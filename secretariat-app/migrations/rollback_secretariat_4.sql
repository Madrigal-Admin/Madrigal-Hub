-- =========================================================================
-- SECRETARIAT — Plan de revenire pentru Migrarea 4 (legături Intrare → Circuit → Ieșire)
-- Șterge coloana „circuit_id” (legăturile Ieșire → Circuit se pierd; documentele rămân) și
-- readuce funcțiile și view-ul la forma din migrarea 3. Nu șterge niciun document.
-- =========================================================================

drop view if exists public.sec_documente_lista;
alter table public.sec_documente drop column if exists circuit_id;

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
  elsif d.registru = 'circuit' then
    if d.resp_angajat_id is null and d.resp_grup_id is null then raise exception 'Alege persoana sau departamentul care inițiază documentul.' using errcode = '22023'; end if;
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
  if p_registru not in ('intrari', 'iesiri', 'circuit') then
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
    rezolutie, rezolutie_data, status, confidential, creat_de, ordine_semnare, locatie_hartie
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
    case when p_registru = 'circuit' then 'ciorna' else 'inregistrat' end,
    coalesce((p_date->>'confidential')::boolean, false),
    v_eu,
    coalesce(nullif(p_date->>'ordine_semnare', ''), 'pe_rand'),
    case when p_registru = 'circuit' and coalesce(nullif(p_date->>'mod_semnare', ''), 'fizica') = 'fizica'
         then coalesce(nullif(left(btrim(coalesce(p_date->>'locatie_hartie', '')), 200), ''), 'La secretariat') end
  ) returning * into v_doc;

  perform public.sec_valideaza(v_doc);

  if v_doc.confidential and jsonb_typeof(p_date->'acces') = 'array' then
    select coalesce(array_agg(distinct e::uuid), '{}') into v_acces from jsonb_array_elements_text(p_date->'acces') e;
    insert into public.sec_confidential_acces (document_id, angajat_id)
    select v_doc.id, x from unnest(v_acces) x on conflict do nothing;
  end if;

  return v_doc;
end $$;

create view public.sec_documente_lista with (security_invoker = true) as
select
  d.*,
  case d.registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end || ' ' || d.nr || '/' || d.an as numar_afisat,
  c.denumire as contact_denumire,
  t.denumire as tip_denumire,
  ca.denumire as canal_denumire,
  (select count(*) from public.sec_semnatari s where s.document_id = d.id and s.runda = d.runda) as semnatari_total,
  (select count(*) from public.sec_semnatari s where s.document_id = d.id and s.runda = d.runda and s.stare = 'semnat') as semnatari_semnat,
  (select f.path from public.sec_fisiere f where f.document_id = d.id and f.curenta limit 1) as fisier_curent_path
from public.sec_documente d
left join public.sec_contacte c on c.id = d.contact_id
left join public.sec_tipuri_document t on t.id = d.tip_id
left join public.sec_canale ca on ca.id = d.canal_id;

grant select on public.sec_documente_lista to authenticated;
grant all on public.sec_documente_lista to service_role;

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
