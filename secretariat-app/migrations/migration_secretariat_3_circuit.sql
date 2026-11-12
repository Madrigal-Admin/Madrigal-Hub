-- =========================================================================
-- SECRETARIAT — Migrarea 3: Circuit de semnare (Etapa 2)
--
-- Statusuri documente din circuit (în aplicație): Ciornă → În lucru → Finalizat / Refuzat (+ Anulat).
-- În baza de date: ciorna → in_circuit → semnat / refuzat (valorile existente din migrarea 1).
--
-- IMPACT ASUPRA DATELOR EXISTENTE
--  • Documentele din Intrări și Ieșiri NU sunt modificate și nu se șterge niciun rând.
--  • sec_documente primește 3 coloane noi cu valori implicite (runda, ordine_semnare, locatie_hartie);
--    rândurile existente le primesc automat, fără rescriere și fără să declanșeze jurnalul.
--  • Tabel nou: sec_semnatari. View-ul sec_documente_lista se recreează (aceleași coloane + câteva noi).
--  • Se înlocuiesc funcțiile: sec_valideaza, sec_inregistreaza, sec_actualizeaza, sec_schimba_status,
--    sec_vede_row (semnatarii văd documentul lor) și se adaugă funcțiile sec_circuit_*.
-- REVENIRE: rollback_secretariat_3.sql (șterge doar ce adaugă această migrare).
-- Necesită migrările 1 și 2 rulate.
-- =========================================================================

do $$
begin
  if to_regclass('public.sec_documente') is null then
    raise exception 'Rulează mai întâi migrarea 1 (migration_secretariat_1_fundatie.sql).';
  end if;
  if to_regprocedure('public.sec_e_sef_pentru(uuid,uuid)') is null
     or position('''angajat''' in pg_get_functiondef('public.sec_rol()'::regprocedure)) = 0
     or position('x.rol = ''angajat''' in pg_get_functiondef('public.sec_rol()'::regprocedure)) = 0 then
    raise exception 'Rulează mai întâi migrarea 2 (migration_secretariat_2_roluri.sql).';
  end if;
end $$;

-- 1. Coloane noi pe documente
alter table public.sec_documente
  add column if not exists runda int not null default 1,
  add column if not exists ordine_semnare text not null default 'pe_rand',
  add column if not exists locatie_hartie text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sec_documente_ordine_semnare_check') then
    alter table public.sec_documente
      add constraint sec_documente_ordine_semnare_check check (ordine_semnare in ('pe_rand', 'paralel'));
  end if;
end $$;

-- 2. Semnatarii unui document, pe runde (relansarea după un refuz începe o rundă nouă; istoricul rămâne)
create table if not exists public.sec_semnatari (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sec_documente(id) on delete cascade,
  runda int not null default 1,
  ordine int not null check (ordine > 0),
  angajat_id uuid references public.angajati(id) on delete set null,
  nume text not null,                                -- copie a numelui, ca istoricul să rămână citibil
  stare text not null default 'asteapta' check (stare in ('asteapta', 'primit', 'semnat', 'refuzat')),
  primit_la date,
  semnat_la date,
  observatii text,
  motiv_refuz text,
  actualizat_de uuid references public.angajati(id) on delete set null,
  actualizat_la timestamptz not null default now(),
  unique (document_id, runda, ordine),
  constraint sec_semnatari_refuz_check check (stare <> 'refuzat' or length(btrim(coalesce(motiv_refuz, ''))) > 0)
);
create index if not exists sec_semnatari_document_idx on public.sec_semnatari (document_id, runda, ordine);
create index if not exists sec_semnatari_angajat_idx on public.sec_semnatari (angajat_id);
alter table public.sec_semnatari enable row level security;

