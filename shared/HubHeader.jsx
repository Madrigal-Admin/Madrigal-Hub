import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'
import { GHID } from './tooluri'

// Antetul comun al întregului Hub (același în Hub și în toate tool-urile):
//  • rândul de sus: logo (stânga), „Hub Madrigal" (centru), numele + deconectare (dreapta);
//  • rândul de tool-uri: „Acasă" mereu în stânga, „Ghidul angajatului" mereu în dreapta, iar lista
//    de tool-uri centrată între ele — oricâte ar fi. Rândul nu se împarte niciodată pe două linii:
//    dacă lista nu încape, se derulează pe orizontală.
//  • pe telefon: bară de jos (Acasă / Calendar / Tool-uri).
//
// props: nume, tooluri (din construiesteTooluri), activ (cheia tool-ului curent; „acasa" pentru pagina de start),
//        onNavigate(view) — doar în Hub, ca paginile din Hub să se schimbe fără reîncărcare,
//        onGhid(key) — doar în Hub (deschide pop-up-ul); în rest se merge la Hub, la #ghid/<key>,
//        onSignOut.

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22406B]'

function Legatura({ item, titlu, className, children, onNavigate, onDone }) {
  const intern = onNavigate && item.view
  if (intern) {
    return (
      <button type="button" title={titlu} aria-label={titlu} className={className} onClick={() => { onDone?.(); onNavigate(item.view) }} aria-current={item.curent ? 'page' : undefined}>
        {children}
      </button>
    )
  }
  return (
    <a href={item.href} title={titlu} aria-label={titlu} className={className} aria-current={item.curent ? 'page' : undefined} onClick={() => onDone?.()}>
      {children}
    </a>
  )
}

function MeniuGhid({ onGhid }) {
  const [deschis, setDeschis] = useState(false)
  const radacina = useRef(null)
  useEffect(() => {
    if (!deschis) return
    const afara = (e) => { if (radacina.current && !radacina.current.contains(e.target)) setDeschis(false) }
    const tasta = (e) => e.key === 'Escape' && setDeschis(false)
    document.addEventListener('mousedown', afara)
    document.addEventListener('keydown', tasta)
    return () => { document.removeEventListener('mousedown', afara); document.removeEventListener('keydown', tasta) }
  }, [deschis])
  return (
    <div ref={radacina} className="relative flex justify-end">
      <button type="button" onClick={() => setDeschis((d) => !d)} aria-expanded={deschis} aria-haspopup="menu" className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-bold text-[#22406B] hover:bg-[#EEF1F6] ${FOCUS}`}>
        <Icon name="book" />
        <span className="hidden lg:inline">Ghidul angajatului</span>
        <span className="lg:hidden">Ghid</span>
        <Icon name="chevron" size={15} />
      </button>
      {deschis && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-[#E1E4EA] bg-white py-1 shadow-lg">
          {GHID.map((c) =>
            onGhid ? (
              <button key={c.key} role="menuitem" type="button" onClick={() => { setDeschis(false); onGhid(c.key) }} className="flex min-h-[44px] w-full items-center px-4 text-left text-sm font-medium text-[#172036] hover:bg-[#F6F8FB]">{c.label}</button>
            ) : (
              <a key={c.key} role="menuitem" href={`/#ghid/${c.key}`} className="flex min-h-[44px] w-full items-center px-4 text-sm font-medium text-[#172036] no-underline hover:bg-[#F6F8FB]">{c.label}</a>
            )
          )}
        </div>
      )}
    </div>
  )
}

// Pe telefon bara de jos acoperă conținutul; lăsăm loc la finalul paginii.
function useLocBaraJos() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const aplica = () => { document.body.style.paddingBottom = mq.matches ? '72px' : '' }
    aplica()
    mq.addEventListener('change', aplica)
    return () => { mq.removeEventListener('change', aplica); document.body.style.paddingBottom = '' }
  }, [])
}

