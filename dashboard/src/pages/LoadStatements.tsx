import { useState } from 'react'
import { FileSpreadsheet, FolderOpen, Check, X, FileText, Database as DatabaseIcon } from 'lucide-react'
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

      <div className="flex flex-col items-center" style={{ gap: '32px' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <FileSpreadsheet className="w-8 h-8 text-blue-500" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-semibold text-lg">Statement Type</h3>
                  <p className="text-sm text-muted-foreground">Select and load statement</p>
                </div>
              </div>

              {/* Statement Type Buttons */}
              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {(Object.keys(statementLabels) as StatementType[]).map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      onClick={() => handleStatementTypeChange(type)}
                      style={{
                        height: '44px',
                        color: '#ffffff',
                        backgroundColor: type === statementType ? '#2563eb' : 'rgba(15, 23, 42, 0.8)',
                        borderColor: type === statementType ? '#2563eb' : 'rgba(59, 130, 246, 0.3)',
                        border: 'none',
                        boxShadow: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {statementLabels[type]}
                    </Button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ef4444', marginLeft: '1.5rem' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#22c55e', marginLeft: '1.5rem' }}>
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
