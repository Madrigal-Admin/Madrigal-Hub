-- =========================================================================
-- Migrarea 23 — Taskuri: „Structură task" (înlocuiește „Destinații" din migrarea 22)
--  • Taskurile Media se asignează unui cont din Hub (responsabil), ales dintre membrii unui DEPARTAMENT (ex. „Media"),
--    setat per categorie. Nu mai există liste separate de conturi: se folosesc departamentele din Taskuri.
--  • Se ȘTERG structurile inutile: tabelele tsk_destinatii și tsk_destinatii_membri, coloana tsk_taskuri.destinatie_id,
--    funcțiile și triggerele legate de „echipa Media ca grup".
--  • Câmpurile suplimentare (șabloanele) devin disponibile și pentru taskurile de eveniment și operaționale.
-- NU modifică și NU șterge niciun task existent. Se oprește cu mesaj dacă există deja taskuri Media.
-- Se poate rula de mai multe ori. Rulează DUPĂ migrarea 22.
-- =========================================================================

-- 0. Siguranță: taskurile Media existente n-ar mai avea responsabil -> oprim și întrebăm ----------------------
do $$
begin
  if to_regclass('public.tsk_destinatii') is not null
     and exists (select 1 from public.tsk_taskuri where tip = 'solicitare') then
    raise exception 'Există taskuri Media create cu structura veche. Anunță dezvoltatorul înainte de a continua (nimic nu a fost modificat).';
  end if;
end $$;

-- 1. Categorii: se redenumește tabelul și se extinde la toate tipurile --------------------------------------
do $$
begin
  if to_regclass('public.tsk_destinatii_categorii') is not null and to_regclass('public.tsk_categorii') is null then
    alter table public.tsk_destinatii_categorii rename to tsk_categorii;
  end if;
end $$;

alter table public.tsk_categorii add column if not exists tip text not null default 'solicitare';
alter table public.tsk_categorii drop constraint if exists tsk_categorii_tip_check;
alter table public.tsk_categorii add constraint tsk_categorii_tip_check check (tip in ('eveniment', 'operational', 'solicitare'));

-- departamentul destinatar și responsabilul implicit (doar la categoriile Media)
alter table public.tsk_categorii add column if not exists grup_id uuid references public.tsk_grupuri(id) on delete set null;
alter table public.tsk_categorii add column if not exists responsabil_implicit_id uuid references public.angajati(id) on delete set null;

-- 2. Politicile taskurilor (fără destinație), înainte de a șterge funcțiile și coloana --------------------------
drop policy if exists tsk_taskuri_select on public.tsk_taskuri;
create policy tsk_taskuri_select on public.tsk_taskuri for select
  using (
    public.tsk_poate_vedea_row(tip, eveniment_id, grup_id, responsabil_id, creat_de, id)
    or (tip = 'solicitare' and eveniment_id is not null and public.tsk_are_acces() and public.tsk_e_pm(eveniment_id))
  );

drop policy if exists tsk_taskuri_update on public.tsk_taskuri;
create policy tsk_taskuri_update on public.tsk_taskuri for update
  using (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de)
         or (tip = 'solicitare' and public.tsk_are_acces() and responsabil_id = public.current_angajat_id()))
  with check (public.tsk_gestioneaza(tip, eveniment_id, grup_id, creat_de)
         or (tip = 'solicitare' and public.tsk_are_acces() and responsabil_id = public.current_angajat_id()));

-- (insert și delete rămân cele din migrarea 22: nu depind de destinații)

-- 3. Triggere și funcții vechi ---------------------------------------------------------------------------------------
drop trigger if exists tsk_solicitare_nou_trg on public.tsk_taskuri;
drop trigger if exists tsk_solicitare_actualizat_trg on public.tsk_taskuri;
drop trigger if exists tsk_solicitare_comentariu_trg on public.tsk_comentarii;
drop function if exists public.tsk_solicitare_nou();
drop function if exists public.tsk_poate_vedea_solicitare(uuid, uuid);

