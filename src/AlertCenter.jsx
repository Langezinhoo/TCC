export default function AlertCenter({ alerts, onClose }) {
  return <div className="details-backdrop" onMouseDown={onClose}>
    <section className="alert-center" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
      <header className="alert-center-header"><div><p>Monitoramento operacional</p><h2>Alertas automáticos</h2><span>{alerts.length} {alerts.length === 1 ? 'alerta encontrado' : 'alertas encontrados'}</span></div><button onClick={onClose} aria-label="Fechar">×</button></header>
      <div className="alert-rules"><strong>Regras ativas</strong><span>Toner abaixo de 20%</span><span>Impressora offline</span></div>
      <div className="generated-alerts">{alerts.length === 0 ? <div className="no-alerts"><b>✓</b><h3>Nenhum alerta no momento</h3><p>Todos os equipamentos estão operando normalmente.</p></div> : alerts.map(alert => <article className={`generated-alert ${alert.level}`} key={alert.id}><div className="generated-icon">{alert.level === 'offline' ? '×' : '!'}</div><div><h3>{alert.title}</h3><p>{alert.printer.name} · {alert.printer.sector}</p><small>{alert.description}</small></div><span>{alert.level === 'offline' ? 'Crítico' : 'Atenção'}</span></article>)}</div>
      <footer className="details-footer"><button onClick={onClose}>Voltar ao painel</button></footer>
    </section>
  </div>
}
