-- =========================================================================
-- TASKURI — Migrarea 1: fundația modulului de taskuri
-- Rulează DUPĂ migrările Hub 16, 17 (și 18). Poate fi rulată din nou.
-- Doar ADAUGĂ (tabele noi, funcții noi, două reguli pe evenimente); nu
-- modifică și nu șterge date existente.
--
-- Ce conține:
--  1. Tool-ul „taskuri" în acces_tooluri (roluri: angajat, admin).
--  2. Departamente (grupuri) cu coordonatori, separate de HR.
--  3. Checklistul master (secțiuni + itemi), importat din documentul Madrigal.
--  4. Taskurile, colaboratorii și comentariile, cu drepturi în baza de date.
--  5. Schimbarea statusului de către angajat (doar status), prin funcție.
--  6. Pe evenimente: checklist la „În organizare", „Adaugă din checklist",
--     „Finalizat" blocat cât timp sunt taskuri deschise, „Anulat" anulează
--     taskurile deschise.
-- =========================================================================
begin;

-- -------------------------------------------------------------------------
-- 1. Tool nou în acces_tooluri
-- -------------------------------------------------------------------------
alter table public.acces_tooluri drop constraint if exists acces_tooluri_tool_check;
alter table public.acces_tooluri
  add constraint acces_tooluri_tool_check
  check (tool in ('hub', 'hr', 'invitatii', 'administrativ', 'calendar', 'rapoarte', 'financiar', 'taskuri'));