-- 4. Structurile vechi: coloană + tabele „destinații" -------------------------------------------------------------------
alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_solicitare_check;
alter table public.tsk_taskuri drop column if exists destinatie_id;      -- șterge și indexul și cheia străină
alter table public.tsk_categorii drop column if exists destinatie_id;   -- șterge și unicitatea (destinatie_id, cod)
drop table if exists public.tsk_destinatii_membri;
drop table if exists public.tsk_destinatii cascade;
drop function if exists public.tsk_e_membru_destinatie(uuid);

-- 5. Redenumiri pentru claritate ---------------------------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tsk_taskuri' and column_name = 'date_solicitare') then
    alter table public.tsk_taskuri rename column date_solicitare to date_campuri;
  end if;
end $$;
-- valorile câmpurilor suplimentare ale oricărui tip de task: [{cheie, eticheta, tip, valoare, brut}]
alter table public.tsk_taskuri add column if not exists date_campuri jsonb not null default '[]'::jsonb;

alter table public.tsk_categorii drop constraint if exists tsk_categorii_cod_key;
alter table public.tsk_categorii add constraint tsk_categorii_cod_key unique (cod);

insert into public.tsk_categorii (cod, nume, tip, ordine) values
  ('eveniment', 'Task de eveniment', 'eveniment', -2),
  ('operational', 'Task operațional', 'operational', -1)
on conflict (cod) do nothing;

alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_categorie_solicitare_check;
alter table public.tsk_taskuri add constraint tsk_taskuri_categorie_solicitare_check check (tip <> 'solicitare' or categorie_id is not null);

-- 6. RLS + grant-uri pe tabelele de structură ------------------------------------------------------------------------------------
alter table public.tsk_categorii enable row level security;
drop policy if exists tsk_destinatii_categorii_select on public.tsk_categorii;
drop policy if exists tsk_destinatii_categorii_write on public.tsk_categorii;

do $$
declare t text;
begin
  foreach t in array array['tsk_categorii', 'tsk_sabloane_campuri'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.tsk_are_acces())', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('create policy %I on public.%I for all using (public.tsk_e_admin()) with check (public.tsk_e_admin())', t || '_write', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- 7. Validări (taskul Media: responsabil din lista permisă; blocare după trimitere) ----------------------------------------------
create or replace function public.tsk_taskuri_valideaza() returns trigger
language plpgsql security definer set search_path = public as $$
declare comp text; cine uuid := public.current_angajat_id(); resp boolean; adm boolean; coord boolean; activ_c boolean; grup_c uuid;
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
    if tg_op = 'INSERT' then
      select c.activ, c.grup_id into activ_c, grup_c from public.tsk_categorii c where c.id = new.categorie_id and c.tip = 'solicitare';
      if activ_c is distinct from true then
        raise exception 'Categoria aleasă nu este activă.';
      end if;
      if grup_c is null then
        raise exception 'Categoria nu are departament destinatar. Adminul îl setează în Setări → Structură task.';
      end if;
      new.grup_id := grup_c;   -- taskul Media aparține departamentului destinatar
      if new.responsabil_id is null or not public.tsk_in_grup(grup_c, new.responsabil_id) then
        raise exception 'Alege un responsabil din departamentul destinatar.';
      end if;
      if new.termen is null then
        raise exception 'Termenul este obligatoriu la taskurile Media.';
      end if;
      if new.link_livrare is not null then
        raise exception 'Linkul de livrare îl completează responsabilul taskului.';
      end if;
      new.status := 'de_facut';
    elsif cine is not null then
      -- din aplicație: după trimitere se blochează titlul, descrierea, termenul, prioritatea, câmpurile și responsabilul (doar adminul le poate schimba)
      adm := public.tsk_e_admin();
      resp := old.responsabil_id = cine;
      coord := old.grup_id is not null and public.tsk_coordoneaza_grup(old.grup_id);
      if not adm and (
           new.titlu is distinct from old.titlu or new.descriere is distinct from old.descriere
           or new.termen is distinct from old.termen or new.prioritate is distinct from old.prioritate
           or new.categorie_id is distinct from old.categorie_id or new.responsabil_id is distinct from old.responsabil_id
           or new.grup_id is distinct from old.grup_id
           or new.date_campuri is distinct from old.date_campuri or new.tag is distinct from old.tag
           or new.link_document is distinct from old.link_document) then
        raise exception 'După trimitere, taskul Media nu se mai modifică. Cere schimbarea printr-un comentariu.';
      end if;
      if new.link_livrare is distinct from old.link_livrare and not (adm or resp or coord) then
        raise exception 'Linkul de livrare îl completează responsabilul taskului sau coordonatorul departamentului.';
      end if;
      if new.status is distinct from old.status and not (adm or resp or coord) then
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

