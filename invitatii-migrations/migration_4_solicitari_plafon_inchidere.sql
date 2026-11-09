-- =========================================================================
-- Invitații — Migrare 4: solicitări angajați, plafon, închidere eveniment,
--                         categorii editabile, limite per angajat
-- Rulează o singură dată în Supabase → SQL Editor (proiectul unic).
-- ÎNAINTE: fă backup (Database → Backups) — baza conține date reale.
-- Idempotentă: poate fi rulată din nou fără efect negativ.
--
-- Ce face:
--  A. Copii de siguranță ale tabelelor care se restructurează (cereri_invitati, invitatii)
--  B. Categorii de invitați editabile (tabel nou) — „Prieteni/Familie" devine arhivată
--  C. Limite: standard + excepții per angajat
--  D. Coloane noi pe eveniment (solicitări deschise, plafon, invitația, închidere)
--  E. Restructurarea cererilor și a invitațiilor angajaților
--  F. Funcții (RPC) pentru angajați, aprobări și statistici — drepturile se aplică în baza de date
--  G. Închiderea evenimentului: blochează răspunsurile RSVP și check-in-ul
--  H. Fișierele invitației (bucket nou) + eliminarea paginii publice de nominalizare
-- =========================================================================

begin;

-- -------------------------------------------------------------------------
-- A. Copii de siguranță (rămân în baza de date; poți șterge tabelele după ce ai verificat totul)
-- -------------------------------------------------------------------------
create table if not exists public.backup_invitatii_cereri_pre_m4 as table public.cereri_invitati;
create table if not exists public.backup_invitatii_invitatii_pre_m4 as table public.invitatii;
alter table public.backup_invitatii_cereri_pre_m4 enable row level security;
alter table public.backup_invitatii_invitatii_pre_m4 enable row level security;
-- fără politici și fără grant-uri pentru authenticated: accesibile doar din SQL Editor / service_role
revoke all on public.backup_invitatii_cereri_pre_m4 from anon, authenticated;
revoke all on public.backup_invitatii_invitatii_pre_m4 from anon, authenticated;

-- Coloana „trimis_la" este folosită de trimiterea prin Brevo; ne asigurăm că există
alter table public.invitatii add column if not exists trimis_la timestamptz;

