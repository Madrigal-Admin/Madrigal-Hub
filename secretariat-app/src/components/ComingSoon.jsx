import { Card, Titlu } from './comun'

export default function ComingSoon({ titlu }) {
  return (
    <div className="space-y-4">
      <Titlu>{titlu}</Titlu>
      <Card>
        <p className="text-sm text-slate-600">
          Această secțiune va fi disponibilă în curând. Numărul de înregistrare (CS 1/2026 etc.) și urmărirea semnatarilor se vor face aici.
        </p>
      </Card>
    </div>
  )
}
