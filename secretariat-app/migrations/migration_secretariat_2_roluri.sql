-- =========================================================================
-- SECRETARIAT — Migrarea 2: „Angajat” devine rol explicit
-- Rolurile devin: Fără acces (implicit) / Angajat / Secretariat / Conducere (+ Admin Hub).
-- Înainte: orice angajat activ era automat „Angajat”. Acum un angajat fără rând în acces_tooluri
-- pentru tool-ul „secretariat” are rolul „none” (nu vede linkul și nu poate citi nimic).
--
-- IMPACT ASUPRA DATELOR EXISTENTE: niciun rând nu se modifică sau șterge. Se înlocuiește doar
-- funcția sec_rol(). Nu există deocamdată rânduri „secretariat/angajat” în acces_tooluri:
-- după această migrare, rolul „Angajat” se acordă din Hub → Acces Tool-uri.
-- Se înlocuiesc doar funcțiile sec_rol(), sec_e_sef_pentru() și sec_vede_row(): fără rol, nu se vede nimic,
-- nici măcar documentele repartizate persoanei respective.
-- Revenire: rulează din nou definițiile acestor funcții din migrarea 1 (secțiunea 3).
-- =========================================================================

create or replace function public.sec_rol() returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.is_hub_admin() then 'admin'
    when exists (select 1 from public.acces_tooluri x where x.angajat_id = public.sec_eu() and x.tool = 'secretariat' and x.rol = 'secretariat') then 'secretariat'
    when exists (select 1 from public.acces_tooluri x where x.angajat_id = public.sec_eu() and x.tool = 'secretariat' and x.rol = 'conducere') then 'conducere'
    when exists (select 1 from public.acces_tooluri x where x.angajat_id = public.sec_eu() and x.tool = 'secretariat' and x.rol = 'angajat') then 'angajat'
    else 'none'
  end
$$;

revoke all on function public.sec_rol() from public, anon;
grant execute on function public.sec_rol() to authenticated, service_role;

-- Șeful de departament are nevoie și el de un rol în Secretariat (Angajat cel puțin)
create or replace function public.sec_e_sef_pentru(p_grup uuid, p_angajat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.sec_rol() <> 'none' and exists (
    select 1 from public.tsk_grup_membri c
    where c.angajat_id = public.sec_eu() and c.e_coordonator
      and (
        (p_grup is not null and c.grup_id = p_grup)
        or (p_angajat is not null and exists (
              select 1 from public.tsk_grup_membri m where m.grup_id = c.grup_id and m.angajat_id = p_angajat))
      )
  )
$$;

-- Fără rol (none) nu se vede niciun document
create or replace function public.sec_vede_row(p_id uuid, p_conf boolean, p_resp_ang uuid, p_resp_grup uuid, p_semnatar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.sec_rol() = 'none' then false
    when public.sec_vede_tot() then true
    when public.sec_eu() is null then false
    when p_conf then
      coalesce(p_resp_ang = public.sec_eu(), false)
      or coalesce(p_semnatar = public.sec_eu(), false)
      or exists (select 1 from public.sec_confidential_acces x where x.document_id = p_id and x.angajat_id = public.sec_eu())
    else
      coalesce(p_resp_ang = public.sec_eu(), false)
      or coalesce(p_semnatar = public.sec_eu(), false)
      or public.sec_e_sef_pentru(p_resp_grup, p_resp_ang)
  end
$$;

revoke all on function public.sec_e_sef_pentru(uuid, uuid), public.sec_vede_row(uuid, boolean, uuid, uuid, uuid) from public, anon;
grant execute on function public.sec_e_sef_pentru(uuid, uuid), public.sec_vede_row(uuid, boolean, uuid, uuid, uuid) to authenticated, service_role;
