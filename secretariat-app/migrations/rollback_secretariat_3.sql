-- =========================================================================
-- SECRETARIAT — Plan de revenire pentru Migrarea 3 (Circuit de semnare)
-- ATENȚIE: șterge toate documentele din Circuitul de semnare (CS), cu semnatarii și fișierele lor
-- (rândurile din storage rămân; bucketul se curăță manual dacă e cazul). NU atinge Intrările și Ieșirile.
-- Nu se rulează după ce există documente reale în Circuit.
-- =========================================================================

-- 1. Documentele din Circuit (cascadă: semnatari, fișiere, jurnal)
delete from public.sec_documente where registru = 'circuit';
delete from public.sec_contoare where registru = 'circuit';

-- 2. View-ul se șterge acum și se recreează la pasul 6, după ce dispar coloanele noi
drop view if exists public.sec_documente_lista;


-- 3. Funcțiile Circuitului
drop function if exists public.sec_circuit_relanseaza(uuid, uuid[]);
drop function if exists public.sec_circuit_locatie(uuid, text);
drop function if exists public.sec_circuit_pas(uuid, text, date, text);
drop function if exists public.sec_circuit_lanseaza(uuid);
drop function if exists public.sec_circuit_semnatari(uuid, uuid[], text);
drop function if exists public.sec_circuit_nume(uuid);

-- 4. Tabelul semnatarilor (politica se șterge odată cu el); sec_vede_row revine mai jos la forma din migrarea 2
drop policy if exists sec_semnatari_select on public.sec_semnatari;
drop table if exists public.sec_semnatari;

-- 5. Funcțiile, înapoi la versiunile din migrările 1 și 2
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

create or replace function public.sec_valideaza(d public.sec_documente) returns void
language plpgsql stable set search_path = public as $$
begin
  if btrim(coalesce(d.obiect, '')) = '' then
    raise exception 'Obiectul documentului este obligatoriu.' using errcode = '22023';
  end if;
  if d.registru = 'intrari' then
    if d.contact_id is null then raise exception 'Expeditorul este obligatoriu.' using errcode = '22023'; end if;
    if d.data_document is null then raise exception 'Data documentului primit este obligatorie.' using errcode = '22023'; end if;
    if btrim(coalesce(d.nr_document_extern, '')) = '' then raise exception 'Numărul documentului primit este obligatoriu (sau „fără număr”).' using errcode = '22023'; end if;
    if d.canal_id is null then raise exception 'Canalul de primire este obligatoriu.' using errcode = '22023'; end if;
    if d.resp_angajat_id is null and d.resp_grup_id is null then raise exception 'Alege persoana sau departamentul căruia i se repartizează documentul.' using errcode = '22023'; end if;
  elsif d.registru = 'iesiri' then
    if d.contact_id is null then raise exception 'Destinatarul este obligatoriu.' using errcode = '22023'; end if;
    if d.canal_id is null then raise exception 'Modul de transmitere este obligatoriu.' using errcode = '22023'; end if;
    if d.resp_angajat_id is null and d.resp_grup_id is null then raise exception 'Alege departamentul sau persoana inițiatoare.' using errcode = '22023'; end if;
  end if;
  if d.termen_raspuns is not null and d.termen_raspuns < d.data_inreg then
    raise exception 'Termenul de răspuns nu poate fi înainte de data înregistrării.' using errcode = '22023';
  end if;
end $$;

