import { useState, useEffect } from 'react'
import { Activity, FolderOpen, Check, X, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

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

  // Get cell color based on correlation value
  const getCellColor = (value: string): string => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'rgba(100, 116, 139, 0.3)'

    if (num >= 0) {
      const intensity = Math.abs(num)
      return `rgba(59, 130, 246, ${intensity * 0.7})`
    } else {
      const intensity = Math.abs(num)
      return `rgba(239, 68, 68, ${intensity * 0.7})`
    }
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

              {/* Correlation Matrix Heatmap */}
              <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                {/* Color Legend */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  marginBottom: '16px',
                  padding: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '8px',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>Legend:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '20px',
                      background: 'linear-gradient(to right, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.7))',
                      borderRadius: '4px',
                      border: '1px solid rgba(239, 68, 68, 0.4)'
                    }} />
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Negative</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '32px',
                      height: '20px',
                      background: 'linear-gradient(to right, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.7))',
                      borderRadius: '4px',
                      border: '1px solid rgba(59, 130, 246, 0.4)'
                    }} />
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Positive</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: 'rgba(100, 116, 139, 0.3)',
                      borderRadius: '4px',
                      border: '1px solid rgba(100, 116, 139, 0.5)'
                    }} />
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Non-numeric</span>
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
                                  padding: '10px 16px',
                                  fontSize: '13px',
                                  color: '#e2e8f0',
                                  whiteSpace: 'nowrap',
                                  backgroundColor: cellIdx === 0 ? 'rgba(59, 130, 246, 0.1)' : getCellColor(cell),
                                  fontWeight: cellIdx === 0 ? 600 : 400,
                                  textAlign: cellIdx === 0 ? 'left' : 'center'
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  )
}
