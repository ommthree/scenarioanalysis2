import { useState, useEffect } from 'react'
import { Activity, FolderOpen, Check, X, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import JointDistributionPanel from '@/components/JointDistributionPanel'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface CorrelationFile {
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

export default function LoadCorrelation() {
  const [correlationFiles, setCorrelationFiles] = useState<CorrelationFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<CsvData | null>(null)
  const [selectedPendingFileIndex, setSelectedPendingFileIndex] = useState<number | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ var1: string; var2: string; correlation: number } | null>(null)

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/correlation?dbPath=${encodeURIComponent(dbPath)}`)
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
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setPreviewData(parsed)
      }
    } catch (error) {
      console.error('Failed to load staged file preview:', error)
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
    input.multiple = false // Only one correlation matrix at a time

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])

      const newFiles: CorrelationFile[] = []

      for (const file of files) {
        try {
          const text = await file.text()
          const parsed = parseCsv(text)

          // Validate it's a square matrix
          const isSquare = parsed.headers.length > 0 &&
                           parsed.rows.length === parsed.headers.length - 1 && // -1 for row labels column
                           parsed.rows.every(row => row.length === parsed.headers.length)

          newFiles.push({
            file,
            name: file.name,
            csvData: parsed,
            isValid: isSquare
          })
        } catch (error) {
          newFiles.push({
            file,
            name: file.name,
            csvData: null,
            isValid: false
          })
        }
      }

      // Auto-select the first file for preview
      if (newFiles.length > 0) {
        const corrFile = newFiles[0]
        setSelectedFileId(null)

        if (corrFile && corrFile.csvData) {
          setPreviewData(corrFile.csvData)
        }
      }

      setCorrelationFiles(prev => {
        const newList = [...prev, ...newFiles]
        if (newFiles.length > 0) {
          setSelectedPendingFileIndex(prev.length)
        }
        return newList
      })
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setCorrelationFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedPendingFileIndex === index) {
      setSelectedPendingFileIndex(null)
      setPreviewData(null)
    }
  }

  const handleSelectPendingFile = (index: number) => {
    const corrFile = correlationFiles[index]
    setSelectedPendingFileIndex(index)
    setSelectedFileId(null)

    if (corrFile && corrFile.csvData) {
      setPreviewData(corrFile.csvData)
    }
  }

  const handleLoad = async () => {
    if (correlationFiles.length === 0) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      const formData = new FormData()
      formData.append('dbPath', dbPath)

      correlationFiles.forEach(corrFile => {
        if (corrFile.isValid && corrFile.file) {
          formData.append('file', corrFile.file)
        }
      })

      const response = await fetch('http://localhost:3001/api/correlation/load', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLoadSuccess(true)
        setLoadMessage(result.message)

        setCorrelationFiles([])

        await fetchStagedFiles()

        setTimeout(() => {
          setLoadSuccess(false)
          setLoadMessage('')
        }, 5000)
      } else {
        setLoadMessage(`Error: ${result.error || 'Failed to load correlation matrix'}`)
      }

    } catch (error) {
      console.error('Import error:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Convert covariance matrix to correlation matrix
  const computeCorrelationMatrix = (covData: CsvData): CsvData => {
    // Extract variances (diagonal elements)
    const variances: number[] = []
    for (let i = 0; i < covData.rows.length; i++) {
      const diagValue = parseFloat(covData.rows[i][i + 1]) // +1 to skip label column
      variances.push(diagValue)
    }

    // Compute correlations
    const corrRows = covData.rows.map((row, i) => {
      const newRow = [row[0]] // Keep variable name
      for (let j = 1; j < row.length; j++) {
        const cov = parseFloat(row[j])
        if (isNaN(cov) || isNaN(variances[i]) || isNaN(variances[j - 1])) {
          newRow.push('N/A')
        } else {
          const stdI = Math.sqrt(variances[i])
          const stdJ = Math.sqrt(variances[j - 1])
          const corr = cov / (stdI * stdJ)
          newRow.push(corr.toFixed(4))
        }
      }
      return newRow
    })

    return {
      headers: covData.headers,
      rows: corrRows
    }
  }

  // Compute correlation matrix if we have covariance data
  const correlationData = previewData ? computeCorrelationMatrix(previewData) : null

  // Get cell color for covariance values (auto-scale based on min/max)
  const getCovarianceCellColor = (value: string, allValues: string[][]): string => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'rgba(100, 116, 139, 0.3)'

    // Find min and max values (excluding non-numeric)
    let min = Infinity
    let max = -Infinity
    allValues.forEach(row => {
      row.slice(1).forEach(cell => {
        const val = parseFloat(cell)
        if (!isNaN(val)) {
          min = Math.min(min, val)
          max = Math.max(max, val)
        }
      })
    })

    // Normalize to [0, 1]
    const normalized = max === min ? 0.5 : (num - min) / (max - min)

    // Interpolate between red (low) and blue (high)
    const red = Math.round(239 - normalized * (239 - 59))
    const green = Math.round(68 + normalized * (130 - 68))
    const blue = Math.round(68 + normalized * (246 - 68))

    return `rgba(${red}, ${green}, ${blue}, 0.7)`
  }

  // Get cell color based on correlation value (-1 to 1)
  const getCellColor = (value: string): string => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'rgba(100, 116, 139, 0.3)'

    // Normalize from [-1, 1] to [0, 1]
    const normalized = (num + 1) / 2

    // Interpolate between red (negative) and blue (positive)
    // Red: rgb(239, 68, 68), Blue: rgb(59, 130, 246)
    const red = Math.round(239 - normalized * (239 - 59))
    const green = Math.round(68 + normalized * (130 - 68))
    const blue = Math.round(68 + normalized * (246 - 68))

    return `rgba(${red}, ${green}, ${blue}, 0.7)`
  }

  // Calculate min/max for covariance matrix legend
  const covarianceRange = previewData ? (() => {
    let min = Infinity
    let max = -Infinity
    previewData.rows.forEach(row => {
      row.slice(1).forEach(cell => {
        const val = parseFloat(cell)
        if (!isNaN(val)) {
          min = Math.min(min, val)
          max = Math.max(max, val)
        }
      })
    })
    return { min, max }
  })() : { min: 0, max: 0 }

  // Handle cell click to show joint distribution
  const handleCellClick = (rowIdx: number, cellIdx: number, value: string) => {
    // Skip if it's the first column (row labels) or if the value is not numeric
    if (cellIdx === 0 || !previewData) return

    // Skip diagonal cells (correlation = 1.0, same variable with itself)
    if (rowIdx === cellIdx - 1) return

    const correlation = parseFloat(value)
    if (isNaN(correlation)) return

    // Skip if correlation is too close to ±1 (causes numerical issues)
    if (Math.abs(correlation) > 0.999) return

    const var1 = previewData.headers[cellIdx]
    const var2 = previewData.rows[rowIdx][0]

    setSelectedCell({ var1, var2, correlation })
  }

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
        <h1 className="text-4xl font-bold tracking-tight">Load Correlation Matrix</h1>
        <p className="text-muted-foreground mt-2">Import covariance/correlation matrix CSV files</p>
      </div>

      <div className="flex flex-col items-center" style={{ gap: '32px' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-semibold text-lg">Correlation Matrix</h3>
                  <p className="text-sm text-muted-foreground">Select a CSV file containing covariance/correlation matrix</p>
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
                  Browse File
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
              {correlationFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Ready to Upload ({correlationFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {correlationFiles.map((corrFile, idx) => {
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
                              : `1px solid ${corrFile.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
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
                              e.currentTarget.style.borderColor = corrFile.isValid ? 'rgba(251, 191, 36, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            {corrFile.isValid ? (
                              <FileText className="w-4 h-4" style={{ color: '#ffffff' }} />
                            ) : (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm" style={{ color: '#ffffff' }}>{corrFile.name}</span>
                            {corrFile.csvData && (
                              <span className="text-xs text-muted-foreground">({corrFile.csvData.rows.length}x{corrFile.csvData.headers.length})</span>
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
                    <Check className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>{loadMessage}</span>
                </div>
              )}

              <Button
                onClick={handleLoad}
                disabled={correlationFiles.length === 0 || isLoading}
                style={{
                  width: '220px',
                  height: '44px',
                  backgroundColor: (correlationFiles.length > 0 && !isLoading) ? '#2563eb' : '#6b7280',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: (correlationFiles.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                  opacity: (correlationFiles.length > 0 && !isLoading) ? 1 : 0.5,
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

        {/* Preview Matrix */}
        {previewData && (selectedFileId || selectedPendingFileIndex !== null) && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <Activity className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Matrix Preview</h3>
                <span className="text-sm text-muted-foreground">
                  {selectedFileId
                    ? stagedFiles.find(f => f.file_id === selectedFileId)?.file_name
                    : selectedPendingFileIndex !== null
                    ? correlationFiles[selectedPendingFileIndex]?.name
                    : ''}
                </span>
              </div>

              {/* Covariance Matrix Heatmap */}
              <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 className="font-semibold text-md" style={{ color: '#3b82f6' }}>Covariance Matrix</h4>

                  {/* Continuous Color Legend */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px 16px',
                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                  }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{covarianceRange.min.toFixed(2)}</span>
                    <div style={{
                      width: '150px',
                      height: '20px',
                      background: 'linear-gradient(to right, rgba(239, 68, 68, 0.7), rgba(149, 99, 157, 0.7), rgba(59, 130, 246, 0.7))',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }} />
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{covarianceRange.max.toFixed(2)}</span>
                  </div>
                </div>

                <ScrollArea className="w-full" style={{ height: '500px' }}>
                  <div style={{ minWidth: 'max-content' }}>
                    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                          {previewData.headers.map((header, idx) => (
                            <th
                              key={idx}
                              style={{
                                padding: '12px 8px',
                                textAlign: idx === 0 ? 'left' : 'center',
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#3b82f6',
                                whiteSpace: 'nowrap',
                                width: idx === 0 ? '100px' : '60px',
                                maxWidth: idx === 0 ? '100px' : '60px'
                              }}
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.rows.map((row, rowIdx) => (
                          <tr
                            key={rowIdx}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            }}
                          >
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                style={{
                                  padding: '0',
                                  fontSize: '11px',
                                  color: '#e2e8f0',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: cellIdx === 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                  fontWeight: cellIdx === 0 ? 600 : 400,
                                  textAlign: 'center',
                                  width: cellIdx === 0 ? '100px' : '60px',
                                  height: cellIdx === 0 ? 'auto' : '60px',
                                  maxWidth: cellIdx === 0 ? '100px' : '60px'
                                }}
                              >
                                <div style={{
                                  width: '100%',
                                  height: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: cellIdx === 0 ? 'flex-start' : 'center',
                                  padding: cellIdx === 0 ? '10px 8px' : '0',
                                  minHeight: cellIdx === 0 ? 'auto' : '60px',
                                  backgroundColor: cellIdx > 0 ? getCovarianceCellColor(cell, previewData.rows) : 'transparent',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {cellIdx === 0 ? (
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cell}>
                                      {cell}
                                    </span>
                                  ) : (
                                    cell
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </div>

              {/* Correlation Matrix Heatmap */}
              {correlationData && (
                <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h4 className="font-semibold text-md" style={{ color: '#3b82f6' }}>Correlation Matrix</h4>

                    {/* Continuous Color Legend */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 16px',
                      backgroundColor: 'rgba(15, 23, 42, 0.5)',
                      borderRadius: '8px',
                      border: '1px solid rgba(59, 130, 246, 0.2)'
                    }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>-1</span>
                      <div style={{
                        width: '200px',
                        height: '20px',
                        background: 'linear-gradient(to right, rgba(239, 68, 68, 0.7), rgba(149, 99, 157, 0.7), rgba(59, 130, 246, 0.7))',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }} />
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>+1</span>
                      <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#22c55e' }}>💡 Click any cell to view joint distribution</span>
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="w-full" style={{ height: '500px' }}>
                    <div style={{ minWidth: 'max-content' }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                            {correlationData.headers.map((header, idx) => (
                              <th
                                key={idx}
                                style={{
                                  padding: '12px 8px',
                                  textAlign: idx === 0 ? 'left' : 'center',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                  color: '#3b82f6',
                                  whiteSpace: 'nowrap',
                                  width: idx === 0 ? '100px' : '60px',
                                  maxWidth: idx === 0 ? '100px' : '60px'
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {correlationData.rows.map((row, rowIdx) => (
                            <tr
                              key={rowIdx}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                            >
                              {row.map((cell, cellIdx) => (
                                <td
                                  key={cellIdx}
                                  onClick={() => handleCellClick(rowIdx, cellIdx, cell)}
                                  style={{
                                    padding: '0',
                                    fontSize: '11px',
                                    color: '#e2e8f0',
                                    whiteSpace: 'nowrap',
                                    backgroundColor: cellIdx === 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                    fontWeight: cellIdx === 0 ? 600 : 400,
                                    textAlign: 'center',
                                    width: cellIdx === 0 ? '100px' : '60px',
                                    height: cellIdx === 0 ? 'auto' : '60px',
                                    maxWidth: cellIdx === 0 ? '100px' : '60px',
                                    cursor: cellIdx > 0 && !isNaN(parseFloat(cell)) && rowIdx !== cellIdx - 1 && Math.abs(parseFloat(cell)) <= 0.999 ? 'pointer' : 'default'
                                  }}
                                >
                                  <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: cellIdx === 0 ? 'flex-start' : 'center',
                                    padding: cellIdx === 0 ? '10px 8px' : '0',
                                    minHeight: cellIdx === 0 ? 'auto' : '60px',
                                    backgroundColor: cellIdx > 0 ? getCellColor(cell) : 'transparent',
                                    transition: 'all 0.2s',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (cellIdx > 0 && !isNaN(parseFloat(cell))) {
                                      e.currentTarget.style.transform = 'scale(1.05)'
                                      e.currentTarget.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)'
                                      e.currentTarget.style.zIndex = '10'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (cellIdx > 0 && !isNaN(parseFloat(cell))) {
                                      e.currentTarget.style.transform = 'scale(1)'
                                      e.currentTarget.style.boxShadow = 'none'
                                      e.currentTarget.style.zIndex = '0'
                                    }
                                  }}
                                  >
                                    {cellIdx === 0 ? (
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cell}>
                                        {cell}
                                      </span>
                                    ) : (
                                      cell
                                    )}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Joint Distribution Panel */}
        {selectedCell && (
          <JointDistributionPanel
            variable1={selectedCell.var1}
            variable2={selectedCell.var2}
            correlation={selectedCell.correlation}
            onClose={() => setSelectedCell(null)}
          />
        )}
      </div>
    </div>
    </>
  )
}