-- 3. Cine vede un document: semnatarii îl văd și pe cel confidențial
create or replace function public.sec_vede_row(p_id uuid, p_conf boolean, p_resp_ang uuid, p_resp_grup uuid, p_semnatar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.sec_rol() = 'none' then false
    when public.sec_vede_tot() then true
    when public.sec_eu() is null then false
    when p_conf then
      coalesce(p_resp_ang = public.sec_eu(), false)
      or coalesce(p_semnatar = public.sec_eu(), false)
      or exists (select 1 from public.sec_semnatari s where s.document_id = p_id and s.angajat_id = public.sec_eu())
      or exists (select 1 from public.sec_confidential_acces x where x.document_id = p_id and x.angajat_id = public.sec_eu())
    else
      coalesce(p_resp_ang = public.sec_eu(), false)
      or coalesce(p_semnatar = public.sec_eu(), false)
      or exists (select 1 from public.sec_semnatari s where s.document_id = p_id and s.angajat_id = public.sec_eu())
      or public.sec_e_sef_pentru(p_resp_grup, p_resp_ang)
  end
$$;

drop policy if exists sec_semnatari_select on public.sec_semnatari;
create policy sec_semnatari_select on public.sec_semnatari for select to authenticated
  using (public.sec_vede_doc(document_id));

-- 4. Funcții existente, extinse pentru Circuit
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
    ordine_semnare     = case when p_date ? 'ordine_semnare' and v_doc.registru = 'circuit' and v_doc.status = 'ciorna'
                              then coalesce(nullif(p_date->>'ordine_semnare', ''), 'pe_rand') else ordine_semnare end,
    locatie_hartie     = case when p_date ? 'locatie_hartie' and v_doc.registru = 'circuit'
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

  v_lista := case v_doc.registru
    when 'intrari' then array['inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat']
    when 'iesiri' then array['inregistrat', 'transmis', 'confirmat', 'arhivat']
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

-- 5. Funcțiile Circuitului de semnare (scrierea în sec_semnatari se face NUMAI prin ele)

-- Numele pentru jurnal și pentru ecran
create or replace function public.sec_circuit_nume(p_angajat uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select a.nume_complet from public.angajati a where a.id = p_angajat), 'angajat șters')
$$;

-- Stabilește lista semnatarilor (în ordinea dată) și ordinea de semnare. Doar în Ciornă.
create or replace function public.sec_circuit_semnatari(p_doc uuid, p_semnatari uuid[], p_ordine text default null) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
  v_n int;
  v_distincti int;
  v_lipsa int;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să stabilești semnatarii.' using errcode = '42501';
  end if;
  select * into v_doc from public.sec_documente where id = p_doc for update;
  if not found or v_doc.registru <> 'circuit' then
    raise exception 'Documentul nu există în Circuitul de semnare.' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'ciorna' then
    raise exception 'Semnatarii se pot schimba doar cât documentul este în Ciornă.' using errcode = '22023';
  end if;
  if p_ordine is not null and p_ordine not in ('pe_rand', 'paralel') then
    raise exception 'Ordine de semnare invalidă.' using errcode = '22023';
  end if;
  v_n := coalesce(array_length(p_semnatari, 1), 0);
  select count(distinct x) into v_distincti from unnest(coalesce(p_semnatari, '{}')) x;
  if v_distincti <> v_n then
    raise exception 'Aceeași persoană apare de două ori în lista de semnatari.' using errcode = '22023';
  end if;
  select count(*) into v_lipsa from unnest(coalesce(p_semnatari, '{}')) x
    where not exists (select 1 from public.angajati a where a.id = x and a.activ);
  if v_lipsa > 0 then
    raise exception 'Semnatarii trebuie să fie angajați activi din Hub.' using errcode = '22023';
  end if;

  delete from public.sec_semnatari where document_id = p_doc and runda = v_doc.runda;
  insert into public.sec_semnatari (document_id, runda, ordine, angajat_id, nume, actualizat_de)
  select p_doc, v_doc.runda, t.ord, t.id, public.sec_circuit_nume(t.id), public.sec_eu()
  from unnest(coalesce(p_semnatari, '{}')) with ordinality as t(id, ord);

  update public.sec_documente set ordine_semnare = coalesce(p_ordine, ordine_semnare), updated_at = now()
    where id = p_doc returning * into v_doc;
  insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
  values (p_doc, public.sec_eu(), 'semnatari_stabiliti',
          jsonb_build_object('runda', v_doc.runda, 'ordine_semnare', v_doc.ordine_semnare,
            'semnatari', (select coalesce(jsonb_agg(public.sec_circuit_nume(x) order by o), '[]'::jsonb) from unnest(coalesce(p_semnatari, '{}')) with ordinality as u(x, o))));
  return v_doc;
