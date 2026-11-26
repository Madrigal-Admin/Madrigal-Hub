-- =========================================================================
-- Migrarea 25 — Polish
--  1) Rapoarte de activitate: coloana „data_document" (data care apare pe documentul Word).
--     Data reală a completării (created_at) NU se schimbă niciodată. Doar adminii de activitate pot seta data_document;
--     fiecare schimbare se scrie în istoricul raportului. Gol = documentul folosește data completării.
--  2) Calendar: funcția eveniment_schimba_status() — statusul unui eveniment poate fi schimbat de adminii de calendar
--     ȘI de PM-ul evenimentului (doar statusul, nu restul datelor). Regulile existente (ex. anulare) rămân active.
-- NU modifică și NU șterge date existente. Se poate rula de mai multe ori.
-- =========================================================================

-- 1a. Coloana nouă -------------------------------------------------------------------------------------------
alter table public.rap_activitate add column if not exists data_document date;
comment on column public.rap_activitate.data_document is 'Data care apare pe documentul Word. Null = data completării (created_at). O poate seta doar adminul.';

-- 1b. La depunere, data pe document e mereu goală --------------------------------------------------------------
create or replace function public.rap_activitate_inainte_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  c record;
  inceput_luna date := make_date(new.an, new.luna, 1);
  sfarsit_luna date := (make_date(new.an, new.luna, 1) + interval '1 month' - interval '1 day')::date;
  termen date := (make_date(new.an, new.luna, 1) + interval '1 month' + interval '4 days')::date;
begin
  select * into c from public.rap_contracte where id = new.contract_id;
  if not found or not c.activ then
    raise exception 'Contractul nu este activ.';
  end if;
  if sfarsit_luna >= current_date then
    raise exception 'Raportul se poate depune doar pentru luni încheiate.';
  end if;
  if c.valabil_de_la > sfarsit_luna or (c.valabil_pana is not null and c.valabil_pana < inceput_luna) then
    raise exception 'Luna aleasă nu face parte din perioada de valabilitate a contractului.';
  end if;
  new.stare := 'trimis';
  new.cu_intarziere := current_date > termen;
  new.autor_user_id := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  new.data_document := null;
  return new;
end $$;

-- 1c. La modificare: autorul nu poate atinge data_document ---------------------------------------------------------
create or replace function public.rap_activitate_inainte_update()
returns trigger language plpgsql security definer set search_path = public
as $$
declare activ_id uuid;
begin
  new.contract_id := old.contract_id;
  new.luna := old.luna;
  new.an := old.an;
  new.cu_intarziere := old.cu_intarziere;
  new.autor_user_id := old.autor_user_id;
  new.created_at := old.created_at;
  new.updated_at := now();

  if not public.rap_e_admin_activitate() then
    -- autor: poate doar corecta textul; raportul revine la "trimis"
    new.stare := 'trimis';
    new.motiv_stare := old.motiv_stare;
    new.sablon_id := old.sablon_id;
    new.data_document := old.data_document;
    return new;
  end if;

  if new.stare = 'respins' and coalesce(btrim(new.motiv_stare), '') = '' then
    raise exception 'Respingerea are nevoie de un motiv.';
  end if;
  if old.stare = 'aprobat' and new.stare <> 'aprobat' and coalesce(btrim(new.motiv_stare), '') = '' then
    raise exception 'Redeschiderea unui raport aprobat are nevoie de un motiv.';
  end if;
  if new.stare = 'aprobat' and old.stare <> 'aprobat' then
    select id into activ_id from public.rap_sabloane where modul = 'activitate' and activ limit 1;
    new.sablon_id := coalesce(old.sablon_id, activ_id);
    new.motiv_stare := null;
  end if;
  return new;
end $$;

-- 1d. Istoricul: apare și schimbarea datei de pe document ----------------------------------------------------------
create or replace function public.rap_activitate_istoric()
returns trigger language plpgsql security definer set search_path = public
as $$
declare nume text; act text; de_la date; la_data date;
begin
  if auth.uid() is null then
    nume := 'Colaborator extern (link public)';
  else
    select coalesce(g.nume_complet, u.email) into nume
    from auth.users u left join public.angajati g on g.user_id = u.id
    where u.id = auth.uid();
  end if;

  if tg_op = 'INSERT' then
    act := 'Depus' || case when new.cu_intarziere then ' (cu întârziere)' else '' end;
  elsif old.stare is distinct from new.stare then
    act := case new.stare
      when 'trimis' then 'Retrimis'
      when 'in_verificare' then case when old.stare = 'aprobat' then 'Redeschis' else 'Preluat în verificare' end
      when 'aprobat' then 'Aprobat'
      when 'respins' then 'Respins'
    end;
  elsif old.data_document is distinct from new.data_document
        and old.activitati is not distinct from new.activitati
        and old.extra is not distinct from new.extra then
    act := null; -- doar data de pe document s-a schimbat: se scrie rândul dedicat mai jos
  else
    act := 'Text modificat';
  end if;

  if act is not null then
    insert into public.rap_istoric (raport_id, actiune, stare, motiv, user_id, nume_utilizator)
    values (new.id, act, new.stare, case when tg_op = 'UPDATE' then new.motiv_stare end, auth.uid(), nume);
  end if;

  if tg_op = 'UPDATE' and old.data_document is distinct from new.data_document then
    de_la := coalesce(old.data_document, (new.created_at at time zone 'Europe/Bucharest')::date);
    la_data := coalesce(new.data_document, (new.created_at at time zone 'Europe/Bucharest')::date);
    insert into public.rap_istoric (raport_id, actiune, stare, motiv, user_id, nume_utilizator)
    values (new.id, 'Data pe document schimbată', new.stare,
            'din ' || to_char(de_la, 'DD.MM.YYYY') || ' în ' || to_char(la_data, 'DD.MM.YYYY')
              || case when new.data_document is null then ' (data completării)' else '' end
              || ' · data completării în sistem: ' || to_char((new.created_at at time zone 'Europe/Bucharest')::date, 'DD.MM.YYYY'),
            auth.uid(), nume);
  end if;
  return new;
end $$;

-- 2. Calendar: statusul evenimentului îl poate schimba și PM-ul (doar statusul) ---------------------------------------
create or replace function public.eveniment_schimba_status(p_eveniment uuid, p_status text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Nu ești autentificat.';
  end if;
  if not (
    public.is_calendar_admin()
    or exists (select 1 from public.eveniment_pm p where p.eveniment_id = p_eveniment and p.angajat_id = public.current_angajat_id())
  ) then
    raise exception 'Nu ai dreptul să schimbi statusul acestui eveniment.';
  end if;
  if not exists (select 1 from public.statusuri_eveniment s where s.cod = p_status) then
    raise exception 'Status necunoscut.';
  end if;
  update public.evenimente set status = p_status where id = p_eveniment;
  if not found then
    raise exception 'Evenimentul nu mai există.';
  end if;
end $$;
revoke all on function public.eveniment_schimba_status(uuid, text) from public, anon;
grant execute on function public.eveniment_schimba_status(uuid, text) to authenticated;
