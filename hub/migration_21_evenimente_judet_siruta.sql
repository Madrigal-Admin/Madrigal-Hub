-- =========================================================================
-- Migrarea 21 — Calendar: județ + cod SIRUTA pe evenimente
-- ADAUGĂ două coloane goale pe `evenimente` (judet, siruta) și actualizează funcția `eveniment_salveaza`
-- ca să le salveze. NU modifică și NU șterge nicio valoare existentă (localitatea rămâne cum e).
-- Se poate rula de mai multe ori. Platforma Cantus Mundi poate citi: judet, localitate, siruta.
--   judet     = numele județului („București" pentru Capitală) sau „În afara României"
--   localitate= numele localității (pentru străinătate: oraș, țară, scris liber)
--   siruta    = codul SIRUTA al localității (gol pentru străinătate sau pentru evenimentele vechi necorectate)
-- =========================================================================

alter table public.evenimente add column if not exists judet text;
alter table public.evenimente add column if not exists siruta text;
create index if not exists evenimente_judet_idx on public.evenimente (judet);

create or replace function public.eveniment_salveaza(
  p_id uuid, p_ev jsonb, p_tipuri text[], p_pm uuid[]
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_data date := (p_ev->>'data')::date;
  v_sfarsit date := coalesce(nullif(p_ev->>'data_sfarsit', '')::date, (p_ev->>'data')::date);
begin
  if nullif(trim(coalesce(p_ev->>'nume', '')), '') is null then
    raise exception 'Evenimentul are nevoie de un nume.';
  end if;
  if v_data is null then
    raise exception 'Evenimentul are nevoie de o dată de început.';
  end if;
  if v_sfarsit < v_data then
    raise exception 'Data de sfârșit nu poate fi înaintea celei de început.';
  end if;

  if v_id is null then
    insert into public.evenimente (
      nume, data, data_sfarsit, ora_inceput, ora_sfarsit, status, locatie, localitate, judet, siruta,
      organizator, implicare, bilete, necesita_rsvp, necesita_costume
    ) values (
      trim(p_ev->>'nume'), v_data, v_sfarsit,
      nullif(p_ev->>'ora_inceput', ''), nullif(p_ev->>'ora_sfarsit', ''),
      coalesce(nullif(p_ev->>'status', ''), 'deschis'),
      nullif(trim(coalesce(p_ev->>'locatie', '')), ''), nullif(trim(coalesce(p_ev->>'localitate', '')), ''),
      nullif(trim(coalesce(p_ev->>'judet', '')), ''), nullif(trim(coalesce(p_ev->>'siruta', '')), ''),
      nullif(trim(coalesce(p_ev->>'organizator', '')), ''), nullif(p_ev->>'implicare', ''),
      (p_ev->>'bilete')::boolean,
      coalesce((p_ev->>'necesita_rsvp')::boolean, false), coalesce((p_ev->>'necesita_costume')::boolean, false)
    ) returning id into v_id;
  else
    update public.evenimente set
      nume = trim(p_ev->>'nume'), data = v_data, data_sfarsit = v_sfarsit,
      ora_inceput = nullif(p_ev->>'ora_inceput', ''), ora_sfarsit = nullif(p_ev->>'ora_sfarsit', ''),
      status = coalesce(nullif(p_ev->>'status', ''), status),
      locatie = nullif(trim(coalesce(p_ev->>'locatie', '')), ''),
      localitate = nullif(trim(coalesce(p_ev->>'localitate', '')), ''),
      judet = nullif(trim(coalesce(p_ev->>'judet', '')), ''),
      siruta = nullif(trim(coalesce(p_ev->>'siruta', '')), ''),
      organizator = nullif(trim(coalesce(p_ev->>'organizator', '')), ''),
      implicare = nullif(p_ev->>'implicare', ''),
      bilete = (p_ev->>'bilete')::boolean,
      necesita_rsvp = coalesce((p_ev->>'necesita_rsvp')::boolean, false),
      necesita_costume = coalesce((p_ev->>'necesita_costume')::boolean, false)
    where id = v_id;
    if not found then
      raise exception 'Nu ai dreptul să modifici acest eveniment sau nu mai există.';
    end if;
  end if;

  delete from public.eveniment_tipuri where eveniment_id = v_id and tip_cod <> all (coalesce(p_tipuri, '{}'));
  insert into public.eveniment_tipuri (eveniment_id, tip_cod)
    select v_id, x from unnest(coalesce(p_tipuri, '{}')) x on conflict do nothing;

  delete from public.eveniment_pm where eveniment_id = v_id and angajat_id <> all (coalesce(p_pm, '{}'));
  insert into public.eveniment_pm (eveniment_id, angajat_id)
    select v_id, x from unnest(coalesce(p_pm, '{}')) x on conflict do nothing;

  return v_id;
end $$;

revoke all on function public.eveniment_salveaza(uuid, jsonb, text[], uuid[]) from public, anon;
grant execute on function public.eveniment_salveaza(uuid, jsonb, text[], uuid[]) to authenticated;