function BaraJos({ tooluri, activ, onNavigate, onGhid }) {
  const [foaie, setFoaie] = useState(false)
  useLocBaraJos()
  const calendar = tooluri.find((t) => t.key === 'calendar')
  const item = 'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#5B6578] no-underline'
  const aprins = '!font-extrabold !text-[#22406B]'
  const acasa = { href: '/', view: 'dashboard', curent: activ === 'acasa' }
  return (
    <>
      <nav aria-label="Navigare" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-[#E1E4EA] bg-white px-2 pb-2.5 pt-1.5 sm:hidden">
        <Legatura item={acasa} onNavigate={onNavigate} className={`${item} ${activ === 'acasa' ? aprins : ''}`}><Icon name="home" size={22} />Acasă</Legatura>
        {calendar && <Legatura item={{ ...calendar, curent: activ === 'calendar' }} onNavigate={onNavigate} className={`${item} ${activ === 'calendar' ? aprins : ''}`}><Icon name="calendar" size={22} />Calendar</Legatura>}
        <button type="button" onClick={() => setFoaie(true)} className={item}><Icon name="grid" size={22} />Tool-uri</button>
      </nav>
      {foaie && (
        <div className="fixed inset-0 z-40 flex items-end bg-[#172036]/45 sm:hidden" onClick={() => setFoaie(false)}>
          <div role="dialog" aria-modal="true" aria-label="Tool-uri" className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#172036]">Tool-uri</h2>
              <button type="button" onClick={() => setFoaie(false)} aria-label="Închide" className="flex h-11 w-11 items-center justify-center rounded-lg text-[#3A465C]"><Icon name="close" size={22} /></button>
            </div>
            <div className="flex flex-col gap-2">
              {tooluri.map((t) => (
                <Legatura key={t.key} item={{ ...t, curent: t.key === activ }} onNavigate={onNavigate} onDone={() => setFoaie(false)} className={`flex min-h-[48px] items-center gap-3 rounded-xl px-4 text-[15px] no-underline ${t.key === activ ? 'bg-[#DCE6F5] font-extrabold text-[#22406B]' : 'border border-[#E1E4EA] font-semibold text-[#3A465C]'}`}>
                  <Icon name={t.icon} size={20} />{t.label}
                </Legatura>
              ))}
            </div>
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-[#5B6578]">Ghidul angajatului</h3>
            <div className="flex flex-col gap-2">
              {GHID.map((c) =>
                onGhid ? (
                  <button key={c.key} type="button" onClick={() => { setFoaie(false); onGhid(c.key) }} className="flex min-h-[48px] items-center rounded-xl border border-[#E1E4EA] px-4 text-left text-[15px] font-medium text-[#172036]">{c.label}</button>
                ) : (
                  <a key={c.key} href={`/#ghid/${c.key}`} className="flex min-h-[48px] items-center rounded-xl border border-[#E1E4EA] px-4 text-[15px] font-medium text-[#172036] no-underline">{c.label}</a>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function HubHeader({ nume, tooluri, activ, onNavigate, onGhid, onSignOut }) {
  const acasa = { href: '/', view: 'dashboard', curent: activ === 'acasa' }
  return (
    <>
      <header className="bg-white">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[#E1E4EA] px-4 sm:px-8">
          <a href="/" onClick={onNavigate ? (e) => { e.preventDefault(); onNavigate('dashboard') } : undefined} className="justify-self-start">
            <img src="/assets/logo-madrigal.png" alt="Madrigal — acasă" className="h-9 w-auto" />
          </a>
          <span className="truncate text-base font-semibold text-[#3A465C]">Hub Madrigal</span>
          <div className="flex items-center justify-self-end gap-2">
            {nume && <span className="hidden max-w-[240px] truncate rounded-full bg-[#EEF1F6] px-3.5 py-2 text-[13px] font-bold text-[#3A465C] sm:inline-block">{nume}</span>}
            <button type="button" onClick={onSignOut} aria-label="Deconectare" title="Deconectare" className={`flex h-11 w-11 items-center justify-center rounded-[10px] text-[#3A465C] hover:bg-[#EEF1F6] ${FOCUS}`}>
              <Icon name="logout" size={20} />
            </button>
          </div>
        </div>

        <nav aria-label="Tool-uri" className="hidden grid-cols-[112px_minmax(0,1fr)_112px] items-center gap-3 border-b border-[#E1E4EA] px-8 py-2.5 sm:grid lg:grid-cols-[200px_minmax(0,1fr)_200px]">
          <div className="flex justify-start">
            <Legatura item={acasa} onNavigate={onNavigate} className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-[#22406B] px-4 text-sm font-bold text-white no-underline hover:bg-[#142846] ${FOCUS}`}>
              <Icon name="home" strokeWidth={2} /> Acasă
            </Legatura>
          </div>
          {/* centrat prin margini automate: dacă nu încape, începe de la margine și se derulează */}
          <div className="flex min-w-0">
            <ul className="m-0 mx-auto flex max-w-full list-none items-center gap-1.5 overflow-x-auto p-0.5 [scrollbar-width:thin]">
              {tooluri.map((t) => {
                const aprins = t.key === activ
                return (
                  <li key={t.key} className="shrink-0">
                    <Legatura item={{ ...t, curent: aprins }} onNavigate={onNavigate} titlu={t.label} className={`inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm no-underline min-[1100px]:px-4 ${aprins ? 'bg-[#DCE6F5] font-extrabold text-[#22406B]' : 'font-semibold text-[#3A465C] hover:bg-[#EEF1F6]'} ${FOCUS}`}>
                      <Icon name={t.icon} strokeWidth={aprins ? 2.1 : 1.8} /> <span className={aprins ? '' : 'hidden min-[1100px]:inline'}>{t.label}</span>
                    </Legatura>
                  </li>
                )
              })}
            </ul>
          </div>
          <MeniuGhid onGhid={onGhid} />
        </nav>
      </header>
      <BaraJos tooluri={tooluri} activ={activ} onNavigate={onNavigate} onGhid={onGhid} />
    </>
  )
}
