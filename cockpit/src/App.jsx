import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layout/Layout'
import AuthGate from './layout/AuthGate'

// Code-split heavy routes so the initial bundle stays light.
const Analytics  = lazy(() => import('./pages/analytics/Analytics'))
const Ozon       = lazy(() => import('./pages/analytics/Ozon'))
const Wb         = lazy(() => import('./pages/analytics/Wb'))
const Matreshka  = lazy(() => import('./pages/generators/Matreshka'))
const GreenPanda = lazy(() => import('./pages/generators/GreenPanda'))
const Kanban     = lazy(() => import('./pages/plan/Kanban'))
const Downloads  = lazy(() => import('./pages/downloads/Downloads'))
const ShopAdmin  = lazy(() => import('./pages/shop/ShopAdmin'))

const Loading = () => (
  <div className="card" style={{ marginTop: 24 }}>
    <p style={{ margin: 0, color: '#8A7A6A' }}>Загрузка…</p>
  </div>
)

export default function App() {
  return (
    <AuthGate>
    <Layout>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Navigate to="/analytics" replace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/analytics/ozon" element={<Ozon />} />
          <Route path="/analytics/wb" element={<Wb />} />
          <Route path="/generators/matreshka" element={<Matreshka />} />
          <Route path="/generators/greenpanda" element={<GreenPanda />} />
          <Route path="/plan" element={<Kanban />} />
          <Route path="/store" element={<ShopAdmin />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="*" element={<Navigate to="/analytics" replace />} />
        </Routes>
      </Suspense>
    </Layout>
    </AuthGate>
  )
}
