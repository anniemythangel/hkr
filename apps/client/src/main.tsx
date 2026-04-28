import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Lobby from './pages/Lobby'
import TablePage from './pages/Table'
import ResponsiveTestPage from './pages/ResponsiveTest'
import StatsPage from './pages/Stats'
import StatsManualPage from './pages/StatsManual'
import CalculatorPage from './pages/Calculator'
import AdminSeatToolsPage from './pages/AdminSeatTools'
import './styles.css'
import './responsive.css'
import { ADMIN_TOOLS_PATH, ENABLE_HIDDEN_ADMIN_ROUTE, ENABLE_STATS_UI, syncResponsiveModeClass } from './utils/featureFlags'

syncResponsiveModeClass()

const enableResponsiveHarness = import.meta.env.DEV || import.meta.env.MODE === 'test'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/room/:roomId" element={<TablePage />} />
        {enableResponsiveHarness ? (
          <Route path="/responsive-test" element={<ResponsiveTestPage />} />
        ) : null}
        {ENABLE_STATS_UI ? <Route path="/stats" element={<StatsPage />} /> : null}
        {ENABLE_STATS_UI ? <Route path="/stats/manual" element={<StatsManualPage />} /> : null}
        {ENABLE_HIDDEN_ADMIN_ROUTE ? <Route path={ADMIN_TOOLS_PATH} element={<AdminSeatToolsPage />} /> : null}
        <Route path="/calculator" element={<CalculatorPage />} />
        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
