-- =========================================================================
-- Invitații — Migrare 3: igienă + pregătire trimitere Brevo
-- Rulează o singură dată, în SQL Editor al proiectului Supabase unic.
-- Aditivă și idempotentă: nu șterge și nu modifică date. Poate fi rulată din nou fără efect.
-- (Backup recomandat oricum, baza conține date reale.)
-- =========================================================================

-- 1. Motivul pentru care o invitație nu a putut fi trimisă (gol = fără eroare)
alter table public.invitatii add column if not exists eroare_trimitere text;

-- 2. Grant-uri strânse: aplicația folosește doar select/insert/update/delete.
--    TRUNCATE, REFERENCES și TRIGGER nu sunt necesare rolului authenticated
--    (TRUNCATE ocolește RLS). RLS rămâne neschimbat.
revoke truncate, references, trigger on
  public.persoane,
  public.invitatii,
  public.invitatii_profil_eveniment,
  public.cereri_invitati
from authenticated;

-- 3. Funcția publică de dezabonare: search_path fixat (e security definer)
alter function public.rsvp_dezabonare(uuid) set search_path = public;

-- 4. Bucketul de afișe: doar imagini JPEG/PNG, maximum 5 MB (citirea publică rămâne,
--    imaginea trebuie să se vadă în email). Fișierele deja încărcate nu sunt afectate.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png']
where id = 'afise';
