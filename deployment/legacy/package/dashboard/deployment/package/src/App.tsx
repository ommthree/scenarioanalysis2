import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { getDefaultDbPath } from '@/config'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import UserManagement from './pages/admin/UserManagement'
import Home from './pages/data/Home'
import Dashboard from './pages/data/Dashboard'
import Database from './pages/data/Database'
import SavedCalcs from './pages/data/SavedCalcs'
import LoadStatements from './pages/inputs/load/LoadStatements'
import LoadScenarios from './pages/inputs/load/LoadScenarios'
import LoadLocations from './pages/inputs/load/LoadLocations'
import MapLocations from './pages/inputs/map/MapLocations'
import LoadDamageCurves from './pages/inputs/load/LoadDamageCurves'
import MapDamageCurves from './pages/inputs/map/MapDamageCurves'
import LoadHazardMaps from './pages/inputs/load/LoadHazardMaps'
import MapHazardMaps from './pages/inputs/map/MapHazardMaps'
import LoadCorrelation from './pages/inputs/load/LoadCorrelation'
import LoadConversions from './pages/inputs/load/LoadConversions'
import DefineStatements from './pages/definitions/DefineStatements'
import DefineEntities from './pages/definitions/DefineEntities'
import DefineFormulas from './pages/definitions/DefineFormulas'
import DefineValidation from './pages/definitions/DefineValidation'
import DefineScenarios from './pages/definitions/DefineScenarios'
import DefineActions from './pages/definitions/DefineActions'
import MapStatements from './pages/inputs/map/MapStatements'
import MapScenarios from './pages/inputs/map/MapScenarios'
import RunDefinition from './pages/execution/RunDefinition'
import PerformCalculation from './pages/execution/PerformCalculation'
import ViewResults from './pages/results/ViewResults'
import Explore from './pages/results/Explore'
import Report from './pages/results/Report'
import VideoViewer from './pages/auth/VideoViewer'

function App() {
  const [dbPath, _setDbPath] = useState<string | null>(() => {
    return getDefaultDbPath()
  })
  const [showDbSelector, _setShowDbSelector] = useState(false)

  if (showDbSelector) {
    return <div style={{padding: '20px', color: 'white'}}>Database Selector Placeholder</div>
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/video" element={
            <ProtectedRoute requireRole="viewer">
              <VideoViewer />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute requireAdmin>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <UserManagement />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <Home />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/data/database" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <Database />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/data/stored-calcs" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <SavedCalcs />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/statements" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadStatements />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/map-statements" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <MapStatements />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/scenarios" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadScenarios />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/map-scenarios" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <MapScenarios />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/correlation" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadCorrelation />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/conversions" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadConversions />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/locations" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadLocations />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/map-locations" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <MapLocations />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/damage-curves" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadDamageCurves />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/map-damage-curves" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <MapDamageCurves />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/hazard-maps" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <LoadHazardMaps />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/inputs/map-hazard-maps" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <MapHazardMaps />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/statements" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineStatements />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/formulas" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineFormulas />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/validation" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineValidation />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/entities" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineEntities />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/scenarios" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineScenarios />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/definitions/actions" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <DefineActions dbPath={dbPath} />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/run/definition" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <RunDefinition />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/run/execute" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <PerformCalculation />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/run/open" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/visualize" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <ViewResults />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/explore" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <Explore />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/report" element={
            <ProtectedRoute>
              <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
                <Report />
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
