import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Database from './pages/Database'
import LoadStatements from './pages/LoadStatements'
import LoadScenarios from './pages/LoadScenarios'

function App() {
  const [dbPath, setDbPath] = useState<string | null>(() => {
    return localStorage.getItem('lastDatabasePath') || '/Users/Owen/finmodel_data/production.db'
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
          <Route path="/inputs/map-statements" element={<Dashboard />} />
          <Route path="/inputs/scenarios" element={<LoadScenarios />} />
          <Route path="/inputs/damage-curves" element={<Dashboard />} />
          <Route path="/inputs/map-damage-curves" element={<Dashboard />} />
          <Route path="/definitions/statements" element={<Dashboard />} />
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