-- -------------------------------------------------------------------------
-- B. Categorii de invitați editabile
-- -------------------------------------------------------------------------
create table if not exists public.invitatii_categorii (
  id uuid primary key default gen_random_uuid(),
  nume text not null unique check (length(trim(nume)) > 0),
  arhivata boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.invitatii_categorii enable row level security;
revoke all on public.invitatii_categorii from anon;
grant select, insert, update, delete on public.invitatii_categorii to authenticated, service_role;
drop policy if exists invitatii_categorii_admin on public.invitatii_categorii;
create policy invitatii_categorii_admin on public.invitatii_categorii for all
  using (public.is_invitatii_admin()) with check (public.is_invitatii_admin());

-- Categoriile existente (cele patru standard + orice altă valoare din persoane)
insert into public.invitatii_categorii (nume)
select v from (values ('Autoritate Publică'), ('Sponsor'), ('Colaborator'), ('Presă')) t(v)
on conflict (nume) do nothing;

insert into public.invitatii_categorii (nume)
select distinct categorie from public.persoane
where categorie is not null and trim(categorie) <> ''
on conflict (nume) do nothing;

-- „Prieteni/Familie" nu se mai oferă (invitații angajaților intră prin solicitări)
insert into public.invitatii_categorii (nume, arhivata) values ('Prieteni/Familie', true)
on conflict (nume) do update set arhivata = true;

-- Valorile goale devin „fără categorie" (null), ca legătura să fie validă
update public.persoane set categorie = null where categorie is not null and trim(categorie) = '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'persoane_categorie_fkey') then
    alter table public.persoane
      add constraint persoane_categorie_fkey foreign key (categorie)
      references public.invitatii_categorii(nume) on update cascade on delete restrict;
  end if;
end $$;

-- -------------------------------------------------------------------------
-- C. Limite per angajat
-- -------------------------------------------------------------------------
create table if not exists public.invitatii_setari (
  id boolean primary key default true check (id),
  limita_standard integer not null default 2 check (limita_standard >= 0)
);
insert into public.invitatii_setari (id) values (true) on conflict do nothing;

create table if not exists public.invitatii_limite_exceptii (
  angajat_id uuid primary key references public.angajati(id) on delete cascade,
  limita integer not null check (limita >= 0)
);

alter table public.invitatii_setari enable row level security;
alter table public.invitatii_limite_exceptii enable row level security;
revoke all on public.invitatii_setari, public.invitatii_limite_exceptii from anon;
grant select, insert, update, delete on public.invitatii_setari to authenticated, service_role;
grant select, insert, update, delete on public.invitatii_limite_exceptii to authenticated, service_role;
drop policy if exists invitatii_setari_admin on public.invitatii_setari;
create policy invitatii_setari_admin on public.invitatii_setari for all
  using (public.is_invitatii_admin()) with check (public.is_invitatii_admin());
drop policy if exists invitatii_limite_exceptii_admin on public.invitatii_limite_exceptii;
create policy invitatii_limite_exceptii_admin on public.invitatii_limite_exceptii for all
  using (public.is_invitatii_admin()) with check (public.is_invitatii_admin());

-- -------------------------------------------------------------------------
-- D. Coloane noi pe eveniment
-- -------------------------------------------------------------------------
alter table public.invitatii_profil_eveniment
  add column if not exists solicitari_deschise boolean not null default false,
  add column if not exists plafon integer check (plafon is null or plafon > 0),
  add column if not exists invitatie_fisier_url text,
  add column if not exists invitatie_fisier_nume text,
  add column if not exists invitatie_link text,
  add column if not exists inchis_la timestamptz;

-- -------------------------------------------------------------------------
-- E. Cereri și invitați ai angajaților
-- -------------------------------------------------------------------------
alter table public.cereri_invitati
  add column if not exists angajat_id uuid references public.angajati(id) on delete set null,
  add column if not exists decis_la timestamptz;

-- elementele din „invitati" devin {nume, email}; cele vechi (text) se convertesc
update public.cereri_invitati
set invitati = (
  select coalesce(jsonb_agg(
    case when jsonb_typeof(x) = 'string' then jsonb_build_object('nume', x #>> '{}', 'email', null::text) else x end
  ), '[]'::jsonb)
  from jsonb_array_elements(invitati) as t(x)
)
where exists (select 1 from jsonb_array_elements(invitati) as t(x) where jsonb_typeof(x) = 'string');

alter table public.cereri_invitati drop column if exists solicitant_functie;
alter table public.cereri_invitati drop constraint if exists cereri_invitati_status_check;
alter table public.cereri_invitati
  add constraint cereri_invitati_status_check check (status in ('in_asteptare', 'aprobata', 'refuzata'));
alter table public.cereri_invitati alter column solicitant_nume set not null;

alter table public.invitatii add column if not exists email_invitat text;
alter table public.invitatii drop constraint if exists invitatii_sursa_check;
update public.invitatii set sursa = 'solicitare' where sursa = 'nominalizare';
alter table public.invitatii
  add constraint invitatii_sursa_check check (sursa in ('trimitere', 'solicitare'));

-- Angajatul își vede propriile cereri (scrierea se face doar prin funcțiile de mai jos)
drop policy if exists cereri_invitati_select on public.cereri_invitati;
create policy cereri_invitati_select on public.cereri_invitati for select
  using (public.is_invitatii_admin() or angajat_id = public.current_angajat_id());
drop policy if exists cereri_invitati_write on public.cereri_invitati;
-- (nu există politică de scriere: aprobarea/refuzul trec prin solicitare_decide)
revoke insert, update, delete on public.cereri_invitati from authenticated;
revoke truncate, references, trigger on public.cereri_invitati from authenticated;
revoke all on public.cereri_invitati from anon;
grant select on public.cereri_invitati to authenticated;
grant select, insert, update, delete on public.cereri_invitati to service_role;

-- -------------------------------------------------------------------------
-- F. Funcții
-- -------------------------------------------------------------------------

-- Limita unui angajat: excepția lui sau limita standard
create or replace function public._invitatii_limita(p_angajat uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(
    (select limita from public.invitatii_limite_exceptii where angajat_id = p_angajat),
    (select limita_standard from public.invitatii_setari limit 1),
    2);
$$;

-- Câți invitați are deja angajatul la eveniment (cererile în așteptare se numără; cele refuzate nu)
create or replace function public._invitatii_folosite(p_angajat uuid, p_eveniment uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(jsonb_array_length(invitati)), 0)::int
  from public.cereri_invitati
  where angajat_id = p_angajat and eveniment_id = p_eveniment and status in ('in_asteptare', 'aprobata');
$$;

-- Locurile ocupate la un eveniment
create or replace function public._invitatii_locuri(p_eveniment uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'confirmati', (select count(*) from public.invitatii where eveniment_id = p_eveniment and sursa = 'trimitere' and status_rsvp = 'confirmat'),
    'aprobati', (select count(*) from public.invitatii where eveniment_id = p_eveniment and sursa = 'solicitare'),
    'in_asteptare', (select coalesce(sum(jsonb_array_length(invitati)), 0) from public.cereri_invitati where eveniment_id = p_eveniment and status = 'in_asteptare'),
    'plafon', (select plafon from public.invitatii_profil_eveniment where eveniment_id = p_eveniment)
  );
$$;

revoke all on function public._invitatii_limita(uuid), public._invitatii_folosite(uuid, uuid), public._invitatii_locuri(uuid) from public, anon, authenticated;

-- Locurile unui eveniment, pentru admin
create or replace function public.invitatii_locuri(p_eveniment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_invitatii_admin() then raise exception 'acces_interzis'; end if;
  return public._invitatii_locuri(p_eveniment_id);
end $$;

-- Statistici per eveniment (carduri + Dashboard). „prezenti” = toți cei intrați; „prezenti_lista” = doar din lista fixă
drop function if exists public.invitatii_statistici();
create or replace function public.invitatii_statistici()
returns table (
  eveniment_id uuid, invitati integer, trimise integer, confirmati integer, refuzati integer,
  prezenti integer, prezenti_lista integer, aprobati_angajati integer, in_asteptare integer, plafon integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_invitatii_admin() then raise exception 'acces_interzis'; end if;
  return query
  select e.id,
    (count(i.id) filter (where i.sursa = 'trimitere'))::int,
    (count(i.id) filter (where i.sursa = 'trimitere' and i.trimis_la is not null))::int,
    (count(i.id) filter (where i.sursa = 'trimitere' and i.status_rsvp = 'confirmat'))::int,
    (count(i.id) filter (where i.sursa = 'trimitere' and i.status_rsvp = 'refuzat'))::int,
    (count(i.id) filter (where i.prezent))::int,
    (count(i.id) filter (where i.prezent and i.sursa = 'trimitere'))::int,
    (count(i.id) filter (where i.sursa = 'solicitare'))::int,
    (select coalesce(sum(jsonb_array_length(c.invitati)), 0)::int from public.cereri_invitati c
       where c.eveniment_id = e.id and c.status = 'in_asteptare'),
    p.plafon
  from public.evenimente e
  left join public.invitatii i on i.eveniment_id = e.id
  left join public.invitatii_profil_eveniment p on p.eveniment_id = e.id
  where e.necesita_rsvp or exists (select 1 from public.invitatii x where x.eveniment_id = e.id)
  group by e.id, p.plafon;
end $$;

-- Lista cererilor pentru admin (cu numele solicitantului și limita lui)
create or replace function public.solicitari_admin(p_eveniment_id uuid)
returns table (
  cerere_id uuid, solicitant text, conducere boolean, status text, data_cerere timestamptz,
  invitati jsonb, folosite integer, limita integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_invitatii_admin() then raise exception 'acces_interzis'; end if;
  return query
  select c.id, coalesce(a.nume_complet, c.solicitant_nume),
    exists (select 1 from public.invitatii_limite_exceptii x where x.angajat_id = c.angajat_id),
    c.status, c.data_cerere, c.invitati,
    case when c.angajat_id is null then 0 else public._invitatii_folosite(c.angajat_id, c.eveniment_id) end,
    case when c.angajat_id is null then 0 else public._invitatii_limita(c.angajat_id) end
  from public.cereri_invitati c
  left join public.angajati a on a.id = c.angajat_id
  where c.eveniment_id = p_eveniment_id
  order by c.data_cerere desc;
end $$;

-- Evenimentele deschise pentru solicitări, pentru angajatul curent
create or replace function public.solicitari_evenimente_disponibile()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ang uuid := public.current_angajat_id();
begin
  if v_ang is null then raise exception 'neautentificat'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'nume', e.nume, 'data', e.data, 'ora_inceput', e.ora_inceput,
      'ora_sfarsit', e.ora_sfarsit, 'locatie', e.locatie,
      'folosite', public._invitatii_folosite(v_ang, e.id),
      'limita', public._invitatii_limita(v_ang),
      'plafon_atins', coalesce(
        (l->>'plafon') is not null
        and ((l->>'confirmati')::int + (l->>'aprobati')::int + (l->>'in_asteptare')::int) >= (l->>'plafon')::int, false)
    ) order by e.data)
    from public.evenimente e
    join public.invitatii_profil_eveniment p on p.eveniment_id = e.id
    left join public.statusuri_eveniment s on s.cod = e.status
    cross join lateral (select public._invitatii_locuri(e.id) as l) loc
    where e.necesita_rsvp and p.solicitari_deschise and p.inchis_la is null
      and coalesce(s.comportament, '') <> 'anulat'
      and (e.data is null or e.data >= current_date)
  ), '[]'::jsonb);
end $$;

-- Cererile angajatului curent (fișierul/linkul invitației apar doar după aprobare)
create or replace function public.solicitari_ale_mele()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_ang uuid := public.current_angajat_id();
begin
  if v_ang is null then raise exception 'neautentificat'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'eveniment_id', c.eveniment_id, 'eveniment_nume', e.nume, 'status', c.status,
      'data_cerere', c.data_cerere, 'invitati', c.invitati,
      'fisier_url', case when c.status = 'aprobata' then p.invitatie_fisier_url end,
      'fisier_nume', case when c.status = 'aprobata' then p.invitatie_fisier_nume end,
      'link', case when c.status = 'aprobata' then p.invitatie_link end
    ) order by c.data_cerere desc)
    from public.cereri_invitati c
    join public.evenimente e on e.id = c.eveniment_id
    left join public.invitatii_profil_eveniment p on p.eveniment_id = c.eveniment_id
    where c.angajat_id = v_ang
  ), '[]'::jsonb);
