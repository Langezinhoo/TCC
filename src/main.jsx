import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import './modal.css'
import './actions.css'
import './details.css'
import './alerts.css'
import './reports.css'
import './printers-center.css'
import './status-selector.css'
import './settings.css'
import './snmp-fields.css'
import './reset-demo.css'

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
)
