import HubHeaderAuto from '@shared/HubHeaderAuto'
import { supabase } from '../supabaseClient'

// Antetul este cel comun al Hub-ului (folderul /shared); aici doar spunem în ce tool ne aflăm.
export default function Navbar({ displayName, onLogout }) {
  return <HubHeaderAuto supabase={supabase} activ="financiar" displayName={displayName} onLogout={onLogout} />
}
