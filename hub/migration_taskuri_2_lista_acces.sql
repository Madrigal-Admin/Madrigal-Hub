-- Taskuri — Migrarea 2: lista angajaților care au acces la Taskuri.
-- Aplicația o folosește ca să arate, în căutarea de responsabil, doar persoane
-- care chiar pot vedea taskul. Doar ADAUGĂ o funcție; nu modifică date.
create or replace function public.tsk_angajati_cu_acces()
returns table (angajat_id uuid, rol text)
language sql stable security definer set search_path = public as $$
  select a.angajat_id, a.rol
  from public.acces_tooluri a
  where a.tool = 'taskuri' and public.tsk_are_acces();
$$;
revoke all on function public.tsk_angajati_cu_acces() from public, anon;
grant execute on function public.tsk_angajati_cu_acces() to authenticated;
