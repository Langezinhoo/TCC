import { useEffect, useMemo, useState } from 'react'
import { printers as initialPrinters } from './data/printers.js'
import PrinterDetails from './PrinterDetails.jsx'
import AlertCenter from './AlertCenter.jsx'
import ReportsCenter from './ReportsCenter.jsx'
import PrintersCenter from './PrintersCenter.jsx'
import StatusSelector from './StatusSelector.jsx'
import SettingsCenter from './SettingsCenter.jsx'
import SnmpFields from './SnmpFields.jsx'

const STORAGE_KEY = 'printwatch_printers'
const HISTORY_STORAGE_KEY = 'printwatch_history'
const SETTINGS_STORAGE_KEY = 'printwatch_settings'
const API_URL = '/api'
const icons = { grid: '▦', printer: '▣', bell: '◉', chart: '↗', settings: '⚙', search: '⌕', refresh: '↻', add: '+', dots: '•••', check: '✓', alert: '!', x: '×' }

function Status({ type }) {
  const labels = { online: 'Online', warning: 'Atenção', offline: 'Offline' }
  return <span className={`status ${type}`}><i />{labels[type]}</span>
}

export default function App() {
  const [active, setActive] = useState('Visão geral')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [lastUpdate, setLastUpdate] = useState('Agora mesmo')
  const [toast, setToast] = useState('')
  const [printerList, setPrinterList] = useState(() => {
    const savedPrinters = localStorage.getItem(STORAGE_KEY)
    return savedPrinters ? JSON.parse(savedPrinters) : initialPrinters
  })
  const [showForm, setShowForm] = useState(false)
  const [editingPrinter, setEditingPrinter] = useState(null)
  const [selectedPrinter, setSelectedPrinter] = useState(null)
  const [history, setHistory] = useState(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY)
    return savedHistory ? JSON.parse(savedHistory) : []
  })
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return savedSettings ? JSON.parse(savedSettings) : { tonerThreshold: 20, snmpVersion: 'v2c', community: 'public' }
  })
  const [showSettings, setShowSettings] = useState(false)
  const [form, setForm] = useState({ name: '', sector: '', ip: '', model: '', toner: 100, pages: 0, status: 'online', snmpVersion: 'v2c', community: 'public' })

  const visiblePrinters = useMemo(() => printerList.filter(printer =>
    (filter === 'all' || printer.status === filter) && `${printer.name} ${printer.sector}`.toLowerCase().includes(search.toLowerCase()),
  ), [filter, search, printerList])
  const automaticAlerts = useMemo(() => printerList.flatMap(printer => {
    if (printer.status === 'offline') return [{ id: `${printer.id}-offline`, printer, level: 'offline', title: 'Impressora offline', description: 'O equipamento não responde à consulta de rede.' }]
    if (printer.toner !== null && printer.toner < settings.tonerThreshold) return [{ id: `${printer.id}-toner`, printer, level: 'warning', title: 'Toner baixo', description: `O nível atual de toner é ${printer.toner}%.` }]
    return []
  }), [printerList, settings.tonerThreshold])

  useEffect(() => { loadFromApi() }, [])

  useEffect(() => {
    const formElement = document.querySelector('.modal form')
    if (formElement) formElement.noValidate = true
  }, [showForm])

  useEffect(() => {
    const settingsButton = document.querySelector('.sidebar-bottom > button')
    const openSettings = () => setShowSettings(true)
    settingsButton?.addEventListener('click', openSettings)
    return () => settingsButton?.removeEventListener('click', openSettings)
  }, [])

  useEffect(() => {
    const tableBody = document.querySelector('.table-wrap tbody')
    function openDetails(event) {
      if (event.target.closest('button')) return
      const row = event.target.closest('tr')
      const name = row?.querySelector('strong')?.textContent
      const printer = printerList.find(item => item.name === name)
      if (printer) setSelectedPrinter(printer)
    }
    tableBody?.addEventListener('click', openDetails)
    return () => tableBody?.removeEventListener('click', openDetails)
  }, [printerList])

  function showToast(message) { setToast(message); setTimeout(() => setToast(''), 2500) }
  async function loadFromApi(showMessage = false) {
    try {
      const [printersResponse, historyResponse, settingsResponse] = await Promise.all([fetch(`${API_URL}/printers`), fetch(`${API_URL}/history`), fetch(`${API_URL}/settings`)])
      if (!printersResponse.ok || !historyResponse.ok || !settingsResponse.ok) throw new Error()
      setPrinterList(await printersResponse.json())
      setHistory(await historyResponse.json())
      setSettings(await settingsResponse.json())
      setLastUpdate('Agora mesmo')
      if (showMessage) showToast('Dados atualizados com sucesso')
    } catch { if (showMessage) showToast('Não foi possível conectar ao servidor') }
  }
  async function saveSettings(newSettings) {
    const response = await fetch(`${API_URL}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSettings) })
    if (!response.ok) return showToast('Não foi possível salvar as configurações')
    setSettings(await response.json())
    showToast('Configurações salvas no servidor')
  }
  async function resetDemoData() {
    const response = await fetch(`${API_URL}/demo/reset`, { method: 'POST' })
    if (!response.ok) return showToast('Não foi possível restaurar os dados')
    await loadFromApi()
    showToast('Dados de demonstração restaurados')
  }
  function refresh() { loadFromApi(true) }
  function updateForm(event) { setForm(current => ({ ...current, [event.target.name]: event.target.value })) }
  async function registerPrinter(event) {
    event.preventDefault()
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(form.ip)) {
      showToast('Informe um IP no formato 192.168.1.105')
      return
    }
    const printerData = { name: form.name, model: form.model, sector: form.sector, ip: form.ip, toner: Number(form.toner), pages: Number(form.pages), status: form.status, snmpVersion: form.snmpVersion, community: form.community, updated: 'Agora' }
    const endpoint = editingPrinter ? `${API_URL}/printers/${editingPrinter.id}` : `${API_URL}/printers`
    const response = await fetch(endpoint, { method: editingPrinter ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(printerData) })
    if (!response.ok) {
      const error = await response.json()
      showToast(error.error || 'Não foi possível salvar a impressora')
      return
    }
    const savedPrinter = await response.json()
    setPrinterList(current => editingPrinter ? current.map(printer => printer.id === savedPrinter.id ? savedPrinter : printer) : [...current, savedPrinter])
    const historyResponse = await fetch(`${API_URL}/history`)
    if (historyResponse.ok) setHistory(await historyResponse.json())
    showToast(editingPrinter ? 'Impressora atualizada com sucesso' : 'Impressora cadastrada com sucesso')
    setForm({ name: '', sector: '', ip: '', model: '', toner: 100, pages: 0, status: 'online', snmpVersion: settings.snmpVersion, community: settings.community })
    setEditingPrinter(null)
    setShowForm(false)
  }
  function openNewPrinterForm() { setEditingPrinter(null); setForm({ name: '', sector: '', ip: '', model: '', toner: 100, pages: 0, status: 'online', snmpVersion: settings.snmpVersion, community: settings.community }); setShowForm(true) }
  function openEditPrinterForm(printer) { setEditingPrinter(printer); setForm({ name: printer.name, model: printer.model || printer.name, sector: printer.sector, ip: printer.ip, toner: printer.toner ?? 0, pages: printer.pages, status: printer.status, snmpVersion: printer.snmpVersion || settings.snmpVersion, community: printer.community || settings.community }); setShowForm(true) }
  async function deletePrinter(printer) {
    if (!window.confirm(`Excluir a impressora "${printer.name}"?`)) return
    const response = await fetch(`${API_URL}/printers/${printer.id}`, { method: 'DELETE' })
    if (!response.ok) return showToast('Não foi possível excluir a impressora')
    setPrinterList(current => current.filter(item => item.id !== printer.id))
    const historyResponse = await fetch(`${API_URL}/history`)
    if (historyResponse.ok) setHistory(await historyResponse.json())
    showToast('Impressora excluída com sucesso')
  }

  const nav = [['Visão geral', icons.grid], ['Impressoras', icons.printer], ['Alertas', icons.bell], ['Relatórios', icons.chart]]
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark">P</span><span>Print<span>Watch</span></span></div><p className="nav-label">MENU PRINCIPAL</p><nav>{nav.map(([name, icon]) => <button key={name} onClick={() => setActive(name)} className={active === name ? 'active' : ''}><b>{icon}</b>{name}{name === 'Alertas' && <em>2</em>}</button>)}</nav><div className="sidebar-bottom"><button><b>{icons.settings}</b>Configurações</button><div className="user"><div className="avatar">JS</div><div><strong>João Silva</strong><small>Administrador</small></div></div></div></aside>
    <main><header><div><p className="breadcrumb">Monitoramento / <span>{active}</span></p><h1>{active}</h1></div><div className="header-actions"><button className="icon-button">{icons.bell}<i className="notification-dot" /></button><button className="profile-avatar">JS</button></div></header><section className="content">
      <div className="intro"><div><h2>Olá, João! <span>👋</span></h2><p>Acompanhe o status das suas impressoras em tempo real.</p></div><button className="refresh" onClick={refresh}>{icons.refresh} Atualizar dados</button></div>
      <div className="stat-grid"><article className="stat-card"><div className="stat-icon blue">{icons.printer}</div><div><small>TOTAL DE IMPRESSORAS</small><strong>{printerList.length}</strong><span className="muted">equipamentos cadastrados</span></div></article><article className="stat-card"><div className="stat-icon green">{icons.check}</div><div><small>ONLINE</small><strong>{printerList.filter(p => p.status === 'online').length}</strong><span className="positive">em funcionamento</span></div></article><article className="stat-card"><div className="stat-icon orange">{icons.alert}</div><div><small>PRECISAM DE ATENÇÃO</small><strong>{printerList.filter(p => p.status === 'warning').length}</strong><span className="warning-text">toner baixo ou erro</span></div></article><article className="stat-card"><div className="stat-icon red">{icons.x}</div><div><small>OFFLINE</small><strong>{printerList.filter(p => p.status === 'offline').length}</strong><span className="danger-text">verificar conexão</span></div></article></div>
      <section className="panel printers-panel"><div className="panel-heading"><div><h3>Status das impressoras</h3><p>Última atualização: {lastUpdate}</p></div><button className="outline" onClick={openNewPrinterForm}>{icons.add} Adicionar impressora</button></div><div className="toolbar"><div className="search">{icons.search}<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar impressora ou setor..." /></div><div className="filters">{[['all', 'Todas'], ['online', 'Online'], ['warning', 'Atenção'], ['offline', 'Offline']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div><div className="table-wrap"><table><thead><tr><th>IMPRESSORA</th><th>STATUS</th><th>TONER</th><th>CONTADOR</th><th>ÚLTIMA LEITURA</th><th>AÇÕES</th></tr></thead><tbody>{visiblePrinters.map(printer => <tr key={printer.id}><td><strong>{printer.name}</strong><small>{printer.sector} · {printer.ip}</small></td><td><Status type={printer.status} /></td><td>{printer.toner === null ? <span className="no-data">Indisponível</span> : <div className="toner"><span><i style={{ width: `${printer.toner}%` }} /></span><b>{printer.toner}%</b></div>}</td><td>{printer.pages.toLocaleString('pt-BR')} <small>páginas</small></td><td className="updated">{printer.updated}</td><td><div className="row-actions"><button className="edit" onClick={() => openEditPrinterForm(printer)}>Editar</button><button className="delete" onClick={() => deletePrinter(printer)}>Excluir</button></div></td></tr>)}</tbody></table>{visiblePrinters.length === 0 && <p className="empty">Nenhuma impressora encontrada.</p>}</div><footer className="table-footer"><span>Mostrando {visiblePrinters.length} de {printerList.length} impressoras</span><button onClick={() => { setSearch(''); setFilter('all') }}>Ver todas as impressoras →</button></footer></section>
      <section className="bottom-grid"><article className="panel alerts"><div className="panel-heading"><div><h3>Alertas recentes <span className="count">2</span></h3><p>Ocorrências que precisam de atenção</p></div></div><div className="alert-item"><span className="alert-sign orange">!</span><div><strong>Toner baixo</strong><p>Brother DCP-L2540DW · Financeiro</p><small>Há 2 minutos</small></div></div><div className="alert-item"><span className="alert-sign red">×</span><div><strong>Impressora offline</strong><p>Samsung M4070FR · Almoxarifado</p><small>Há 28 minutos</small></div></div></article><article className="panel usage"><div className="panel-heading"><div><h3>Uso mensal</h3><p>Páginas impressas nos últimos 6 meses</p></div></div><div className="chart"><div className="y-labels"><span>12k</span><span>8k</span><span>4k</span><span>0</span></div><div className="bars">{[42, 62, 51, 78, 67, 88].map((height, index) => <div className="bar-column" key={index}><div className={index === 5 ? 'bar current' : 'bar'} style={{ height: `${height}%` }} /><span>{['MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO'][index]}</span></div>)}</div></div><div className="usage-total"><span>Total no período</span><strong>48.672 <small>páginas</small></strong></div></article></section>
    </section></main>
    {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><section className="modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}><div className="modal-header"><div><h2>{editingPrinter ? 'Editar impressora' : 'Cadastrar impressora'}</h2><p>Informe os dados iniciais do equipamento.</p></div><button className="close-modal" onClick={() => setShowForm(false)}>×</button></div><form onSubmit={registerPrinter}><div className="form-grid"><label>Nome de identificação<input name="name" value={form.name} onChange={updateForm} placeholder="Ex.: Impressora da recepção" required /></label><label>Modelo<input name="model" value={form.model} onChange={updateForm} placeholder="Ex.: HP LaserJet Pro M404" required /></label><label>Setor<input name="sector" value={form.sector} onChange={updateForm} placeholder="Ex.: Administrativo" required /></label><label>Endereço IP<input name="ip" value={form.ip} onChange={updateForm} placeholder="Ex.: 192.168.1.105" pattern="^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$" required /></label><label>Nível inicial de toner (%)<input name="toner" type="number" min="0" max="100" value={form.toner} onChange={updateForm} required /></label><label>Contador de páginas<input name="pages" type="number" min="0" value={form.pages} onChange={updateForm} required /></label></div><p className="form-note">A configuração SNMP será adicionada posteriormente.</p><div className="form-actions"><button type="button" className="cancel" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="save">{editingPrinter ? 'Salvar alterações' : 'Cadastrar impressora'}</button></div></form></section></div>}
    {showForm && <StatusSelector value={form.status} onChange={status => setForm(current => ({ ...current, status }))} />}
    {showForm && <SnmpFields version={form.snmpVersion} community={form.community} onChange={(field, value) => setForm(current => ({ ...current, [field]: value }))} />}
    {active === 'Alertas' && <AlertCenter alerts={automaticAlerts} onClose={() => setActive('Visão geral')} />}
    {active === 'Relatórios' && <ReportsCenter printers={printerList} history={history} onClose={() => setActive('Visão geral')} />}
    {active === 'Impressoras' && <PrintersCenter printers={printerList} onClose={() => setActive('Visão geral')} onOpenDetails={setSelectedPrinter} />}
    {showSettings && <SettingsCenter settings={settings} onSave={saveSettings} onResetDemo={resetDemoData} onClose={() => setShowSettings(false)} />}
    {selectedPrinter && <PrinterDetails printer={selectedPrinter} onClose={() => setSelectedPrinter(null)} />}
    {toast && <div className="toast">{icons.check} {toast}</div>}
  </div>
}
