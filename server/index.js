import cors from 'cors'
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const dataDirectory = join(currentDirectory, 'data')
mkdirSync(dataDirectory, { recursive: true })
const useFakeData = process.argv.includes('--fake')

const database = new DatabaseSync(join(dataDirectory, useFakeData ? 'printwatch.fake.db' : 'printwatch.db'))
database.exec(`
  CREATE TABLE IF NOT EXISTS printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    sector TEXT NOT NULL,
    ip TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'online',
    toner INTEGER,
    pages INTEGER NOT NULL DEFAULT 0,
    snmp_version TEXT NOT NULL DEFAULT 'v2c',
    community TEXT NOT NULL DEFAULT 'public',
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trade_name TEXT,
    cnpj TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS printer_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    code TEXT,
    duration_minutes INTEGER,
    technician TEXT,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    technician TEXT,
    resolution TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sku TEXT,
    minimum_quantity INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS stock_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS material_compatibility (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER NOT NULL,
    printer_model TEXT NOT NULL,
    UNIQUE(material_id, printer_model)
  );
  CREATE TABLE IF NOT EXISTS replenishment_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER,
    material_id INTEGER,
    status TEXT NOT NULL DEFAULT 'open',
    note TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS printer_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    printer_id INTEGER NOT NULL,
    toner INTEGER,
    pages INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (printer_id) REFERENCES printers(id) ON DELETE CASCADE
  );
`)

