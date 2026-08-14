const statusLabel = { online: 'Online', warning: 'Atenção', offline: 'Offline' }

export default function PrinterDetails({ printer, onClose }) {
  const readings = [
    ['Hoje, 10:32', printer.pages, printer.toner],
    ['Ontem, 10:30', Math.max(0, printer.pages - 124), printer.toner === null ? null : Math.min(100, printer.toner + 2)],
    ['12 ago, 10:28', Math.max(0, printer.pages - 261), printer.toner === null ? null : Math.min(100, printer.toner + 5)],
  ]
  const events = printer.status === 'warning'
    ? ['Toner abaixo de 20%', 'Leitura SNMP concluída']
    : printer.status === 'offline'
      ? ['Equipamento sem resposta na rede', 'Última leitura registrada']
      : ['Leitura SNMP concluída', 'Equipamento respondeu normalmente']

  return <div className="details-backdrop" onMouseDown={onClose}>
    <section className="details-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
      <header className="details-header"><div><p>Detalhes da impressora</p><h2>{printer.name}</h2><span>{printer.sector} · {printer.ip}</span></div><button onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="details-status"><span className={`details-badge ${printer.status}`}>{statusLabel[printer.status]}</span><small>Última leitura: {printer.updated}</small></div>
      <div className="details-metrics"><div><small>MODELO</small><strong>{printer.model || printer.name}</strong></div><div><small>CONTADOR ATUAL</small><strong>{printer.pages.toLocaleString('pt-BR')} páginas</strong></div><div><small>NÍVEL DE TONER</small><strong>{printer.toner === null ? 'Indisponível' : `${printer.toner}%`}</strong></div></div>
      <section className="details-section"><h3>Histórico de leituras</h3><div className="readings"><div className="reading-head"><span>DATA</span><span>CONTADOR</span><span>TONER</span></div>{readings.map(([date, pages, toner]) => <div className="reading-row" key={date}><span>{date}</span><span>{pages.toLocaleString('pt-BR')} páginas</span><span>{toner === null ? 'Indisponível' : `${toner}%`}</span></div>)}</div></section>
      <section className="details-section"><h3>Ocorrências recentes</h3>{events.map((event, index) => <div className="event-item" key={event}><i className={index === 0 && printer.status !== 'online' ? 'event-alert' : ''} />{event}<small>{index === 0 ? 'Hoje' : 'Última leitura'}</small></div>)}</section>
      <footer className="details-footer"><button onClick={onClose}>Fechar detalhes</button></footer>
    </section>
  </div>
}
