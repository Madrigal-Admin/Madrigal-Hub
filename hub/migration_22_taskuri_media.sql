-- =========================================================================
-- Migrarea 22 — Taskuri: tipul „Solicitare" (Media · Design grafic / Foto-video)
-- ADAUGĂ: 4 tabele noi (destinații, membri, categorii, șabloane de câmpuri), 4 coloane noi pe
-- tsk_taskuri, reguli și triggere noi. NU șterge și NU modifică niciun task existent.
-- Taskurile de acum (eveniment / operațional) rămân exact cum sunt.
-- Face și o copie de siguranță: tabelul backup_tsk_taskuri_pre_media.
-- Se poate rula de mai multe ori fără probleme.
-- =========================================================================

-- 0. Copie de siguranță (o singură dată) --------------------------------------------------------
create table if not exists public.backup_tsk_taskuri_pre_media as select * from public.tsk_taskuri;
alter table public.backup_tsk_taskuri_pre_media enable row level security;   -- fără politici = nimeni nu o vede din aplicație
revoke all on public.backup_tsk_taskuri_pre_media from anon, authenticated;

-- 1. Tabele noi ---------------------------------------------------------------------------------
create table if not exists public.tsk_destinatii (
  id uuid primary key default gen_random_uuid(),
  cod text not null unique check (cod ~ '^[a-z0-9_]+$'),
  nume text not null check (length(trim(nume)) > 0),
  tip text not null default 'intern' check (tip in ('intern', 'clickup')),
  activ boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tsk_destinatii_membri (
  destinatie_id uuid not null references public.tsk_destinatii(id) on delete cascade,
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  primary key (destinatie_id, angajat_id)
);
create index if not exists tsk_destinatii_membri_angajat_idx on public.tsk_destinatii_membri (angajat_id);

create table if not exists public.tsk_destinatii_categorii (
  id uuid primary key default gen_random_uuid(),
  destinatie_id uuid not null references public.tsk_destinatii(id) on delete cascade,
  cod text not null check (cod ~ '^[a-z0-9_]+$'),
  nume text not null check (length(trim(nume)) > 0),
  activ boolean not null default true,
  ordine integer not null default 0,
  unique (destinatie_id, cod)
);

create table if not exists public.tsk_sabloane_campuri (
  id uuid primary key default gen_random_uuid(),
  categorie_id uuid not null references public.tsk_destinatii_categorii(id) on delete cascade,
  cheie text not null check (cheie ~ '^[a-z0-9_]+$'),
  eticheta text not null check (length(trim(eticheta)) > 0),
  tip text not null check (tip in ('text', 'paragraf', 'numar', 'data', 'ora', 'link', 'lista', 'multi', 'persoana')),
  obligatoriu boolean not null default false,
  ordine integer not null default 0,
  activ boolean not null default true,
  -- pentru 'lista' și 'multi': [{"cod":"afis","eticheta":"Afiș","activ":true}, ...]
  optiuni jsonb not null default '[]'::jsonb check (jsonb_typeof(optiuni) = 'array'),
  ajutor text,
  unique (categorie_id, cheie)
);

-- 2. Coloane noi pe tsk_taskuri (toate opționale) ------------------------------------------------
alter table public.tsk_taskuri add column if not exists destinatie_id uuid references public.tsk_destinatii(id) on delete set null;
alter table public.tsk_taskuri add column if not exists categorie_id uuid references public.tsk_destinatii_categorii(id) on delete set null;
-- perechi {cheie, eticheta, valoare, tip}: păstrate așa cum au fost la trimitere
alter table public.tsk_taskuri add column if not exists date_solicitare jsonb not null default '[]'::jsonb;
alter table public.tsk_taskuri add column if not exists link_livrare text;
alter table public.tsk_taskuri add column if not exists livrat_la timestamptz;
create index if not exists tsk_taskuri_destinatie_idx on public.tsk_taskuri (destinatie_id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tsk_taskuri_link_livrare_check') then
    alter table public.tsk_taskuri add constraint tsk_taskuri_link_livrare_check
      check (link_livrare is null or link_livrare ~* '^https?://\S+$');
  end if;
end $$;

-- tipul nou „solicitare"; la solicitare evenimentul este opțional
alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_tip_check;
alter table public.tsk_taskuri add constraint tsk_taskuri_tip_check check (tip in ('eveniment', 'operational', 'solicitare'));

alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_check;
alter table public.tsk_taskuri add constraint tsk_taskuri_check
  check (tip = 'solicitare' or ((tip = 'eveniment') = (eveniment_id is not null)));

alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_solicitare_check;
alter table public.tsk_taskuri add constraint tsk_taskuri_solicitare_check
  check ((tip = 'solicitare') = (destinatie_id is not null));

-- „Nou / Actualizat" pentru taskurile Media
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.tsk_necitite'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%motiv%' loop
    execute format('alter table public.tsk_necitite drop constraint %I', c);
  end loop;
  alter table public.tsk_necitite add constraint tsk_necitite_motiv_check check (motiv in ('atribuit', 'mentiune', 'actualizat'));
end $$;

-- 3. Funcții de drepturi ---------------------------------------------------------------------------
create or replace function public.tsk_e_membru_destinatie(p_destinatie uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_destinatie is not null and exists (
    select 1 from public.tsk_destinatii_membri m
    where m.destinatie_id = p_destinatie and m.angajat_id = public.current_angajat_id());
$$;

create or replace function public.tsk_e_pm_oarecare() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eveniment_pm p where p.angajat_id = public.current_angajat_id());
$$;

-- Cine poate deschide un task Media: aceleași reguli ca la taskurile normale
create or replace function public.tsk_poate_crea_solicitare() returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_are_acces() and (public.tsk_e_admin() or public.tsk_e_coordonator() or public.tsk_e_pm_oarecare());
$$;

-- Vede taskul Media: cel care l-a deschis, adminii (prin funcția veche), membrii destinației, PM-ul evenimentului legat
create or replace function public.tsk_poate_vedea_solicitare(p_destinatie uuid, p_eveniment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_are_acces() and (
    public.tsk_e_membru_destinatie(p_destinatie)
    or (p_eveniment is not null and public.tsk_e_pm(p_eveniment))
  );
$$;

-- 4. Tabelele noi: RLS + grant-uri ---------------------------------------------------------------------
alter table public.tsk_destinatii enable row level security;
alter table public.tsk_destinatii_membri enable row level security;
alter table public.tsk_destinatii_categorii enable row level security;
alter table public.tsk_sabloane_campuri enable row level security;

do $$
declare t text;
begin
  foreach t in array array['tsk_destinatii', 'tsk_destinatii_membri', 'tsk_destinatii_categorii', 'tsk_sabloane_campuri'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.tsk_are_acces())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all using (public.tsk_e_admin()) with check (public.tsk_e_admin())', t || '_write', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- 5. Politici noi / înlocuite pe tsk_taskuri ---------------------------------------------------------------
drop policy if exists tsk_taskuri_select on public.tsk_taskuri;
create policy tsk_taskuri_select on public.tsk_taskuri for select
  using (
    public.tsk_poate_vedea_row(tip, eveniment_id, grup_id, responsabil_id, creat_de, id)
    or (tip = 'solicitare' and public.tsk_poate_vedea_solicitare(destinatie_id, eveniment_id))
  );

drop policy if exists tsk_taskuri_insert on public.tsk_taskuri;
create policy tsk_taskuri_insert on public.tsk_taskuri for insert
  with check (
    public.tsk_are_acces()
    and creat_de = public.current_angajat_id()
    and (
      public.tsk_e_admin()
      or (tip = 'eveniment' and public.tsk_e_pm(eveniment_id))
      or (tip = 'operational' and grup_id is not null and public.tsk_coordoneaza_grup(grup_id))
      or (tip = 'solicitare' and public.tsk_poate_crea_solicitare())
    )
  );

drop policy if exists tsk_taskuri_update on public.tsk_taskuri;
create policy tsk_taskuri_update on public.tsk_taskuri for update
  using (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de)
         or (tip = 'solicitare' and public.tsk_are_acces() and public.tsk_e_membru_destinatie(destinatie_id)))
  with check (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de)
         or (tip = 'solicitare' and public.tsk_are_acces() and public.tsk_e_membru_destinatie(destinatie_id)));

-- taskurile Media le șterge doar adminul (creatorul le anulează)
drop policy if exists tsk_taskuri_delete on public.tsk_taskuri;
create policy tsk_taskuri_delete on public.tsk_taskuri for delete
  using (case when tip = 'solicitare' then public.tsk_e_admin()
              else public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de) end);