-- -------------------------------------------------------------------------
-- 2. Departamente (grupuri) și coordonatori
-- -------------------------------------------------------------------------
create table if not exists public.tsk_grupuri (
  id uuid primary key default gen_random_uuid(),
  nume text not null check (length(trim(nume)) > 0),
  activ boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists tsk_grupuri_nume_uq on public.tsk_grupuri (lower(nume));

create table if not exists public.tsk_grup_membri (
  grup_id uuid not null references public.tsk_grupuri(id) on delete cascade,
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  e_coordonator boolean not null default false,
  primary key (grup_id, angajat_id)
);
create index if not exists tsk_grup_membri_angajat_idx on public.tsk_grup_membri (angajat_id);

-- -------------------------------------------------------------------------
-- 3. Checklist master (editabil complet)
-- -------------------------------------------------------------------------
create table if not exists public.tsk_checklist_sectiuni (
  id uuid primary key default gen_random_uuid(),
  nume text not null check (length(trim(nume)) > 0),
  ordine integer not null default 0
);

create table if not exists public.tsk_checklist_itemi (
  id uuid primary key default gen_random_uuid(),
  sectiune_id uuid not null references public.tsk_checklist_sectiuni(id) on delete cascade,
  titlu text not null check (length(trim(titlu)) > 0),
  ordine integer not null default 0
);
create index if not exists tsk_checklist_itemi_sectiune_idx on public.tsk_checklist_itemi (sectiune_id);

-- -------------------------------------------------------------------------
-- 4. Taskuri
-- -------------------------------------------------------------------------
create table if not exists public.tsk_taskuri (
  id uuid primary key default gen_random_uuid(),
  tip text not null check (tip in ('eveniment', 'operational')),
  titlu text not null check (length(trim(titlu)) > 0),
  descriere text,
  eveniment_id uuid references public.evenimente(id) on delete cascade,
  grup_id uuid references public.tsk_grupuri(id) on delete set null,
  responsabil_id uuid references public.angajati(id) on delete set null,
  termen date,
  prioritate text not null default 'medie' check (prioritate in ('mare', 'medie', 'mica')),
  status text not null default 'de_facut' check (status in ('de_facut', 'in_lucru', 'terminat', 'anulat')),
  link_document text check (link_document is null or link_document ~* '^https?://\S+$'),
  checklist_item_id uuid references public.tsk_checklist_itemi(id) on delete set null,
  creat_de uuid references public.angajati(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  terminat_la timestamptz,
  check ((tip = 'eveniment') = (eveniment_id is not null))
);
create index if not exists tsk_taskuri_eveniment_idx on public.tsk_taskuri (eveniment_id);
create index if not exists tsk_taskuri_responsabil_idx on public.tsk_taskuri (responsabil_id);
create index if not exists tsk_taskuri_grup_idx on public.tsk_taskuri (grup_id);
-- un item din checklist se adaugă o singură dată pe eveniment
create unique index if not exists tsk_taskuri_item_unic on public.tsk_taskuri (eveniment_id, checklist_item_id)
  where checklist_item_id is not null;

create table if not exists public.tsk_colaboratori (
  task_id uuid not null references public.tsk_taskuri(id) on delete cascade,
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  primary key (task_id, angajat_id)
);
create index if not exists tsk_colaboratori_angajat_idx on public.tsk_colaboratori (angajat_id);

create table if not exists public.tsk_comentarii (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tsk_taskuri(id) on delete cascade,
  autor_id uuid references public.angajati(id) on delete set null,
  text text not null check (length(trim(text)) > 0 and length(text) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists tsk_comentarii_task_idx on public.tsk_comentarii (task_id);

-- Evenimentul: checklistul se generează o singură dată
alter table public.evenimente add column if not exists checklist_generat boolean not null default false;

-- -------------------------------------------------------------------------
-- 5. Funcții de drepturi (folosite de politici și de funcțiile de mai jos)
-- -------------------------------------------------------------------------
create or replace function public.tsk_acces() returns text
language sql stable security definer set search_path = public as $$
  select a.rol from public.acces_tooluri a
  where a.angajat_id = public.current_angajat_id() and a.tool = 'taskuri' limit 1;
$$;

create or replace function public.tsk_are_acces() returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_acces() is not null;
$$;

create or replace function public.tsk_e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_acces() = 'admin';
$$;

create or replace function public.tsk_e_pm(p_eveniment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.eveniment_pm p
                 where p.eveniment_id = p_eveniment and p.angajat_id = public.current_angajat_id());
$$;

create or replace function public.tsk_e_coordonator() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tsk_grup_membri m
                 where m.angajat_id = public.current_angajat_id() and m.e_coordonator);
$$;

create or replace function public.tsk_coordoneaza_grup(p_grup uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tsk_grup_membri m
                 where m.grup_id = p_grup and m.angajat_id = public.current_angajat_id() and m.e_coordonator);
$$;

create or replace function public.tsk_coordoneaza_persoana(p_angajat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tsk_grup_membri c
    join public.tsk_grup_membri m on m.grup_id = c.grup_id
    where c.angajat_id = public.current_angajat_id() and c.e_coordonator and m.angajat_id = p_angajat);
$$;

create or replace function public.tsk_in_grup(p_grup uuid, p_angajat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tsk_grup_membri m where m.grup_id = p_grup and m.angajat_id = p_angajat);
$$;

create or replace function public.tsk_e_colaborator(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.tsk_colaboratori c
                 where c.task_id = p_task and c.angajat_id = public.current_angajat_id());
$$;

-- Poate modifica taskul (toate câmpurile): admin, cel care l-a creat, PM-ul evenimentului,
-- coordonatorul departamentului taskului.
create or replace function public.tsk_gestioneaza(p_tip text, p_eveniment uuid, p_grup uuid, p_creat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_are_acces() and (
    public.tsk_e_admin()
    or p_creat = public.current_angajat_id()
    or (p_tip = 'eveniment' and public.tsk_e_pm(p_eveniment))
    or (p_grup is not null and public.tsk_coordoneaza_grup(p_grup))
  );
$$;

-- Poate vedea taskul
create or replace function public.tsk_poate_vedea_row(p_tip text, p_eveniment uuid, p_grup uuid, p_responsabil uuid, p_creat uuid, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_are_acces() and (
    public.tsk_e_admin()
    or p_responsabil = public.current_angajat_id()
    or p_creat = public.current_angajat_id()
    or public.tsk_e_colaborator(p_id)
    or (p_tip = 'eveniment' and public.tsk_e_pm(p_eveniment))
    or (p_grup is not null and public.tsk_coordoneaza_grup(p_grup))
    or (p_responsabil is not null and public.tsk_coordoneaza_persoana(p_responsabil))
  );
$$;

-- Poate adăuga colaboratori: cine gestionează taskul, coordonatorul responsabilului,
-- sau responsabilul însuși dacă e coordonator de departament (delegare parțială).
create or replace function public.tsk_poate_delega(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tsk_taskuri t
    where t.id = p_task and (
      public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de)
      or (t.responsabil_id is not null and public.tsk_coordoneaza_persoana(t.responsabil_id))
      or (t.responsabil_id = public.current_angajat_id() and public.tsk_e_coordonator())
    )
  );
$$;

-- -------------------------------------------------------------------------
-- 6. Validări pe taskuri (în baza de date, nu doar în interfață)
-- -------------------------------------------------------------------------
create or replace function public.tsk_taskuri_valideaza() returns trigger
language plpgsql security definer set search_path = public as $$
declare comp text;
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

  new.updated_at := now();
  if new.status = 'terminat' and (tg_op = 'INSERT' or old.status <> 'terminat') then
    new.terminat_la := now();
  elsif new.status <> 'terminat' then
    new.terminat_la := null;
  end if;
  return new;
end $$;

drop trigger if exists tsk_taskuri_valideaza_trg on public.tsk_taskuri;
create trigger tsk_taskuri_valideaza_trg
  before insert or update on public.tsk_taskuri
  for each row execute function public.tsk_taskuri_valideaza();

-- -------------------------------------------------------------------------
-- 7. RLS + grant-uri
-- -------------------------------------------------------------------------
alter table public.tsk_grupuri enable row level security;
alter table public.tsk_grup_membri enable row level security;
alter table public.tsk_checklist_sectiuni enable row level security;
alter table public.tsk_checklist_itemi enable row level security;
alter table public.tsk_taskuri enable row level security;
alter table public.tsk_colaboratori enable row level security;
alter table public.tsk_comentarii enable row level security;

grant select, insert, update, delete on
  public.tsk_grupuri, public.tsk_grup_membri, public.tsk_checklist_sectiuni, public.tsk_checklist_itemi,
  public.tsk_taskuri, public.tsk_colaboratori, public.tsk_comentarii
  to authenticated, service_role;

-- grupuri, membri, checklist: citire pentru oricine are acces; scriere doar admin taskuri
do $$
declare t text;
begin
  foreach t in array array['tsk_grupuri', 'tsk_grup_membri', 'tsk_checklist_sectiuni', 'tsk_checklist_itemi'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.tsk_are_acces())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all using (public.tsk_e_admin()) with check (public.tsk_e_admin())', t || '_write', t);
  end loop;
end $$;

-- taskuri
drop policy if exists tsk_taskuri_select on public.tsk_taskuri;
create policy tsk_taskuri_select on public.tsk_taskuri for select
  using (public.tsk_poate_vedea_row(tip, eveniment_id, grup_id, responsabil_id, creat_de, id));

drop policy if exists tsk_taskuri_insert on public.tsk_taskuri;
create policy tsk_taskuri_insert on public.tsk_taskuri for insert
  with check (
    public.tsk_are_acces()
    and creat_de = public.current_angajat_id()
    and (
      public.tsk_e_admin()
      or (tip = 'eveniment' and public.tsk_e_pm(eveniment_id))
      or (tip = 'operational' and grup_id is not null and public.tsk_coordoneaza_grup(grup_id))
    )
  );

drop policy if exists tsk_taskuri_update on public.tsk_taskuri;
create policy tsk_taskuri_update on public.tsk_taskuri for update
  using (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de))
  with check (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de));

drop policy if exists tsk_taskuri_delete on public.tsk_taskuri;
create policy tsk_taskuri_delete on public.tsk_taskuri for delete
  using (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de));

-- colaboratori
drop policy if exists tsk_colaboratori_select on public.tsk_colaboratori;
create policy tsk_colaboratori_select on public.tsk_colaboratori for select
  using (angajat_id = public.current_angajat_id() or exists (select 1 from public.tsk_taskuri t where t.id = task_id));
drop policy if exists tsk_colaboratori_write on public.tsk_colaboratori;
create policy tsk_colaboratori_write on public.tsk_colaboratori for all
  using (public.tsk_poate_delega(task_id)) with check (public.tsk_poate_delega(task_id));

-- comentarii: le vede și le scrie cine vede taskul; le șterge autorul sau adminul
drop policy if exists tsk_comentarii_select on public.tsk_comentarii;
create policy tsk_comentarii_select on public.tsk_comentarii for select
  using (exists (select 1 from public.tsk_taskuri t where t.id = task_id));
drop policy if exists tsk_comentarii_insert on public.tsk_comentarii;
create policy tsk_comentarii_insert on public.tsk_comentarii for insert
  with check (autor_id = public.current_angajat_id() and exists (select 1 from public.tsk_taskuri t where t.id = task_id));
drop policy if exists tsk_comentarii_delete on public.tsk_comentarii;
create policy tsk_comentarii_delete on public.tsk_comentarii for delete
  using (autor_id = public.current_angajat_id() or public.tsk_e_admin());

-- -------------------------------------------------------------------------
-- 8. Funcții apelate din aplicație
-- -------------------------------------------------------------------------
-- Angajatul își schimbă DOAR statusul. „Anulat" rămâne pentru cei care gestionează taskul.
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
  if not (public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de)
          or t.responsabil_id = public.current_angajat_id()
          or public.tsk_e_colaborator(t.id)) then
    raise exception 'Nu poți schimba statusul acestui task.';
  end if;
  if p_status = 'anulat' and not public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de) then
    raise exception 'Doar cine a creat taskul sau coordonatorul lui îl poate anula.';
  end if;
  update public.tsk_taskuri set status = p_status where id = p_task;
