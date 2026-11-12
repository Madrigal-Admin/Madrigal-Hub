-- =========================================================================
-- SECRETARIAT — Migrarea 1: fundația + registrele Intrări și Ieșiri
-- Proiect Supabase: qgofoygismknlqipgrng.supabase.co
--
-- Rulează O SINGURĂ DATĂ, în SQL Editor, ÎNAINTE de a încărca aplicația.
-- (Dacă apare pop-up-ul cu „Potential issues”, alege „Run and enable RLS”.)
-- Poate fi rulat și a doua oară fără pagube.
--
-- Ce face:
--   0. Verifică ce există deja în baza ta (se oprește cu mesaj clar dacă lipsește ceva).
--   1. Adaugă „secretariat” în lista de tool-uri permise din acces_tooluri.
--   2. Tabele noi (toate cu prefix sec_): contacte, canale, tipuri de document,
--      contoare de numerotare, documente, fișiere (versiuni), acces la confidențiale, jurnal.
--   3. Funcții de rol și de vizibilitate (Admin Hub / Secretariat / Conducere / Șef de departament / Angajat).
--   4. Funcții apelate din aplicație (înregistrare cu numerotare fără goluri, modificare,
--      schimbare de status, anulare, confidențial, versiuni de fișiere, număr de start).
--   5. Jurnal automat al modificărilor.
--   6. Reguli de acces (RLS) + grant-uri explicite (conform conventie-migrari-supabase.md).
--   7. Bucket privat „secretariat-documente” (PDF/JPEG/PNG, max. 25 MB) + politici pe storage.objects.
--
-- IMPACT ASUPRA DATELOR EXISTENTE: niciun rând existent nu este modificat sau șters.
-- Se adaugă doar tabele, funcții, un bucket și valoarea „secretariat” în lista permisă a
-- coloanei acces_tooluri.tool (rândurile existente rămân valide).
-- NU atinge celelalte tool-uri.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. Verificări prealabile
-- -------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'is_hub_admin'
  ) then
    raise exception 'Lipsește funcția public.is_hub_admin(). Oprește-te și spune-i dezvoltatorului.';
  end if;
  if to_regclass('public.angajati') is null or to_regclass('public.acces_tooluri') is null then
    raise exception 'Lipsesc tabelele angajati / acces_tooluri.';
  end if;
  if to_regclass('public.tsk_grupuri') is null or to_regclass('public.tsk_grup_membri') is null then
    raise exception 'Lipsesc tabelele din tool-ul Taskuri (tsk_grupuri / tsk_grup_membri), necesare pentru rolul „Șef de departament”.';
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 1. „secretariat” devine tool permis în acces_tooluri
-- -------------------------------------------------------------------------
do $$
declare c record; def text;
begin
  for c in
    select conname, pg_get_constraintdef(oid) as d from pg_constraint
    where conrelid = 'public.acces_tooluri'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) ilike '%tool%'
  loop
    if c.d not ilike '%secretariat%' then
      def := replace(c.d, '''taskuri''::text', '''taskuri''::text, ''secretariat''::text');
      if def = c.d then
        raise exception 'Nu am găsit lista de tool-uri în constrângere: %', c.d;
      end if;
      execute format('alter table public.acces_tooluri drop constraint %I', c.conname);
      execute format('alter table public.acces_tooluri add constraint %I %s', c.conname, def);
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- 2. Tabele
-- -------------------------------------------------------------------------

-- 2.1 Contacte: LISTĂ COMUNĂ pentru expeditori (Intrări) și destinatari (Ieșiri)
create table if not exists public.sec_contacte (
  id uuid primary key default gen_random_uuid(),
  denumire text not null check (length(btrim(denumire)) > 0),
  tip text not null default 'institutie' check (tip in ('institutie', 'persoana')),
  email text,
  telefon text,
  adresa text,
  observatii text,
  activ boolean not null default true,
  creat_de uuid references public.angajati(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sec_contacte_denumire_idx on public.sec_contacte (lower(denumire));

-- 2.2 Canale (canal de primire la Intrări / mod de transmitere la Ieșiri) — listă editabilă
create table if not exists public.sec_canale (
  id uuid primary key default gen_random_uuid(),
  denumire text not null check (length(btrim(denumire)) > 0),
  ordine int not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists sec_canale_denumire_uq on public.sec_canale (lower(denumire));

-- 2.3 Tipuri de document — listă editabilă
create table if not exists public.sec_tipuri_document (
  id uuid primary key default gen_random_uuid(),
  denumire text not null check (length(btrim(denumire)) > 0),
  ordine int not null default 100,
  activ boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists sec_tipuri_document_denumire_uq on public.sec_tipuri_document (lower(denumire));

-- 2.4 Contoare de numerotare: câte unul pe registru și an (reîncepe anual)
create table if not exists public.sec_contoare (
  registru text not null check (registru in ('intrari', 'iesiri', 'circuit')),
  an int not null,
  ultim_nr int not null default 0 check (ultim_nr >= 0),
  inceput_la date,           -- data de la care Hub-ul ține registrul (setată de admin)
  primary key (registru, an)
);

-- 2.5 Documentele celor trei registre (Circuit de semnare se completează în Etapa 2)
create table if not exists public.sec_documente (
  id uuid primary key default gen_random_uuid(),
  registru text not null check (registru in ('intrari', 'iesiri', 'circuit')),
  an int not null,
  nr int not null check (nr > 0),
  data_inreg date not null default current_date,
  data_document date,                       -- data de pe document (Intrări)
  nr_document_extern text,                  -- numărul de pe documentul primit (Intrări)
  contact_id uuid references public.sec_contacte(id),   -- expeditor (Intrări) / destinatar (Ieșiri)
  obiect text not null,
  canal_id uuid references public.sec_canale(id),       -- canal de primire / mod de transmitere
  tip_id uuid references public.sec_tipuri_document(id),
  mod_semnare text not null default 'fizica' check (mod_semnare in ('fizica', 'electronica')),
  resp_angajat_id uuid references public.angajati(id) on delete set null,  -- repartizat către (Intrări) / inițiator (Ieșiri)
  resp_grup_id uuid references public.tsk_grupuri(id) on delete set null,  -- idem, la nivel de departament
  semnatar_id uuid references public.angajati(id) on delete set null,      -- Ieșiri
  data_transmitere date,                    -- Ieșiri: data transmiterii efective
  rezolutie text,                           -- Intrări
  rezolutie_data date,
  legat_de uuid references public.sec_documente(id) on delete set null,    -- Intrare ↔ Ieșire
  termen_raspuns date,                      -- Intrări (manual, opțional); alertele vin în Etapa 3
  status text not null,
  confidential boolean not null default false,
  motiv_anulare text,
  anulat_la timestamptz,
  anulat_de uuid references public.angajati(id) on delete set null,
  creat_de uuid references public.angajati(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (registru, an, nr),
  constraint sec_documente_status_check check (
    (registru = 'intrari' and status in ('inregistrat', 'repartizat', 'in_lucru', 'solutionat', 'arhivat', 'anulat'))
    or (registru = 'iesiri' and status in ('inregistrat', 'transmis', 'confirmat', 'arhivat', 'anulat'))
    or (registru = 'circuit' and status in ('ciorna', 'in_circuit', 'semnat', 'refuzat', 'arhivat', 'anulat'))
  ),
  constraint sec_documente_anulare_check check (
    status <> 'anulat' or length(btrim(coalesce(motiv_anulare, ''))) > 0
  )
);
create index if not exists sec_documente_registru_an_idx on public.sec_documente (registru, an, nr desc);
create index if not exists sec_documente_resp_angajat_idx on public.sec_documente (resp_angajat_id);
create index if not exists sec_documente_resp_grup_idx on public.sec_documente (resp_grup_id);
create index if not exists sec_documente_semnatar_idx on public.sec_documente (semnatar_id);
create index if not exists sec_documente_contact_idx on public.sec_documente (contact_id);

-- 2.6 Fișierele documentelor, cu versiuni (versiunea înlocuită rămâne în istoric)
create table if not exists public.sec_fisiere (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.sec_documente(id) on delete cascade,
  versiune int not null check (versiune > 0),
  path text not null unique,                -- calea în bucketul secretariat-documente
  nume_original text not null,
  mime text not null,
  marime bigint not null,
  curenta boolean not null default true,
  inlocuit_la timestamptz,
  incarcat_de uuid references public.angajati(id) on delete set null,
  incarcat_la timestamptz not null default now(),
  unique (document_id, versiune)
);
create unique index if not exists sec_fisiere_curenta_uq on public.sec_fisiere (document_id) where curenta;

-- 2.7 Cine are acces la un document confidențial (pe lângă Secretariat, Conducere, Admin)
create table if not exists public.sec_confidential_acces (
  document_id uuid not null references public.sec_documente(id) on delete cascade,
  angajat_id uuid not null references public.angajati(id) on delete cascade,
  primary key (document_id, angajat_id)
);

-- 2.8 Jurnal de activitate (doar modificări; scris automat de triggere/funcții)
create table if not exists public.sec_jurnal (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.sec_documente(id) on delete cascade,
  angajat_id uuid references public.angajati(id) on delete set null,
  actiune text not null,
  detalii jsonb,
  la timestamptz not null default now()
);
create index if not exists sec_jurnal_document_idx on public.sec_jurnal (document_id, la);

-- Date de pornire pentru listele editabile (le poți schimba oricând din aplicație)
insert into public.sec_canale (denumire, ordine)
select v.d, v.o from (values ('Poștă', 1), ('Curier', 2), ('E-mail', 3), ('Predat personal', 4)) as v(d, o)
where not exists (select 1 from public.sec_canale c where lower(c.denumire) = lower(v.d));

insert into public.sec_tipuri_document (denumire, ordine)
select v.d, v.o from (values ('Adresă', 1), ('Cerere', 2), ('Notificare', 3), ('Factură', 4), ('Contract', 5), ('Altele', 99)) as v(d, o)
where not exists (select 1 from public.sec_tipuri_document t where lower(t.denumire) = lower(v.d));

-- -------------------------------------------------------------------------
-- 3. Funcții de rol și de vizibilitate
-- -------------------------------------------------------------------------

-- Angajatul curent (activ), după contul de autentificare
create or replace function public.sec_eu() returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from public.angajati a where a.user_id = auth.uid() and a.activ limit 1
$$;

-- Rolul în Secretariat: admin (Admin Hub) > secretariat > conducere > angajat (implicit, orice angajat activ) > none
create or replace function public.sec_rol() returns text
language sql stable security definer set search_path = public as $$
  select case
    when public.is_hub_admin() then 'admin'
    when exists (select 1 from public.acces_tooluri x where x.angajat_id = public.sec_eu() and x.tool = 'secretariat' and x.rol = 'secretariat') then 'secretariat'
    when exists (select 1 from public.acces_tooluri x where x.angajat_id = public.sec_eu() and x.tool = 'secretariat' and x.rol = 'conducere') then 'conducere'
    when public.sec_eu() is not null then 'angajat'
    else 'none'
  end
$$;

-- Înregistrează, modifică, încarcă fișiere, anulează
create or replace function public.sec_e_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.sec_rol() in ('admin', 'secretariat')
$$;

-- Vede toate documentele (inclusiv confidențialele)
create or replace function public.sec_vede_tot() returns boolean
language sql stable security definer set search_path = public as $$
  select public.sec_rol() in ('admin', 'secretariat', 'conducere')
$$;

-- Șef de departament = coordonator de grup în tool-ul Taskuri (tsk_grup_membri.e_coordonator).
-- Adevărat dacă e coordonatorul grupului dat SAU al unui grup din care face parte persoana dată.
create or replace function public.sec_e_sef_pentru(p_grup uuid, p_angajat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tsk_grup_membri c
    where c.angajat_id = public.sec_eu() and c.e_coordonator
      and (
        (p_grup is not null and c.grup_id = p_grup)
        or (p_angajat is not null and exists (
              select 1 from public.tsk_grup_membri m where m.grup_id = c.grup_id and m.angajat_id = p_angajat))
      )
  )
$$;

-- Poate vedea documentul cu aceste valori (folosită de politici și de view)
create or replace function public.sec_vede_row(p_id uuid, p_conf boolean, p_resp_ang uuid, p_resp_grup uuid, p_semnatar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
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

create or replace function public.sec_vede_doc(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.sec_vede_row(d.id, d.confidential, d.resp_angajat_id, d.resp_grup_id, d.semnatar_id)
    from public.sec_documente d where d.id = p_id
  ), false)
$$;

-- Un contact este vizibil dacă există un document vizibil care îl folosește
create or replace function public.sec_vede_contact(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sec_documente d
    where d.contact_id = p_id
      and public.sec_vede_row(d.id, d.confidential, d.resp_angajat_id, d.resp_grup_id, d.semnatar_id)
  )
$$;

-- Poate încărca fișiere la acest document (Etapa 2 adaugă inițiatorul la Circuit)
create or replace function public.sec_poate_incarca_doc(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_id is not null and public.sec_e_staff()
    and exists (select 1 from public.sec_documente d where d.id = p_id and d.status <> 'anulat')
$$;

-- Primul segment din calea unui fișier = id-ul documentului (null dacă nu arată a UUID)
create or replace function public.sec_uuid_din_cale(p_name text) returns uuid
language sql immutable set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

-- Lista departamentelor (grupurilor din Taskuri), pentru orice utilizator al Secretariatului
create or replace function public.sec_grupuri_lista() returns table (id uuid, nume text)
language sql stable security definer set search_path = public as $$
  select g.id, g.nume from public.tsk_grupuri g where public.sec_rol() <> 'none' order by g.nume
$$;

-- Membrii unui departament (pentru filtrul „departament”): doar Secretariat/Conducere/Admin sau șeful lui
create or replace function public.sec_membri_grup(p_grup uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.angajat_id from public.tsk_grup_membri m
  where m.grup_id = p_grup and (public.sec_vede_tot() or public.sec_e_sef_pentru(p_grup, null))
$$;

-- -------------------------------------------------------------------------
-- 4. Funcții apelate din aplicație (singurul mod de a scrie în sec_documente)
-- -------------------------------------------------------------------------

-- Verifică câmpurile obligatorii (decise la proiectare)
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

-- Înregistrare: dă numărul următor din registru (fără goluri, fără dubluri la utilizatori simultani)
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

-- Modificarea câmpurilor (nu și a numărului, datei înregistrării sau registrului).
-- Conducerea poate modifica doar rezoluția.
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

-- Schimbarea statusului.
--  • Secretariat/Admin: orice status din registrul respectiv; „anulat” cere motiv și nu mai poate fi schimbat.
--  • Persoana repartizată (sau șeful ei), doar la Intrări: Repartizat/În lucru → În lucru / Soluționat.
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

-- Marcaj „confidențial” + lista persoanelor numite (pe lângă Secretariat, Conducere, Admin,
-- persoana repartizată/inițiatoare și semnatar, care îl văd oricum)
create or replace function public.sec_seteaza_confidential(p_id uuid, p_conf boolean, p_angajati uuid[] default '{}') returns public.sec_documente
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
begin
  if not public.sec_e_staff() then
    raise exception 'Nu ai dreptul să modifici caracterul confidențial.' using errcode = '42501';
  end if;
  select * into v_doc from public.sec_documente where id = p_id for update;
  if not found then
    raise exception 'Documentul nu există.' using errcode = 'P0002';
  end if;
  if v_doc.status in ('anulat', 'arhivat') then
    raise exception 'Un document anulat sau arhivat nu mai poate fi modificat.' using errcode = '22023';
  end if;
  update public.sec_documente set confidential = p_conf, updated_at = now() where id = p_id returning * into v_doc;
  delete from public.sec_confidential_acces where document_id = p_id;
  if p_conf then
    insert into public.sec_confidential_acces (document_id, angajat_id)
    select p_id, x from (select distinct unnest(coalesce(p_angajati, '{}')) as x) s;
  end if;
  insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
  values (p_id, public.sec_eu(), 'acces_confidential', jsonb_build_object('confidential', p_conf, 'persoane', coalesce(to_jsonb(p_angajati), '[]'::jsonb)));
  return v_doc;
end $$;

-- Înregistrează un fișier deja încărcat în bucket ca versiune nouă (cea veche rămâne în istoric)
create or replace function public.sec_adauga_versiune(p_doc uuid, p_path text, p_nume text) returns public.sec_fisiere
language plpgsql security definer set search_path = public as $$
declare
  v_doc public.sec_documente;
  v_obj record;
  v_mime text;
  v_marime bigint;
  v_ver int;
  v_f public.sec_fisiere;
begin
  select * into v_doc from public.sec_documente where id = p_doc for update;
  if not found then
    raise exception 'Documentul nu există.' using errcode = 'P0002';
  end if;
  if not public.sec_poate_incarca_doc(p_doc) then
    raise exception 'Nu ai dreptul să încarci fișiere la acest document.' using errcode = '42501';
  end if;
  if left(p_path, length(p_doc::text) + 1) <> p_doc::text || '/' then
    raise exception 'Calea fișierului nu corespunde documentului.' using errcode = '22023';
  end if;
  select o.name, o.metadata into v_obj from storage.objects o
    where o.bucket_id = 'secretariat-documente' and o.name = p_path;
  if not found then
    raise exception 'Fișierul nu a fost găsit în spațiul de stocare.' using errcode = 'P0002';
  end if;
  v_mime := v_obj.metadata->>'mimetype';
  v_marime := coalesce((v_obj.metadata->>'size')::bigint, 0);
  if v_mime is null or v_mime not in ('application/pdf', 'image/jpeg', 'image/png') then
    raise exception 'Sunt permise doar PDF, JPEG și PNG.' using errcode = '22023';
  end if;
  if v_mime like 'image/%' and v_marime > 10485760 then
    raise exception 'Imaginile pot avea cel mult 10 MB.' using errcode = '22023';
  end if;
  if v_marime > 26214400 then
    raise exception 'Fișierele pot avea cel mult 25 MB.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sec_fisiere f where f.path = p_path) then
    raise exception 'Acest fișier este deja înregistrat.' using errcode = '23505';
  end if;

  select coalesce(max(f.versiune), 0) + 1 into v_ver from public.sec_fisiere f where f.document_id = p_doc;
  update public.sec_fisiere set curenta = false, inlocuit_la = now() where document_id = p_doc and curenta;
  insert into public.sec_fisiere (document_id, versiune, path, nume_original, mime, marime, curenta, incarcat_de)
  values (p_doc, v_ver, p_path, left(coalesce(nullif(btrim(p_nume), ''), 'document'), 200), v_mime, v_marime, true, public.sec_eu())
  returning * into v_f;
  update public.sec_documente set updated_at = now() where id = p_doc;
  return v_f;
end $$;

-- Numărul de start al unui registru pe un an (doar Admin Hub, doar cât timp nu există documente)
create or replace function public.sec_seteaza_start(p_registru text, p_an int, p_urmatorul int, p_data date) returns public.sec_contoare
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
  if p_urmatorul is null or p_urmatorul < 1 then
    raise exception 'Numărul de start trebuie să fie cel puțin 1.' using errcode = '22023';
  end if;
  if exists (select 1 from public.sec_documente d where d.registru = p_registru and d.an = p_an) then
    raise exception 'În acest registru există deja documente pe anul % — numărul de start nu mai poate fi schimbat.', p_an using errcode = '22023';
  end if;
  insert into public.sec_contoare (registru, an, ultim_nr, inceput_la)
  values (p_registru, p_an, p_urmatorul - 1, p_data)
  on conflict (registru, an) do update set ultim_nr = excluded.ultim_nr, inceput_la = excluded.inceput_la
  returning * into v_c;
  return v_c;
end $$;

-- -------------------------------------------------------------------------
-- 5. Jurnal automat (doar modificări)
-- -------------------------------------------------------------------------
create or replace function public.sec_jurnal_doc() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
    values (new.id, public.sec_eu(), 'inregistrat', jsonb_build_object('registru', new.registru, 'an', new.an, 'nr', new.nr));
  else
    select jsonb_object_agg(n.key, jsonb_build_object('de_la', o.value, 'la', n.value))
      into v_diff
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value and n.key <> 'updated_at';
    if v_diff is not null then
      insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
      values (new.id, public.sec_eu(), case when v_diff ? 'status' then 'status' else 'modificat' end, v_diff);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists sec_documente_jurnal on public.sec_documente;
create trigger sec_documente_jurnal after insert or update on public.sec_documente
  for each row execute function public.sec_jurnal_doc();

create or replace function public.sec_jurnal_fisier() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sec_jurnal (document_id, angajat_id, actiune, detalii)
  values (new.document_id, public.sec_eu(), 'fisier_adaugat',
          jsonb_build_object('versiune', new.versiune, 'nume', new.nume_original, 'marime', new.marime));
  return null;
end $$;

drop trigger if exists sec_fisiere_jurnal on public.sec_fisiere;
create trigger sec_fisiere_jurnal after insert on public.sec_fisiere
  for each row execute function public.sec_jurnal_fisier();

-- -------------------------------------------------------------------------
-- 6. Reguli de acces (RLS) și grant-uri explicite
-- -------------------------------------------------------------------------
alter table public.sec_contacte enable row level security;
alter table public.sec_canale enable row level security;
alter table public.sec_tipuri_document enable row level security;
alter table public.sec_contoare enable row level security;
alter table public.sec_documente enable row level security;
alter table public.sec_fisiere enable row level security;
alter table public.sec_confidential_acces enable row level security;
alter table public.sec_jurnal enable row level security;

-- Documente: citire după regulile de vizibilitate; scriere NUMAI prin funcții
drop policy if exists sec_documente_select on public.sec_documente;
create policy sec_documente_select on public.sec_documente for select to authenticated
  using (public.sec_vede_row(id, confidential, resp_angajat_id, resp_grup_id, semnatar_id));

-- Fișiere: se văd dacă se vede documentul; scriere NUMAI prin sec_adauga_versiune
drop policy if exists sec_fisiere_select on public.sec_fisiere;
create policy sec_fisiere_select on public.sec_fisiere for select to authenticated
  using (public.sec_vede_doc(document_id));

-- Lista de acces la confidențiale: Secretariat/Conducere/Admin sau persoana însăși
drop policy if exists sec_confidential_acces_select on public.sec_confidential_acces;
create policy sec_confidential_acces_select on public.sec_confidential_acces for select to authenticated
  using (public.sec_vede_tot() or angajat_id = public.sec_eu());

-- Jurnal: doar Secretariat/Conducere/Admin
drop policy if exists sec_jurnal_select on public.sec_jurnal;
create policy sec_jurnal_select on public.sec_jurnal for select to authenticated
  using (public.sec_vede_tot());

-- Contoare: doar Secretariat/Admin (scrierea prin funcții)
drop policy if exists sec_contoare_select on public.sec_contoare;
create policy sec_contoare_select on public.sec_contoare for select to authenticated
  using (public.sec_e_staff());

-- Contacte: se văd cele folosite de documentele vizibile (Secretariat/Conducere/Admin le văd pe toate)
drop policy if exists sec_contacte_select on public.sec_contacte;
create policy sec_contacte_select on public.sec_contacte for select to authenticated
  using (public.sec_vede_tot() or public.sec_vede_contact(id));
drop policy if exists sec_contacte_insert on public.sec_contacte;
create policy sec_contacte_insert on public.sec_contacte for insert to authenticated
  with check (public.sec_e_staff());
drop policy if exists sec_contacte_update on public.sec_contacte;
create policy sec_contacte_update on public.sec_contacte for update to authenticated
  using (public.sec_e_staff()) with check (public.sec_e_staff());

-- Liste editabile (canale, tipuri): citire pentru orice utilizator al tool-ului, scriere Secretariat/Admin
drop policy if exists sec_canale_select on public.sec_canale;
create policy sec_canale_select on public.sec_canale for select to authenticated using (public.sec_rol() <> 'none');
drop policy if exists sec_canale_write on public.sec_canale;
create policy sec_canale_write on public.sec_canale for all to authenticated
  using (public.sec_e_staff()) with check (public.sec_e_staff());
drop policy if exists sec_tipuri_select on public.sec_tipuri_document;
create policy sec_tipuri_select on public.sec_tipuri_document for select to authenticated using (public.sec_rol() <> 'none');
drop policy if exists sec_tipuri_write on public.sec_tipuri_document;
create policy sec_tipuri_write on public.sec_tipuri_document for all to authenticated
  using (public.sec_e_staff()) with check (public.sec_e_staff());

-- Lista documentelor, cu denumirile din liste (rulează cu drepturile utilizatorului, deci cu aceleași reguli RLS)
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

-- Grant-uri explicite (nimic pentru anon: tool-ul nu are pagini publice)
grant select on public.sec_documente, public.sec_documente_lista, public.sec_fisiere,
  public.sec_confidential_acces, public.sec_jurnal, public.sec_contoare to authenticated;
grant select, insert, update on public.sec_contacte to authenticated;
grant select, insert, update, delete on public.sec_canale, public.sec_tipuri_document to authenticated;
grant all on public.sec_contacte, public.sec_canale, public.sec_tipuri_document, public.sec_contoare,
  public.sec_documente, public.sec_documente_lista, public.sec_fisiere, public.sec_confidential_acces,
  public.sec_jurnal to service_role;

-- Funcțiile: doar utilizatorii autentificați (și service_role); nimic pentru anon
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

-- -------------------------------------------------------------------------
-- 7. Spațiu privat pentru documente (PDF/JPEG/PNG, max. 25 MB; imaginile max. 10 MB se verifică în sec_adauga_versiune)
-- -------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('secretariat-documente', 'secretariat-documente', false, 26214400,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false, file_size_limit = 26214400,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- Încărcare: Secretariat/Admin, în folderul unui document existent și neanulat.
-- Citire (și URL-uri semnate): cine vede documentul. Fără modificare/ștergere din aplicație.
drop policy if exists sec_storage_insert on storage.objects;
create policy sec_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'secretariat-documente' and public.sec_poate_incarca_doc(public.sec_uuid_din_cale(name)));
drop policy if exists sec_storage_select on storage.objects;
create policy sec_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'secretariat-documente' and public.sec_vede_doc(public.sec_uuid_din_cale(name)));
