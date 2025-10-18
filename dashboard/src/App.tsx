import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Database from './pages/Database'
import LoadStatements from './pages/LoadStatements'
import LoadScenarios from './pages/LoadScenarios'
import LoadLocations from './pages/LoadLocations'
import MapLocations from './pages/MapLocations'
import LoadDamageCurves from './pages/LoadDamageCurves'
import MapDamageCurves from './pages/MapDamageCurves'
import LoadHazardMaps from './pages/LoadHazardMaps'
import DefineStatements from './pages/DefineStatements'
import DefineEntities from './pages/DefineEntities'
import DefineFormulas from './pages/DefineFormulas'
import DefineValidation from './pages/DefineValidation'
import DefineScenarios from './pages/DefineScenarios'
import MapStatements from './pages/MapStatements'
import MapScenarios from './pages/MapScenarios'

function App() {
  const [dbPath, setDbPath] = useState<string | null>(() => {
    return localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
  })
  const [showDbSelector, setShowDbSelector] = useState(false)

  const handleDbSelected = (path: string) => {
    setDbPath(path)
    localStorage.setItem('lastDatabasePath', path)
    setShowDbSelector(false)
  }

  if (showDbSelector) {
    return <div style={{padding: '20px', color: 'white'}}>Database Selector Placeholder</div>
  }

  return (
    <BrowserRouter>
      <Layout dbPath={dbPath} onChangeDb={() => setShowDbSelector(true)}>
        <Routes>
          <Route path="/" element={<Navigate to="/data/database" replace />} />
          <Route path="/data/database" element={<Database />} />
          <Route path="/data/stored-calcs" element={<Dashboard />} />
          <Route path="/inputs/statements" element={<LoadStatements />} />
          <Route path="/inputs/map-statements" element={<MapStatements />} />
          <Route path="/inputs/scenarios" element={<LoadScenarios />} />
          <Route path="/inputs/map-scenarios" element={<MapScenarios />} />
          <Route path="/inputs/locations" element={<LoadLocations />} />
          <Route path="/inputs/map-locations" element={<MapLocations />} />
          <Route path="/inputs/damage-curves" element={<LoadDamageCurves />} />
          <Route path="/inputs/map-damage-curves" element={<MapDamageCurves />} />
          <Route path="/inputs/hazard-maps" element={<LoadHazardMaps />} />
          <Route path="/definitions/statements" element={<DefineStatements />} />
          <Route path="/definitions/formulas" element={<DefineFormulas />} />
          <Route path="/definitions/validation" element={<DefineValidation />} />
          <Route path="/definitions/entities" element={<DefineEntities />} />
          <Route path="/definitions/scenarios" element={<DefineScenarios />} />
          <Route path="/definitions/actions" element={<Dashboard />} />
          <Route path="/run/definition" element={<Dashboard />} />
          <Route path="/run/execute" element={<Dashboard />} />
          <Route path="/run/open" element={<Dashboard />} />
          <Route path="/visualize" element={<Dashboard />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