create or replace function public.sec_inregistreaza(p_registru text, p_date jsonb) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := public.sec_eu();
  v_data date;
  v_an int;
  v_start date;
  v_nr int;
  v_doc public.sec_documente;
  v_acces uuid[];
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să înregistrezi documente.' using errcode = '42501';
  end if;
  if p_registru not in ('intrari', 'iesiri') then
    raise exception 'Acest registru nu este disponibil încă.' using errcode = '22023';
  end if;
  v_data := coalesce(nullif(p_date->>'data_inreg', '')::date, current_date);
  if v_data > current_date then
    raise exception 'Data înregistrării nu poate fi în viitor.' using errcode = '22023';
  end if;
  if extract(year from v_data)::int <> extract(year from current_date)::int then
    raise exception 'Data înregistrării trebuie să fie din anul curent.' using errcode = '22023';
  end if;
  v_an := extract(year from v_data)::int;

  insert into public.sec_contoare (registru, an, ultim_nr) values (p_registru, v_an, 0)
  on conflict (registru, an) do nothing;

  select c.inceput_la into v_start from public.sec_contoare c where c.registru = p_registru and c.an = v_an;
  if v_start is not null and v_data < v_start then
    raise exception 'Data înregistrării nu poate fi înainte de data de start a registrului (%).', to_char(v_start, 'DD.MM.YYYY') using errcode = '22023';
  end if;

  -- UPDATE blochează rândul contorului până la sfârșitul tranzacției: doi utilizatori simultani primesc numere diferite
  update public.sec_contoare set ultim_nr = ultim_nr + 1
  where registru = p_registru and an = v_an
  returning ultim_nr into v_nr;

  insert into public.sec_documente (
    registru, an, nr, data_inreg, data_document, nr_document_extern, contact_id, obiect, canal_id, tip_id,
    mod_semnare, resp_angajat_id, resp_grup_id, semnatar_id, data_transmitere, legat_de, termen_raspuns,
    rezolutie, rezolutie_data, status, confidential, creat_de
  ) values (
    p_registru, v_an, v_nr, v_data,
    nullif(p_date->>'data_document', '')::date,
    nullif(btrim(coalesce(p_date->>'nr_document_extern', '')), ''),
    nullif(p_date->>'contact_id', '')::uuid,
    btrim(coalesce(p_date->>'obiect', '')),
    nullif(p_date->>'canal_id', '')::uuid,
    nullif(p_date->>'tip_id', '')::uuid,
    coalesce(nullif(p_date->>'mod_semnare', ''), 'fizica'),
    nullif(p_date->>'resp_angajat_id', '')::uuid,
    nullif(p_date->>'resp_grup_id', '')::uuid,
    nullif(p_date->>'semnatar_id', '')::uuid,
    nullif(p_date->>'data_transmitere', '')::date,
    nullif(p_date->>'legat_de', '')::uuid,
    nullif(p_date->>'termen_raspuns', '')::date,
    nullif(btrim(coalesce(p_date->>'rezolutie', '')), ''),
    nullif(p_date->>'rezolutie_data', '')::date,
    'inregistrat',
    coalesce((p_date->>'confidential')::boolean, false),
    v_eu
  ) returning * into v_doc;

  perform public.sec_valideaza(v_doc);

  if v_doc.confidential and jsonb_typeof(p_date->'acces') = 'array' then
    select coalesce(array_agg(distinct e::uuid), '{}') into v_acces from jsonb_array_elements_text(p_date->'acces') e;
    insert into public.sec_confidential_acces (document_id, angajat_id)
    select v_doc.id, x from unnest(v_acces) x on conflict do nothing;
  end if;

  return v_doc;
end $$;

create or replace function public.sec_actualizeaza(p_id uuid, p_date jsonb) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
  v_doar_rezolutie boolean;
begin
  select * into v_doc from public.sec_documente where id = p_id for update;
  if not found then
    raise exception 'Documentul nu există.' using errcode = 'P0002';
  end if;
  v_doar_rezolutie := not exists (select 1 from jsonb_object_keys(p_date) k where k not in ('rezolutie', 'rezolutie_data'));
  if not (public.sec_e_staff() or (public.sec_rol() = 'conducere' and v_doar_rezolutie)) then
    raise exception 'Nu ai dreptul să modifici acest document.' using errcode = '42501';
  end if;
  if v_doc.status in ('anulat', 'arhivat') then
    raise exception 'Un document anulat sau arhivat nu mai poate fi modificat.' using errcode = '22023';
  end if;

  update public.sec_documente set
    data_document      = case when p_date ? 'data_document' then nullif(p_date->>'data_document', '')::date else data_document end,
    nr_document_extern = case when p_date ? 'nr_document_extern' then nullif(btrim(coalesce(p_date->>'nr_document_extern', '')), '') else nr_document_extern end,
    contact_id         = case when p_date ? 'contact_id' then nullif(p_date->>'contact_id', '')::uuid else contact_id end,
    obiect             = case when p_date ? 'obiect' then btrim(coalesce(p_date->>'obiect', '')) else obiect end,
    canal_id           = case when p_date ? 'canal_id' then nullif(p_date->>'canal_id', '')::uuid else canal_id end,
    tip_id             = case when p_date ? 'tip_id' then nullif(p_date->>'tip_id', '')::uuid else tip_id end,
    mod_semnare        = case when p_date ? 'mod_semnare' then coalesce(nullif(p_date->>'mod_semnare', ''), 'fizica') else mod_semnare end,
    resp_angajat_id    = case when p_date ? 'resp_angajat_id' then nullif(p_date->>'resp_angajat_id', '')::uuid else resp_angajat_id end,
    resp_grup_id       = case when p_date ? 'resp_grup_id' then nullif(p_date->>'resp_grup_id', '')::uuid else resp_grup_id end,
    semnatar_id        = case when p_date ? 'semnatar_id' then nullif(p_date->>'semnatar_id', '')::uuid else semnatar_id end,
    data_transmitere   = case when p_date ? 'data_transmitere' then nullif(p_date->>'data_transmitere', '')::date else data_transmitere end,
    legat_de           = case when p_date ? 'legat_de' then nullif(p_date->>'legat_de', '')::uuid else legat_de end,
    termen_raspuns     = case when p_date ? 'termen_raspuns' then nullif(p_date->>'termen_raspuns', '')::date else termen_raspuns end,
    rezolutie          = case when p_date ? 'rezolutie' then nullif(btrim(coalesce(p_date->>'rezolutie', '')), '') else rezolutie end,
    rezolutie_data     = case when p_date ? 'rezolutie_data' then nullif(p_date->>'rezolutie_data', '')::date else rezolutie_data end,
    updated_at         = now()
  where id = p_id
  returning * into v_doc;

  perform public.sec_valideaza(v_doc);
  return v_doc;
