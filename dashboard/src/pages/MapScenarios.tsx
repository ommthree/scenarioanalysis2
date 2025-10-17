import { useState, useEffect } from 'react'
import { ArrowRight, Save, Sparkles, Activity, Trash2, Check } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { parse } from 'csv-parse/sync'

interface Driver {
  driver_id: number
  code: string
  name: string
  category: string
}

interface CsvRow {
  [key: string]: any
}

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
}

interface VariableMapping {
  csv_row_index: number
  driver_code: string
}

export default function MapScenarios() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState<string>('')

  // Column configuration
  const [driverColumn, setDriverColumn] = useState<string | null>(null)
  const [valueColumns, setValueColumns] = useState<string[]>([])

  // Row mappings
  const [variableMappings, setVariableMappings] = useState<VariableMapping[]>([])
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // AI mapping
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false)
  const [aiMappingMessage, setAiMappingMessage] = useState<string>('')

  // Save status
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Load staged files
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  // Load drivers
  useEffect(() => {
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => setDrivers(data || []))
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/staged-files/scenario?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      if (result.success) {
        setStagedFiles(result.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch staged files:', error)
    }
  }

  const handleFileSelect = async (fileId: number) => {
    setSelectedFileId(fileId)
    setVariableMappings([])

    try {
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success && result.csvText) {
        const records = parse(result.csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }) as CsvRow[]

        const columns = records.length > 0 ? Object.keys(records[0]) : []

        setCsvData(records)
        setCsvColumns(columns)
        setCsvFileName(result.fileName)

        // Auto-detect driver column (look for "driver", "variable", "drivername")
        const driverCol = columns.find(col =>
          col.toLowerCase().includes('driver') ||
          col.toLowerCase().includes('variable') ||
          col.toLowerCase() === 'drivername'
        )
        if (driverCol) {
          setDriverColumn(driverCol)
        }

        // Auto-detect value columns (numeric columns)
        const valueCols = columns.filter(col => {
          const firstValue = records[0]?.[col]
          return !isNaN(parseFloat(firstValue)) && isFinite(parseFloat(firstValue))
        })
        setValueColumns(valueCols)
      }
    } catch (error) {
      console.error('Failed to load scenario file:', error)
    }
  }

  const handleRoleDragStart = (role: 'driver' | 'value') => {
    // For future drag-and-drop column assignment
  }

  const handleColumnDrop = (columnName: string) => {
    // For future drag-and-drop column assignment
  }

  const toggleRowMapping = (rowIdx: number, driverCode: string) => {
    setVariableMappings(prev => {
      const existing = prev.find(m => m.csv_row_index === rowIdx)
      if (existing) {
        if (existing.driver_code === driverCode) {
          // Remove mapping
          return prev.filter(m => m.csv_row_index !== rowIdx)
        } else {
          // Update mapping
          return prev.map(m =>
            m.csv_row_index === rowIdx
              ? { ...m, driver_code: driverCode }
              : m
          )
        }
      } else {
        // Add new mapping
        return [...prev, { csv_row_index: rowIdx, driver_code: driverCode }]
      }
    })
  }

  const handleAIMapping = async () => {
    if (!driverColumn || csvData.length === 0 || drivers.length === 0) {
      setAiMappingMessage('Please select a file and configure the driver column first')
      setTimeout(() => setAiMappingMessage(''), 3000)
      return
    }

    setAiMappingInProgress(true)
    setAiMappingMessage('Analyzing with AI...')

    try {
      const csvSample = csvData.slice(0, 20).map((row, idx) => ({
        index: idx,
        data: row
      }))

      const prompt = `You are a scenario mapping assistant. Analyze the CSV data and map driver variables to the defined drivers.

CSV Columns: ${csvColumns.join(', ')}
Driver Column: ${driverColumn}
CSV Sample (first 20 rows):
${JSON.stringify(csvSample, null, 2)}

Available Drivers to map:
${drivers.map(d => `- ${d.code}: ${d.name} (${d.category})`).join('\n')}

Instructions:
1. Analyze the "${driverColumn}" column values in the CSV
2. Map each CSV row to the most appropriate driver code
3. Return ONLY a JSON object with this format:
{
  "row_mappings": [
    {
      "csv_row_index": 0,
      "driver_code": "REVENUE_GROWTH",
      "confidence": "high"
    },
    {
      "csv_row_index": 1,
      "driver_code": "COGS_MARGIN",
      "confidence": "high"
    }
  ]
}

Rules:
- Only map rows where you have reasonable confidence
- driver_code must match one of the available driver codes
- confidence can be "high", "medium", or "low"
- Look for semantic matches between variable names and driver descriptions

Respond with ONLY the JSON object, no other text`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'AI mapping failed')
      }

      const result = await response.json()
      const content = result.content[0].text

      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI')
      }

      const aiResponse = JSON.parse(jsonMatch[0])
      const rowMappings = aiResponse.row_mappings || []

      // Apply the AI-suggested mappings
      setVariableMappings(rowMappings.map((m: any) => ({
        csv_row_index: m.csv_row_index,
        driver_code: m.driver_code
      })))

      setAiMappingMessage('AI mapping completed!')
      setTimeout(() => setAiMappingMessage(''), 5000)

    } catch (error) {
      console.error('AI mapping error:', error)
      setAiMappingMessage(`Error: ${error instanceof Error ? error.message : 'AI mapping failed'}`)
      setTimeout(() => setAiMappingMessage(''), 5000)
    } finally {
      setAiMappingInProgress(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFileId || variableMappings.length === 0) {
      setSaveMessage('No mappings to save')
      setTimeout(() => setSaveMessage(''), 3000)
      return
    }

    setIsSaving(true)
    setSaveMessage('Saving mappings...')

    try {
      const response = await fetch('http://localhost:3001/api/scenario-mappings/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dbPath,
          fileId: selectedFileId,
          driverColumn,
          valueColumns,
          variableMappings
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSaveMessage('Mappings saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage(`Error: ${result.error || 'Failed to save mappings'}`)
        setTimeout(() => setSaveMessage(''), 5000)
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
      setTimeout(() => setSaveMessage(''), 5000)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-12 max-w-[1800px] mx-auto">
      <div className="mb-8" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Map Scenarios</h1>
        <p className="text-muted-foreground mt-2">Map scenario variables to drivers</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - File Selection */}
        <div className="col-span-3">
          <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-6">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Activity className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Scenario Files</h3>
              </div>

              {stagedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">No staged scenarios found</p>
              ) : (
                <ScrollArea style={{ height: 'calc(100vh - 300px)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {stagedFiles.map(file => {
                      const isSelected = selectedFileId === file.file_id
                      return (
                        <button
                          key={file.file_id}
                          onClick={() => handleFileSelect(file.file_id)}
                          style={{
                            padding: '12px',
                            backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                            border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isSelected && <Check className="w-4 h-4 text-green-500" />}
                            <span style={{ fontSize: '14px', color: isSelected ? '#10b981' : '#e2e8f0', fontWeight: isSelected ? 600 : 500 }}>
                              {file.file_name}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                            {file.row_count} rows
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Mapping Interface */}
        <div className="col-span-9">
          {!selectedFileId ? (
            <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)', padding: '48px', textAlign: 'center' }}>
              <p className="text-muted-foreground">Select a scenario file to begin mapping</p>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Column Configuration */}
              <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Column Configuration</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', alignItems: 'center' }}>
                    <div className="text-sm text-muted-foreground">Driver/Variable Column:</div>
                    <div className="text-sm font-medium" style={{ color: '#10b981' }}>{driverColumn || 'Not configured'}</div>

                    <div className="text-sm text-muted-foreground">Value Columns:</div>
                    <div className="text-sm">{valueColumns.length > 0 ? valueColumns.join(', ') : 'None detected'}</div>
                  </div>
                </CardContent>
              </Card>

              {/* AI Mapping and Save */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  onClick={handleAIMapping}
                  disabled={aiMappingInProgress || !driverColumn}
                  style={{
                    backgroundColor: aiMappingInProgress ? '#6b7280' : '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {aiMappingInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      AI Mapping...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      AI Mapping
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving || variableMappings.length === 0}
                  style={{
                    backgroundColor: isSaving ? '#6b7280' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Mappings'}
                </Button>
              </div>

              {(aiMappingMessage || saveMessage) && (
                <div style={{
                  padding: '12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#60a5fa'
                }}>
                  {aiMappingMessage || saveMessage}
                </div>
              )}

              {/* Mapping Table */}
              <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Variable to Driver Mapping</h3>
                  <ScrollArea style={{ height: '600px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                          <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: 600, color: '#3b82f6' }}>
                            Variable Name
                          </th>
                          {drivers.slice(0, 5).map(driver => (
                            <th key={driver.code} style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#3b82f6' }}>
                              {driver.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvData.map((row, rowIdx) => {
                          const variableName = driverColumn ? row[driverColumn] : ''
                          const mapping = variableMappings.find(m => m.csv_row_index === rowIdx)

                          return (
                            <tr
                              key={rowIdx}
                              style={{
                                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                backgroundColor: mapping ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                              }}
                            >
                              <td style={{ padding: '10px 12px', fontSize: '13px', color: '#e2e8f0' }}>
                                {variableName}
                              </td>
                              {drivers.slice(0, 5).map(driver => {
                                const isMapped = mapping?.driver_code === driver.code
                                return (
                                  <td key={driver.code} style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <button
                                      onClick={() => toggleRowMapping(rowIdx, driver.code)}
                                      style={{
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '4px',
                                        backgroundColor: isMapped ? '#10b981' : 'rgba(71, 85, 105, 0.3)',
                                        border: isMapped ? '2px solid #10b981' : '1px solid rgba(71, 85, 105, 0.5)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        margin: '0 auto'
                                      }}
                                    >
                                      {isMapped && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
