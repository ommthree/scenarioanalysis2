import { useState, useEffect } from 'react'
import { TrendingUp, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface ScenarioFile {
  file: File
  name: string
  csvData: CsvData | null
  isValid: boolean
}

interface SelectedRow {
  scenarioIdx: number
  rowIdx: number
}

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

export default function LoadScenarios() {
  const [scenarioFiles, setScenarioFiles] = useState<ScenarioFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [selectedRows, setSelectedRows] = useState<SelectedRow[]>([])
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/scenario?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch staged files:', error)
    }
  }

  const handleDeleteStagedFile = async (fileId: number) => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        // Refresh the list
        fetchStagedFiles()
      }
    } catch (error) {
      console.error('Failed to delete staged file:', error)
    }
  }

  const parseCsv = (text: string): CsvData => {
    const lines = text.split('\n').filter(line => line.trim() !== '')
    if (lines.length === 0) {
      return { headers: [], rows: [] }
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const rows = lines.slice(1).map(line =>
      line.split(',').map(cell => cell.trim())
    )

    return { headers, rows }
  }

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.multiple = true

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])

      const newScenarios: ScenarioFile[] = []

      for (const file of files) {
        try {
          const text = await file.text()
          const parsed = parseCsv(text)
          newScenarios.push({
            file,
            name: file.name,
            csvData: parsed,
            isValid: parsed.headers.length > 0 && parsed.rows.length > 0
          })
        } catch (error) {
          newScenarios.push({
            file,
            name: file.name,
            csvData: null,
            isValid: false
          })
        }
      }

      setScenarioFiles(prev => [...prev, ...newScenarios])
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setScenarioFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleLoad = async () => {
    if (scenarioFiles.length === 0) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // Create form data with all files
      const formData = new FormData()
      formData.append('dbPath', dbPath)

      scenarioFiles.forEach(scenario => {
        if (scenario.isValid && scenario.file) {
          formData.append('files', scenario.file)
        }
      })

      const response = await fetch('http://localhost:3001/api/scenarios/load-batch', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLoadSuccess(true)
        setLoadMessage(result.message)

        // Record each staged file
        try {
          for (const scenario of scenarioFiles) {
            if (scenario.isValid && scenario.csvData) {
              await fetch('http://localhost:3001/api/staged-files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  dbPath,
                  fileName: scenario.name,
                  fileType: 'scenario',
                  rowCount: scenario.csvData.rows.length
                })
              })
            }
          }

          // Refresh staged files list
          fetchStagedFiles()
        } catch (err) {
          console.error('Failed to record staged files:', err)
        }

        setTimeout(() => {
          setLoadSuccess(false)
          setLoadMessage('')
        }, 5000)
      } else {
        setLoadMessage(`Error: ${result.error || 'Failed to load scenarios'}`)
      }

    } catch (error) {
      console.error('Import error:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Get chart data for all selected rows
  const getSelectedRowsChartData = () => {
    if (selectedRows.length === 0) return null

    const allRowData = selectedRows
      .map((selection) => {
        const scenario = scenarioFiles[selection.scenarioIdx]
        if (!scenario || !scenario.isValid || !scenario.csvData) return null

        const row = scenario.csvData.rows[selection.rowIdx]
        if (!row) return null

        // Find the last non-numeric column, then start plotting from the next column
        let lastNonNumericCol = -1
        for (let colIdx = scenario.csvData.headers.length - 1; colIdx >= 0; colIdx--) {
          const hasNonNumeric = scenario.csvData.rows.some(r => {
            const val = r[colIdx]
            return isNaN(parseFloat(val)) || !isFinite(val as any)
          })
          if (hasNonNumeric) {
            lastNonNumericCol = colIdx
            break
          }
        }

        const firstNumericCol = lastNonNumericCol + 1

        // Get the row label (first non-numeric value)
        const rowLabel = row.slice(0, firstNumericCol).join(' - ')

        // Plot only from first numeric column onwards
        return {
          scenarioName: scenario.name.replace('.csv', ''),
          rowLabel: rowLabel,
          data: scenario.csvData.headers.slice(firstNumericCol).map((header, idx) => ({
            variable: header,
            value: parseFloat(row[firstNumericCol + idx]) || 0,
            index: firstNumericCol + idx
          }))
        }
      })
      .filter(s => s !== null)

    return allRowData.length > 0 ? allRowData : null
  }

  const chartData = getSelectedRowsChartData()

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Load Scenarios</h1>
        <p className="text-muted-foreground mt-2">Import scenario CSV files and visualize variable progression</p>
      </div>

      <div className="flex flex-col items-center" style={{ gap: '32px' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-semibold text-lg">Scenario Files</h3>
                  <p className="text-sm text-muted-foreground">Select multiple CSV files</p>
                </div>
              </div>

              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <Button
                  variant="outline"
                  onClick={handleBrowse}
                  style={{
                    width: '100%',
                    height: '44px',
                    color: '#ffffff',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    padding: '10px 16px',
                  }}
                >
                  <FolderOpen style={{ width: '16px', height: '16px', marginRight: '8px', color: '#ffffff' }} />
                  Browse Multiple Files
                </Button>
              </div>

              {/* Staged Files List */}
              {stagedFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Staged Files ({stagedFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {stagedFiles.map((file) => (
                      <div
                        key={file.file_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: '1px solid rgba(34, 197, 94, 0.3)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm" style={{ color: '#ffffff' }}>{file.file_name}</span>
                          <span className="text-xs text-muted-foreground">({file.row_count} rows)</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStagedFile(file.file_id)}
                          style={{ color: '#ef4444', padding: '4px 8px' }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File List */}
              {scenarioFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {scenarioFiles.map((scenario, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: `1px solid ${scenario.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {scenario.isValid ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm" style={{ color: '#ffffff' }}>{scenario.name}</span>
                          {scenario.csvData && (
                            <span className="text-xs text-muted-foreground">({scenario.csvData.rows.length} rows)</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(idx)}
                          style={{ color: '#ef4444', padding: '4px 8px' }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: loadSuccess ? '#22c55e' : '#ef4444',
                  marginLeft: '1.5rem',
                  marginRight: '1.5rem',
                  padding: '12px',
                  backgroundColor: loadSuccess ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px'
                }}>
                  {loadSuccess ? (
                    <DatabaseIcon className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>{loadMessage}</span>
                </div>
              )}

              <Button
                onClick={handleLoad}
                disabled={scenarioFiles.length === 0 || isLoading}
                style={{
                  width: '220px',
                  height: '44px',
                  backgroundColor: (scenarioFiles.length > 0 && !isLoading) ? '#2563eb' : '#6b7280',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: (scenarioFiles.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                  opacity: (scenarioFiles.length > 0 && !isLoading) ? 1 : 0.5,
                  color: '#ffffff',
                  margin: '0 auto 24px auto',
                  display: 'block'
                }}
              >
                {isLoading ? 'Loading to Staging...' : 'Load to Staging'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Tables and Visualization */}
        {scenarioFiles.length > 0 && scenarioFiles.some(s => s.isValid) && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Scenario Data</h3>
                <span className="text-sm text-muted-foreground">Click a row to visualize</span>
              </div>

              {/* Scenario Tables */}
              {scenarioFiles.map((scenario, scenarioIdx) => {
                if (!scenario.isValid || !scenario.csvData) return null

                return (
                  <div key={scenarioIdx} style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                      {scenario.name}
                    </div>
                    <ScrollArea className="w-full" style={{ height: '300px' }}>
                      <div style={{ minWidth: 'max-content' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                              {scenario.csvData.headers.map((header, idx) => (
                                <th
                                  key={idx}
                                  style={{
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#3b82f6',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {scenario.csvData.rows.map((row, rowIdx) => (
                              <tr
                                key={rowIdx}
                                onClick={() => {
                                  const isSelected = selectedRows.some(
                                    s => s.scenarioIdx === scenarioIdx && s.rowIdx === rowIdx
                                  )
                                  if (isSelected) {
                                    // Remove from selection
                                    setSelectedRows(prev =>
                                      prev.filter(s => !(s.scenarioIdx === scenarioIdx && s.rowIdx === rowIdx))
                                    )
                                  } else {
                                    // Add to selection
                                    setSelectedRows(prev => [...prev, { scenarioIdx, rowIdx }])
                                  }
                                }}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                  backgroundColor: selectedRows.some(s => s.scenarioIdx === scenarioIdx && s.rowIdx === rowIdx)
                                    ? 'rgba(59, 130, 246, 0.2)'
                                    : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => {
                                  if (!selectedRows.some(s => s.scenarioIdx === scenarioIdx && s.rowIdx === rowIdx)) {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!selectedRows.some(s => s.scenarioIdx === scenarioIdx && s.rowIdx === rowIdx)) {
                                    e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
                                  }
                                }}
                              >
                                {row.map((cell, cellIdx) => (
                                  <td
                                    key={cellIdx}
                                    style={{
                                      padding: '10px 16px',
                                      fontSize: '13px',
                                      color: '#e2e8f0',
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </div>
                )
              })}

              {/* Chart */}
              {chartData && chartData.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginTop: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h4 className="font-semibold">Row Visualization</h4>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    padding: '24px',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    position: 'relative',
                    width: '100%'
                  }}>
                    <svg
                      width="100%"
                      height="300"
                      viewBox="0 0 1000 300"
                      preserveAspectRatio="xMidYMid meet"
                      style={{ display: 'block' }}
                    >
                      {(() => {
                        // Define colors for different scenarios
                        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

                        // Get all data points from all scenarios to calculate range
                        const allValues = chartData.flatMap(s => s.data.map(p => p.value))
                        const maxValue = Math.max(...allValues)
                        const minValue = Math.min(...allValues)
                        const range = maxValue - minValue
                        const paddingLeft = 60
                        const paddingRight = 40
                        const paddingBottom = 80
                        const paddingTop = 20
                        const chartWidth = 1000 - paddingLeft - paddingRight
                        const chartHeight = 300 - paddingTop - paddingBottom

                        // Use first scenario's data for x-axis labels
                        const xAxisLabels = chartData[0].data.map(p => p.variable)
                        const xStep = chartWidth / Math.max(xAxisLabels.length - 1, 1)

                        // Helper function to create smooth Catmull-Rom spline
                        const createSmoothPath = (points: any[]) => {
                          if (points.length < 2) return ''

                          let pathD = `M ${points[0].x} ${points[0].y}`

                          if (points.length === 2) {
                            pathD += ` L ${points[1].x} ${points[1].y}`
                            return pathD
                          }

                          // Use cubic bezier curves with control points for smoothing
                          for (let i = 0; i < points.length - 1; i++) {
                            const p0 = points[Math.max(i - 1, 0)]
                            const p1 = points[i]
                            const p2 = points[i + 1]
                            const p3 = points[Math.min(i + 2, points.length - 1)]

                            // Calculate control points for smoother curve
                            const tension = 0.3
                            const cp1x = p1.x + (p2.x - p0.x) * tension
                            const cp1y = p1.y + (p2.y - p0.y) * tension
                            const cp2x = p2.x - (p3.x - p1.x) * tension
                            const cp2y = p2.y - (p3.y - p1.y) * tension

                            pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
                          }

                          return pathD
                        }

                        return (
                          <>
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((fraction, idx) => {
                              const y = paddingTop + chartHeight - (fraction * chartHeight)
                              return (
                                <line
                                  key={idx}
                                  x1={paddingLeft}
                                  y1={y}
                                  x2={paddingLeft + chartWidth}
                                  y2={y}
                                  stroke="rgba(255, 255, 255, 0.1)"
                                  strokeWidth="1"
                                />
                              )
                            })}

                            {/* Y-axis labels */}
                            {[0, 0.25, 0.5, 0.75, 1].map((fraction, idx) => {
                              const value = minValue + (fraction * range)
                              const y = paddingTop + chartHeight - (fraction * chartHeight)
                              return (
                                <text
                                  key={idx}
                                  x={paddingLeft - 10}
                                  y={y + 4}
                                  fill="#94a3b8"
                                  fontSize="12"
                                  textAnchor="end"
                                >
                                  {value.toFixed(1)}
                                </text>
                              )
                            })}

                            {/* Draw lines for each selected row */}
                            {chartData.map((rowData, rowDataIdx) => {
                              const points = rowData.data.map((point, idx) => {
                                const x = paddingLeft + (idx * xStep)
                                const normalizedValue = range > 0 ? ((point.value - minValue) / range) : 0.5
                                const y = paddingTop + chartHeight - (normalizedValue * chartHeight)
                                return { x, y, ...point }
                              })

                              const pathD = createSmoothPath(points)
                              const color = colors[rowDataIdx % colors.length]

                              return (
                                <path
                                  key={rowDataIdx}
                                  d={pathD}
                                  fill="none"
                                  stroke={color}
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )
                            })}

                            {/* X-axis labels */}
                            {xAxisLabels.map((label, idx) => {
                              const x = paddingLeft + (idx * xStep)
                              return (
                                <text
                                  key={idx}
                                  x={x}
                                  y={paddingTop + chartHeight + 20}
                                  fill="#94a3b8"
                                  fontSize="11"
                                  textAnchor="end"
                                  transform={`rotate(-45, ${x}, ${paddingTop + chartHeight + 20})`}
                                >
                                  {label}
                                </text>
                              )
                            })}

                            {/* Legend */}
                            {chartData.length > 0 && (
                              <g>
                                {chartData.map((item, idx) => {
                                  const color = colors[idx % colors.length]
                                  const legendY = 10 + (idx * 20)
                                  const label = `${item.scenarioName}: ${item.rowLabel}`
                                  return (
                                    <g key={idx}>
                                      <line
                                        x1={paddingLeft + chartWidth - 250}
                                        y1={legendY}
                                        x2={paddingLeft + chartWidth - 220}
                                        y2={legendY}
                                        stroke={color}
                                        strokeWidth="3"
                                      />
                                      <text
                                        x={paddingLeft + chartWidth - 215}
                                        y={legendY + 4}
                                        fill="#e2e8f0"
                                        fontSize="11"
                                      >
                                        {label}
                                      </text>
                                    </g>
                                  )
                                })}
                              </g>
                            )}
                          </>
                        )
                      })()}
                    </svg>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
