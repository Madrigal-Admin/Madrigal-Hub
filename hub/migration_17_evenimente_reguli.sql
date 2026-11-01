-- =========================================================================
-- HUB — Migrarea 17: Evenimente native (pasul 2 din 2, ADITIV)
-- Rulează DUPĂ migrarea 16 și ÎNAINTE de a încărca noua versiune a codului.
-- Poate fi rulată din nou fără probleme. Nu șterge nicio dată.
--
-- Ce face:
--  1. Câmpul "organizator" (curat) — copiat din vechiul "responsabil",
--     fără numele de test din ClickUp.
--  2. "Implicare" devine o alegere dintr-o listă (Organizator/Partener/Invitat).
--  3. Funcția care salvează un eveniment dintr-un singur pas (tipuri + PM).
--  4. Tipurile noi apar automat și în configurarea din Rapoarte.
--  5. Regulile pentru evenimentul ANULAT: fără RSVP/costume, fără raport
--     post-eveniment, invitațiile existente rămân înghețate (istoric).
-- =========================================================================
begin;

-- 1. Organizator
alter table public.evenimente add column if not exists organizator text;

update public.evenimente
set organizator = nullif(trim(responsabil), '')
where organizator is null
  and responsabil is not null
  and trim(responsabil) not in ('-', 'Diana Raluca Niculae', 'Catalin Andrei Niculae', 'Nicoleta Dan');

-- 2. Implicare: doar valorile cunoscute (sau necompletat)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evenimente_implicare_check') then
    alter table public.evenimente
      add constraint evenimente_implicare_check
      check (implicare is null or implicare in ('Organizator', 'Partener', 'Invitat'));
  end if;
end $$;

-- 3. Tipurile din etichete (din nou, în caz că între timp au apărut evenimente noi)
insert into public.eveniment_tipuri (eveniment_id, tip_cod)
select distinct e.id, t.cod
from public.evenimente e
cross join lateral unnest(e.tags) as tg(tag)
join public.tipuri_eveniment t on lower(trim(tg.tag)) = lower(t.nume)
on conflict do nothing;

-- 4. Salvarea unui eveniment dintr-un singur pas. Drepturile rămân cele din
--    politicile tabelelor (doar adminii de calendar pot salva).
create or replace function public.eveniment_salveaza(
  p_id uuid, p_ev jsonb, p_tipuri text[], p_pm uuid[]
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_data date := (p_ev->>'data')::date;
  v_sfarsit date := coalesce(nullif(p_ev->>'data_sfarsit', '')::date, (p_ev->>'data')::date);
begin
  if nullif(trim(coalesce(p_ev->>'nume', '')), '') is null then
    raise exception 'Evenimentul are nevoie de un nume.';
  end if;
  if v_data is null then
    raise exception 'Evenimentul are nevoie de o dată de început.';
  end if;
  if v_sfarsit < v_data then
    raise exception 'Data de sfârșit nu poate fi înaintea celei de început.';
  end if;

  if v_id is null then
    insert into public.evenimente (
      nume, data, data_sfarsit, ora_inceput, ora_sfarsit, status, locatie, localitate,
      organizator, implicare, bilete, necesita_rsvp, necesita_costume
    ) values (
      trim(p_ev->>'nume'), v_data, v_sfarsit,
      nullif(p_ev->>'ora_inceput', ''), nullif(p_ev->>'ora_sfarsit', ''),
      coalesce(nullif(p_ev->>'status', ''), 'deschis'),
      nullif(trim(coalesce(p_ev->>'locatie', '')), ''), nullif(trim(coalesce(p_ev->>'localitate', '')), ''),
      nullif(trim(coalesce(p_ev->>'organizator', '')), ''), nullif(p_ev->>'implicare', ''),
      (p_ev->>'bilete')::boolean,
      coalesce((p_ev->>'necesita_rsvp')::boolean, false), coalesce((p_ev->>'necesita_costume')::boolean, false)
    ) returning id into v_id;
  else
    update public.evenimente set
      nume = trim(p_ev->>'nume'), data = v_data, data_sfarsit = v_sfarsit,
      ora_inceput = nullif(p_ev->>'ora_inceput', ''), ora_sfarsit = nullif(p_ev->>'ora_sfarsit', ''),
      status = coalesce(nullif(p_ev->>'status', ''), status),
      locatie = nullif(trim(coalesce(p_ev->>'locatie', '')), ''),
      localitate = nullif(trim(coalesce(p_ev->>'localitate', '')), ''),
      organizator = nullif(trim(coalesce(p_ev->>'organizator', '')), ''),
      implicare = nullif(p_ev->>'implicare', ''),
      bilete = (p_ev->>'bilete')::boolean,
      necesita_rsvp = coalesce((p_ev->>'necesita_rsvp')::boolean, false),
      necesita_costume = coalesce((p_ev->>'necesita_costume')::boolean, false)
    where id = v_id;
    if not found then
      raise exception 'Nu ai dreptul să modifici acest eveniment sau nu mai există.';
    end if;
  end if;

  delete from public.eveniment_tipuri where eveniment_id = v_id and tip_cod <> all (coalesce(p_tipuri, '{}'));
  insert into public.eveniment_tipuri (eveniment_id, tip_cod)
    select v_id, x from unnest(coalesce(p_tipuri, '{}')) x on conflict do nothing;

  delete from public.eveniment_pm where eveniment_id = v_id and angajat_id <> all (coalesce(p_pm, '{}'));
  insert into public.eveniment_pm (eveniment_id, angajat_id)
    select v_id, x from unnest(coalesce(p_pm, '{}')) x on conflict do nothing;

  return v_id;
end $$;
revoke all on function public.eveniment_salveaza(uuid, jsonb, text[], uuid[]) from public, anon;
grant execute on function public.eveniment_salveaza(uuid, jsonb, text[], uuid[]) to authenticated;

-- 5. Un tip nou din Calendar primește automat rândul de configurare din Rapoarte
create or replace function public.tipuri_eveniment_rand_rapoarte()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.rap_tipuri (cod, nume, ordine, activ)
  values (new.cod, new.nume, new.ordine, new.activ)
  on conflict (cod) do nothing;
  return new;
end $$;
revoke all on function public.tipuri_eveniment_rand_rapoarte() from public, anon, authenticated;

drop trigger if exists tipuri_eveniment_rand_rapoarte_trg on public.tipuri_eveniment;
create trigger tipuri_eveniment_rand_rapoarte_trg
  after insert on public.tipuri_eveniment
  for each row execute function public.tipuri_eveniment_rand_rapoarte();

insert into public.rap_tipuri (cod, nume, ordine, activ)
select cod, nume, ordine, activ from public.tipuri_eveniment
on conflict (cod) do nothing;

-- 6. Evenimentul ANULAT
--    a) nu are RSVP/costume; nu poate fi anulat dacă are raport post-eveniment
create or replace function public.evenimente_regula_anulat()
returns trigger language plpgsql
as $$
declare comp text;
begin
  select comportament into comp from public.statusuri_eveniment where cod = new.status;
  if comp = 'anulat' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status
       and exists (select 1 from public.rap_postev where eveniment_id = new.id) then
      raise exception 'Evenimentul „%” are un raport post-eveniment și nu poate fi anulat. Șterge mai întâi raportul din Rapoarte.', new.nume;
    end if;
    new.necesita_rsvp := false;
    new.necesita_costume := false;
  end if;
  return new;
