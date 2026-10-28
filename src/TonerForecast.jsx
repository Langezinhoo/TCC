import { useEffect, useState } from 'react'

export default function TonerForecast({ printerId }) {
  const [forecast, setForecast] = useState(null)
  useEffect(() => { fetch(`/api/printers/${printerId}/forecast`).then(response => response.ok ? response.json() : null).then(setForecast) }, [printerId])
  if (!forecast) return null
  return <section className="forecast-card"><small>PREVISÃO DE TONER</small>{forecast.available ? <><strong>{forecast.daysRemaining} dias restantes</strong><span>Consumo médio: {forecast.consumptionPerDay.toFixed(1)}% ao dia</span></> : <><strong>Previsão indisponível</strong><span>{forecast.message}</span></>}</section>
}