-- 6. Validări (înlocuiește funcția veche, păstrând regulile ei) -----------------------------------------------
create or replace function public.tsk_taskuri_valideaza() returns trigger
language plpgsql security definer set search_path = public as $$
declare comp text; cine uuid := public.current_angajat_id(); membru boolean; adm boolean; activ_d boolean;
begin
  if tg_op = 'UPDATE' then
    if new.tip <> old.tip or new.eveniment_id is distinct from old.eveniment_id or new.creat_de is distinct from old.creat_de then
      raise exception 'Tipul taskului, evenimentul și autorul nu se pot schimba.';
    end if;
  end if;

  -- taskurile unui eveniment anulat sunt înghețate (se pot doar anula)
  if new.tip = 'eveniment' then
    select s.comportament into comp from public.evenimente e
      join public.statusuri_eveniment s on s.cod = e.status where e.id = new.eveniment_id;
    if comp = 'anulat' and not (tg_op = 'UPDATE' and new.status = 'anulat' and new.status is distinct from old.status) then
      raise exception 'Evenimentul este anulat; taskurile lui nu se mai pot crea sau modifica.';
    end if;
  end if;

  -- taskul operațional al unui departament: responsabilul trebuie să fie în departament
  if new.tip = 'operational' and new.grup_id is not null and new.responsabil_id is not null
     and not public.tsk_in_grup(new.grup_id, new.responsabil_id)
     and not public.tsk_e_admin() then
    raise exception 'Responsabilul trebuie să facă parte din departamentul taskului.';
  end if;

  -- taskurile Media (solicitări)
  if new.tip = 'solicitare' then
    if new.responsabil_id is not null or new.grup_id is not null then
      raise exception 'Un task Media nu are responsabil sau departament; îl preia echipa Media.';
    end if;
    if tg_op = 'INSERT' then
      select d.activ into activ_d from public.tsk_destinatii d where d.id = new.destinatie_id;
      if activ_d is distinct from true then
        raise exception 'Destinația aleasă nu este activă.';
      end if;
      if new.termen is null then
        raise exception 'Termenul este obligatoriu la taskurile Media.';
      end if;
      if new.link_livrare is not null then
        raise exception 'Linkul de livrare îl completează echipa Media.';
      end if;
      new.status := 'de_facut';
    elsif cine is not null then
      -- din aplicație: titlul, descrierea, termenul, prioritatea și câmpurile se blochează (le poate schimba doar adminul)
      adm := public.tsk_e_admin();
      membru := public.tsk_e_membru_destinatie(old.destinatie_id);
      if not adm and (
           new.titlu is distinct from old.titlu or new.descriere is distinct from old.descriere
           or new.termen is distinct from old.termen or new.prioritate is distinct from old.prioritate
           or new.destinatie_id is distinct from old.destinatie_id or new.categorie_id is distinct from old.categorie_id
           or new.date_solicitare is distinct from old.date_solicitare or new.tag is distinct from old.tag
           or new.link_document is distinct from old.link_document) then
        raise exception 'După trimitere, taskul Media nu se mai modifică. Cere schimbarea printr-un comentariu.';
      end if;
      if new.link_livrare is distinct from old.link_livrare and not (adm or membru) then
        raise exception 'Linkul de livrare îl completează echipa Media.';
      end if;
      if new.status is distinct from old.status and not (adm or membru) then
        if not (new.status = 'anulat' and old.status in ('de_facut', 'in_lucru')) then
          raise exception 'Poți doar să anulezi un task Media care nu este încă terminat.';
        end if;
      end if;
      if new.link_livrare is distinct from old.link_livrare and new.link_livrare is not null then
        new.livrat_la := now();
      end if;
    end if;
  end if;

  new.updated_at := now();
  if new.status = 'terminat' and (tg_op = 'INSERT' or old.status <> 'terminat') then
    new.terminat_la := now();
  elsif new.status <> 'terminat' then
    new.terminat_la := null;
  end if;
  return new;
