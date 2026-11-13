-- =========================================================================
-- SECRETARIAT — Migrarea 5: ștergerea definitivă a documentelor (doar Admin Hub)
--
-- • Tabel nou „sec_sters_jurnal”: urma fiecărei ștergeri (număr, registru, cine, când, motiv) — FĂRĂ obiect și fără fișiere.
-- • Funcții noi: sec_lant_legat(id) (documentele legate Intrare ↔ Circuit ↔ Ieșire + fișierele lor)
--   și sec_sterge_documente(ids, motiv).
-- • Politică nouă pe storage.objects: doar Adminul Hub poate șterge fișiere din spațiul „secretariat-documente”.
--
-- ORDINEA ȘTERGERII (decisă pentru igiena fișierelor): aplicația șterge ÎNTÂI fișierele din Storage, apoi
-- funcția șterge documentele; funcția REFUZĂ ștergerea dacă mai există fișiere în Storage pentru ele.
--
-- IMPACT ASUPRA DATELOR EXISTENTE
--  • Nu se modifică și nu se șterge nimic la rularea migrării (doar obiecte noi). Datele dispar doar când adminul
--    șterge explicit un document din aplicație, cu confirmare.
-- REVENIRE: rollback_secretariat_5.sql (șterge funcțiile, politica și jurnalul de ștergeri; documentele rămân).
-- Necesită migrările 1–4.
-- =========================================================================

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sec_documente' and column_name = 'circuit_id') then
    raise exception 'Rulează mai întâi migrarea 4 (migration_secretariat_4_legaturi.sql).';
  end if;
end $$;

create table if not exists public.sec_sters_jurnal (
  id bigint generated always as identity primary key,
  registru text not null,
  an int not null,
  nr int not null,
  numar_afisat text not null,
  status_la_stergere text,
  nr_fisiere int not null default 0,
  documente_in_lant int not null default 1,
  motiv text not null,
  sters_de uuid references public.angajati(id) on delete set null,
  sters_de_nume text,
  sters_la timestamptz not null default now()
);
alter table public.sec_sters_jurnal enable row level security;
drop policy if exists sec_sters_jurnal_select on public.sec_sters_jurnal;
create policy sec_sters_jurnal_select on public.sec_sters_jurnal for select to authenticated using (public.is_hub_admin());
revoke all on public.sec_sters_jurnal from anon, authenticated;
grant select on public.sec_sters_jurnal to authenticated;
grant all on public.sec_sters_jurnal to service_role;

drop policy if exists sec_storage_delete on storage.objects;
create policy sec_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'secretariat-documente' and public.is_hub_admin());

-- Documentele legate de unul dat (în ambele sensuri, transitiv) și fișierele fiecăruia
create or replace function public.sec_lant_legat(p_id uuid)
returns table (id uuid, registru text, numar_afisat text, obiect text, status text, cai text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate șterge documente.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.sec_documente x where x.id = p_id) then
    raise exception 'Documentul nu există.' using errcode = '22023';
  end if;
  return query
  with recursive muchii as (
    select d.id as a, d.legat_de as b from public.sec_documente d where d.legat_de is not null
    union all
    select d.id, d.circuit_id from public.sec_documente d where d.circuit_id is not null
  ), lant(lid) as (
    select p_id
    union
    select case when m.a = l.lid then m.b else m.a end from lant l join muchii m on m.a = l.lid or m.b = l.lid
  )
  select d.id, d.registru,
         (case d.registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end || ' ' || d.nr || '/' || d.an)::text,
         d.obiect::text, d.status::text,
         array(select o.name::text from storage.objects o
               where o.bucket_id = 'secretariat-documente' and o.name like d.id::text || '/%' order by o.name)
  from public.sec_documente d join lant on lant.lid = d.id
  order by d.registru, d.an, d.nr;
end $$;

-- Ștergerea definitivă. Se apelează DUPĂ ce fișierele au fost șterse din Storage.
create or replace function public.sec_sterge_documente(p_ids uuid[], p_motiv text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_nr int;
  v_eu uuid := public.sec_eu();
  v_nume text;
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate șterge documente.' using errcode = '42501';
  end if;
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception 'Nu ai ales niciun document.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motiv, ''))) < 3 then
    raise exception 'Scrie motivul ștergerii (ex. „înregistrare de test”).' using errcode = '22023';
  end if;
  select count(*) into v_nr from public.sec_documente x where x.id = any(p_ids);
  if v_nr <> (select count(distinct i) from unnest(p_ids) i) then
    raise exception 'Unele documente nu mai există. Reîncarcă pagina și încearcă din nou.' using errcode = '22023';
  end if;
  if exists (select 1 from storage.objects o
             where o.bucket_id = 'secretariat-documente' and public.sec_uuid_din_cale(o.name) = any(p_ids)) then
    raise exception 'Fișierele documentelor nu au fost șterse din spațiul de stocare. Încearcă din nou.' using errcode = '22023';
  end if;
  select a.nume_complet into v_nume from public.angajati a where a.id = v_eu;

  insert into public.sec_sters_jurnal (registru, an, nr, numar_afisat, status_la_stergere, nr_fisiere, documente_in_lant, motiv, sters_de, sters_de_nume)
  select d.registru, d.an, d.nr,
         case d.registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end || ' ' || d.nr || '/' || d.an,
         d.status, (select count(*) from public.sec_fisiere f where f.document_id = d.id), v_nr,
         left(btrim(p_motiv), 300), v_eu, v_nume
  from public.sec_documente d where d.id = any(p_ids);

  -- Fișiere, jurnal, semnatari și persoane numite se șterg în cascadă; legăturile rămase se desprind (set null)
  delete from public.sec_documente where id = any(p_ids);
  return v_nr;
end $$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'sec\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;