function ensureColumn(table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all()
  if (!columns.some(item => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}
ensureColumn('printers', 'client_id', 'client_id INTEGER')
ensureColumn('printers', 'site_id', 'site_id INTEGER')
ensureColumn('printers', 'serial_number', 'serial_number TEXT')

function now() { return new Date().toISOString() }
function toPrinter(row) {
  return { ...row, snmpVersion: row.snmp_version, clientId: row.client_id, siteId: row.site_id, serialNumber: row.serial_number, updated: new Date(row.updated_at).toLocaleString('pt-BR') }
}
function addHistory(type, title, description) {
  database.prepare('INSERT INTO history (type, title, description, created_at) VALUES (?, ?, ?, ?)').run(type, title, description, now())
}
function getSettings() {
  const rows = database.prepare('SELECT key, value FROM settings').all()
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
  return { tonerThreshold: Number(values.tonerThreshold ?? 20), snmpVersion: values.snmpVersion ?? 'v2c', community: values.community ?? 'public' }
}

if (useFakeData && database.prepare('SELECT COUNT(*) AS total FROM printers').get().total === 0) {
  const insert = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const timestamp = now();
  [
    ['HP LaserJet Pro M404', 'HP LaserJet Pro M404', 'Administrativo', '192.168.1.101', 'online', 78, 12480],
    ['Brother DCP-L2540DW', 'Brother DCP-L2540DW', 'Financeiro', '192.168.1.102', 'warning', 18, 8914],
    ['Epson EcoTank L6270', 'Epson EcoTank L6270', 'Recepção', '192.168.1.103', 'online', 63, 5329],
    ['Samsung M4070FR', 'Samsung M4070FR', 'Almoxarifado', '192.168.1.104', 'offline', null, 21763],
  ].forEach(printer => insert.run(...printer, 'v2c', 'public', timestamp, timestamp))
}

if (useFakeData && database.prepare('SELECT COUNT(*) AS total FROM clients').get().total === 0) {
  const timestamp = now()
  const client = database.prepare('INSERT INTO clients (name, trade_name, cnpj, created_at) VALUES (?, ?, ?, ?)').run('Empresa Demonstração', 'Empresa Demo', '00.000.000/0001-00', timestamp)
  const site = database.prepare('INSERT INTO sites (client_id, name, address, city, state, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(client.lastInsertRowid, 'Matriz', 'Endereço de demonstração', 'São Paulo', 'SP', timestamp)
  database.prepare('UPDATE printers SET client_id = ?, site_id = ? WHERE client_id IS NULL').run(client.lastInsertRowid, site.lastInsertRowid)
}

if (useFakeData && database.prepare('SELECT COUNT(*) AS total FROM printer_readings').get().total === 0) {
  const insertReading = database.prepare('INSERT INTO printer_readings (printer_id, toner, pages, created_at) VALUES (?, ?, ?, ?)')
  const printers = database.prepare('SELECT id, toner, pages FROM printers WHERE toner IS NOT NULL').all()
  const today = new Date()
  printers.forEach(printer => {
    for (const daysAgo of [6, 3, 0]) {
      const date = new Date(today)
      date.setDate(today.getDate() - daysAgo)
      const toner = Math.min(100, printer.toner + daysAgo * 2)
      const pages = Math.max(0, printer.pages - daysAgo * 85)
      insertReading.run(printer.id, toner, pages, date.toISOString())
    }
  })
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/materials', (_request, response) => response.json(database.prepare('SELECT materials.*, COALESCE(stock_items.quantity, 0) AS quantity FROM materials LEFT JOIN stock_items ON stock_items.material_id = materials.id ORDER BY materials.name').all().map(item => ({ ...item, belowMinimum: item.quantity <= item.minimum_quantity, compatibleModels: database.prepare('SELECT printer_model FROM material_compatibility WHERE material_id = ?').all(item.id).map(row => row.printer_model) }))))
app.post('/api/materials', (request, response) => {
  const { name, type, sku = '', minimumQuantity = 0, quantity = 0 } = request.body
  if (!name || !type) return response.status(400).json({ error: 'Nome e tipo são obrigatórios.' })
  const result = database.prepare('INSERT INTO materials (name, type, sku, minimum_quantity, created_at) VALUES (?, ?, ?, ?, ?)').run(name, type, sku, minimumQuantity, now())
  database.prepare('INSERT INTO stock_items (material_id, quantity, updated_at) VALUES (?, ?, ?)').run(result.lastInsertRowid, quantity, now())
  response.status(201).json({ id: Number(result.lastInsertRowid), name, type, sku, minimum_quantity: minimumQuantity, quantity })
})
app.post('/api/materials/:id/movements', (request, response) => {
  const { type, quantity, note = '' } = request.body
  const material = database.prepare('SELECT * FROM materials WHERE id = ?').get(request.params.id)
  if (!material || !['entry', 'exit'].includes(type) || !Number(quantity)) return response.status(400).json({ error: 'Movimentação inválida.' })
  const current = database.prepare('SELECT quantity FROM stock_items WHERE material_id = ?').get(request.params.id).quantity
  const next = type === 'entry' ? current + Number(quantity) : current - Number(quantity)
  if (next < 0) return response.status(400).json({ error: 'Estoque insuficiente.' })
  database.prepare('UPDATE stock_items SET quantity = ?, updated_at = ? WHERE material_id = ?').run(next, now(), request.params.id)
  database.prepare('INSERT INTO stock_movements (material_id, type, quantity, note, created_at) VALUES (?, ?, ?, ?, ?)').run(request.params.id, type, quantity, note, now())
  response.json({ quantity: next })
})
app.get('/api/materials/:id/movements', (request, response) => response.json(database.prepare('SELECT * FROM stock_movements WHERE material_id = ? ORDER BY id DESC').all(request.params.id)))
app.post('/api/materials/:id/compatibility', (request, response) => {
  const { printerModel } = request.body
  if (!printerModel) return response.status(400).json({ error: 'Informe o modelo da impressora.' })
  try { database.prepare('INSERT INTO material_compatibility (material_id, printer_model) VALUES (?, ?)').run(request.params.id, printerModel); response.status(201).json({ printerModel }) } catch { response.status(409).json({ error: 'Compatibilidade já cadastrada.' }) }
})
app.post('/api/replenishment-requests', (request, response) => {
  const { printerId = null, materialId = null, note = '' } = request.body
  const result = database.prepare('INSERT INTO replenishment_requests (printer_id, material_id, note, created_at) VALUES (?, ?, ?, ?)').run(printerId, materialId, note, now())
  response.status(201).json({ id: Number(result.lastInsertRowid), status: 'open' })
})
app.get('/api/clients', (_request, response) => {
  const clients = database.prepare('SELECT * FROM clients ORDER BY name').all()
  const sites = database.prepare('SELECT * FROM sites ORDER BY name').all()
  response.json(clients.map(client => ({ id: client.id, name: client.name, tradeName: client.trade_name, cnpj: client.cnpj, createdAt: client.created_at, sites: sites.filter(site => site.client_id === client.id).map(site => ({ id: site.id, name: site.name, address: site.address, city: site.city, state: site.state })) })))
})
app.post('/api/clients', (request, response) => {
  const { name, tradeName = '', cnpj = '' } = request.body
  if (!name) return response.status(400).json({ error: 'O nome do cliente é obrigatório.' })
  const result = database.prepare('INSERT INTO clients (name, trade_name, cnpj, created_at) VALUES (?, ?, ?, ?)').run(name, tradeName, cnpj, now())
  response.status(201).json({ id: Number(result.lastInsertRowid), name, tradeName, cnpj, sites: [] })
})
app.post('/api/clients/:id/sites', (request, response) => {
  const { name, address = '', city = '', state = '' } = request.body
  const client = database.prepare('SELECT id FROM clients WHERE id = ?').get(request.params.id)
  if (!client) return response.status(404).json({ error: 'Cliente não encontrado.' })
  if (!name) return response.status(400).json({ error: 'O nome do site é obrigatório.' })
  const result = database.prepare('INSERT INTO sites (client_id, name, address, city, state, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(request.params.id, name, address, city, state, now())
  response.status(201).json({ id: Number(result.lastInsertRowid), name, address, city, state })
})
app.get('/api/printers', (_request, response) => {
  response.json(database.prepare('SELECT * FROM printers ORDER BY id').all().map(toPrinter))
})
app.get('/api/printers/:id/events', (request, response) => {
  response.json(database.prepare('SELECT * FROM printer_events WHERE printer_id = ? ORDER BY id DESC').all(request.params.id).map(event => ({ ...event, createdAt: event.created_at })))
})
app.post('/api/printers/:id/readings', (request, response) => {
  const { toner, pages } = request.body
  const printer = database.prepare('SELECT id FROM printers WHERE id = ?').get(request.params.id)
  if (!printer || pages === undefined) return response.status(400).json({ error: 'Leitura inválida.' })
  database.prepare('INSERT INTO printer_readings (printer_id, toner, pages, created_at) VALUES (?, ?, ?, ?)').run(request.params.id, toner, pages, now())
  response.status(201).json({ ok: true })
})
app.get('/api/printers/:id/forecast', (request, response) => {
  const readings = database.prepare('SELECT * FROM printer_readings WHERE printer_id = ? ORDER BY created_at ASC').all(request.params.id)
  if (readings.length < 2) return response.json({ available: false, message: 'São necessárias pelo menos duas leituras.' })
  const first = readings[0], last = readings.at(-1)
  const days = (new Date(last.created_at) - new Date(first.created_at)) / 86400000
  const consumptionPerDay = days > 0 && first.toner !== null && last.toner !== null ? (first.toner - last.toner) / days : 0
  const daysRemaining = consumptionPerDay > 0 ? Math.floor(last.toner / consumptionPerDay) : null
  response.json({ available: Boolean(daysRemaining !== null), currentToner: last.toner, consumptionPerDay, daysRemaining })
})
app.post('/api/printers/:id/events', (request, response) => {
  const printer = database.prepare('SELECT name FROM printers WHERE id = ?').get(request.params.id)
  const { type, severity, code = '', durationMinutes = null, technician = '', description = '' } = request.body
  if (!printer) return response.status(404).json({ error: 'Impressora não encontrada.' })
  if (!type || !severity) return response.status(400).json({ error: 'Tipo e nível são obrigatórios.' })
  const result = database.prepare('INSERT INTO printer_events (printer_id, type, severity, code, duration_minutes, technician, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(request.params.id, type, severity, code, durationMinutes, technician, description, now())
  addHistory('event', `Evento técnico: ${type}`, `${printer.name} registrou uma ocorrência de nível ${severity}.`)
  response.status(201).json(database.prepare('SELECT * FROM printer_events WHERE id = ?').get(result.lastInsertRowid))
})
app.get('/api/printers/:id/tickets', (request, response) => response.json(database.prepare('SELECT * FROM maintenance_tickets WHERE printer_id = ? ORDER BY id DESC').all(request.params.id)))
app.post('/api/printers/:id/tickets', (request, response) => {
  const printer = database.prepare('SELECT name FROM printers WHERE id = ?').get(request.params.id)
  const { title, priority = 'medium', technician = '' } = request.body
  if (!printer) return response.status(404).json({ error: 'Impressora não encontrada.' })
  if (!title) return response.status(400).json({ error: 'Informe o título do chamado.' })
  const result = database.prepare('INSERT INTO maintenance_tickets (printer_id, title, priority, technician, created_at) VALUES (?, ?, ?, ?, ?)').run(request.params.id, title, priority, technician, now())
  addHistory('ticket', 'Chamado de manutenção aberto', `${printer.name}: ${title}`)
  response.status(201).json(database.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(result.lastInsertRowid))
})
ensureColumn('maintenance_tickets', 'resolution', 'resolution TEXT')
app.put('/api/tickets/:id', (request, response) => {
  const ticket = database.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(request.params.id)
  if (!ticket) return response.status(404).json({ error: 'Chamado não encontrado.' })
  const { status, technician = ticket.technician, priority = ticket.priority, resolution = ticket.resolution } = request.body
  const resolvedAt = status === 'resolved' ? now() : ticket.resolved_at
  database.prepare('UPDATE maintenance_tickets SET status = ?, technician = ?, priority = ?, resolution = ?, resolved_at = ? WHERE id = ?').run(status, technician, priority, resolution, resolvedAt, request.params.id)
  const updated = database.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(request.params.id)
  response.json({ ...updated, resolutionMinutes: updated.resolved_at ? Math.max(0, Math.round((new Date(updated.resolved_at) - new Date(updated.created_at)) / 60000)) : null })
})
app.post('/api/printers', (request, response) => {
  const { name, model, sector, ip, status = 'online', toner = 100, pages = 0, snmpVersion = 'v2c', community = 'public', clientId = null, siteId = null, serialNumber = '' } = request.body
  if (!name || !model || !sector || !ip) return response.status(400).json({ error: 'Nome, modelo, setor e IP são obrigatórios.' })
  if (siteId && !database.prepare('SELECT id FROM sites WHERE id = ? AND client_id = ?').get(siteId, clientId)) return response.status(400).json({ error: 'O site informado não pertence ao cliente selecionado.' })
  try {
    const timestamp = now()
    const result = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, client_id, site_id, serial_number, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, model, sector, ip, status, toner, pages, snmpVersion, community, clientId, siteId, serialNumber, timestamp, timestamp)
    database.prepare('INSERT INTO printer_readings (printer_id, toner, pages, created_at) VALUES (?, ?, ?, ?)').run(result.lastInsertRowid, toner, pages, timestamp)
    addHistory('create', 'Impressora cadastrada', `${name} foi adicionada ao monitoramento.`)
    response.status(201).json(toPrinter(database.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid)))
  } catch {
    response.status(409).json({ error: 'Já existe uma impressora cadastrada com este IP.' })
  }
})
app.put('/api/printers/:id', (request, response) => {
  const { name, model, sector, ip, status, toner, pages, snmpVersion, community, clientId = null, siteId = null, serialNumber = '' } = request.body
  const existing = database.prepare('SELECT * FROM printers WHERE id = ?').get(request.params.id)
  if (!existing) return response.status(404).json({ error: 'Impressora não encontrada.' })
  if (siteId && !database.prepare('SELECT id FROM sites WHERE id = ? AND client_id = ?').get(siteId, clientId)) return response.status(400).json({ error: 'O site informado não pertence ao cliente selecionado.' })
  try {
    database.prepare('UPDATE printers SET name = ?, model = ?, sector = ?, ip = ?, status = ?, toner = ?, pages = ?, snmp_version = ?, community = ?, client_id = ?, site_id = ?, serial_number = ?, updated_at = ? WHERE id = ?').run(name, model, sector, ip, status, toner, pages, snmpVersion, community, clientId, siteId, serialNumber, now(), request.params.id)
    database.prepare('INSERT INTO printer_readings (printer_id, toner, pages, created_at) VALUES (?, ?, ?, ?)').run(request.params.id, toner, pages, now())
    addHistory('edit', 'Impressora atualizada', `${name} teve seus dados alterados.`)
    response.json(toPrinter(database.prepare('SELECT * FROM printers WHERE id = ?').get(request.params.id)))
  } catch {
    response.status(409).json({ error: 'Já existe uma impressora cadastrada com este IP.' })
  }
})
app.delete('/api/printers/:id', (request, response) => {
  const printer = database.prepare('SELECT * FROM printers WHERE id = ?').get(request.params.id)
  if (!printer) return response.status(404).json({ error: 'Impressora não encontrada.' })
  database.prepare('DELETE FROM printers WHERE id = ?').run(request.params.id)
  addHistory('delete', 'Impressora excluída', `${printer.name} foi removida do monitoramento.`)
  response.status(204).end()
})
app.get('/api/history', (_request, response) => response.json(database.prepare('SELECT * FROM history ORDER BY id DESC').all().map(row => ({ ...row, createdAt: row.created_at }))))
app.get('/api/settings', (_request, response) => response.json(getSettings()))
app.put('/api/settings', (request, response) => {
  const settings = request.body
  const save = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
  save.run('tonerThreshold', String(settings.tonerThreshold))
  save.run('snmpVersion', settings.snmpVersion)
  save.run('community', settings.community)
  response.json(getSettings())
})
app.post('/api/demo/reset', (_request, response) => {
  database.exec('DELETE FROM printers; DELETE FROM history;')
  const insert = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const timestamp = now();
  [
    ['HP LaserJet Pro M404', 'HP LaserJet Pro M404', 'Administrativo', '192.168.1.101', 'online', 78, 12480],
    ['Brother DCP-L2540DW', 'Brother DCP-L2540DW', 'Financeiro', '192.168.1.102', 'warning', 18, 8914],
    ['Epson EcoTank L6270', 'Epson EcoTank L6270', 'Recepção', '192.168.1.103', 'online', 63, 5329],
    ['Samsung M4070FR', 'Samsung M4070FR', 'Almoxarifado', '192.168.1.104', 'offline', null, 21763],
  ].forEach(printer => insert.run(...printer, 'v2c', 'public', timestamp, timestamp))
  response.status(204).end()
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`API do PrintWatch${useFakeData ? ' (dados fictícios)' : ''} em http://localhost:${port}`))