end $$;
revoke all on function public.tsk_taskuri_valideaza() from public, anon, authenticated;

-- 7. Schimbarea statusului (RPC) ---------------------------------------------------------------------------------
create or replace function public.tsk_schimba_status(p_task uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tsk_taskuri;
begin
  if p_status not in ('de_facut', 'in_lucru', 'terminat', 'anulat') then
    raise exception 'Status invalid.';
  end if;
  select * into t from public.tsk_taskuri where id = p_task;
  if not found or not public.tsk_are_acces() then
    raise exception 'Taskul nu există sau nu ai acces la el.';
  end if;
  if t.tip = 'solicitare' then
    if not (public.tsk_e_admin() or public.tsk_e_membru_destinatie(t.destinatie_id)
            or (t.creat_de = public.current_angajat_id() and p_status = 'anulat' and t.status in ('de_facut', 'in_lucru'))) then
      raise exception 'Nu poți schimba statusul acestui task Media.';
    end if;
  else
    if not (public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de)
            or t.responsabil_id = public.current_angajat_id()
            or public.tsk_e_colaborator(t.id)) then
      raise exception 'Nu poți schimba statusul acestui task.';
    end if;
    if p_status = 'anulat' and not public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de) then
      raise exception 'Doar cine a creat taskul sau coordonatorul lui îl poate anula.';
    end if;
  end if;
  update public.tsk_taskuri set status = p_status where id = p_task;
