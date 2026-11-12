-- =========================================================================
-- SECRETARIAT — Plan de revenire pentru Migrarea 1
-- NU se rulează decât dacă vrei să ANULEZI complet Etapa 1.
-- ATENȚIE: șterge tabelele Secretariatului ȘI toate documentele înregistrate în ele.
-- Nu atinge niciun alt tool. NU o rula după ce ai început să folosești registrele cu documente reale.
-- Bucketul de fișiere „secretariat-documente” se șterge separat, din Dashboard (vezi instrucțiunile).
-- =========================================================================

-- 1. Accesul acordat tool-ului (altfel constrângerea de la pasul 5 nu se mai poate reface)
delete from public.acces_tooluri where tool = 'secretariat';

-- 2. Politicile de pe Storage
drop policy if exists sec_storage_insert on storage.objects;
drop policy if exists sec_storage_select on storage.objects;

-- 3. View și tabele
drop view if exists public.sec_documente_lista;
drop table if exists public.sec_jurnal, public.sec_confidential_acces, public.sec_fisiere,
  public.sec_documente, public.sec_contoare, public.sec_tipuri_document, public.sec_canale, public.sec_contacte cascade;

-- 4. Funcțiile
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'sec\_%'
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;

-- 5. Lista de tool-uri din acces_tooluri revine la cea de dinainte
do $$
declare c record; def text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as d from pg_constraint
    where conrelid = 'public.acces_tooluri'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%tool%'
  loop
    if c.d ilike '%secretariat%' then
      def := replace(c.d, ', ''secretariat''::text', '');
      execute format('alter table public.acces_tooluri drop constraint %I', c.conname);
      execute format('alter table public.acces_tooluri add constraint %I %s', c.conname, def);
    end if;
  end loop;
end $$;
