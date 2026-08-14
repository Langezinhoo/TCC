import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function SnmpFields({ version, community, onChange }) {
  const [target, setTarget] = useState(null)
  useEffect(() => setTarget(document.querySelector('.form-note')), [])
  if (!target) return null
  return createPortal(<fieldset className="snmp-fields"><legend>Configuração SNMP desta impressora</legend><div><label>Versão<select value={version} onChange={event => onChange('snmpVersion', event.target.value)}><option value="v2c">SNMP v2c</option><option value="v3">SNMP v3</option></select></label><label>Comunidade<input value={community} onChange={event => onChange('community', event.target.value)} placeholder="public" required /></label></div><small>Na integração final, esses dados serão usados para consultar o equipamento.</small></fieldset>, target)
}