end $$;

-- 8. Evenimente: taskurile Media NU blochează finalizarea ---------------------------------------------------------
create or replace function public.evenimente_regula_taskuri_finalizat() returns trigger
language plpgsql security definer set search_path = public as $$
declare comp text; nr integer; exemple text;
begin
  select comportament into comp from public.statusuri_eveniment where cod = new.status;
  if comp = 'finalizat' and new.status is distinct from old.status then
    select count(*), string_agg(titlu, '; ' order by created_at) filter (where rn <= 5)
    into nr, exemple
    from (select titlu, created_at, row_number() over (order by created_at) rn
          from public.tsk_taskuri
          where eveniment_id = new.id and tip <> 'solicitare' and status in ('de_facut', 'in_lucru')) x;
    if nr > 0 then
      raise exception 'Evenimentul „%” nu poate fi finalizat: mai are % taskuri nefinalizate (de ex.: %).', new.nume, nr, exemple;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.evenimente_regula_taskuri_finalizat() from public, anon, authenticated;

-- 9. Notificări („Nou" / „Actualizat") + comentariu automat la anulare ---------------------------------------------
create or replace function public.tsk_solicitare_nou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.tip = 'solicitare' then
    insert into public.tsk_necitite (task_id, angajat_id, motiv)
      select new.id, m.angajat_id, 'atribuit' from public.tsk_destinatii_membri m
      where m.destinatie_id = new.destinatie_id and m.angajat_id is distinct from new.creat_de
      on conflict (task_id, angajat_id) do nothing;
  end if;
  return null;
end $$;
revoke all on function public.tsk_solicitare_nou() from public, anon, authenticated;
drop trigger if exists tsk_solicitare_nou_trg on public.tsk_taskuri;
create trigger tsk_solicitare_nou_trg after insert on public.tsk_taskuri
  for each row execute function public.tsk_solicitare_nou();

create or replace function public.tsk_solicitare_actualizat() returns trigger
language plpgsql security definer set search_path = public as $$
declare cine uuid := public.current_angajat_id(); nume text;
begin
  if new.tip <> 'solicitare' then return null; end if;
  if new.status is distinct from old.status or new.link_livrare is distinct from old.link_livrare then
    -- cel care a deschis taskul află de schimbările făcute de alții
    if new.creat_de is not null and new.creat_de is distinct from cine then
      insert into public.tsk_necitite (task_id, angajat_id, motiv) values (new.id, new.creat_de, 'actualizat')
        on conflict (task_id, angajat_id) do update set created_at = now(),
          motiv = case when tsk_necitite.motiv in ('atribuit', 'mentiune') then tsk_necitite.motiv else 'actualizat' end;
    end if;
  end if;
  -- anulare: comentariu automat în fir
  if new.status = 'anulat' and old.status is distinct from 'anulat' then
    select nume_complet into nume from public.angajati where id = cine;
    insert into public.tsk_comentarii (task_id, autor_id, text)
      values (new.id, cine, 'Taskul a fost anulat' || case when nume is not null then ' de ' || nume else '' end || '.');
  end if;
  return null;
