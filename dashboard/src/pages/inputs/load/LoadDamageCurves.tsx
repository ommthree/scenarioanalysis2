import { useState, useEffect } from 'react'
import { TrendingUp, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
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

interface DamageCurveFile {
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

export default function LoadDamageCurves() {
  const [damageCurveFiles, setDamageCurveFiles] = useState<DamageCurveFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<CsvData | null>(null)
  const [_selectedXAxis, _setSelectedXAxis] = useState<string>('')
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [selectedPendingFileIndex, setSelectedPendingFileIndex] = useState<number | null>(null)

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/damage_curve?dbPath=${encodeURIComponent(dbPath)}`)
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
    setSelectedPendingFileIndex(null) // Clear pending file selection
    setSelectedRows([]) // Clear row selections when switching files
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setPreviewData(parsed)

        // Auto-select X-axis (look for intensity, return period, or first numeric column)
        if (parsed.headers.length > 0) {
          let xAxisCol = parsed.headers[0]
          for (let i = 0; i < parsed.headers.length; i++) {
            const col = parsed.headers[i]
            const colLower = col.toLowerCase()
            if (colLower.includes('intensity') || colLower.includes('return') || colLower.includes('period')) {
              xAxisCol = col
              break
            }
          }
          _setSelectedXAxis(xAxisCol)
        }
      }
    } catch (error) {
      console.error('Failed to load staged file preview:', error)
    }
  }

  const toggleRowSelection = (rowIdx: number) => {
    if (!previewData) return

    const clickedRow = previewData.rows[rowIdx]
    if (!clickedRow) return

    // Find all non-numeric column indices
    const nonNumericIndices: number[] = []
    for (let i = 0; i < previewData.headers.length; i++) {
      const firstValue = previewData.rows[0]?.[i]
      const isNumeric = !isNaN(parseFloat(firstValue)) && isFinite(parseFloat(firstValue))
      if (!isNumeric) {
        nonNumericIndices.push(i)
      }
    }

    // Find all rows that match the clicked row's non-numeric columns
    const matchingRowIndices: number[] = []
    previewData.rows.forEach((row, idx) => {
      const matches = nonNumericIndices.every(colIdx => row[colIdx] === clickedRow[colIdx])
      if (matches) {
        matchingRowIndices.push(idx)
      }
    })

    setSelectedRows(prev => {
      // If the clicked row is selected, deselect all matching rows
      if (prev.includes(rowIdx)) {
        return prev.filter(idx => !matchingRowIndices.includes(idx))
      } else {
        // Otherwise, add all matching rows
        const newSelection = new Set([...prev, ...matchingRowIndices])
        return Array.from(newSelection)
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

      const newDamageCurves: DamageCurveFile[] = []

      for (const file of files) {
        try {
          const text = await file.text()
          const parsed = parseCsv(text)
          newDamageCurves.push({
            file,
            name: file.name,
            csvData: parsed,
            isValid: parsed.headers.length > 0 && parsed.rows.length > 0
          })
        } catch (error) {
          newDamageCurves.push({
            file,
            name: file.name,
            csvData: null,
            isValid: false
          })
        }
      }

      // Auto-select the first NEW file for preview (before adding to state)
      if (newDamageCurves.length > 0) {
        const curve = newDamageCurves[0]
        setSelectedFileId(null)

        if (curve && curve.csvData) {
          setPreviewData(curve.csvData)
          setSelectedRows([])

          // Auto-select X-axis
          if (curve.csvData.headers.length > 0) {
            let xAxisCol = curve.csvData.headers[0]
            for (let i = 0; i < curve.csvData.headers.length; i++) {
              const col = curve.csvData.headers[i]
              const colLower = col.toLowerCase()
              if (colLower.includes('intensity') || colLower.includes('return') || colLower.includes('period')) {
                xAxisCol = col
                break
              }
            }
            _setSelectedXAxis(xAxisCol)
          }
        }
      }

      setDamageCurveFiles(prev => {
        const newList = [...prev, ...newDamageCurves]
        // Update selected index to point to first of the newly added files
        if (newDamageCurves.length > 0) {
          setSelectedPendingFileIndex(prev.length) // Index of first new file
        }
        return newList
      })
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setDamageCurveFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedPendingFileIndex === index) {
      setSelectedPendingFileIndex(null)
      setPreviewData(null)
      setSelectedRows([])
    }
  }

  const handleSelectPendingFile = (index: number) => {
    console.log('handleSelectPendingFile called with index:', index)
    const curve = damageCurveFiles[index]
    console.log('Selected damage curve:', curve)
    setSelectedPendingFileIndex(index)
    setSelectedFileId(null) // Clear staged file selection

    if (curve && curve.csvData) {
      console.log('Setting preview data:', curve.csvData)
      setPreviewData(curve.csvData)
      setSelectedRows([])

      // Auto-select X-axis
      if (curve.csvData.headers.length > 0) {
        let xAxisCol = curve.csvData.headers[0]
        for (let i = 0; i < curve.csvData.headers.length; i++) {
          const col = curve.csvData.headers[i]
          const colLower = col.toLowerCase()
          if (colLower.includes('intensity') || colLower.includes('return') || colLower.includes('period')) {
            xAxisCol = col
            break
          }
        }
        _setSelectedXAxis(xAxisCol)
        console.log('X-axis set to:', xAxisCol)
      }
    } else {
      console.log('No CSV data available for this file')
    }
  }

  const handleLoad = async () => {
    if (damageCurveFiles.length === 0) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // Create form data with all files
      const formData = new FormData()
      formData.append('dbPath', dbPath)

      damageCurveFiles.forEach(curve => {
        if (curve.isValid && curve.file) {
          formData.append('files', curve.file)
        }
      })

      const response = await fetch('http://localhost:3001/api/damage-curves/load-batch', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLoadSuccess(true)
        setLoadMessage(result.message)

        // Clear the damage curve files list
        setDamageCurveFiles([])

        // Refresh staged files list (server already created staged_file entries)
        await fetchStagedFiles()

        setTimeout(() => {
          setLoadSuccess(false)
          setLoadMessage('')
        }, 5000)
      } else {
        setLoadMessage(`Error: ${result.error || 'Failed to load damage curves'}`)
      }

    } catch (error) {
      console.error('Import error:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Prepare chart data for Recharts based on selected rows
  // Plot: Y-axis (damage factor) vs X-axis (intensity) for each series (peril + archetype + value_type)
  const getChartData = () => {
    if (!previewData || selectedRows.length === 0) return []
    if (previewData.headers.length < 3) return [] // Need at least 3 columns

    // Try to find intensity and damage_factor columns by name
    let xAxisIdx = previewData.headers.findIndex(h => h.toLowerCase() === 'intensity')
    let yAxisIdx = previewData.headers.findIndex(h => h.toLowerCase().includes('damage'))

    // Fallback to penultimate and last columns if not found
    if (xAxisIdx === -1) xAxisIdx = previewData.headers.length - 2
    if (yAxisIdx === -1) yAxisIdx = previewData.headers.length - 1

    // Find columns for series naming (peril, archetype, value_type)
    const perilIdx = previewData.headers.findIndex(h => h.toLowerCase() === 'peril')
    const archetypeIdx = previewData.headers.findIndex(h => h.toLowerCase() === 'archetype')
    const valueTypeIdx = previewData.headers.findIndex(h => h.toLowerCase().includes('value') && h.toLowerCase().includes('type'))

    // Collect all data points organized by series, then by X value
    const seriesData = new Map<string, Map<string, number>>()

    selectedRows.forEach(rowIdx => {
      const row = previewData.rows[rowIdx]
      if (!row) return

      // Build series name from available columns
      const parts = []
      if (perilIdx >= 0 && row[perilIdx]) parts.push(row[perilIdx])
      if (archetypeIdx >= 0 && row[archetypeIdx]) parts.push(row[archetypeIdx])
      if (valueTypeIdx >= 0 && row[valueTypeIdx]) parts.push(row[valueTypeIdx])

      const seriesName = parts.length > 0 ? parts.join(' - ') : `Series ${rowIdx}`
      const xValue = String(row[xAxisIdx]).trim() // Ensure consistent string format
      const yValue = parseFloat(row[yAxisIdx])

      console.log(`Row ${rowIdx}: series="${seriesName}", x="${xValue}", y=${yValue}`)

      if (isNaN(yValue)) return

      if (!seriesData.has(seriesName)) {
        seriesData.set(seriesName, new Map())
      }

      // Store the value for this series at this X coordinate
      seriesData.get(seriesName)!.set(xValue, yValue)
    })

    // Collect all unique X values across all series
    const allXValues = new Set<string>()
    seriesData.forEach(xMap => {
      xMap.forEach((_, xValue) => allXValues.add(xValue))
    })

    // Sort X values numerically
    const sortedXValues = Array.from(allXValues).sort((a, b) => {
      const aVal = parseFloat(a)
      const bVal = parseFloat(b)
      if (!isNaN(aVal) && !isNaN(bVal)) {
        return aVal - bVal
      }
      return String(a).localeCompare(String(b))
    })

    // Build chart data with all X values, filling in Y values for each series
    const allSeriesNames = Array.from(seriesData.keys())
    const chartData = sortedXValues.map(xValue => {
      const dataPoint: any = { name: xValue }

      // For each series, add the value if it exists, otherwise add null
      allSeriesNames.forEach(seriesName => {
        const xMap = seriesData.get(seriesName)
        const yValue = xMap?.get(xValue)
        dataPoint[seriesName] = yValue !== undefined ? yValue : null
      })

      return dataPoint
    })

    console.log('Chart data generated:', chartData)
    console.log('Series:', allSeriesNames)

    return chartData
  }

  // Get line names for the chart (series names from selected rows)
  const getLineNames = () => {
    if (!previewData || selectedRows.length === 0) return []

    // Find columns for series naming
    const perilIdx = previewData.headers.findIndex(h => h.toLowerCase() === 'peril')
    const archetypeIdx = previewData.headers.findIndex(h => h.toLowerCase() === 'archetype')
    const valueTypeIdx = previewData.headers.findIndex(h => h.toLowerCase().includes('value') && h.toLowerCase().includes('type'))

    // Get unique series names from selected rows
    const seriesNames = new Set<string>()
    selectedRows.forEach(rowIdx => {
      const row = previewData.rows[rowIdx]
      if (row) {
        const parts = []
        if (perilIdx >= 0 && row[perilIdx]) parts.push(row[perilIdx])
        if (archetypeIdx >= 0 && row[archetypeIdx]) parts.push(row[archetypeIdx])
        if (valueTypeIdx >= 0 && row[valueTypeIdx]) parts.push(row[valueTypeIdx])

        const seriesName = parts.length > 0 ? parts.join(' - ') : `Series ${rowIdx}`
        seriesNames.add(seriesName)
      }
    })

    return Array.from(seriesNames)
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
        <h1 className="text-4xl font-bold tracking-tight">Load Damage Curves</h1>
        <p className="text-muted-foreground mt-2">Import damage curve CSV files and visualize intensity vs. damage relationships</p>
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
                  <h3 className="font-semibold text-lg">Damage Curve Files</h3>
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
              {damageCurveFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Ready to Upload ({damageCurveFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {damageCurveFiles.map((curve, idx) => {
                      const isSelected = selectedPendingFileIndex === idx
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSelectPendingFile(idx)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            marginBottom: '8px',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                            borderRadius: '6px',
                            border: isSelected
                              ? '2px solid rgba(59, 130, 246, 0.5)'
                              : `1px solid ${curve.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'left'
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
                              e.currentTarget.style.borderColor = curve.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            {curve.isValid ? (
                              <FileText className="w-4 h-4" style={{ color: '#ffffff' }} />
                            ) : (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm" style={{ color: '#ffffff' }}>{curve.name}</span>
                            {curve.csvData && (
                              <span className="text-xs text-muted-foreground">({curve.csvData.rows.length} rows)</span>
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
                        </button>
                      )
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
                disabled={damageCurveFiles.length === 0 || isLoading}
                style={{
                  width: '220px',
                  height: '44px',
                  backgroundColor: (damageCurveFiles.length > 0 && !isLoading) ? '#2563eb' : '#6b7280',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: (damageCurveFiles.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                  opacity: (damageCurveFiles.length > 0 && !isLoading) ? 1 : 0.5,
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
                <h3 className="font-semibold text-lg">Damage Curve Preview</h3>
                <span className="text-sm text-muted-foreground">
                  {selectedFileId
                    ? stagedFiles.find(f => f.file_id === selectedFileId)?.file_name
                    : selectedPendingFileIndex !== null
                    ? damageCurveFiles[selectedPendingFileIndex]?.name
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
                    <h4 className="font-semibold">Damage Curve Visualization</h4>
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
                      <LineChart data={chartData} key="damage-curve-chart">
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
                            connectNulls={true}
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