end $$;

-- Lansează circuitul: Ciornă → În lucru
create or replace function public.sec_circuit_lanseaza(p_doc uuid) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să lansezi circuitul.' using errcode = '42501';
  end if;
  select * into v_doc from public.sec_documente where id = p_doc for update;
  if not found or v_doc.registru <> 'circuit' then
    raise exception 'Documentul nu există în Circuitul de semnare.' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'ciorna' then
    raise exception 'Doar o Ciornă poate fi trimisă la semnare.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sec_semnatari s where s.document_id = p_doc and s.runda = v_doc.runda) then
    raise exception 'Adaugă cel puțin un semnatar înainte de a trimite documentul la semnare.' using errcode = '22023';
  end if;
  update public.sec_documente
    set status = 'in_circuit',
        locatie_hartie = case when mod_semnare = 'fizica' then coalesce(locatie_hartie, 'La secretariat') else locatie_hartie end,
        updated_at = now()
    where id = p_doc returning * into v_doc;
  return v_doc;
end $$;

-- Pas de semnare: primit / semnat / refuzat / inapoi (corectarea ultimului pas)
create or replace function public.sec_circuit_pas(p_semnatar uuid, p_actiune text, p_data date default null, p_obs text default null) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_s public.sec_semnatari;
  v_doc public.sec_documente;
  v_data date := coalesce(p_data, current_date);
  v_obs text := nullif(btrim(coalesce(p_obs, '')), '');
  v_electronic boolean;
  v_status text;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să notezi pașii de semnare.' using errcode = '42501';
  end if;
  select * into v_s from public.sec_semnatari where id = p_semnatar;
  if not found then
    raise exception 'Semnatarul nu există.' using errcode = 'P0002';
  end if;
  select * into v_doc from public.sec_documente where id = v_s.document_id for update;
  select * into v_s from public.sec_semnatari where id = p_semnatar for update;
  if v_doc.registru <> 'circuit' or v_s.runda <> v_doc.runda then
    raise exception 'Acest pas aparține unei runde încheiate.' using errcode = '22023';
  end if;
  if v_doc.status not in ('in_circuit', 'semnat') or (v_doc.status = 'semnat' and p_actiune <> 'inapoi') then
    raise exception 'Documentul nu este în curs de semnare.' using errcode = '22023';
  end if;
  if v_data > current_date then
    raise exception 'Data nu poate fi în viitor.' using errcode = '22023';
  end if;
  v_electronic := v_doc.mod_semnare = 'electronica';

  if p_actiune in ('primit', 'semnat', 'refuzat') and v_doc.ordine_semnare = 'pe_rand'
     and exists (select 1 from public.sec_semnatari p
                 where p.document_id = v_s.document_id and p.runda = v_s.runda and p.ordine < v_s.ordine and p.stare <> 'semnat') then
    raise exception 'Semnarea este „pe rând”: persoanele dinaintea acestui semnatar trebuie să fi semnat.' using errcode = '22023';
  end if;

  if p_actiune = 'primit' then
    if v_s.stare <> 'asteapta' then raise exception 'Documentul a fost deja marcat ca primit.' using errcode = '22023'; end if;
    update public.sec_semnatari set stare = 'primit', primit_la = v_data, observatii = coalesce(v_obs, observatii),
      actualizat_de = public.sec_eu(), actualizat_la = now() where id = p_semnatar;
    if not v_electronic then
      update public.sec_documente set locatie_hartie = 'La ' || v_s.nume, updated_at = now() where id = v_doc.id;
    end if;
  elsif p_actiune = 'semnat' then
    if not (v_s.stare = 'primit' or (v_electronic and v_s.stare = 'asteapta')) then
      raise exception 'Marchează mai întâi documentul ca primit de către semnatar.' using errcode = '22023';
    end if;
    if v_s.primit_la is not null and v_data < v_s.primit_la then
      raise exception 'Data semnării nu poate fi înainte de data primirii.' using errcode = '22023';
    end if;
    update public.sec_semnatari set stare = 'semnat', semnat_la = v_data, observatii = coalesce(v_obs, observatii),
      actualizat_de = public.sec_eu(), actualizat_la = now() where id = p_semnatar;
    if not v_electronic then
      update public.sec_documente set locatie_hartie = 'La secretariat', updated_at = now() where id = v_doc.id;
    end if;
  elsif p_actiune = 'refuzat' then
    if not (v_s.stare = 'primit' or (v_electronic and v_s.stare = 'asteapta')) then
      raise exception 'Refuzul se notează după ce semnatarul a primit documentul.' using errcode = '22023';
    end if;
    if v_obs is null then
      raise exception 'Refuzul cere un motiv.' using errcode = '22023';
    end if;
    update public.sec_semnatari set stare = 'refuzat', semnat_la = v_data, motiv_refuz = v_obs,
      actualizat_de = public.sec_eu(), actualizat_la = now() where id = p_semnatar;
    if not v_electronic then
      update public.sec_documente set locatie_hartie = 'La secretariat', updated_at = now() where id = v_doc.id;
    end if;
  elsif p_actiune = 'inapoi' then
    if v_s.stare = 'asteapta' then raise exception 'Nu există niciun pas de anulat.' using errcode = '22023'; end if;
    if v_s.stare = 'refuzat' then raise exception 'Un refuz nu se desface; relansează circuitul.' using errcode = '22023'; end if;
    if exists (select 1 from public.sec_semnatari p
               where p.document_id = v_s.document_id and p.runda = v_s.runda and p.ordine > v_s.ordine and p.stare <> 'asteapta')
       and v_doc.ordine_semnare = 'pe_rand' then
      raise exception 'Anulează mai întâi pașii semnatarilor următori.' using errcode = '22023';
    end if;
    if v_s.stare = 'primit' then
      update public.sec_semnatari set stare = 'asteapta', primit_la = null,
        actualizat_de = public.sec_eu(), actualizat_la = now() where id = p_semnatar;
      if not v_electronic then
        update public.sec_documente set locatie_hartie = 'La secretariat', updated_at = now() where id = v_doc.id;
      end if;
    else -- semnat: electronic fără primire → așteaptă; fizic → primit
      update public.sec_semnatari
        set stare = case when v_s.primit_la is null then 'asteapta' else 'primit' end, semnat_la = null,
            actualizat_de = public.sec_eu(), actualizat_la = now() where id = p_semnatar;
      if not v_electronic and v_s.primit_la is not null then
        update public.sec_documente set locatie_hartie = 'La ' || v_s.nume, updated_at = now() where id = v_doc.id;
      end if;
    end if;
  else
    raise exception 'Acțiune necunoscută.' using errcode = '22023';
  end if;

  -- Statusul documentului se pune automat
  select case
    when exists (select 1 from public.sec_semnatari s where s.document_id = v_doc.id and s.runda = v_doc.runda and s.stare = 'refuzat') then 'refuzat'
    when not exists (select 1 from public.sec_semnatari s where s.document_id = v_doc.id and s.runda = v_doc.runda and s.stare <> 'semnat') then 'semnat'
    else 'in_circuit'
  end into v_status;
  update public.sec_documente set status = v_status, updated_at = now() where id = v_doc.id returning * into v_doc;

  insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
  values (v_doc.id, public.sec_eu(), 'pas_semnare',
          jsonb_build_object('semnatar', v_s.nume, 'actiune', p_actiune, 'data', v_data, 'observatii', v_obs));
  return v_doc;
