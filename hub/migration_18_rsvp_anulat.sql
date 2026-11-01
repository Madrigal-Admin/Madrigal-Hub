-- =========================================================================
-- HUB — Migrarea 18: pagina publică de RSVP pentru evenimente ANULATE
-- Rulează DUPĂ migrările 16 și 17. Poate fi rulată din nou.
--
--  * rsvp_get_info întoarce acum și „anulat" (true/false), ca pagina de RSVP
--    să afișeze „Evenimentul a fost anulat" în loc de butoanele de răspuns.
--  * rsvp_raspunde refuză răspunsurile la un eveniment anulat.
--  * nominalizare_creeaza refuză nominalizări pentru un eveniment anulat.
-- Restul funcțiilor rămân neschimbate.
-- =========================================================================
begin;

-- rsvp_get_info: se adaugă o coloană în rezultat, deci funcția se recreează
drop function if exists public.rsvp_get_info(uuid);
create function public.rsvp_get_info(p_token uuid)
returns table(nume_eveniment text, data date, locatie text, nume_invitat text, status_rsvp text, afis_url text, mesaj_intro text, anulat boolean)
language sql stable security definer set search_path = public
as $$
  select
    e.nume,
    e.data,
    e.locatie,
    coalesce(p.prenume || ' ' || p.nume, i.nume_complet_invitat),
    i.status_rsvp,
    ipe.afis_url,
    ipe.mesaj_intro,
    coalesce(s.comportament = 'anulat', false)
  from public.invitatii i
  join public.evenimente e on e.id = i.eveniment_id
  left join public.statusuri_eveniment s on s.cod = e.status
  left join public.persoane p on p.id = i.persoana_id
  left join public.invitatii_profil_eveniment ipe on ipe.eveniment_id = e.id
  where i.token = p_token;
$$;
revoke all on function public.rsvp_get_info(uuid) from public;
grant execute on function public.rsvp_get_info(uuid) to anon, authenticated;

create or replace function public.rsvp_raspunde(p_token uuid, p_raspuns text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_raspuns not in ('confirmat', 'refuzat') then
    raise exception 'Răspuns invalid.';
  end if;
  if exists (
    select 1 from public.invitatii i
    join public.evenimente e on e.id = i.eveniment_id
    join public.statusuri_eveniment s on s.cod = e.status
    where i.token = p_token and s.comportament = 'anulat'
  ) then
    raise exception 'eveniment_anulat';
  end if;
  update public.invitatii
  set status_rsvp = p_raspuns, data_rsvp = now()
  where token = p_token;
end;
$$;

create or replace function public.nominalizare_creeaza(
  p_eveniment_id uuid, p_solicitant_nume text, p_solicitant_functie text, p_invitati jsonb
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_nume text := regexp_replace(trim(coalesce(p_solicitant_nume, '')), '\s+', ' ', 'g');
  v_lista jsonb;
  v_deja int;
  v_acum int;
begin
  if v_nume = '' then
    raise exception 'nume_lipsa';
  end if;
  if p_solicitant_functie not in ('Corist', 'Organizare', 'Management') then
    raise exception 'functie_invalida';
  end if;
  -- evenimentul trebuie să existe și să nu fie anulat
  if not exists (
    select 1 from public.evenimente e
    join public.statusuri_eveniment s on s.cod = e.status
    where e.id = p_eveniment_id and s.comportament <> 'anulat'
  ) then
    raise exception 'eveniment_invalid';
  end if;

  -- doar nume nevide, text
  select coalesce(jsonb_agg(to_jsonb(trim(x))), '[]'::jsonb)
    into v_lista
    from jsonb_array_elements_text(coalesce(p_invitati, '[]'::jsonb)) as t(x)
   where trim(x) <> '';

  v_acum := jsonb_array_length(v_lista);
  if v_acum = 0 then
    raise exception 'fara_invitati';
  end if;

  select coalesce(sum(jsonb_array_length(invitati)), 0)
    into v_deja
    from public.cereri_invitati
   where eveniment_id = p_eveniment_id
     and lower(regexp_replace(trim(solicitant_nume), '\s+', ' ', 'g')) = lower(v_nume);

  if v_deja + v_acum > 2 then
    raise exception 'limita_2_invitati';
  end if;

  insert into public.cereri_invitati (eveniment_id, solicitant_nume, solicitant_functie, invitati)
  values (p_eveniment_id, v_nume, p_solicitant_functie, v_lista);
end;
$$;

commit;
