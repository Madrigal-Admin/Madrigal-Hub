-- =========================================================================
-- HUB — Migrarea 16: Evenimente native (pasul 1 din 2, ADITIV)
-- Pregătește tabelele pentru evenimente introduse direct în Hub, înlocuind
-- ClickUp. NU șterge și NU modifică nicio dată existentă. Poate fi rulată
-- din nou fără probleme. Dacă ceva eșuează, nu rămâne nimic pe jumătate.
--
-- Ce face:
--  1. Salvează o copie de siguranță a tabelului "evenimente".
--  2. Creează lista editabilă de tipuri (cu culori) și legătura eveniment <-> tipuri,
--     completată automat din etichetele (taguri) de acum.
--  3. Creează lista editabilă de statusuri (cele 4 de bază sunt protejate).
--  4. Creează tabelul cu PM-urile evenimentului (unul sau mai mulți).
--  5. Adaugă câmpul "localitate"; permite evenimente fără id ClickUp.
--  6. Drepturi: admin calendar poate adăuga/edita/șterge evenimente;
--     un eveniment cu invitații legate NU poate fi șters (se anulează).
-- =========================================================================
begin;

-- -------------------------------------------------------------------------
-- 1. Copie de siguranță (temporară; o ștergem în migrarea de curățare)
-- -------------------------------------------------------------------------
create table if not exists public.backup_evenimente_pre_etapa1 as
  select * from public.evenimente;
alter table public.backup_evenimente_pre_etapa1 enable row level security;
-- fără politici și fără grant-uri: nu e vizibilă din aplicație, doar din SQL Editor

-- -------------------------------------------------------------------------
-- 2. Funcție de drepturi: cine administrează calendarul
-- -------------------------------------------------------------------------
create or replace function public.is_calendar_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.acces_tooluri a
    join public.angajati g on g.id = a.angajat_id
    where g.user_id = auth.uid()
      and ((a.tool = 'hub' and a.rol = 'admin') or (a.tool = 'calendar' and a.rol = 'admin'))
  );
$$;
revoke all on function public.is_calendar_admin() from public, anon;
grant execute on function public.is_calendar_admin() to authenticated;

-- -------------------------------------------------------------------------
-- 3. Tipuri de eveniment (listă editabilă)
-- -------------------------------------------------------------------------
create table if not exists public.tipuri_eveniment (
  cod text primary key check (cod ~ '^[a-z0-9_]+$'),
  nume text not null,
  culoare text not null default '#7F77DD',
  activ boolean not null default true,
  ordine integer not null default 0,
  created_at timestamptz not null default now()
);

-- Aceleași coduri ca în Rapoarte (rap_tipuri), ca legătura să rămână simplă.
-- Culorile vin din cele alese deja în calendar.
insert into public.tipuri_eveniment (cod, nume, culoare, ordine) values
  ('madrigal',           'Madrigal',            '#BA7517', 1),
  ('cantus_mundi',       'Cantus Mundi',        '#D85A30', 2),
  ('symphonia_mundi',    'Symphonia Mundi',     '#7F77DD', 3),
  ('galeria_madrigal',   'Galeria Madrigal',    '#639922', 4),
  ('academia_dirijat',   'Academia de Dirijat', '#5F5E5A', 5),
  ('forum_cantus_mundi', 'Forum Cantus Mundi',  '#378ADD', 6)
on conflict (cod) do nothing;

create table if not exists public.eveniment_tipuri (
  eveniment_id uuid not null references public.evenimente(id) on delete cascade,
  tip_cod text not null references public.tipuri_eveniment(cod) on delete restrict,
  primary key (eveniment_id, tip_cod)
);
create index if not exists eveniment_tipuri_tip_idx on public.eveniment_tipuri (tip_cod);

-- Completare din etichetele de acum (potrivire pe nume, fără diferență litere mari/mici)
insert into public.eveniment_tipuri (eveniment_id, tip_cod)
select distinct e.id, t.cod
from public.evenimente e
cross join lateral unnest(e.tags) as tg(tag)
join public.tipuri_eveniment t on lower(trim(tg.tag)) = lower(t.nume)
on conflict do nothing;

-- -------------------------------------------------------------------------
-- 4. Statusuri de eveniment (listă editabilă; cele 4 de bază sunt protejate)
-- -------------------------------------------------------------------------
create table if not exists public.statusuri_eveniment (
  cod text primary key,
  nume text not null,
  culoare text not null,
  -- cum se comportă: 'deschis' | 'organizare' | 'finalizat' | 'anulat'
  -- statusurile adăugate de tine au mereu comportamentul 'organizare'
  comportament text not null check (comportament in ('deschis', 'organizare', 'finalizat', 'anulat')),
  de_sistem boolean not null default false,
  ordine integer not null default 0,
  check (de_sistem or comportament = 'organizare')
);

-- Codurile sunt exact valorile folosite deja în evenimente (nicio dată nu se modifică)
insert into public.statusuri_eveniment (cod, nume, culoare, comportament, de_sistem, ordine) values
  ('deschis',       'Deschis',       '#87909e', 'deschis',    true, 1),
  ('in organizare', 'În organizare', '#f76808', 'organizare', true, 2),
  ('finalizat',     'Finalizat',     '#008844', 'finalizat',  true, 3),
  ('anulat',        'Anulat',        '#e5484d', 'anulat',     true, 4)
on conflict (cod) do nothing;

