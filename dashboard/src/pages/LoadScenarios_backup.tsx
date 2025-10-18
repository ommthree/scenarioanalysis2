import { useState, useEffect } from 'react'
import { TrendingUp, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parse } from 'csv-parse/sync'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

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
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<CsvData | null>(null)
  const [selectedXAxis, setSelectedXAxis] = useState<string>('')
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [selectedPendingFileIndex, setSelectedPendingFileIndex] = useState<number | null>(null)

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

  const handleDeleteStagedFile = async (fileId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        if (selectedFileId === fileId) {
          setSelectedFileId(null)
          setPreviewData(null)
        }
        fetchStagedFiles()
      }
    } catch (error) {
      console.error('Failed to delete staged file:', error)
    }
  }

  const handleSelectStagedFile = async (fileId: number) => {
    setSelectedFileId(fileId)
    setSelectedRows([]) // Clear row selections when switching files
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setPreviewData(parsed)

        // Auto-select X-axis (first non-numeric column)
        if (parsed.headers.length > 0) {
          let xAxisCol = parsed.headers[0]
          for (let i = 0; i < parsed.headers.length; i++) {
            const col = parsed.headers[i]
            const hasNonNumeric = parsed.rows.some(row => {
              const val = row[i]
              return isNaN(parseFloat(val)) || !isFinite(val as any)
            })
            if (hasNonNumeric) {
              xAxisCol = col
              break
            }
          }
          setSelectedXAxis(xAxisCol)
        }
      }
    } catch (error) {
      console.error('Failed to load staged file preview:', error)
    }
  }

  const toggleRowSelection = (rowIdx: number) => {
    setSelectedRows(prev => {
      if (prev.includes(rowIdx)) {
        return prev.filter(idx => idx !== rowIdx)
      } else {
        return [...prev, rowIdx]
      }
    })
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
    console.log('handleBrowse called!')
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.multiple = true
    console.log('File input created')

    input.onchange = async (e: Event) => {
      console.log('File input changed!')
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])
      console.log('Files selected:', files.length)

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

      // Auto-select the first NEW file for preview (before adding to state)
      if (newScenarios.length > 0) {
        const scenario = newScenarios[0]
        setSelectedFileId(null)

        if (scenario && scenario.csvData) {
          setPreviewData(scenario.csvData)
          setSelectedRows([])

          // Auto-select X-axis
          if (scenario.csvData.headers.length > 0) {
            let xAxisCol = scenario.csvData.headers[0]
            for (let i = 0; i < scenario.csvData.headers.length; i++) {
              const col = scenario.csvData.headers[i]
              const hasNonNumeric = scenario.csvData.rows.some(row => {
                const val = row[i]
                return isNaN(parseFloat(val)) || !isFinite(val as any)
              })
              if (hasNonNumeric) {
                xAxisCol = col
                break
              }
            }
            setSelectedXAxis(xAxisCol)
          }
        }
      }

      setScenarioFiles(prev => {
        const newList = [...prev, ...newScenarios]
        // Update selected index to point to first of the newly added files
        if (newScenarios.length > 0) {
          setSelectedPendingFileIndex(prev.length) // Index of first new file
        }
        return newList
      })
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setScenarioFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedPendingFileIndex === index) {
      setSelectedPendingFileIndex(null)
      setPreviewData(null)
      setSelectedRows([])
    }
  }

  const handleSelectPendingFile = (index: number) => {
    console.log('handleSelectPendingFile called with index:', index)
    const scenario = scenarioFiles[index]
    console.log('Selected scenario:', scenario)
    setSelectedPendingFileIndex(index)
    setSelectedFileId(null) // Clear staged file selection

    if (scenario && scenario.csvData) {
      console.log('Setting preview data:', scenario.csvData)
      setPreviewData(scenario.csvData)
      setSelectedRows([])

      // Auto-select X-axis (first non-numeric column)
      if (scenario.csvData.headers.length > 0) {
        let xAxisCol = scenario.csvData.headers[0]
        for (let i = 0; i < scenario.csvData.headers.length; i++) {
          const col = scenario.csvData.headers[i]
          const hasNonNumeric = scenario.csvData.rows.some(row => {
            const val = row[i]
            return isNaN(parseFloat(val)) || !isFinite(val as any)
          })
          if (hasNonNumeric) {
            xAxisCol = col
            break
          }
        }
        setSelectedXAxis(xAxisCol)
        console.log('X-axis set to:', xAxisCol)
      }
    } else {
      console.log('No CSV data available for this file')
    }
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

        // Clear the scenario files list
        setScenarioFiles([])

        // Refresh staged files list (server already created staged_file entries)
        await fetchStagedFiles()

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

  // Prepare chart data for Recharts based on selected rows
  const getChartData = () => {
    if (!previewData || !selectedXAxis || selectedRows.length === 0) return []

    const xAxisIdx = previewData.headers.indexOf(selectedXAxis)
    if (xAxisIdx === -1) return []

    // Find continuous numeric columns from the end of the table backwards
    const numericCols: string[] = []
    const numericColIndices: number[] = []
    for (let i = previewData.headers.length - 1; i >= 0; i--) {
      const col = previewData.headers[i]
      if (col === selectedXAxis) continue

      // Check if this column is numeric (check first row)
      const firstValue = previewData.rows[0]?.[i]
      const isNumeric = !isNaN(parseFloat(firstValue)) && isFinite(parseFloat(firstValue))

      console.log(`Column ${i} (${col}): value="${firstValue}", isNumeric=${isNumeric}`)

      if (isNumeric) {
        numericCols.unshift(col) // Add to beginning to maintain order
        numericColIndices.unshift(i)
      } else {
        // Stop when we hit a non-numeric column
        console.log(`Stopping at column ${i} (${col}) - non-numeric`)
        break
      }
    }

    console.log('Numeric columns detected:', numericCols)

    // Create data points for the chart
    // Each data point represents one numeric column (X-axis point)
    // Each selected row becomes a line (dataKey) with values across columns
    const chartData = numericCols.map((col, colArrayIdx) => {
      const colIdx = numericColIndices[colArrayIdx]
      const dataPoint: any = { name: col }

      // Add value for each selected row
      selectedRows.forEach(rowIdx => {
        const row = previewData.rows[rowIdx]
        if (row) {
          // Use row index in the label to ensure uniqueness
          const rowLabel = `${row[xAxisIdx] || 'Row'}-${rowIdx}`
          const value = parseFloat(row[colIdx])
          dataPoint[rowLabel] = isNaN(value) ? null : value
        }
      })

      return dataPoint
    })

    console.log('Final chartData:', JSON.stringify(chartData, null, 2))
    console.log('Selected rows:', selectedRows)
    return chartData
  }

  // Get line names for the chart (selected row labels)
  const getLineNames = () => {
    if (!previewData || !selectedXAxis) return []
    const xAxisIdx = previewData.headers.indexOf(selectedXAxis)
    return selectedRows.map(rowIdx => {
      const row = previewData.rows[rowIdx]
      // Use row index in the label to ensure uniqueness and match dataPoint keys
      return row ? `${row[xAxisIdx] || 'Row'}-${rowIdx}` : `Row-${rowIdx}`
    })
  }

  const chartData = getChartData()
  const lineNames = getLineNames()
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
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
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {stagedFiles.map((file) => {
                      const isSelected = selectedFileId === file.file_id
                      return (
                        <div
                          key={file.file_id}
                          onClick={() => handleSelectStagedFile(file.file_id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            marginBottom: '8px',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                            borderRadius: '6px',
                            border: `2px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.3)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'
                              e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)'
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium" style={{ color: '#ffffff' }}>{file.file_name}</span>
                            <span className="text-xs text-muted-foreground">({file.row_count} rows)</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteStagedFile(file.file_id, e)}
                            style={{
                              color: '#ef4444',
                              padding: '4px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Newly Selected Files (pending upload) */}
              {scenarioFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Ready to Upload ({scenarioFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {scenarioFiles.map((scenario, idx) => {
                      const isSelected = selectedPendingFileIndex === idx
                      return <div
                        key={idx}
                        onClick={() => {
                          console.log('DIV CLICKED!', idx)
                          handleSelectPendingFile(idx)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: isSelected
                            ? '2px solid rgba(59, 130, 246, 0.5)'
                            : `1px solid ${scenario.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'
                            e.currentTarget.style.borderColor = scenario.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {scenario.isValid ? (
                            <FileText className="w-4 h-4 text-yellow-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm" style={{ color: '#ffffff' }}>{scenario.name}</span>
                          {scenario.csvData && (
                            <span className="text-xs text-muted-foreground">({scenario.csvData.rows.length} rows)</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            removeFile(idx)
                          }}
                          style={{
                            color: '#ef4444',
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    })}
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

        {/* Preview Data and Visualization */}
        {previewData && (selectedFileId || selectedPendingFileIndex !== null) && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Scenario Preview</h3>
                <span className="text-sm text-muted-foreground">
                  {selectedFileId
                    ? stagedFiles.find(f => f.file_id === selectedFileId)?.file_name
                    : selectedPendingFileIndex !== null
                    ? scenarioFiles[selectedPendingFileIndex]?.name
                    : ''}
                </span>
              </div>

              {/* Data Table */}
              <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <div style={{ fontSize: '14px', marginBottom: '12px', color: '#94a3b8' }}>
                  Click rows to visualize them in the chart below
                </div>
                <ScrollArea className="w-full" style={{ height: '300px' }}>
                  <div style={{ minWidth: 'max-content' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse' }} key={`table-${selectedFileId}`}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                          {previewData.headers.map((header, idx) => (
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
                        {previewData.rows.map((row, rowIdx) => {
                          const isSelected = selectedRows.includes(rowIdx)
                          return (
                            <tr
                              key={rowIdx}
                              onClick={() => toggleRowSelection(rowIdx)}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: isSelected
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
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
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>

              {/* Chart */}
              {chartData.length > 0 && selectedRows.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                    <h4 className="font-semibold">Scenario Visualization</h4>
                  </div>
                  <div style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    padding: '24px',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    height: '400px',
                    animation: 'fadeIn 0.3s ease-in'
                  }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} key="scenario-chart">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                        <XAxis
                          dataKey="name"
                          stroke="#94a3b8"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                        />
                        <YAxis
                          stroke="#94a3b8"
                          tick={{ fill: '#94a3b8', fontSize: 12 }}
                          domain={['auto', 'auto']}
                          scale="linear"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            color: '#ffffff'
                          }}
                        />
                        <Legend
                          wrapperStyle={{ color: '#ffffff' }}
                          iconType="line"
                        />
                        {lineNames.map((lineName, idx) => (
                          <Line
                            key={`line-${lineName}`}
                            type="monotone"
                            dataKey={lineName}
                            stroke={colors[idx % colors.length]}
                            strokeWidth={2}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  )
}
