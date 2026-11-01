import { useEffect, useRef } from 'react'
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  Image as ImageIcon,
  Heading1,
  Heading2,
  Pilcrow,
} from 'lucide-react'
import { supabase } from '../../supabaseClient'

// Editor de text cu formatare de bază, folosit în toate secțiunile
// Ghidului angajatului care au nevoie de text formatat (Despre Madrigal,
// Informații utile, Ghid Resurse Umane). Mărime text (titluri), bold,
// italic, subliniat, culoare, aliniere (inclusiv centrare), listă, link
// și imagine.
//
// IMPORTANT — nu e un editor "controlat" (nu re-scrie conținutul la
// fiecare literă): HTML-ul inițial se scrie o singură dată, la montare.
// De aceea, componenta care îl folosește trebuie să-i dea un `key` care
// se schimbă ori de câte ori trebuie reîncărcat cu alt conținut (ex: la
// "Renunță" sau la schimbarea intrării editate) — altfel editorul tot
// arată conținutul vechi, scris cu mâna de utilizator. Vezi cum e folosit
// în AdminGhidDespre.jsx și AdminGhidAcordeon.jsx.
//
// Conținutul e salvat ca HTML (coloana "continut_html") și randat cu
// dangerouslySetInnerHTML în componentele publice (RichTextContent.jsx),
// cu clasa CSS "ghid-prose" (din index.css).
//
// Imaginile inserate din editor se încarcă în bucket-ul public
// "ghid-foto" și se introduc ca URL public direct în HTML.
const CULORI_TEXT = ['#1e293b', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#22406b', '#9333ea']

export default function RichTextEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null)

  // Scriem conținutul inițial o singură dată, la montare — vezi nota de
  // mai sus despre de ce componenta-părinte trebuie să schimbe `key`.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleInput() {
    onChange(editorRef.current?.innerHTML || '')
  }

  function exec(comanda, valoare) {
    editorRef.current?.focus()
    document.execCommand(comanda, false, valoare)
    handleInput()
  }

  async function handleImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const fisier = input.files?.[0]
      if (!fisier) return

      const caleStorage = `${Date.now()}-${fisier.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
      const { error: uploadError } = await supabase.storage
        .from('ghid-foto')
        .upload(caleStorage, fisier, { upsert: false })

      if (uploadError) {
        alert('Nu am putut încărca imaginea: ' + uploadError.message)
        return
      }

      const { data } = supabase.storage.from('ghid-foto').getPublicUrl(caleStorage)
      exec('insertImage', data.publicUrl)
    }
    input.click()
  }

  function handleLink() {
    const url = prompt('Adresa link-ului (ex: https://... sau /HR/):')
    if (url) exec('createLink', url)
  }

  const butoane = [
    { Icon: Heading1, titlu: 'Titlu mare', actiune: () => exec('formatBlock', '<h1>') },
    { Icon: Heading2, titlu: 'Titlu mic', actiune: () => exec('formatBlock', '<h2>') },
    { Icon: Pilcrow, titlu: 'Text normal', actiune: () => exec('formatBlock', '<p>') },
    { Icon: Bold, titlu: 'Bold', actiune: () => exec('bold') },
    { Icon: Italic, titlu: 'Italic', actiune: () => exec('italic') },
    { Icon: Underline, titlu: 'Subliniat', actiune: () => exec('underline') },
    { Icon: AlignLeft, titlu: 'Aliniat stânga', actiune: () => exec('justifyLeft') },
    { Icon: AlignCenter, titlu: 'Centrat', actiune: () => exec('justifyCenter') },
    { Icon: AlignRight, titlu: 'Aliniat dreapta', actiune: () => exec('justifyRight') },
    { Icon: List, titlu: 'Listă cu puncte', actiune: () => exec('insertUnorderedList') },
    { Icon: ListOrdered, titlu: 'Listă numerotată', actiune: () => exec('insertOrderedList') },
    { Icon: Link2, titlu: 'Link', actiune: handleLink },
    { Icon: ImageIcon, titlu: 'Imagine', actiune: handleImage },
  ]

  return (
    <div className="rich-text-editor bg-white rounded-lg border border-slate-300 overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        {butoane.map((b, i) => (
          <button
            key={i}
            type="button"
            title={b.titlu}
            onMouseDown={(e) => e.preventDefault()}
            onClick={b.actiune}
            className="w-8 h-8 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 transition"
          >
            <b.Icon size={15} />
          </button>
        ))}
        <span className="mx-1 text-slate-300 select-none">|</span>
        {CULORI_TEXT.map((culoare) => (
          <button
            key={culoare}
            type="button"
            title="Culoare text"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('foreColor', culoare)}
            className="w-6 h-6 rounded-full border border-slate-300 flex-shrink-0"
            style={{ backgroundColor: culoare }}
          />
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        data-placeholder={placeholder || ''}
        className="ghid-prose rich-text-editable min-h-[160px] px-3 py-2.5 focus:outline-none"
        suppressContentEditableWarning
      />
    </div>
  )
}
