import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import { getDefaultDbPath } from '@/config'
import Layout from './components/layout/Layout'
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

function App() {
  const [dbPath, _setDbPath] = useState<string | null>(() => {
    return getDefaultDbPath()
  })
  const [showDbSelector, _setShowDbSelector] = useState(false)

  if (showDbSelector) {
    return <div style={{padding: '20px', color: 'white'}}>Database Selector Placeholder</div>
  }

  return (
    <BrowserRouter>
      <Layout dbPath={dbPath} onChangeDb={() => _setShowDbSelector(true)}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/data/database" element={<Database />} />
          <Route path="/data/stored-calcs" element={<SavedCalcs />} />
          <Route path="/inputs/statements" element={<LoadStatements />} />
          <Route path="/inputs/map-statements" element={<MapStatements />} />
          <Route path="/inputs/scenarios" element={<LoadScenarios />} />
          <Route path="/inputs/map-scenarios" element={<MapScenarios />} />
          <Route path="/inputs/correlation" element={<LoadCorrelation />} />
          <Route path="/inputs/conversions" element={<LoadConversions />} />
          <Route path="/inputs/locations" element={<LoadLocations />} />
          <Route path="/inputs/map-locations" element={<MapLocations />} />
          <Route path="/inputs/damage-curves" element={<LoadDamageCurves />} />
          <Route path="/inputs/map-damage-curves" element={<MapDamageCurves />} />
          <Route path="/inputs/hazard-maps" element={<LoadHazardMaps />} />
          <Route path="/inputs/map-hazard-maps" element={<MapHazardMaps />} />
          <Route path="/definitions/statements" element={<DefineStatements />} />
          <Route path="/definitions/formulas" element={<DefineFormulas />} />
          <Route path="/definitions/validation" element={<DefineValidation />} />
          <Route path="/definitions/entities" element={<DefineEntities />} />
          <Route path="/definitions/scenarios" element={<DefineScenarios />} />
          <Route path="/definitions/actions" element={<DefineActions dbPath={dbPath} />} />
          <Route path="/run/definition" element={<RunDefinition />} />
          <Route path="/run/execute" element={<PerformCalculation />} />
          <Route path="/run/open" element={<Dashboard />} />
          <Route path="/visualize" element={<ViewResults />} />
          <Route path="/explore" element={<Explore />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
