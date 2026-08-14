const labels = { online: 'Online', warning: 'Atenção', offline: 'Offline' }

export default function PrintersCenter({ printers, onClose, onOpenDetails }) {
  return <div className="details-backdrop" onMouseDown={onClose}>
    <section className="printers-center" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
      <header className="alert-center-header"><div><p>Inventário de equipamentos</p><h2>Impressoras cadastradas</h2><span>{printers.length} equipamentos no monitoramento</span></div><button onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="printer-cards">{printers.length === 0 ? <p className="report-empty">Nenhuma impressora cadastrada.</p> : printers.map(printer => <article className="printer-card" key={printer.id}><div><span className={`details-badge ${printer.status}`}>{labels[printer.status]}</span><h3>{printer.name}</h3><p>{printer.sector} · {printer.ip}</p></div><div className="printer-card-data"><span><small>TONER</small><strong>{printer.toner === null ? '—' : `${printer.toner}%`}</strong></span><span><small>CONTADOR</small><strong>{printer.pages.toLocaleString('pt-BR')}</strong></span></div><button onClick={() => onOpenDetails(printer)}>Ver detalhes</button></article>)}</div>
      <footer className="details-footer"><button onClick={onClose}>Voltar ao painel</button></footer>
    </section>
  </div>
}