end $$;

create or replace function public.sec_schimba_status(p_id uuid, p_status text, p_motiv text default null) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
  v_lista text[];
  v_eu uuid := public.sec_eu();
begin
  select * into v_doc from public.sec_documente where id = p_id for update;
  if not found then
    raise exception 'Documentul nu există.' using errcode = 'P0002';
  end if;
  if v_doc.status = 'anulat' then
    raise exception 'Un document anulat nu mai poate fi modificat.' using errcode = '22023';
  end if;

  v_lista := case v_doc.registru
    when 'intrari' then array['inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat']
    when 'iesiri' then array['inregistrat', 'transmis', 'confirmat', 'arhivat']
    else array['ciorna', 'in_circuit', 'semnat', 'refuzat', 'arhivat']
  end;
  if p_status <> 'anulat' and not (p_status = any (v_lista)) then
    raise exception 'Status invalid pentru acest registru.' using errcode = '22023';
  end if;
  if p_status = v_doc.status then
    return v_doc;
  end if;

  if public.sec_e_staff() then
    null;
  elsif v_doc.registru = 'intrari'
        and p_status in ('in_lucru', 'solutionat')
        and v_doc.status in ('repartizat', 'in_lucru')
        and (coalesce(v_doc.resp_angajat_id = v_eu, false) or public.sec_e_sef_pentru(v_doc.resp_grup_id, v_doc.resp_angajat_id))
        and public.sec_vede_doc(p_id) then
    null;
  else
    raise exception 'Nu ai dreptul să schimbi statusul acestui document.' using errcode = '42501';
  end if;

  if p_status = 'anulat' then
    if btrim(coalesce(p_motiv, '')) = '' then
      raise exception 'Anularea cere un motiv.' using errcode = '22023';
    end if;
    update public.sec_documente
      set status = 'anulat', motiv_anulare = btrim(p_motiv), anulat_la = now(), anulat_de = v_eu, updated_at = now()
      where id = p_id returning * into v_doc;
  else
    update public.sec_documente set status = p_status, updated_at = now()
      where id = p_id returning * into v_doc;
  end if;
  return v_doc;
end $$;

-- 6. Coloanele adăugate de migrarea 3
alter table public.sec_documente drop constraint if exists sec_documente_ordine_semnare_check;
alter table public.sec_documente drop column if exists runda, drop column if exists ordine_semnare, drop column if exists locatie_hartie;

-- 6b. View-ul, înapoi la forma din migrarea 1
create or replace view public.sec_documente_lista with (security_invoker = true) as
select
  d.*,
  case d.registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end || ' ' || d.nr || '/' || d.an as numar_afisat,
  c.denumire as contact_denumire,
  t.denumire as tip_denumire,
  ca.denumire as canal_denumire
from public.sec_documente d
left join public.sec_contacte c on c.id = d.contact_id
left join public.sec_tipuri_document t on t.id = d.tip_id
left join public.sec_canale ca on ca.id = d.canal_id;
grant select on public.sec_documente_lista to authenticated;
grant all on public.sec_documente_lista to service_role;

-- 7. Grant-uri pe funcții
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