end $$;

drop trigger if exists evenimente_regula_anulat_trg on public.evenimente;
create trigger evenimente_regula_anulat_trg
  before insert or update on public.evenimente
  for each row execute function public.evenimente_regula_anulat();

--    b) evenimentele deja anulate: scoase din Invitații/Costume (invitațiile rămân, înghețate)
update public.evenimente e
set necesita_rsvp = false, necesita_costume = false
where (necesita_rsvp or necesita_costume)
  and exists (select 1 from public.statusuri_eveniment s where s.cod = e.status and s.comportament = 'anulat');

--    c) un eveniment anulat nu primește rapoarte post-eveniment
create or replace function public.rap_postev_refuza_anulat()
returns trigger language plpgsql
as $$
begin
  if new.eveniment_id is not null and exists (
    select 1 from public.evenimente e
    join public.statusuri_eveniment s on s.cod = e.status
    where e.id = new.eveniment_id and s.comportament = 'anulat'
  ) then
    raise exception 'Evenimentul este anulat și nu poate avea raport post-eveniment.';
  end if;
  return new;
end $$;

drop trigger if exists rap_postev_refuza_anulat_trg on public.rap_postev;
create trigger rap_postev_refuza_anulat_trg
  before insert on public.rap_postev
  for each row execute function public.rap_postev_refuza_anulat();

--    d) invitațiile unui eveniment anulat sunt înghețate: nu mai primesc răspunsuri
create or replace function public.invitatii_inghetate_la_anulare()
returns trigger language plpgsql
as $$
begin
  if (new.status_rsvp is distinct from old.status_rsvp or new.prezent is distinct from old.prezent) and exists (
    select 1 from public.evenimente e
    join public.statusuri_eveniment s on s.cod = e.status
    where e.id = new.eveniment_id and s.comportament = 'anulat'
  ) then
    raise exception 'Evenimentul a fost anulat; invitația nu mai poate primi răspuns.';
  end if;
  return new;
end $$;

drop trigger if exists invitatii_inghetate_la_anulare_trg on public.invitatii;
create trigger invitatii_inghetate_la_anulare_trg
  before update on public.invitatii
  for each row execute function public.invitatii_inghetate_la_anulare();

-- Raport: ce a rămas (așteptat: organizator completat la ~65-70 de evenimente)
do $$
declare cu_org int; fara_org int;
begin
  select count(*) filter (where organizator is not null), count(*) filter (where organizator is null)
  into cu_org, fara_org from public.evenimente;
  raise notice 'Evenimente cu organizator: %, fără organizator: %', cu_org, fara_org;
end $$;

commit;
