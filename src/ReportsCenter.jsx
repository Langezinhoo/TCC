function formatDate(value) { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) }

export default function ReportsCenter({ printers, history, onClose }) {
  const totalPages = printers.reduce((total, printer) => total + Number(printer.pages || 0), 0)
  const sectors = [...new Set(printers.map(printer => printer.sector))]
  return <div className="details-backdrop" onMouseDown={onClose}>
    <section className="reports-center" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
      <header className="alert-center-header"><div><p>Análise operacional</p><h2>Relatórios e histórico</h2><span>Dados registrados neste navegador</span></div><button onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="report-metrics"><article><small>IMPRESSORAS CADASTRADAS</small><strong>{printers.length}</strong></article><article><small>CONTADORES SOMADOS</small><strong>{totalPages.toLocaleString('pt-BR')}</strong><span>páginas</span></article><article><small>SETORES ATENDIDOS</small><strong>{sectors.length}</strong></article><article><small>OCORRÊNCIAS REGISTRADAS</small><strong>{history.length}</strong></article></div>
      <section className="report-section"><h3>Uso por setor</h3>{sectors.length === 0 ? <p className="report-empty">Nenhum dado disponível.</p> : sectors.map(sector => { const pages = printers.filter(printer => printer.sector === sector).reduce((total, printer) => total + Number(printer.pages || 0), 0); const percent = totalPages ? Math.round((pages / totalPages) * 100) : 0; return <div className="sector-row" key={sector}><span>{sector}</span><div><i style={{ width: `${percent}%` }} /></div><strong>{pages.toLocaleString('pt-BR')} páginas</strong></div> })}</section>
      <section className="report-section"><h3>Histórico de ocorrências</h3><div className="history-list">{history.length === 0 ? <p className="report-empty">Nenhuma ocorrência registrada.</p> : history.slice(0, 8).map(event => <article key={event.id}><i className={event.type} /><div><strong>{event.title}</strong><p>{event.description}</p></div><time>{formatDate(event.createdAt)}</time></article>)}</div></section>
      <footer className="details-footer"><button onClick={onClose}>Voltar ao painel</button></footer>
    </section>
  </div>
}