end $$;

-- Cerere nouă de invitați (angajat autentificat)
create or replace function public.solicitare_creeaza(p_eveniment_id uuid, p_invitati jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ang uuid := public.current_angajat_id();
  v_nume text;
  v_lista jsonb;
  v_n int;
  v_loc jsonb;
begin
  if v_ang is null then raise exception 'neautentificat'; end if;
  perform pg_advisory_xact_lock(hashtext(p_eveniment_id::text));

  select nume_complet into v_nume from public.angajati where id = v_ang;

  if not exists (
    select 1 from public.evenimente e
    join public.invitatii_profil_eveniment p on p.eveniment_id = e.id
    left join public.statusuri_eveniment s on s.cod = e.status
    where e.id = p_eveniment_id and e.necesita_rsvp and p.solicitari_deschise and p.inchis_la is null
      and coalesce(s.comportament, '') <> 'anulat' and (e.data is null or e.data >= current_date)
  ) then raise exception 'eveniment_indisponibil'; end if;

  if jsonb_typeof(coalesce(p_invitati, 'null'::jsonb)) <> 'array' then raise exception 'fara_invitati'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'nume', regexp_replace(trim(x->>'nume'), '\s+', ' ', 'g'),
           'email', lower(trim(x->>'email')))), '[]'::jsonb)
    into v_lista
    from jsonb_array_elements(p_invitati) as t(x)
   where trim(coalesce(x->>'nume', '')) <> '' or trim(coalesce(x->>'email', '')) <> '';

  v_n := jsonb_array_length(v_lista);
  if v_n = 0 then raise exception 'fara_invitati'; end if;
  if exists (
    select 1 from jsonb_array_elements(v_lista) as t(x)
    where (x->>'nume') = '' or length(x->>'nume') > 120
       or (x->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(x->>'email') > 200
  ) then raise exception 'date_invalide'; end if;

  if public._invitatii_folosite(v_ang, p_eveniment_id) + v_n > public._invitatii_limita(v_ang) then
    raise exception 'limita_depasita';
  end if;

  v_loc := public._invitatii_locuri(p_eveniment_id);
  if (v_loc->>'plafon') is not null
     and (v_loc->>'confirmati')::int + (v_loc->>'aprobati')::int + (v_loc->>'in_asteptare')::int + v_n > (v_loc->>'plafon')::int then
    raise exception 'plafon_atins';
  end if;

  insert into public.cereri_invitati (eveniment_id, solicitant_nume, angajat_id, invitati)
  values (p_eveniment_id, coalesce(v_nume, 'Angajat'), v_ang, v_lista);
end $$;

-- Decizia adminului: aproba | refuza | anuleaza (anulează aprobarea)
create or replace function public.solicitare_decide(p_cerere_id uuid, p_decizie text, p_depasire boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.cereri_invitati%rowtype;
  v_loc jsonb;
  v_ocupate int;
begin
  if not public.is_invitatii_admin() then raise exception 'acces_interzis'; end if;
  if p_decizie not in ('aproba', 'refuza', 'anuleaza') then raise exception 'decizie_invalida'; end if;

  select * into c from public.cereri_invitati where id = p_cerere_id for update;
  if not found then raise exception 'cerere_negasita'; end if;
  perform pg_advisory_xact_lock(hashtext(c.eveniment_id::text));

  if exists (select 1 from public.invitatii_profil_eveniment where eveniment_id = c.eveniment_id and inchis_la is not null)
     or exists (select 1 from public.evenimente e join public.statusuri_eveniment s on s.cod = e.status
                where e.id = c.eveniment_id and s.comportament = 'anulat') then
    raise exception 'eveniment_inchis';
  end if;

  if p_decizie = 'aproba' then
    if c.status <> 'in_asteptare' then raise exception 'stare_invalida'; end if;
    v_loc := public._invitatii_locuri(c.eveniment_id);
    v_ocupate := (v_loc->>'confirmati')::int + (v_loc->>'aprobati')::int + (v_loc->>'in_asteptare')::int;
    if (v_loc->>'plafon') is not null and v_ocupate > (v_loc->>'plafon')::int and not p_depasire then
      raise exception 'plafon_depasit';
    end if;
    insert into public.invitatii (eveniment_id, nume_complet_invitat, email_invitat, sursa, cerere_id, status_rsvp, data_rsvp)
    select c.eveniment_id, x->>'nume', x->>'email', 'solicitare', c.id, 'confirmat', now()
    from jsonb_array_elements(c.invitati) as t(x);
    update public.cereri_invitati set status = 'aprobata', decis_la = now() where id = c.id;

  elsif p_decizie = 'refuza' then
    if c.status <> 'in_asteptare' then raise exception 'stare_invalida'; end if;
    update public.cereri_invitati set status = 'refuzata', decis_la = now() where id = c.id;

  else -- anuleaza
    if c.status <> 'aprobata' then raise exception 'stare_invalida'; end if;
    if exists (select 1 from public.invitatii where cerere_id = c.id and prezent) then
      raise exception 'deja_prezent';
    end if;
    delete from public.invitatii where cerere_id = c.id;
    update public.cereri_invitati set status = 'in_asteptare', decis_la = null where id = c.id;
  end if;
end $$;

-- Lista de check-in (rolul „Verificare la intrare” nu are acces la tabelul `persoane`, deci o primește prin această funcție;
-- nu include adrese de email)
create or replace function public.checkin_invitati(p_eveniment_id uuid)
returns table (id uuid, nume text, categorie text, status_rsvp text, prezent boolean, sursa text, solicitant text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_invitatii_checkin() then raise exception 'acces_interzis'; end if;
  return query
  select i.id, coalesce(p.prenume || ' ' || p.nume, i.nume_complet_invitat), p.categorie,
         i.status_rsvp, i.prezent, i.sursa, c.solicitant_nume
  from public.invitatii i
  left join public.persoane p on p.id = i.persoana_id
  left join public.cereri_invitati c on c.id = i.cerere_id
  where i.eveniment_id = p_eveniment_id;
end $$;

revoke all on function public.invitatii_locuri(uuid), public.invitatii_statistici(), public.solicitari_admin(uuid),
  public.solicitari_evenimente_disponibile(), public.solicitari_ale_mele(),
  public.solicitare_creeaza(uuid, jsonb), public.solicitare_decide(uuid, text, boolean), public.checkin_invitati(uuid) from public, anon;
grant execute on function public.checkin_invitati(uuid), public.invitatii_locuri(uuid), public.invitatii_statistici(), public.solicitari_admin(uuid),
  public.solicitari_evenimente_disponibile(), public.solicitari_ale_mele(),
  public.solicitare_creeaza(uuid, jsonb), public.solicitare_decide(uuid, text, boolean) to authenticated;

-- -------------------------------------------------------------------------
-- G. Evenimentul ÎNCHIS: fără răspunsuri RSVP și fără check-in
-- -------------------------------------------------------------------------
create or replace function public.invitatii_inghetate_la_anulare()
returns trigger language plpgsql as $$
begin
  if (new.status_rsvp is distinct from old.status_rsvp or new.prezent is distinct from old.prezent) then
    if exists (
      select 1 from public.evenimente e
      join public.statusuri_eveniment s on s.cod = e.status
      where e.id = new.eveniment_id and s.comportament = 'anulat'
    ) then
      raise exception 'Evenimentul a fost anulat; invitația nu mai poate primi răspuns.';
    end if;
    if exists (
      select 1 from public.invitatii_profil_eveniment p
      where p.eveniment_id = new.eveniment_id and p.inchis_la is not null
    ) then
      raise exception 'Evenimentul este închis; invitația nu mai poate fi modificată.';
    end if;
  end if;
  return new;
end $$;

revoke all on function public.invitatii_inghetate_la_anulare() from public, anon, authenticated;

-- Pagina publică RSVP: câmpuri noi (închis + date pentru personalizare)
drop function if exists public.rsvp_get_info(uuid);
create function public.rsvp_get_info(p_token uuid)
returns table(nume_eveniment text, data date, locatie text, nume_invitat text, status_rsvp text,
              afis_url text, mesaj_intro text, anulat boolean, inchis boolean,
              prenume text, nume_familie text, institutie text, functie text)
language sql stable security definer set search_path = public
as $$
  select
    e.nume, e.data, e.locatie,
    coalesce(p.prenume || ' ' || p.nume, i.nume_complet_invitat),
    i.status_rsvp, ipe.afis_url, ipe.mesaj_intro,
    coalesce(s.comportament = 'anulat', false),
    (ipe.inchis_la is not null),
    p.prenume, p.nume, p.institutie, p.functie
  from public.invitatii i
  join public.evenimente e on e.id = i.eveniment_id
  left join public.statusuri_eveniment s on s.cod = e.status
  left join public.persoane p on p.id = i.persoana_id
  left join public.invitatii_profil_eveniment ipe on ipe.eveniment_id = e.id
  where i.token = p_token and i.sursa = 'trimitere';
$$;
revoke all on function public.rsvp_get_info(uuid) from public;
grant execute on function public.rsvp_get_info(uuid) to anon, authenticated;

create or replace function public.rsvp_raspunde(p_token uuid, p_raspuns text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if p_raspuns not in ('confirmat', 'refuzat') then
    raise exception 'Răspuns invalid.';
  end if;
  if exists (
    select 1 from public.invitatii i
    join public.evenimente e on e.id = i.eveniment_id
    join public.statusuri_eveniment s on s.cod = e.status
    where i.token = p_token and s.comportament = 'anulat'
  ) then
    raise exception 'eveniment_anulat';
  end if;
  if exists (
    select 1 from public.invitatii i
    join public.invitatii_profil_eveniment p on p.eveniment_id = i.eveniment_id
    where i.token = p_token and p.inchis_la is not null
  ) then
    raise exception 'eveniment_inchis';
  end if;
  update public.invitatii
  set status_rsvp = p_raspuns, data_rsvp = now()
  where token = p_token and sursa = 'trimitere';
end $$;
revoke all on function public.rsvp_raspunde(uuid, text) from public;
grant execute on function public.rsvp_raspunde(uuid, text) to anon, authenticated;

-- -------------------------------------------------------------------------
-- H. Fișierele invitației + eliminarea nominalizării publice
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invitatii-fisiere', 'invitatii-fisiere', true, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

drop policy if exists invitatii_fisiere_insert on storage.objects;
create policy invitatii_fisiere_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'invitatii-fisiere' and public.is_invitatii_admin());
drop policy if exists invitatii_fisiere_update on storage.objects;
create policy invitatii_fisiere_update on storage.objects for update to authenticated
  using (bucket_id = 'invitatii-fisiere' and public.is_invitatii_admin());
drop policy if exists invitatii_fisiere_delete on storage.objects;
create policy invitatii_fisiere_delete on storage.objects for delete to authenticated
  using (bucket_id = 'invitatii-fisiere' and public.is_invitatii_admin());

-- Funcțiile publice de nominalizare dispar (indiferent de semnătură)
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('nominalizare_creeaza', 'nominalizare_evenimente_disponibile')
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;

commit;

-- Verificare (opțional) — trebuie să întoarcă 0 rânduri:
-- select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'nominalizare%';
