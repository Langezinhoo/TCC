import cors from 'cors'
import express from 'express'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDirectory = fileURLToPath(new URL('.', import.meta.url))
const dataDirectory = join(currentDirectory, 'data')
mkdirSync(dataDirectory, { recursive: true })

const database = new DatabaseSync(join(dataDirectory, 'printwatch.db'))
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

if (database.prepare('SELECT COUNT(*) AS total FROM printers').get().total === 0) {
  const insert = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const timestamp = now();
  [
    ['HP LaserJet Pro M404', 'HP LaserJet Pro M404', 'Administrativo', '192.168.1.101', 'online', 78, 12480],
    ['Brother DCP-L2540DW', 'Brother DCP-L2540DW', 'Financeiro', '192.168.1.102', 'warning', 18, 8914],
    ['Epson EcoTank L6270', 'Epson EcoTank L6270', 'Recepção', '192.168.1.103', 'online', 63, 5329],
    ['Samsung M4070FR', 'Samsung M4070FR', 'Almoxarifado', '192.168.1.104', 'offline', null, 21763],
  ].forEach(printer => insert.run(...printer, 'v2c', 'public', timestamp, timestamp))
}

if (database.prepare('SELECT COUNT(*) AS total FROM clients').get().total === 0) {
  const timestamp = now()
  const client = database.prepare('INSERT INTO clients (name, trade_name, cnpj, created_at) VALUES (?, ?, ?, ?)').run('Empresa Demonstração', 'Empresa Demo', '00.000.000/0001-00', timestamp)
  const site = database.prepare('INSERT INTO sites (client_id, name, address, city, state, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(client.lastInsertRowid, 'Matriz', 'Endereço de demonstração', 'São Paulo', 'SP', timestamp)
  database.prepare('UPDATE printers SET client_id = ?, site_id = ? WHERE client_id IS NULL').run(client.lastInsertRowid, site.lastInsertRowid)
}

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
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
app.post('/api/printers', (request, response) => {
  const { name, model, sector, ip, status = 'online', toner = 100, pages = 0, snmpVersion = 'v2c', community = 'public', clientId = null, siteId = null, serialNumber = '' } = request.body
  if (!name || !model || !sector || !ip) return response.status(400).json({ error: 'Nome, modelo, setor e IP são obrigatórios.' })
  if (siteId && !database.prepare('SELECT id FROM sites WHERE id = ? AND client_id = ?').get(siteId, clientId)) return response.status(400).json({ error: 'O site informado não pertence ao cliente selecionado.' })
  try {
    const timestamp = now()
    const result = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, client_id, site_id, serial_number, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, model, sector, ip, status, toner, pages, snmpVersion, community, clientId, siteId, serialNumber, timestamp, timestamp)
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
app.listen(port, () => console.log(`API do PrintWatch em http://localhost:${port}`))
