import { useState, useEffect } from 'react'
import { FileSpreadsheet, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CsvData {
  headers: string[]
  rows: string[][]
}

type StatementType = 'balance_sheet' | 'pnl' | 'carbon' | 'cashflow'

const statementLabels: Record<StatementType, string> = {
  balance_sheet: 'Balance Sheet',
  pnl: 'P&L',
  carbon: 'Carbon',
  cashflow: 'Cash Flow'
}

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

export default function LoadStatements() {
  const [statementType, setStatementType] = useState<StatementType>('balance_sheet')
  const [filePath, setFilePath] = useState('')
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [csvData, setCsvData] = useState<CsvData | null>(null)
  const [fileName, setFileName] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])

  // Load staged files when component mounts or statement type changes
  useEffect(() => {
    fetchStagedFiles()
  }, [statementType])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${statementType}?dbPath=${encodeURIComponent(dbPath)}`)
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

    return { headers, rows: rows.slice(0, 20) } // Limit to 20 rows for preview
  }

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        setFileName(file.name)
        setFilePath(file.name)
        setCsvFile(file)

        // Read and parse CSV for preview
        try {
          const text = await file.text()
          const parsed = parseCsv(text)
          setCsvData(parsed)
          setIsValid(true)
        } catch (error) {
          setIsValid(false)
          setCsvData(null)
          setCsvFile(null)
        }
      }
    }

    input.click()
  }

  const handleLoad = async () => {
    if (!isValid || !csvFile) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // Create form data
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('statementType', statementType)
      formData.append('dbPath', dbPath)

      // Call API
      const response = await fetch('http://localhost:3001/api/statements/load', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLoadSuccess(true)
        setLoadMessage(result.message)

        // Record the staged file
        try {
          const rowCount = csvData?.rows.length || 0
          await fetch('http://localhost:3001/api/staged-files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dbPath,
              fileName: fileName,
              fileType: statementType,
              rowCount
            })
          })

          // Refresh staged files list
          fetchStagedFiles()
        } catch (err) {
          console.error('Failed to record staged file:', err)
        }

        setTimeout(() => {
          setLoadSuccess(false)
          setLoadMessage('')
        }, 5000)
      } else {
        setLoadMessage(`Error: ${result.error || 'Failed to load statements'}`)
      }

    } catch (error) {
      console.error('Import error:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStatementTypeChange = (type: StatementType) => {
    setStatementType(type)
    // Reset file selection when changing type
    setFilePath('')
    setCsvData(null)
    setIsValid(null)
    setFileName('')
    setCsvFile(null)
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Load Statements</h1>
        <p className="text-muted-foreground mt-2">Import financial statements from CSV</p>
      </div>

      <div className="flex flex-col" style={{ gap: '32px', paddingLeft: '1.5rem' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '800px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
              {/* Statement Type Section */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <FileSpreadsheet className="w-6 h-6 text-blue-500" />
                  <h3 className="font-semibold text-lg">Statement Type</h3>
                </div>
                <div style={{ display: 'flex', gap: '2px', marginBottom: '-8px' }}>
                  {(Object.keys(statementLabels) as StatementType[]).map((type, index) => {
                    // Different color schemes for each tab
                    const tabColors = {
                      pnl: {
                        active: 'rgba(37, 99, 235, 0.2)',   // blue
                        border: '#2563eb',
                        borderLight: 'rgba(37, 99, 235, 0.3)'
                      },
                      balance_sheet: {
                        active: 'rgba(168, 85, 247, 0.2)',  // purple
                        border: '#a855f7',
                        borderLight: 'rgba(168, 85, 247, 0.3)'
                      },
                      cashflow: {
                        active: 'rgba(34, 197, 94, 0.2)',   // green
                        border: '#22c55e',
                        borderLight: 'rgba(34, 197, 94, 0.3)'
                      },
                      carbon: {
                        active: 'rgba(251, 146, 60, 0.2)',  // orange
                        border: '#fb923c',
                        borderLight: 'rgba(251, 146, 60, 0.3)'
                      }
                    }

                    const colors = tabColors[type as keyof typeof tabColors]

                    return (
                      <Button
                        key={type}
                        variant="outline"
                        onClick={() => handleStatementTypeChange(type)}
                        style={{
                          padding: '12px 24px',
                          color: type === statementType ? '#ffffff' : '#94a3b8',
                          backgroundColor: type === statementType ? colors.active : 'rgba(15, 23, 42, 0.5)',
                          borderTop: type === statementType ? `3px solid ${colors.border}` : `3px solid ${colors.borderLight}`,
                          borderLeft: `1px solid ${colors.borderLight}`,
                          borderRight: `1px solid ${colors.borderLight}`,
                          borderBottom: type === statementType ? 'none' : `1px solid ${colors.borderLight}`,
                          borderRadius: '8px 8px 0 0',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          fontWeight: type === statementType ? 600 : 400,
                          position: 'relative',
                          zIndex: type === statementType ? 10 : 1,
                        }}
                      >
                        {statementLabels[type]}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Staged Files List */}
              {stagedFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Staged Files ({stagedFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {stagedFiles.map((file) => (
                      <div
                        key={file.file_id}
                        style={{
                          display: 'flex',
                          alignItems: 'start',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: '1px solid rgba(34, 197, 94, 0.3)',
                          cursor: 'pointer'
                        }}
                        onClick={async () => {
                          // Fetch and preview the staged file
                          try {
                            const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
                            const response = await fetch(`http://localhost:3001/api/staged-files/${file.file_id}/preview?dbPath=${encodeURIComponent(dbPath)}`)
                            const result = await response.json()

                            if (result.success && result.csvText) {
                              const parsed = parseCsv(result.csvText)
                              setCsvData(parsed)
                              setFileName(file.file_name)
                              setIsValid(true)
                            }
                          } catch (error) {
                            console.error('Failed to fetch staged file preview:', error)
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginTop: '7px' }}>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm" style={{ color: '#ffffff' }}>{file.file_name}</span>
                          <span className="text-xs text-muted-foreground">({file.row_count} rows)</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStagedFile(file.file_id)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            marginTop: '0px'
                          }}
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <Input
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="/path/to/statements.csv"
                  readOnly
                  style={{
                    flex: 1,
                    color: '#ffffff',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    padding: '10px 12px',
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleBrowse}
                  style={{
                    color: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '10px 16px',
                  }}
                >
                  <FolderOpen style={{ width: '16px', height: '16px', marginRight: '8px', color: '#ffffff' }} />
                  Browse
                </Button>
              </div>

              {isValid === false && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ef4444' }}>
                  <div style={{
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <X style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                  </div>
                  <span>Invalid CSV file</span>
                </div>
              )}

              {isValid === true && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#22c55e' }}>
                  <div style={{
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check style={{ width: '16px', height: '16px', color: '#22c55e' }} />
                  </div>
                  <span>Valid CSV file - {csvData?.rows.length || 0} rows</span>
                </div>
              )}

              {loadMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: loadSuccess ? '#22c55e' : '#ef4444',
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
                disabled={!isValid || isLoading}
                style={{
                  width: '220px',
                  height: '44px',
                  backgroundColor: (isValid && !isLoading) ? '#2563eb' : '#6b7280',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: (isValid && !isLoading) ? 'pointer' : 'not-allowed',
                  opacity: (isValid && !isLoading) ? 1 : 0.5,
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

        {/* CSV Preview Card */}
        {csvData && csvData.headers.length > 0 && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">CSV Preview</h3>
                <span className="text-sm text-muted-foreground">({fileName})</span>
              </div>

              <ScrollArea className="w-full" style={{ height: '400px' }}>
                <div style={{ minWidth: 'max-content' }}>
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                        {csvData.headers.map((header, idx) => (
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
                      {csvData.rows.map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
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

              {csvData.rows.length >= 20 && (
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Showing first 20 rows of preview
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
