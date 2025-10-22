import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Trash2, FolderOpen, Calendar, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SavedRun {
  run_id: number
  run_name: string
  run_description: string
  saved_at: string
  config: any
}

export default function SavedCalcs() {
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  const loadSavedRuns = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`http://localhost:3001/api/runs/list?dbPath=${encodeURIComponent(dbPath)}`)

      if (!response.ok) {
        throw new Error('Failed to load saved runs')
      }

      const result = await response.json()
      setSavedRuns(result.runs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error loading saved runs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSavedRuns()
  }, [])

  const handleRestore = async (runId: number) => {
    if (!confirm('This will replace all current data with the saved run. Continue?')) {
      return
    }

    try {
      const response = await fetch('http://localhost:3001/api/runs/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, runId })
      })

      if (!response.ok) {
        throw new Error('Failed to restore run')
      }

      const result = await response.json()

      // Save the config back to localStorage
      if (result.config) {
        localStorage.setItem('runDefinition', JSON.stringify(result.config))
      }

      alert('Run restored successfully! You can now run the calculation or view results if they were saved.')
      // Reload the list to ensure UI is in sync
      loadSavedRuns()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore run')
      console.error('Error restoring run:', err)
    }
  }

  const handleDelete = async (runId: number, runName: string) => {
    if (!confirm(`Delete saved run "${runName}"?`)) {
      return
    }

    try {
      const response = await fetch(`http://localhost:3001/api/runs/${runId}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete run')
      }

      // Reload the list
      loadSavedRuns()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete run')
      console.error('Error deleting run:', err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const extractRunName = (fullName: string) => {
    // Remove the timestamp suffix (format: _2025-10-22T14-32-35)
    const timestampPattern = /_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/
    return fullName.replace(timestampPattern, '')
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-8" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Saved Calculations</h1>
        <p className="text-muted-foreground mt-2">Restore or manage your saved calculation runs</p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading saved runs...</p>
        </div>
      )}

      {error && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="p-6">
            <p className="text-red-500">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && savedRuns.length === 0 && (
        <Card style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardContent className="p-12 text-center">
            <Save className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Saved Runs</h3>
            <p className="text-muted-foreground mb-6">
              Run a calculation and save it to see it here.
            </p>
            <Button onClick={() => navigate('/run/execute')}>
              Go to Perform Calculation
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && savedRuns.length > 0 && (
        <div style={{ marginLeft: '1.5rem', marginRight: '1.5rem' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '40%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>ID</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>Run Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>Saved At</th>
                  <th style={{ padding: '12px', textAlign: 'right', color: '#94a3b8', fontWeight: 600, fontSize: '14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedRuns.map((run) => (
                  <tr
                    key={run.run_id}
                    style={{
                      borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '16px', fontSize: '14px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>#{run.run_id}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extractRunName(run.run_name)}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#94a3b8' }}>{run.run_description || '-'}</td>
                    <td style={{ padding: '16px', fontSize: '14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{formatDate(run.saved_at)}</td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(run.run_id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            fontSize: '13px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            color: '#10b981',
                            borderColor: 'rgba(16, 185, 129, 0.5)',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)'
                            e.currentTarget.style.borderColor = '#10b981'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'
                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)'
                          }}
                        >
                          <FolderOpen className="w-4 h-4" />
                          Restore
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(run.run_id, run.run_name)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            fontSize: '13px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            borderColor: 'rgba(239, 68, 68, 0.5)',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)'
                            e.currentTarget.style.borderColor = '#ef4444'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
