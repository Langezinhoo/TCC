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
`)

function now() { return new Date().toISOString() }
function toPrinter(row) {
  return { ...row, snmpVersion: row.snmp_version, updated: new Date(row.updated_at).toLocaleString('pt-BR') }
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

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.get('/api/printers', (_request, response) => {
  response.json(database.prepare('SELECT * FROM printers ORDER BY id').all().map(toPrinter))
})
app.post('/api/printers', (request, response) => {
  const { name, model, sector, ip, status = 'online', toner = 100, pages = 0, snmpVersion = 'v2c', community = 'public' } = request.body
  if (!name || !model || !sector || !ip) return response.status(400).json({ error: 'Nome, modelo, setor e IP são obrigatórios.' })
  try {
    const timestamp = now()
    const result = database.prepare('INSERT INTO printers (name, model, sector, ip, status, toner, pages, snmp_version, community, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name, model, sector, ip, status, toner, pages, snmpVersion, community, timestamp, timestamp)
    addHistory('create', 'Impressora cadastrada', `${name} foi adicionada ao monitoramento.`)
    response.status(201).json(toPrinter(database.prepare('SELECT * FROM printers WHERE id = ?').get(result.lastInsertRowid)))
  } catch {
    response.status(409).json({ error: 'Já existe uma impressora cadastrada com este IP.' })
  }
})
app.put('/api/printers/:id', (request, response) => {
  const { name, model, sector, ip, status, toner, pages, snmpVersion, community } = request.body
  const existing = database.prepare('SELECT * FROM printers WHERE id = ?').get(request.params.id)
  if (!existing) return response.status(404).json({ error: 'Impressora não encontrada.' })
  try {
    database.prepare('UPDATE printers SET name = ?, model = ?, sector = ?, ip = ?, status = ?, toner = ?, pages = ?, snmp_version = ?, community = ?, updated_at = ? WHERE id = ?').run(name, model, sector, ip, status, toner, pages, snmpVersion, community, now(), request.params.id)
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
