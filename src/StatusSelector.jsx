import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function StatusSelector({ value, onChange }) {
  const [target, setTarget] = useState(null)
  useEffect(() => setTarget(document.querySelector('.form-note')), [])
  if (!target) return null
  return createPortal(<label className="status-field">Status inicial<select value={value} onChange={event => onChange(event.target.value)}><option value="online">Online</option><option value="warning">Atenção</option><option value="offline">Offline</option></select><small>Use este campo para simular condições até a integração SNMP.</small></label>, target)
}
