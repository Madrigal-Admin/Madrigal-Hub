-- =========================================================================
-- SECRETARIAT — Migrarea 6: serii, locuri libere, circuit unic pe Intrare, fără „Confirmat”
--
-- CE FACE
--  • Tabel nou „sec_serii” (RU, CTB, ACH, SEC, DEC, STM) — editabile din Setări (doar Admin Hub).
--  • Numerotare separată pe serie: contoarele devin (registru, serie, an); numărul se afișează „INT RU 3/2026”.
--  • Locuri libere: documente cu status „liber” (număr rezervat, completat ulterior cu „Completează”).
--  • O Intrare poate avea cel mult UN circuit de semnare activ (neanulat) — garantat în baza de date.
--  • Statusul „Confirmat de destinatar” dispare de la Ieșiri.
--
-- DATE EXISTENTE (documente reale/de test)
--  • TOATE documentele și contoarele existente trec în seria „SEC” (Secretariat); numerele NU se schimbă
--    (doar afișarea: „INT 1/2026” devine „INT SEC 1/2026”).
--  • Ieșirile cu status „confirmat” devin „transmis” (singura modificare de conținut; apare în jurnalul documentului).
--  • Migrarea se oprește cu un mesaj clar dacă există o Intrare cu mai multe circuite active.
--
-- ROLLBACK: rollback_secretariat_6.sql (refuză dacă există locuri libere sau documente în alte serii decât SEC).
-- =========================================================================

begin;

do $$
begin
  if to_regclass('public.sec_sters_jurnal') is null then
    raise exception 'Rulează mai întâi migrările 1–5 (ultima: migration_secretariat_5_stergere.sql).';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sec_documente' and column_name = 'circuit_id') then
    raise exception 'Rulează mai întâi migrarea 4 (migration_secretariat_4_legaturi.sql).';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sec_documente' and column_name = 'serie_id') then
    raise exception 'Migrarea 6 pare deja rulată (există coloana serie_id).';
  end if;
end $$;

do $$
declare v_lista text;
begin
  select string_agg(x.numar, ', ') into v_lista from (
    select i.nr || '/' || i.an as numar
    from public.sec_documente c join public.sec_documente i on i.id = c.legat_de
    where c.registru = 'circuit' and c.status <> 'anulat'
    group by i.id, i.nr, i.an having count(*) > 1
  ) x;
  if v_lista is not null then
    raise exception 'Intrările cu număr % au mai multe circuite active. Anulează sau șterge circuitele în plus, apoi rulează din nou migrarea.', v_lista;
  end if;
end $$;

