import { LogOut } from 'lucide-react'

export default function Navbar({ displayName, roleLabel, onLogout }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <div className="site-header__left">
          <img src="/assets/logo-madrigal.png" alt="Madrigal" className="site-header__logo" />
        </div>
        <div className="site-header__center">
          <h1>Taskuri</h1>
        </div>
        <div className="site-header__right">
          {displayName && (
            <span className="hidden max-w-[260px] truncate rounded-full bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 sm:inline-block">
              {displayName}
              {roleLabel ? ` · ${roleLabel}` : ''}
            </span>
          )}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 focus-ring"
            title="Deconectare"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
