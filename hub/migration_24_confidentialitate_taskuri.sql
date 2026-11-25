-- =========================================================================
-- Migrarea 24 — Taskuri: confidențialitate pe departamente
--  • Un task aparține DOAR departamentului din câmpul „grup" al taskului. Coordonatorul unui departament vede
--    taskurile departamentelor lui + pe cele în care e implicat direct (responsabil, creator, colaborator,
--    PM la eveniment). NU mai vede taskurile altor departamente doar pentru că responsabilul face parte și din
--    departamentul lui. Adminul de taskuri vede în continuare tot.
--  • Delegarea (adăugarea de colaboratori) urmează aceeași regulă.
--  • Funcție nouă tsk_numar_in_afara(): pentru fiecare membru al departamentelor coordonate (admin: toate),
--    NUMĂRUL taskurilor deschise din afara departamentului. Doar cifre, fără titluri sau alte detalii.
-- NU modifică și NU șterge niciun task. Se poate rula de mai multe ori. Rulează DUPĂ migrarea 23.
-- =========================================================================

-- 1. Cine poate vedea un task ---------------------------------------------------------------------------------
create or replace function public.tsk_poate_vedea_row(p_tip text, p_eveniment uuid, p_grup uuid, p_responsabil uuid, p_creat uuid, p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.tsk_are_acces() and (
    public.tsk_e_admin()
    or p_responsabil = public.current_angajat_id()
    or p_creat = public.current_angajat_id()
    or public.tsk_e_colaborator(p_id)
    or (p_tip = 'eveniment' and public.tsk_e_pm(p_eveniment))
    or (p_grup is not null and public.tsk_coordoneaza_grup(p_grup))
  );
$$;

-- 2. Cine poate adăuga colaboratori ------------------------------------------------------------------------------
create or replace function public.tsk_poate_delega(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tsk_taskuri t
    where t.id = p_task and (
      public.tsk_gestioneaza(t.tip, t.eveniment_id, t.grup_id, t.creat_de)
      or (t.responsabil_id = public.current_angajat_id() and public.tsk_e_coordonator())
    )
  );
$$;

-- 3. Numărul taskurilor deschise ale membrilor, din AFARA departamentului (doar cifre) ---------------------------
create or replace function public.tsk_numar_in_afara()
returns table (grup_id uuid, angajat_id uuid, nr integer)
language sql stable security definer set search_path = public as $$
  select m.grup_id, m.angajat_id,
         (select count(*)::int from public.tsk_taskuri t
           where t.responsabil_id = m.angajat_id
             and t.status in ('de_facut', 'in_lucru')
             and t.grup_id is distinct from m.grup_id)
  from public.tsk_grup_membri m
  where public.tsk_are_acces()
    and (public.tsk_e_admin() or public.tsk_coordoneaza_grup(m.grup_id));
$$;
revoke all on function public.tsk_numar_in_afara() from public, anon;
grant execute on function public.tsk_numar_in_afara() to authenticated;