end $$;
revoke all on function public.tsk_solicitare_actualizat() from public, anon, authenticated;
drop trigger if exists tsk_solicitare_actualizat_trg on public.tsk_taskuri;
create trigger tsk_solicitare_actualizat_trg after update on public.tsk_taskuri
  for each row execute function public.tsk_solicitare_actualizat();

-- comentariu nou pe un task Media: ceilalți participanți primesc „Actualizat"
create or replace function public.tsk_solicitare_comentariu() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tsk_taskuri;
begin
  select * into t from public.tsk_taskuri where id = new.task_id;
  if not found or t.tip <> 'solicitare' then return null; end if;
  -- către cel care a deschis taskul
  if t.creat_de is not null and t.creat_de is distinct from new.autor_id then
    insert into public.tsk_necitite (task_id, angajat_id, motiv) values (t.id, t.creat_de, 'actualizat')
      on conflict (task_id, angajat_id) do update set created_at = now(),
        motiv = case when tsk_necitite.motiv in ('atribuit', 'mentiune') then tsk_necitite.motiv else 'actualizat' end;
  end if;
  -- către membrii echipei destinatare
  insert into public.tsk_necitite (task_id, angajat_id, motiv)
    select t.id, m.angajat_id, 'actualizat' from public.tsk_destinatii_membri m
    where m.destinatie_id = t.destinatie_id and m.angajat_id is distinct from new.autor_id
    on conflict (task_id, angajat_id) do update set created_at = now(),
      motiv = case when tsk_necitite.motiv in ('atribuit', 'mentiune') then tsk_necitite.motiv else 'actualizat' end;
  return null;
end $$;
revoke all on function public.tsk_solicitare_comentariu() from public, anon, authenticated;
drop trigger if exists tsk_solicitare_comentariu_trg on public.tsk_comentarii;
create trigger tsk_solicitare_comentariu_trg after insert on public.tsk_comentarii
  for each row execute function public.tsk_solicitare_comentariu();

-- 10. Grant-uri pe funcțiile noi -----------------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'tsk_e_membru_destinatie(uuid)', 'tsk_e_pm_oarecare()', 'tsk_poate_crea_solicitare()',
    'tsk_poate_vedea_solicitare(uuid, uuid)', 'tsk_schimba_status(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- 11. Date inițiale: Echipa Media + șabloanele din formularele Google (editabile din Setări) ------------------------
insert into public.tsk_destinatii (cod, nume, tip, ordine) values ('media', 'Echipa Media', 'intern', 1)
  on conflict (cod) do nothing;

insert into public.tsk_destinatii_categorii (destinatie_id, cod, nume, ordine)
  select d.id, v.cod, v.nume, v.ordine
  from public.tsk_destinatii d, (values ('design_grafic', 'Design grafic', 1), ('foto_video', 'Foto-video', 2)) as v(cod, nume, ordine)
  where d.cod = 'media'
  on conflict (destinatie_id, cod) do nothing;

-- ajutor: transformă o listă de etichete în jsonb [{cod, eticheta, activ}]
create or replace function pg_temp.opt(p_et text[]) returns jsonb language sql as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cod', 'o' || n,
    'eticheta', e, 'activ', true) order by n), '[]'::jsonb)
  from unnest(p_et) with ordinality as u(e, n);
$$;

