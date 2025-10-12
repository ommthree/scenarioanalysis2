import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import TemplateEditor from './pages/TemplateEditor'
import DriverEditor from './pages/DriverEditor'
import ActionsEditor from './pages/ActionsEditor'
import PhysicalRiskConfig from './pages/PhysicalRiskConfig'
import ScenarioEditor from './pages/ScenarioEditor'
import Results from './pages/Results'
import DatabaseSelector from './components/DatabaseSelector'

function App() {
  const [dbPath, setDbPath] = useState<string | null>(null)
  const [showDbSelector, setShowDbSelector] = useState(true)

  const handleDbSelected = (path: string) => {
    setDbPath(path)
    setShowDbSelector(false)
  }

  if (showDbSelector) {
    return <DatabaseSelector onSelect={handleDbSelected} />
  }

  return (
    <BrowserRouter>
      <Layout dbPath={dbPath} onChangeDb={() => setShowDbSelector(true)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/scenarios" element={<ScenarioEditor />} />
          <Route path="/templates" element={<TemplateEditor />} />
          <Route path="/drivers" element={<DriverEditor />} />
          <Route path="/actions" element={<ActionsEditor />} />
          <Route path="/physical-risk" element={<PhysicalRiskConfig />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
