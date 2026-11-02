import EmployeesTab from './EmployeesTab'

// Resurse Umane păstrează doar datele despre angajați.
// Listele (departamente, funcții, atribuții) și zilele libere legale se administrează acum în Hub → Administrare Hub → Resurse Umane.
export default function SettingsTab() {
  return (
    <div className="space-y-10">
      <section>
        <h3 className="mb-3 font-display text-lg font-semibold text-ink">Angajați</h3>
        <EmployeesTab />
      </section>
    </div>
  )
}
