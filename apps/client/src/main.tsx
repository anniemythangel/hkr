import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Lobby from './pages/Lobby'
import TablePage from './pages/Table'
import ResponsiveTestPage from './pages/ResponsiveTest'
import './styles.css'
import './responsive.css'
import { syncResponsiveModeClass } from './utils/featureFlags'

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
        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