-- 1. Seriile
create table if not exists public.sec_serii (
  id uuid primary key default gen_random_uuid(),
  cod text not null check (cod ~ '^[A-Z0-9]{1,8}$'),
  denumire text not null check (length(btrim(denumire)) > 0),
  ordine int not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists sec_serii_cod_uq on public.sec_serii (cod);
create unique index if not exists sec_serii_denumire_uq on public.sec_serii (lower(denumire));
insert into public.sec_serii (cod, denumire, ordine) values
  ('RU', 'Resurse Umane', 10), ('CTB', 'Contabilitate', 20), ('ACH', 'Achiziții', 30),
  ('SEC', 'Secretariat', 40), ('DEC', 'Decizii', 50), ('STM', 'STM', 60)
on conflict do nothing;
alter table public.sec_serii enable row level security;
drop policy if exists sec_serii_select on public.sec_serii;
create policy sec_serii_select on public.sec_serii for select to authenticated using (public.sec_rol() <> 'none');
grant select on public.sec_serii to authenticated;
grant all on public.sec_serii to service_role;

-- 2. Documente: coloana serie (toate documentele existente → SEC; jurnalul nu se umple cu această mutare tehnică)
alter table public.sec_documente add column serie_id uuid references public.sec_serii(id);
alter table public.sec_documente disable trigger sec_documente_jurnal;
update public.sec_documente set serie_id = (select id from public.sec_serii where cod = 'SEC');
alter table public.sec_documente enable trigger sec_documente_jurnal;
alter table public.sec_documente alter column serie_id set not null;
create index if not exists sec_documente_serie_idx on public.sec_documente (serie_id);

do $$
declare v_nume text;
begin
  for v_nume in
    select c.conname from pg_constraint c
    where c.conrelid = 'public.sec_documente'::regclass and c.contype = 'u'
      and (select array_agg(a.attname::text order by a.attname) from pg_attribute a where a.attrelid = c.conrelid and a.attnum = any (c.conkey)) = array['an', 'nr', 'registru']
  loop
    execute format('alter table public.sec_documente drop constraint %I', v_nume);
  end loop;
end $$;
alter table public.sec_documente add constraint sec_documente_serie_nr_uq unique (registru, serie_id, an, nr);

-- 3. Contoare pe serie
alter table public.sec_contoare add column serie_id uuid references public.sec_serii(id);
update public.sec_contoare set serie_id = (select id from public.sec_serii where cod = 'SEC');
alter table public.sec_contoare alter column serie_id set not null;
alter table public.sec_contoare drop constraint sec_contoare_pkey;
alter table public.sec_contoare add primary key (registru, serie_id, an);

-- 4. Statusuri: „liber” nou, „confirmat” dispare
update public.sec_documente set status = 'transmis' where registru = 'iesiri' and status = 'confirmat';
alter table public.sec_documente drop constraint sec_documente_status_check;
alter table public.sec_documente add constraint sec_documente_status_check check (
  (registru = 'intrari' and status in ('liber', 'inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat', 'anulat'))
  or (registru = 'iesiri' and status in ('liber', 'inregistrat', 'transmis', 'arhivat', 'anulat'))
  or (registru = 'circuit' and status in ('liber', 'ciorna', 'in_circuit', 'semnat', 'refuzat', 'arhivat', 'anulat'))
);

-- 5. Un singur circuit activ pe Intrare
create unique index if not exists sec_documente_circuit_unic on public.sec_documente (legat_de)
  where registru = 'circuit' and legat_de is not null and status <> 'anulat';

-- 6. Funcții ajutătoare
create or replace function public.sec_numar(p_registru text, p_serie uuid, p_nr int, p_an int) returns text
language sql stable security definer set search_path = public as $$
  select (case p_registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end)
         || ' ' || coalesce((select s.cod from public.sec_serii s where s.id = p_serie), '?') || ' ' || p_nr || '/' || p_an
$$;

-- Alocă următorul număr dintr-o serie (blochează contorul până la sfârșitul tranzacției → fără dubluri, fără goluri)
create or replace function public.sec_aloca_nr(p_registru text, p_serie uuid, p_data date) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_an int;
  v_start date;
  v_nr int;
begin
  if not exists (select 1 from public.sec_serii s where s.id = p_serie and s.activ) then
    raise exception 'Seria aleasă nu există sau este dezactivată.' using errcode = '22023';
  end if;
  if p_data > current_date then
    raise exception 'Data înregistrării nu poate fi în viitor.' using errcode = '22023';
  end if;
  if extract(year from p_data)::int <> extract(year from current_date)::int then
    raise exception 'Data înregistrării trebuie să fie din anul curent.' using errcode = '22023';
  end if;
  v_an := extract(year from p_data)::int;
  insert into public.sec_contoare (registru, serie_id, an, ultim_nr) values (p_registru, p_serie, v_an, 0)
  on conflict (registru, serie_id, an) do nothing;
  select c.inceput_la into v_start from public.sec_contoare c where c.registru = p_registru and c.serie_id = p_serie and c.an = v_an;
  if v_start is not null and p_data < v_start then
    raise exception 'Data înregistrării nu poate fi înainte de data de start a registrului (%).', to_char(v_start, 'DD.MM.YYYY') using errcode = '22023';
  end if;
  update public.sec_contoare set ultim_nr = ultim_nr + 1
  where registru = p_registru and serie_id = p_serie and an = v_an
  returning ultim_nr into v_nr;
  return v_nr;
end $$;

-- 6b. Funcții actualizate
create or replace function public.sec_valideaza(d public.sec_documente) returns void
language plpgsql stable set search_path = public as $$
begin
  if d.status = 'liber' then
    return;   -- loc liber rezervat: se validează abia la completare
  end if;
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
    if d.legat_de is not null and not exists (select 1 from public.sec_documente x where x.id = d.legat_de and x.registru = 'intrari') then
      raise exception 'Un document din Circuitul de semnare se poate lega doar de o Intrare.' using errcode = '22023';
    end if;
    if d.legat_de is not null and d.status <> 'anulat' and exists (
         select 1 from public.sec_documente x where x.registru = 'circuit' and x.legat_de = d.legat_de and x.status <> 'anulat' and x.id <> d.id) then
      raise exception 'Intrarea are deja un circuit de semnare activ. Deschide circuitul existent sau anuleaz-o mai întâi.' using errcode = '22023';
    end if;
  end if;
  if d.circuit_id is not null then
    if d.registru <> 'iesiri' then
      raise exception 'Legătura cu un circuit de semnare este posibilă doar la Ieșiri.' using errcode = '22023';
    end if;
    if not exists (select 1 from public.sec_documente x where x.id = d.circuit_id and x.registru = 'circuit') then
      raise exception 'Documentul din Circuitul de semnare nu există.' using errcode = '22023';
    end if;
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
  v_serie uuid := nullif(p_date->>'serie_id', '')::uuid;
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
  if nullif(p_date->>'circuit_id', '') is not null
     and not exists (select 1 from public.sec_documente c where c.id = (p_date->>'circuit_id')::uuid and c.registru = 'circuit' and c.status = 'semnat') then
    raise exception 'Se poate crea o Ieșire doar din documente „Finalizate” din Circuitul de semnare.' using errcode = '22023';
  end if;
  if v_serie is null then
    raise exception 'Alege seria documentului.' using errcode = '22023';
  end if;
  if p_registru = 'circuit' and nullif(p_date->>'legat_de', '') is not null
     and exists (select 1 from public.sec_documente x where x.registru = 'circuit' and x.legat_de = (p_date->>'legat_de')::uuid and x.status <> 'anulat') then
    raise exception 'Intrarea are deja un circuit de semnare activ. Deschide circuitul existent sau anuleaz-o mai întâi.' using errcode = '22023';
  end if;
  v_data := coalesce(nullif(p_date->>'data_inreg', '')::date, current_date);
  v_an := extract(year from v_data)::int;
  v_nr := public.sec_aloca_nr(p_registru, v_serie, v_data);

  insert into public.sec_documente (
    registru, serie_id, an, nr, data_inreg, data_document, nr_document_extern, contact_id, obiect, canal_id, tip_id,
    mod_semnare, resp_angajat_id, resp_grup_id, semnatar_id, data_transmitere, legat_de, termen_raspuns,
    rezolutie, rezolutie_data, status, confidential, creat_de, ordine_semnare, locatie_hartie, circuit_id
  ) values (
    p_registru, v_serie, v_an, v_nr, v_data,
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
         then coalesce(nullif(left(btrim(coalesce(p_date->>'locatie_hartie', '')), 200), ''), 'La secretariat') end,
    nullif(p_date->>'circuit_id', '')::uuid
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
  if v_doc.status = 'liber' and not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să completezi acest loc liber.' using errcode = '42501';
  end if;
  if v_doc.status in ('anulat', 'arhivat') then
    raise exception 'Un document anulat sau arhivat nu mai poate fi modificat.' using errcode = '22023';
  end if;

  if v_doc.status = 'liber' then
    if p_date ? 'data_inreg' and nullif(p_date->>'data_inreg', '') is not null then
      if (p_date->>'data_inreg')::date > current_date then
        raise exception 'Data înregistrării nu poate fi în viitor.' using errcode = '22023';
      end if;
      if extract(year from (p_date->>'data_inreg')::date)::int <> v_doc.an then
        raise exception 'Data înregistrării trebuie să fie din anul numărului rezervat (%).', v_doc.an using errcode = '22023';
      end if;
    end if;
    if nullif(p_date->>'circuit_id', '') is not null
       and not exists (select 1 from public.sec_documente c where c.id = (p_date->>'circuit_id')::uuid and c.registru = 'circuit' and c.status = 'semnat') then
      raise exception 'Se poate crea o Ieșire doar din documente „Finalizate” din Circuitul de semnare.' using errcode = '22023';
    end if;
  end if;
  if v_doc.registru = 'circuit' and p_date ? 'legat_de' and nullif(p_date->>'legat_de', '') is not null and v_doc.status <> 'anulat'
     and exists (select 1 from public.sec_documente x where x.registru = 'circuit' and x.legat_de = (p_date->>'legat_de')::uuid and x.status <> 'anulat' and x.id <> p_id) then
    raise exception 'Intrarea are deja un circuit de semnare activ. Deschide circuitul existent sau anuleaz-o mai întâi.' using errcode = '22023';
  end if;

  update public.sec_documente set
    data_inreg         = case when v_doc.status = 'liber' and p_date ? 'data_inreg' and nullif(p_date->>'data_inreg', '') is not null then (p_date->>'data_inreg')::date else data_inreg end,
    circuit_id         = case when v_doc.status = 'liber' and v_doc.registru = 'iesiri' and p_date ? 'circuit_id' then nullif(p_date->>'circuit_id', '')::uuid else circuit_id end,
    status             = case when v_doc.status = 'liber' then (case v_doc.registru when 'circuit' then 'ciorna' else 'inregistrat' end) else status end,
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
    ordine_semnare     = case when p_date ? 'ordine_semnare' and v_doc.registru = 'circuit' and v_doc.status in ('ciorna', 'liber')
                              then coalesce(nullif(p_date->>'ordine_semnare', ''), 'pe_rand') else ordine_semnare end,
    locatie_hartie     = case when v_doc.registru = 'circuit' and v_doc.status = 'liber'
                              then (case when coalesce(nullif(p_date->>'mod_semnare', ''), 'fizica') = 'fizica'
                                         then coalesce(nullif(left(btrim(coalesce(p_date->>'locatie_hartie', '')), 200), ''), 'La secretariat') end)
                              when p_date ? 'locatie_hartie' and v_doc.registru = 'circuit'
                              then nullif(left(btrim(coalesce(p_date->>'locatie_hartie', '')), 200), '') else locatie_hartie end,
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

  if v_doc.status = 'liber' and p_status <> 'anulat' then
    raise exception 'Completează mai întâi documentul rezervat (butonul „Completează”).' using errcode = '22023';
  end if;

  v_lista := case v_doc.registru
    when 'intrari' then array['inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat']
    when 'iesiri' then array['inregistrat', 'transmis', 'arhivat']
    else array['ciorna', 'in_circuit', 'semnat', 'refuzat', 'arhivat']
  end;
  if p_status <> 'anulat' and not (p_status = any (v_lista)) then
    raise exception 'Status invalid pentru acest registru.' using errcode = '22023';
  end if;
  if v_doc.registru = 'circuit' and p_status <> 'anulat' then
    raise exception 'Statusul unui document din Circuitul de semnare se schimbă prin pașii de semnare.' using errcode = '22023';
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
         public.sec_numar(d.registru, d.serie_id, d.nr, d.an)::text,
         d.obiect::text, d.status::text,
         array(select o.name::text from storage.objects o
               where o.bucket_id = 'secretariat-documente' and o.name like d.id::text || '/%' order by o.name)
  from public.sec_documente d join lant on lant.lid = d.id
  order by d.registru, d.an, d.nr;
end $$;

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
         public.sec_numar(d.registru, d.serie_id, d.nr, d.an),
         d.status, (select count(*) from public.sec_fisiere f where f.document_id = d.id), v_nr,
         left(btrim(p_motiv), 300), v_eu, v_nume
  from public.sec_documente d where d.id = any(p_ids);

  -- Fișiere, jurnal, semnatari și persoane numite se șterg în cascadă; legăturile rămase se desprind (set null)
  delete from public.sec_documente where id = any(p_ids);
  return v_nr;
end $$;

-- 7. Locuri libere: rezervă una sau mai multe numere goale (se completează ulterior cu „Completează”)
create or replace function public.sec_rezerva_locuri(p_registru text, p_serie uuid, p_cate int default 1, p_data date default null) returns setof public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_data date := coalesce(p_data, current_date);
  v_doc public.sec_documente;
  i int;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să rezervi locuri libere.' using errcode = '42501';
  end if;
  if p_registru not in ('intrari', 'iesiri', 'circuit') then
    raise exception 'Registru invalid.' using errcode = '22023';
  end if;
  if p_cate is null or p_cate < 1 or p_cate > 20 then
    raise exception 'Poți rezerva între 1 și 20 de locuri odată.' using errcode = '22023';
  end if;
  for i in 1..p_cate loop
    insert into public.sec_documente (registru, serie_id, an, nr, data_inreg, obiect, status, creat_de, mod_semnare)
    values (p_registru, p_serie, extract(year from v_data)::int, public.sec_aloca_nr(p_registru, p_serie, v_data), v_data, '', 'liber', public.sec_eu(), 'fizica')
    returning * into v_doc;
    return next v_doc;
  end loop;
  return;
end $$;

-- 8. Numărul de start (acum pe serie)
drop function if exists public.sec_seteaza_start(text, int, int, date);
create or replace function public.sec_seteaza_start(p_registru text, p_serie uuid, p_an int, p_urmatorul int, p_data date) returns public.sec_contoare
language plpgsql security definer set search_path = public as $$
declare
  v_c public.sec_contoare;
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate seta numărul de start.' using errcode = '42501';
  end if;
  if p_registru not in ('intrari', 'iesiri', 'circuit') then
    raise exception 'Registru invalid.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sec_serii s where s.id = p_serie) then
    raise exception 'Seria nu există.' using errcode = '22023';
  end if;
  if p_urmatorul is null or p_urmatorul < 1 then
    raise exception 'Numărul de start trebuie să fie cel puțin 1.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sec_documente d where d.registru = p_registru and d.serie_id = p_serie and d.an = p_an) then
    raise exception 'În acest registru și această serie există deja documente pe anul % — numărul de start nu mai poate fi schimbat.', p_an using errcode = '22023';
  end if;
  insert into public.sec_contoare (registru, serie_id, an, ultim_nr, inceput_la)
  values (p_registru, p_serie, p_an, p_urmatorul - 1, p_data)
  on conflict (registru, serie_id, an) do update set ultim_nr = excluded.ultim_nr, inceput_la = excluded.inceput_la
  returning * into v_c;
  return v_c;
end $$;

-- 9. Administrarea seriilor (doar Admin Hub)
create or replace function public.sec_serie_salveaza(p_id uuid, p_cod text, p_denumire text) returns public.sec_serii
language plpgsql security definer set search_path = public as $$
declare
  v_cod text := upper(btrim(coalesce(p_cod, '')));
  v_den text := btrim(coalesce(p_denumire, ''));
  v_s public.sec_serii;
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate administra seriile.' using errcode = '42501';
  end if;
  if v_cod !~ '^[A-Z0-9]{1,8}$' then
    raise exception 'Codul seriei are 1–8 caractere (litere fără diacritice sau cifre), ex. RU.' using errcode = '22023';
  end if;
  if v_den = '' then
    raise exception 'Denumirea seriei este obligatorie.' using errcode = '22023';
  end if;
  begin
    if p_id is null then
      insert into public.sec_serii (cod, denumire, ordine)
      values (v_cod, v_den, coalesce((select max(ordine) from public.sec_serii), 0) + 10)
      returning * into v_s;
    else
      select * into v_s from public.sec_serii where id = p_id for update;
      if not found then
        raise exception 'Seria nu există.' using errcode = 'P0002';
      end if;
      if v_s.cod <> v_cod and exists (select 1 from public.sec_documente d where d.serie_id = p_id) then
        raise exception 'Codul nu se mai poate schimba după primul document (numerele existente s-ar modifica). Poți schimba doar denumirea.' using errcode = '22023';
      end if;
      update public.sec_serii set cod = v_cod, denumire = v_den where id = p_id returning * into v_s;
    end if;
  exception when unique_violation then
    raise exception 'Există deja o serie cu acest cod sau cu această denumire.' using errcode = '22023';
  end;
  return v_s;
end $$;

create or replace function public.sec_serie_activeaza(p_id uuid, p_activ boolean) returns public.sec_serii
language plpgsql security definer set search_path = public as $$
declare
  v_s public.sec_serii;
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate administra seriile.' using errcode = '42501';
  end if;
  if not coalesce(p_activ, false) and not exists (select 1 from public.sec_serii x where x.activ and x.id <> p_id) then
    raise exception 'Trebuie să rămână cel puțin o serie activă.' using errcode = '22023';
  end if;
  update public.sec_serii set activ = coalesce(p_activ, false) where id = p_id returning * into v_s;
  if not found then
    raise exception 'Seria nu există.' using errcode = 'P0002';
  end if;
  return v_s;
end $$;

create or replace function public.sec_serie_sterge(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_hub_admin() then
    raise exception 'Doar adminul Hub poate administra seriile.' using errcode = '42501';
  end if;
  if exists (select 1 from public.sec_documente d where d.serie_id = p_id) then
    raise exception 'Seria are documente și nu poate fi ștearsă. Dezactiveaz-o în schimb.' using errcode = '22023';
  end if;
  delete from public.sec_contoare where serie_id = p_id;
  delete from public.sec_serii where id = p_id;
end $$;

-- 10. Lista documentelor (view) cu seria în număr
drop view if exists public.sec_documente_lista;
create view public.sec_documente_lista with (security_invoker = true) as
select
  d.*,
  case d.registru when 'intrari' then 'INT' when 'iesiri' then 'IEȘ' else 'CS' end || ' ' || se.cod || ' ' || d.nr || '/' || d.an as numar_afisat,
  se.cod as serie_cod,
  se.denumire as serie_denumire,
  c.denumire as contact_denumire,
  t.denumire as tip_denumire,
  ca.denumire as canal_denumire,
  (select count(*) from public.sec_semnatari s where s.document_id = d.id and s.runda = d.runda) as semnatari_total,
  (select count(*) from public.sec_semnatari s where s.document_id = d.id and s.runda = d.runda and s.stare = 'semnat') as semnatari_semnat,
  (select f.path from public.sec_fisiere f where f.document_id = d.id and f.curenta limit 1) as fisier_curent_path
from public.sec_documente d
join public.sec_serii se on se.id = d.serie_id
left join public.sec_contacte c on c.id = d.contact_id
left join public.sec_tipuri_document t on t.id = d.tip_id
left join public.sec_canale ca on ca.id = d.canal_id;

grant select on public.sec_documente_lista to authenticated;
grant all on public.sec_documente_lista to service_role;

-- 11. Permisiuni pe funcții (fără anon)
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

commit;