insert into public.tsk_sabloane_campuri (categorie_id, cheie, eticheta, tip, obligatoriu, ordine, optiuni, ajutor)
select c.id, v.cheie, v.eticheta, v.tip, v.oblig, v.ordine, v.optiuni, v.ajutor
from public.tsk_destinatii_categorii c
join public.tsk_destinatii d on d.id = c.destinatie_id and d.cod = 'media'
join (values
  ('design_grafic', 'brand', 'Instituția / brandul', 'lista', true, 1,
     pg_temp.opt(array['Madrigal', 'Cantus Mundi', 'Galeria Madrigal', 'Madrigal pentru Spitale', 'Symphonia Mundi']), null),
  ('design_grafic', 'material', 'Material', 'lista', true, 2,
     pg_temp.opt(array['Afiș', 'Pliant', 'Banner online', 'Banner outdoor', 'Plăci direcționale', 'Program de sală', 'Revistă', 'Catalog',
                       'Machetă pentru publicitate', 'Roll up', 'Spider', 'Grafică foyer TV', 'Grafică foyer videoproiecții', 'Altul']),
     'Dacă alegi „Altul”, explică în Descriere.'),
  ('design_grafic', 'dimensiune', 'Dimensiune exactă', 'lista', true, 3,
     pg_temp.opt(array['50x70', '70x100', 'A3 landscape', 'A3 portrait', 'A5', 'Facebook postare (16x9)', 'Facebook cover (315x820)',
                       'Instagram post (1x1)', 'Instagram story (9x16)', '20x20 cm', 'Altul']),
     'Dacă alegi „Altul”, explică în Descriere. Bleed-ul se menționează în Descriere.'),
  ('design_grafic', 'nr_pagini', 'Număr de pagini', 'numar', true, 4, '[]'::jsonb, '1 la afișe și machete.'),
  ('design_grafic', 'unde', 'Unde se utilizează', 'multi', true, 5,
     pg_temp.opt(array['Tipar', 'Facebook', 'Instagram', 'Site', 'Outdoor', 'Foyer', 'Presă', 'Newsletter', 'Altul']),
     'Dacă alegi „Altul”, explică în Descriere.'),
  ('design_grafic', 'sigle', 'Sigle', 'multi', true, 6,
     pg_temp.opt(array['Madrigal', 'Cantus Mundi', 'Galeria Madrigal', 'Madrigal pentru Spitale', 'Symphonia Mundi', 'Altul']),
     'Dacă alegi „Altul”, explică în Descriere.'),
  ('design_grafic', 'text', 'Text (toate textele, poziția, ordinul de mărime)', 'paragraf', true, 7, '[]'::jsonb, null),
  ('design_grafic', 'link_model', 'Link model / exemplificare', 'link', false, 8, '[]'::jsonb, null),

  ('foto_video', 'serviciu', 'Serviciu', 'lista', true, 1,
     pg_temp.opt(array['Fotografiere eveniment', 'Filmare pentru reel / promo', 'Ședință foto profesionistă',
                       'Filmare în regim studio (interviuri, declarații, urări)', 'Filmare spectacol', 'Altul']),
     'Dacă alegi „Altul”, explică în Descriere.'),
  ('foto_video', 'data_filmarii', 'Data filmării', 'data', true, 2, '[]'::jsonb, 'Se completează din eveniment, dacă alegi unul.'),
  ('foto_video', 'locatie', 'Locație filmare', 'lista', true, 3,
     pg_temp.opt(array['Altul']), 'Se completează din eveniment, dacă alegi unul. Adminul poate adăuga locații în Setări.'),
  ('foto_video', 'ora_inceput', 'Ora început', 'ora', true, 4, '[]'::jsonb, null),
  ('foto_video', 'ora_sfarsit', 'Ora sfârșit', 'ora', true, 5, '[]'::jsonb, null),
  ('foto_video', 'contact', 'Persoană de contact la filmare', 'persoana', true, 6, '[]'::jsonb, 'Din lista de angajați.'),
  ('foto_video', 'brand', 'Instituția / brandul', 'lista', true, 7,
     pg_temp.opt(array['Madrigal', 'Cantus Mundi', 'Galeria Madrigal', 'Madrigal pentru Spitale', 'Symphonia Mundi']), null),
  ('foto_video', 'obiective', 'Obiective (toate locurile de captat)', 'paragraf', true, 8, '[]'::jsonb, null),
  ('foto_video', 'storyboard', 'Storyboard (mesaje, tipuri de cadre, persoane de surprins)', 'paragraf', true, 9, '[]'::jsonb, null),
  ('foto_video', 'mentiuni', 'Alte mențiuni', 'paragraf', false, 10, '[]'::jsonb, null)
) as v(cat, cheie, eticheta, tip, oblig, ordine, optiuni, ajutor) on v.cat = c.cod
on conflict (categorie_id, cheie) do nothing;
