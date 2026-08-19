import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ClientSiteFields({ clientId, siteId, serialNumber, onChange }) {
  const [target, setTarget] = useState(null)
  const [clients, setClients] = useState([])
  useEffect(() => { setTarget(document.querySelector('.form-note')); fetch('/api/clients').then(response => response.ok ? response.json() : []).then(setClients) }, [])
  const sites = useMemo(() => clients.find(client => String(client.id) === String(clientId))?.sites ?? [], [clients, clientId])
  if (!target) return null
  return createPortal(<fieldset className="client-site-fields"><legend>Cliente e local de instalação</legend><div><label>Cliente<select value={clientId} onChange={event => { onChange('clientId', event.target.value); onChange('siteId', '') }} required><option value="">Selecione o cliente</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Site<select value={siteId} onChange={event => onChange('siteId', event.target.value)} required disabled={!clientId}><option value="">Selecione o site</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label></div><label className="serial-field">Número de série<input value={serialNumber} onChange={event => onChange('serialNumber', event.target.value)} placeholder="Ex.: CNB1234567" /></label></fieldset>, target)
}