end $$;

-- Adaugă taskuri din checklist (doar itemii care nu au fost deja adăugați pe eveniment)
create or replace function public.tsk_adauga_din_checklist_intern(p_eveniment uuid, p_items uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.tsk_taskuri (tip, titlu, eveniment_id, checklist_item_id, creat_de)
  select 'eveniment', i.titlu, p_eveniment, i.id, public.current_angajat_id()
  from public.tsk_checklist_itemi i
  where i.id = any (coalesce(p_items, '{}'))
  order by (select s.ordine from public.tsk_checklist_sectiuni s where s.id = i.sectiune_id), i.ordine
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tsk_adauga_din_checklist_intern(uuid, uuid[]) from public, anon, authenticated;

create or replace function public.tsk_adauga_din_checklist(p_eveniment uuid, p_items uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not public.tsk_are_acces() or not (public.tsk_e_admin() or public.tsk_e_pm(p_eveniment)) then
    raise exception 'Doar PM-ul evenimentului sau adminul de taskuri poate adăuga taskuri din checklist.';
  end if;
  return public.tsk_adauga_din_checklist_intern(p_eveniment, p_items);
end $$;

-- „Deschis → În organizare" + generarea o singură dată a taskurilor bifate
create or replace function public.tsk_eveniment_incepe_organizarea(p_eveniment uuid, p_items uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare ev public.evenimente; comp text; cod_nou text; n integer := 0;
begin
  select * into ev from public.evenimente where id = p_eveniment;
  if not found then raise exception 'Evenimentul nu există.'; end if;
  if not (public.is_calendar_admin() or (public.tsk_are_acces() and (public.tsk_e_admin() or public.tsk_e_pm(p_eveniment)))) then
    raise exception 'Doar PM-ul evenimentului sau un admin poate începe organizarea.';
  end if;
  select comportament into comp from public.statusuri_eveniment where cod = ev.status;
  if comp <> 'deschis' then
    raise exception 'Evenimentul nu mai este „Deschis".';
  end if;
  select cod into cod_nou from public.statusuri_eveniment where comportament = 'organizare' order by ordine limit 1;
  update public.evenimente set status = cod_nou where id = p_eveniment;
  if not ev.checklist_generat then
    n := public.tsk_adauga_din_checklist_intern(p_eveniment, p_items);
    update public.evenimente set checklist_generat = true where id = p_eveniment;
  end if;
  return n;
end $$;

-- PM-ul poate muta evenimentul lui între „În organizare" și „Finalizat" (restul îl face adminul de calendar)
create or replace function public.tsk_eveniment_schimba_status(p_eveniment uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare comp text;
begin
  select comportament into comp from public.statusuri_eveniment where cod = p_status;
  if comp is null then raise exception 'Status invalid.'; end if;
  if not (public.is_calendar_admin() or (public.tsk_are_acces() and public.tsk_e_pm(p_eveniment))) then
    raise exception 'Doar PM-ul evenimentului sau un admin poate schimba statusul.';
  end if;
  if comp in ('anulat', 'deschis') and not public.is_calendar_admin() then
    raise exception 'Anularea sau redeschiderea evenimentului o face un admin de calendar.';
  end if;
  update public.evenimente set status = p_status where id = p_eveniment;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'tsk_acces()', 'tsk_are_acces()', 'tsk_e_admin()', 'tsk_e_pm(uuid)', 'tsk_e_coordonator()',
    'tsk_coordoneaza_grup(uuid)', 'tsk_coordoneaza_persoana(uuid)', 'tsk_in_grup(uuid, uuid)',
    'tsk_e_colaborator(uuid)', 'tsk_gestioneaza(text, uuid, uuid, uuid)',
    'tsk_poate_vedea_row(text, uuid, uuid, uuid, uuid, uuid)', 'tsk_poate_delega(uuid)',
    'tsk_schimba_status(uuid, text)', 'tsk_adauga_din_checklist(uuid, uuid[])',
    'tsk_eveniment_incepe_organizarea(uuid, uuid[])', 'tsk_eveniment_schimba_status(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.tsk_taskuri_valideaza() from public, anon, authenticated;

-- -------------------------------------------------------------------------
-- 9. Reguli pe evenimente
-- -------------------------------------------------------------------------
-- Finalizat: doar dacă toate taskurile sunt terminate sau anulate
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
          where eveniment_id = new.id and status in ('de_facut', 'in_lucru')) x;
    if nr > 0 then
      raise exception 'Evenimentul „%” nu poate fi finalizat: mai are % taskuri nefinalizate (de ex.: %).', new.nume, nr, exemple;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.evenimente_regula_taskuri_finalizat() from public, anon, authenticated;

drop trigger if exists evenimente_regula_taskuri_finalizat_trg on public.evenimente;
create trigger evenimente_regula_taskuri_finalizat_trg
  before update of status on public.evenimente
  for each row execute function public.evenimente_regula_taskuri_finalizat();

-- Anulat: taskurile deschise ale evenimentului se anulează
create or replace function public.evenimente_regula_taskuri_anulat() returns trigger
language plpgsql security definer set search_path = public as $$
declare comp text;
begin
  select comportament into comp from public.statusuri_eveniment where cod = new.status;
  if comp = 'anulat' and new.status is distinct from old.status then
    update public.tsk_taskuri set status = 'anulat'
    where eveniment_id = new.id and status in ('de_facut', 'in_lucru');
  end if;
  return null;
end $$;
revoke all on function public.evenimente_regula_taskuri_anulat() from public, anon, authenticated;

drop trigger if exists evenimente_regula_taskuri_anulat_trg on public.evenimente;
create trigger evenimente_regula_taskuri_anulat_trg
  after update of status on public.evenimente
  for each row execute function public.evenimente_regula_taskuri_anulat();

-- -------------------------------------------------------------------------
-- 10. Checklistul master — importat o singură dată din documentul Madrigal
--     (doar titlurile; responsabilii și termenele se completează manual)
-- -------------------------------------------------------------------------
do $seed$
declare v_sec uuid;
begin
  if not exists (select 1 from public.tsk_checklist_sectiuni) then
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Planificare și contractare', 1) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea datei, orașului, sălii și tipului de concert', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea disponibilității dirijorului / actori / instrumentiști', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea disponibilității echipei tehnice și administrative', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Vizionarea și evaluarea sălii', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Negocierea condițiilor financiare și tehnice', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea bugetului estimativ și ofertarea', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Redactarea, verificarea și semnarea contractelor', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea persoanelor de contact din partea organizatorului (Organizare, Comunicare, Tehnic, Lumini, Sunet)', 8);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Logistică și transport', 2) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Centralizarea listei participanților (artistic / organizare)', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea mijloacelor de transport și a traseelor', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Repartizarea camerelor / Rooming list (artistic / organizare)', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Rezervarea cazării artistic', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Rezervarea cazării organizare', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Opțiunile de meniu lot artistic', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea meselor și a necesarului de catering (ore, meniu propriu-zis, locație)', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Transmiterea programului de deplasare', 8);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea locurilor de parcare și a accesului pentru descărcare', 9);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Pregătirea documentelor de deplasare și a diurnelor, după caz', 10);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Producție și tehnic', 3) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Solicitarea și verificarea fișei tehnice a sălii', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Transmiterea riderului tehnic Madrigal', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea necesarului de sunet, lumini și video', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea scenei, practicabilelor și a amplasării corului', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea necesarului de echipamente suplimentare', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea personalului tehnic local', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea programului de montaj, probe și demontaj', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Pregătirea materialelor scenografice și a recuzitei', 8);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Artistic și backstage', 4) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea repertoriului și a duratei concertului', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Definitivarea distribuției artistice', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea programului repetițiilor și al probelor de sunet', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea costumelor și a accesoriilor', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Alocarea cabinelor și a spațiilor de schimb', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Pregătirea necesarului de apă, consumabile și catering backstage', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea fluxului de intrare și ieșire din scenă', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea responsabililor de scenă și backstage', 8);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Logistică cor', 5) returning id into v_sec;
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Protocol', 6) returning id into v_sec;
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Comunicare, promovare și ticketing', 7) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea identității vizuale și a materialelor de promovare', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Pregătirea comunicatului de presă și a descrierii evenimentului', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Configurarea evenimentului pe platforma de ticketing - în paralel', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Blocare locuri protocol, tehnice, vizibilitate 0, handicap', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea categoriilor de bilete, prețurilor și comisioanelor', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea campaniei de promovare și a calendarului de postări', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea echipelor foto-video și a livrabilelor', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea vânzărilor și a gradului de ocupare', 8);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Restricții și limitări foto-video (durată, poziție, echipamente, acreditării)', 9);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Protocol și acces public', 8) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea listei de invitați și a locurilor rezervate', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea invitațiilor VIP și instituționale', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Monitorizarea listelor de acces în hub', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Transmiterea invitațiilor către parteneri și presă', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Stabilirea responsabililor de protocol', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea echipei de acces și scanare bilete', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea semnalisticii, garderobei și a fluxurilor de public', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Pregătirea eventualelor materiale de protocol', 8);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Magazin', 9) returning id into v_sec;
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Ziua evenimentului', 10) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Briefing cu responsabilii tuturor departamentelor', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea prezenței echipei și a artiștilor', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea finalizării montajului tehnic', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Realizarea probelor artistice și tehnice', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea cabinelor, costumelor și consumabilelor', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea accesului publicului și a protocolului', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Respectarea orelor de începere și finalizare', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Coordonarea demontajului și a plecării echipei', 8);
    insert into public.tsk_checklist_sectiuni (nume, ordine) values ('Post-eveniment și raportare', 11) returning id into v_sec;
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Confirmarea returului echipei și a echipamentelor', 1);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Colectarea facturilor, contractelor și documentelor justificative', 2);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Solicitarea raportului final de ticketing și a decontului', 3);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Verificarea comisioanelor și a veniturilor nete', 4);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Întocmirea raportului financiar și a deconturilor', 5);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Transmiterea mulțumirilor către parteneri', 6);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Centralizarea materialelor foto-video și a aparițiilor media', 7);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Evaluarea problemelor și a soluțiilor pentru evenimente viitoare', 8);
    insert into public.tsk_checklist_itemi (sectiune_id, titlu, ordine) values (v_sec, 'Arhivarea documentației evenimentului', 9);
  end if;
end
$seed$;

commit;