create or replace function public.statusuri_eveniment_protejare()
returns trigger language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.de_sistem then
      raise exception 'Statusul „%” este de bază și nu poate fi șters. Îl poți redenumi sau recolora.', old.nume;
    end if;
    return old;
  end if;
  if new.cod <> old.cod or new.de_sistem <> old.de_sistem or new.comportament <> old.comportament then
    raise exception 'Codul și comportamentul unui status nu se pot schimba. Poți schimba numele, culoarea și ordinea.';
  end if;
  return new;
end $$;

drop trigger if exists statusuri_eveniment_protejare_trg on public.statusuri_eveniment;
create trigger statusuri_eveniment_protejare_trg
  before update or delete on public.statusuri_eveniment
  for each row execute function public.statusuri_eveniment_protejare();

-- Statusul unui eveniment devine o valoare din listă (nu text liber)
update public.evenimente set status = 'deschis' where status is null;
alter table public.evenimente alter column status set default 'deschis';
alter table public.evenimente alter column status set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'evenimente_status_fk') then
    alter table public.evenimente
      add constraint evenimente_status_fk foreign key (status)
      references public.statusuri_eveniment(cod) on update restrict on delete restrict;
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 5. PM-urile evenimentului (unul sau mai mulți)
-- -------------------------------------------------------------------------
create table if not exists public.eveniment_pm (
  eveniment_id uuid not null references public.evenimente(id) on delete cascade,
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  primary key (eveniment_id, angajat_id)
);
create index if not exists eveniment_pm_angajat_idx on public.eveniment_pm (angajat_id);

-- -------------------------------------------------------------------------
-- 6. Câmpuri pe eveniment
-- -------------------------------------------------------------------------
alter table public.evenimente add column if not exists localitate text;
-- evenimentele noi nu mai au id ClickUp (rămâne UNIQUE pentru cele vechi)
alter table public.evenimente alter column clickup_task_id drop not null;

-- -------------------------------------------------------------------------
-- 7. Ștergerea unui eveniment cu invitații legate e blocată
--    (invitațiile s-ar șterge odată cu el; se anulează în schimb)
-- -------------------------------------------------------------------------
create or replace function public.evenimente_blocheaza_stergerea()
returns trigger language plpgsql
as $$
begin
  if exists (select 1 from public.invitatii where eveniment_id = old.id)
     or exists (select 1 from public.cereri_invitati where eveniment_id = old.id) then
    raise exception 'Evenimentul „%” are invitații legate și nu poate fi șters. Setează-i statusul „Anulat”.', old.nume;
  end if;
  return old;
end $$;

drop trigger if exists evenimente_blocheaza_stergerea_trg on public.evenimente;
create trigger evenimente_blocheaza_stergerea_trg
  before delete on public.evenimente
  for each row execute function public.evenimente_blocheaza_stergerea();

-- -------------------------------------------------------------------------
-- 8. RLS + grant-uri (convenția din 30 oct 2026)
-- -------------------------------------------------------------------------
alter table public.tipuri_eveniment enable row level security;
alter table public.eveniment_tipuri enable row level security;
alter table public.statusuri_eveniment enable row level security;
alter table public.eveniment_pm enable row level security;

grant select, insert, update, delete on public.tipuri_eveniment to authenticated, service_role;
grant select, insert, update, delete on public.eveniment_tipuri to authenticated, service_role;
grant select, insert, update, delete on public.statusuri_eveniment to authenticated, service_role;
grant select, insert, update, delete on public.eveniment_pm to authenticated, service_role;

-- toți angajații autentificați citesc; doar adminii de calendar scriu
do $$
declare t text;
begin
  foreach t in array array['tipuri_eveniment', 'eveniment_tipuri', 'statusuri_eveniment', 'eveniment_pm'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (auth.uid() is not null)', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all using (public.is_calendar_admin()) with check (public.is_calendar_admin())', t || '_write', t);
  end loop;
end $$;

-- evenimente: politica veche (doar UPDATE) se înlocuiește cu INSERT/UPDATE/DELETE
drop policy if exists "evenimente_write_hub_admin" on public.evenimente;
drop policy if exists evenimente_insert_calendar_admin on public.evenimente;
create policy evenimente_insert_calendar_admin on public.evenimente for insert
  with check (public.is_calendar_admin());
drop policy if exists evenimente_update_calendar_admin on public.evenimente;
create policy evenimente_update_calendar_admin on public.evenimente for update
  using (public.is_calendar_admin()) with check (public.is_calendar_admin());
drop policy if exists evenimente_delete_calendar_admin on public.evenimente;
create policy evenimente_delete_calendar_admin on public.evenimente for delete
  using (public.is_calendar_admin());

-- Ordine: drepturi inutile (TRUNCATE etc.) scoase de pe evenimente
revoke truncate, references, trigger on public.evenimente from authenticated;

-- -------------------------------------------------------------------------
-- 9. Raport: ce a rămas nepotrivit (ar trebui să fie 0)
-- -------------------------------------------------------------------------
do $$
declare nepotrivite int; fara_tip int;
begin
  select count(*) into nepotrivite
  from (select distinct lower(trim(tg.tag)) tag from public.evenimente e, unnest(e.tags) tg(tag)) x
  where not exists (select 1 from public.tipuri_eveniment t where lower(t.nume) = x.tag);
  select count(*) into fara_tip from public.evenimente e
  where not exists (select 1 from public.eveniment_tipuri et where et.eveniment_id = e.id);
  raise notice 'Etichete fără tip corespunzător: % (așteptat 0)', nepotrivite;
  raise notice 'Evenimente fără niciun tip: % (așteptat 1 — cel fără etichetă)', fara_tip;
end $$;

commit;
