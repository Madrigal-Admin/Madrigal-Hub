-- =========================================================================
-- Taskuri — Migrarea 3: câmpul „Tag" pe taskuri.
--  * adaugă coloana tag (text liber, opțional, max 60 caractere);
--  * completează tagul taskurilor deja create din checklist, cu numele secțiunii lor;
--  * de acum, taskurile generate din checklist primesc automat tagul = numele secțiunii.
-- Nu șterge și nu modifică alte date. Poate fi rulată de mai multe ori fără probleme.
-- =========================================================================
alter table public.tsk_taskuri add column if not exists tag text;

alter table public.tsk_taskuri drop constraint if exists tsk_taskuri_tag_valid;
alter table public.tsk_taskuri add constraint tsk_taskuri_tag_valid
  check (tag is null or (length(trim(tag)) > 0 and length(tag) <= 60));

create index if not exists tsk_taskuri_tag_idx on public.tsk_taskuri (tag) where tag is not null;

-- taskurile existente create din checklist
update public.tsk_taskuri t
set tag = s.nume
from public.tsk_checklist_itemi i
join public.tsk_checklist_sectiuni s on s.id = i.sectiune_id
where t.checklist_item_id = i.id and t.tag is null;

-- generarea din checklist pune tagul automat
create or replace function public.tsk_adauga_din_checklist_intern(p_eveniment uuid, p_items uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.tsk_taskuri (tip, titlu, eveniment_id, checklist_item_id, tag, creat_de)
  select 'eveniment', i.titlu, p_eveniment, i.id, s.nume, public.current_angajat_id()
  from public.tsk_checklist_itemi i
  join public.tsk_checklist_sectiuni s on s.id = i.sectiune_id
  where i.id = any (coalesce(p_items, '{}'))
  order by s.ordine, i.ordine
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.tsk_adauga_din_checklist_intern(uuid, uuid[]) from public, anon, authenticated;