end $$;

-- Locația hârtiei (text liber: „La secretariat”, „Trimis la biroul contabilității” etc.)
create or replace function public.sec_circuit_locatie(p_doc uuid, p_locatie text) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să modifici locația documentului.' using errcode = '42501';
  end if;
  select * into v_doc from public.sec_documente where id = p_doc for update;
  if not found or v_doc.registru <> 'circuit' then
    raise exception 'Documentul nu există în Circuitul de semnare.' using errcode = 'P0002';
  end if;
  if v_doc.status = 'anulat' then
    raise exception 'Un document anulat nu mai poate fi modificat.' using errcode = '22023';
  end if;
  update public.sec_documente set locatie_hartie = nullif(left(btrim(coalesce(p_locatie, '')), 200), ''), updated_at = now()
    where id = p_doc returning * into v_doc;
  return v_doc;
end $$;

-- Relansare după refuz: rundă nouă (istoricul rundei vechi rămâne), cu aceiași semnatari sau o listă nouă
create or replace function public.sec_circuit_relanseaza(p_doc uuid, p_semnatari uuid[] default null) returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
  v_lista uuid[];
  v_n int;
  v_distincti int;
  v_lipsa int;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să relansezi circuitul.' using errcode = '42501';
  end if;
  select * into v_doc from public.sec_documente where id = p_doc for update;
  if not found or v_doc.registru <> 'circuit' then
    raise exception 'Documentul nu există în Circuitul de semnare.' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'refuzat' then
    raise exception 'Doar un document refuzat poate fi relansat.' using errcode = '22023';
  end if;
  if p_semnatari is null then
    select coalesce(array_agg(s.angajat_id order by s.ordine), '{}') into v_lista
      from public.sec_semnatari s where s.document_id = p_doc and s.runda = v_doc.runda and s.angajat_id is not null;
  else
    v_lista := p_semnatari;
  end if;
  v_n := coalesce(array_length(v_lista, 1), 0);
  if v_n = 0 then
    raise exception 'Adaugă cel puțin un semnatar.' using errcode = '22023';
  end if;
  select count(distinct x) into v_distincti from unnest(v_lista) x;
  if v_distincti <> v_n then
    raise exception 'Aceeași persoană apare de două ori în lista de semnatari.' using errcode = '22023';
  end if;
  select count(*) into v_lipsa from unnest(v_lista) x where not exists (select 1 from public.angajati a where a.id = x and a.activ);
  if v_lipsa > 0 then
    raise exception 'Semnatarii trebuie să fie angajați activi din Hub.' using errcode = '22023';
  end if;

  insert into public.sec_semnatari (document_id, runda, ordine, angajat_id, nume, actualizat_de)
  select p_doc, v_doc.runda + 1, t.ord, t.id, public.sec_circuit_nume(t.id), public.sec_eu()
  from unnest(v_lista) with ordinality as t(id, ord);
  update public.sec_documente
    set runda = runda + 1, status = 'in_circuit',
        locatie_hartie = case when mod_semnare = 'fizica' then 'La secretariat' else locatie_hartie end,
        updated_at = now()
    where id = p_doc returning * into v_doc;
  insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
  values (p_doc, public.sec_eu(), 'relansat', jsonb_build_object('runda', v_doc.runda));
  return v_doc;
end $$;

-- 6. Lista documentelor (view recreat: aceleași coloane + coloanele noi + sumarul semnatarilor)
drop view if exists public.sec_documente_lista;
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

-- 7. Grant-uri explicite
grant select on public.sec_semnatari, public.sec_documente_lista to authenticated;
grant all on public.sec_semnatari, public.sec_documente_lista to service_role;

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