-- 8. Status (RPC): la taskurile Media îl schimbă responsabilul (și adminul); cine l-a deschis îl poate doar anula --------------------
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
    if not (public.tsk_e_admin() or t.responsabil_id = public.current_angajat_id()
            or (t.grup_id is not null and public.tsk_coordoneaza_grup(t.grup_id))
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

-- 9. Notificări „Actualizat" + comentariu automat la anulare ------------------------------------------------------------------------
-- (eticheta „Nou" pentru responsabil o dă deja triggerul din migrarea 20)
create or replace function public.tsk_solicitare_actualizat() returns trigger
language plpgsql security definer set search_path = public as $$
declare cine uuid := public.current_angajat_id(); nume text;
begin
  if new.tip <> 'solicitare' then return null; end if;
  if new.status is distinct from old.status or new.link_livrare is distinct from old.link_livrare then
    if new.creat_de is not null and new.creat_de is distinct from cine then
      insert into public.tsk_necitite (task_id, angajat_id, motiv) values (new.id, new.creat_de, 'actualizat')
        on conflict (task_id, angajat_id) do update set created_at = now(),
          motiv = case when tsk_necitite.motiv in ('atribuit', 'mentiune') then tsk_necitite.motiv else 'actualizat' end;
    end if;
  end if;
  if new.status = 'anulat' and old.status is distinct from 'anulat' then
    select nume_complet into nume from public.angajati where id = cine;
    insert into public.tsk_comentarii (task_id, autor_id, text)
      values (new.id, cine, 'Taskul a fost anulat' || case when nume is not null then ' de ' || nume else '' end || '.');
  end if;
  return null;
end $$;
revoke all on function public.tsk_solicitare_actualizat() from public, anon, authenticated;
create trigger tsk_solicitare_actualizat_trg after update on public.tsk_taskuri
  for each row execute function public.tsk_solicitare_actualizat();

-- comentariu nou pe un task Media: celălalt participant (cine l-a deschis / responsabilul) primește „Actualizat"
create or replace function public.tsk_solicitare_comentariu() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.tsk_taskuri; p uuid;
begin
  select * into t from public.tsk_taskuri where id = new.task_id;
  if not found or t.tip <> 'solicitare' then return null; end if;
  foreach p in array array[t.creat_de, t.responsabil_id] loop
    if p is not null and p is distinct from new.autor_id then
      insert into public.tsk_necitite (task_id, angajat_id, motiv) values (t.id, p, 'actualizat')
        on conflict (task_id, angajat_id) do update set created_at = now(),
          motiv = case when tsk_necitite.motiv in ('atribuit', 'mentiune') then tsk_necitite.motiv else 'actualizat' end;
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.tsk_solicitare_comentariu() from public, anon, authenticated;
create trigger tsk_solicitare_comentariu_trg after insert on public.tsk_comentarii
  for each row execute function public.tsk_solicitare_comentariu();

-- 10. Funcțiile rămase: grant-uri ---------------------------------------------------------------------------------------------------------
revoke all on function public.tsk_schimba_status(uuid, text) from public, anon;
grant execute on function public.tsk_schimba_status(uuid, text) to authenticated;
