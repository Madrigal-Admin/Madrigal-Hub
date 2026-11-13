-- =========================================================================
-- SECRETARIAT — Plan de revenire pentru Migrarea 5 (ștergere documente)
-- Șterge funcțiile, politica de ștergere din Storage și jurnalul de ștergeri (urma ștergerilor făcute până acum
-- se pierde). Nu atinge documentele, fișierele sau legăturile.
-- =========================================================================
drop function if exists public.sec_sterge_documente(uuid[], text);
drop function if exists public.sec_lant_legat(uuid);
drop policy if exists sec_storage_delete on storage.objects;
drop table if exists public.sec_sters_jurnal;
