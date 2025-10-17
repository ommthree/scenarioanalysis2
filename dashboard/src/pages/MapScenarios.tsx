import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, GripVertical, FileSpreadsheet, Move, Sparkles } from 'lucide-react'

interface Driver {
  driver_id: number
  code: string
  name: string
  description: string
  category: string
}

interface TableInfo {
  tableName: string
  fileName: string
  fileId: number
}

interface StagedFile {
  file_id: number
  file_name: string
  row_count: number
  uploaded_at: string
}

interface CsvRow {
  [key: string]: any
}

const MapScenarios: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  // CSV Preview State
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [isLoadingMapping, setIsLoadingMapping] = useState(false)

  // Column Configuration State
  const [scenarioColumn, setScenarioColumn] = useState<string | null>(null)
  const [variableColumn, setVariableColumn] = useState<string | null>(null)
  const [unitsColumn, setUnitsColumn] = useState<string | null>(null)
  const [valueStartColumn, setValueStartColumn] = useState<string | null>(null)
  const [valueEndColumn, setValueEndColumn] = useState<string | null>(null)

  // Drag state
  const [draggedRole, setDraggedRole] = useState<'scenario' | 'variable' | 'units' | 'valueStart' | 'valueEnd' | null>(null)
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // Variable mappings: maps driver_code to csv_row_index
  const [variableMappings, setVariableMappings] = useState<Array<{csv_row_index: number, driver_code: string}>>([])

  // AI Mapping state
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false)
  const [aiMappingMessage, setAiMappingMessage] = useState('')
  const [aiRowMappingInProgress, setAiRowMappingInProgress] = useState(false)
  const [aiRowMappingMessage, setAiRowMappingMessage] = useState('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Fetch available staging tables
  useEffect(() => {
    fetch(`http://localhost:3001/api/scenarios/staging-tables?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTables(data.tables || [])
        }
      })
      .catch(err => console.error('Error fetching staging tables:', err))
  }, [])

  // Fetch drivers
  useEffect(() => {
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        setDrivers(data || [])
      })
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  // Auto-save mappings when they change
  useEffect(() => {
    if (!selectedFileId || !variableColumn || isLoadingMapping) return

    const timeoutId = setTimeout(async () => {
      try {
        const valueColumns = getValueColumns()

        const payload = {
          dbPath,
          fileId: selectedFileId,
          scenarioColumn: scenarioColumn,
          unitsColumn: unitsColumn,
          driverColumn: variableColumn,
          valueColumns: valueColumns,
          variableMappings: variableMappings
        }

        console.log('Auto-save payload:', payload)

        await fetch('http://localhost:3001/api/scenarios/save-scenario-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Auto-save error:', err)
      }
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timeoutId)
  }, [variableMappings, selectedFileId, variableColumn, valueStartColumn, valueEndColumn, scenarioColumn, unitsColumn])

  // Load CSV data when file is selected
  const handleFileSelect = async (fileId: number, fileName: string) => {
    console.log('File clicked:', fileId, fileName)
    setSelectedFileId(fileId)
    setSelectedFileName(fileName)
    setIsLoadingMapping(true)

    // Clear previous data
    setCsvData([])
    setCsvColumns([])
    setScenarioColumn(null)
    setVariableColumn(null)
    setUnitsColumn(null)
    setValueStartColumn(null)
    setValueEndColumn(null)
    setVariableMappings([])

    try {
      // Load saved mapping if it exists
      try {
        const mappingResponse = await fetch(`http://localhost:3001/api/scenarios/get-scenario-mapping?dbPath=${encodeURIComponent(dbPath)}&fileId=${fileId}`)
        const mappingResult = await mappingResponse.json()

        if (mappingResult.success && mappingResult.mapping) {
          const mapping = mappingResult.mapping
          console.log('Loading mapping:', mapping)
          console.log('scenarioColumn from DB:', mapping.scenarioColumn)
          if (mapping.scenarioColumn) {
            console.log('Setting scenarioColumn to:', mapping.scenarioColumn)
            setScenarioColumn(mapping.scenarioColumn)
          }
          if (mapping.unitsColumn) setUnitsColumn(mapping.unitsColumn)
          setVariableColumn(mapping.driverColumn)
          if (mapping.valueColumns && mapping.valueColumns.length > 0) {
            setValueStartColumn(mapping.valueColumns[0])
            setValueEndColumn(mapping.valueColumns[mapping.valueColumns.length - 1])
          }
          setVariableMappings(mapping.variableMappings || [])
        }
      } catch (mappingError) {
        console.log('No saved mapping found or error loading mapping:', mappingError)
        // Continue without loading mapping
      } finally {
        setIsLoadingMapping(false)
      }

      // Find the table name for this file
      const tableInfo = availableTables.find(t => t.fileId === fileId)
      console.log('Table info found:', tableInfo)
      if (!tableInfo) {
        console.error('No table info found for fileId:', fileId)
        return
      }

      const url = `http://localhost:3001/api/scenarios/staging-preview?dbPath=${encodeURIComponent(dbPath)}&tableName=${encodeURIComponent(tableInfo.tableName)}&limit=5`
      console.log('Fetching:', url)

      const response = await fetch(url)
      const result = await response.json()
      console.log('Response:', result)

      if (result.success && result.data) {
        console.log('Setting CSV data, rows:', result.data.length)
        setCsvData(result.data)
        if (result.data.length > 0) {
          const cols = Object.keys(result.data[0]).filter(col =>
            !['_rowid', 'imported_at', 'is_mapped'].includes(col)
          )
          console.log('Columns:', cols)
          setCsvColumns(cols)
        }
      } else {
        console.error('Failed to load data:', result)
      }
    } catch (error) {
      console.error('Error loading CSV preview:', error)
    }
  }

  const handleRoleDragStart = (role: 'scenario' | 'variable' | 'units' | 'valueStart' | 'valueEnd') => {
    setDraggedRole(role)
  }

  const handleRoleDragEnd = () => {
    setDraggedRole(null)
  }

  const handleColumnDrop = (columnName: string) => {
    if (!draggedRole) return

    const roleMap = {
      scenario: setScenarioColumn,
      variable: setVariableColumn,
      units: setUnitsColumn,
      valueStart: setValueStartColumn,
      valueEnd: setValueEndColumn
    }

    roleMap[draggedRole](columnName)
    setDraggedRole(null)
  }

  const handleRemoveColumnAssignment = (role: 'scenario' | 'variable' | 'units' | 'valueStart' | 'valueEnd') => {
    const roleMap = {
      scenario: setScenarioColumn,
      variable: setVariableColumn,
      units: setUnitsColumn,
      valueStart: setValueStartColumn,
      valueEnd: setValueEndColumn
    }
    roleMap[role](null)
  }

  const handleAIMapping = async () => {
    if (csvData.length === 0 || csvColumns.length === 0) {
      setAiMappingMessage('No CSV data loaded')
      setTimeout(() => setAiMappingMessage(''), 3000)
      return
    }

    setAiMappingInProgress(true)
    setAiMappingMessage('Analyzing with AI...')

    try {
      const csvSample = csvData.slice(0, 5)

      const prompt = `You are a scenario data mapping assistant. Analyze this CSV data and identify the column structure for scenario analysis.

CSV Columns: ${csvColumns.join(', ')}
CSV Sample (first 5 rows):
${JSON.stringify(csvSample, null, 2)}

Instructions:
Identify which columns are:
1. scenario - Column containing scenario names/identifiers
2. variable - Column containing variable/driver names
3. value_start - First column containing numeric scenario values (e.g., first year)
4. value_end - Last column containing numeric scenario values (e.g., last year)

Return ONLY a JSON object in this format:
{
  "scenario_column": "column_name",
  "variable_column": "column_name",
  "value_start_column": "column_name",
  "value_end_column": "column_name"
}

Rules:
- Value columns are typically years or time periods
- Scenario column might be named like "scenario", "name", "id"
- Variable column might be named like "variable", "driver", "indicator"
- If there are multiple value columns, identify the first and last one`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'AI mapping failed')
      }

      const result = await response.json()
      const content = result.content[0].text

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI')
      }

      const aiResponse = JSON.parse(jsonMatch[0])

      // Apply the AI suggestions
      if (aiResponse.scenario_column) setScenarioColumn(aiResponse.scenario_column)
      if (aiResponse.variable_column) setVariableColumn(aiResponse.variable_column)
      if (aiResponse.value_start_column) setValueStartColumn(aiResponse.value_start_column)
      if (aiResponse.value_end_column) setValueEndColumn(aiResponse.value_end_column)

      setAiMappingMessage('Mapping performed')
      setTimeout(() => setAiMappingMessage(''), 3000)

    } catch (error) {
      console.error('AI mapping error:', error)
      setAiMappingMessage(`Error: ${error instanceof Error ? error.message : 'AI mapping failed'}`)
      setTimeout(() => setAiMappingMessage(''), 5000)
    } finally {
      setAiMappingInProgress(false)
    }
  }

  const handleAIRowMapping = async () => {
    if (csvData.length === 0 || drivers.length === 0 || !variableColumn) {
      setAiRowMappingMessage('Error: Missing data or variable column not set')
      setTimeout(() => setAiRowMappingMessage(''), 3000)
      return
    }

    setAiRowMappingInProgress(true)
    setAiRowMappingMessage('AI analyzing rows...')

    try {
      // Prepare driver information
      const driverInfo = drivers.map(d => ({
        code: d.code,
        name: d.name,
        description: d.description,
        category: d.category
      }))

      // Prepare CSV row information
      const csvRowInfo = csvData.map((row, index) => ({
        index: index,
        identifier: getRowIdentifier(row)
      })).filter(r => r.identifier) // Only include rows with identifiers

      const prompt = `You are a scenario data mapping assistant. Map CSV rows to climate scenario drivers.

Available Drivers:
${JSON.stringify(driverInfo, null, 2)}

CSV Rows (from "${variableColumn}" column):
${JSON.stringify(csvRowInfo, null, 2)}

Instructions:
Match each CSV row to the most appropriate driver based on:
1. The driver's name and description
2. The CSV row identifier text
3. Keywords related to climate scenarios (temperature, sea level, carbon price, policy, etc.)

Return ONLY a JSON array of mappings in this format:
[
  {"csv_row_index": 0, "driver_code": "TEMP_RISE"},
  {"csv_row_index": 1, "driver_code": "SEA_LEVEL"}
]

Rules:
- Only include mappings you are confident about
- A CSV row can only map to one driver
- Not all rows need to be mapped
- Use the exact driver codes from the Available Drivers list`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'AI row mapping failed')
      }

      const result = await response.json()
      const content = result.content[0].text

      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI')
      }

      const aiMappings = JSON.parse(jsonMatch[0])

      // Apply the AI mappings
      setVariableMappings(aiMappings)

      setAiRowMappingMessage(`Mapped ${aiMappings.length} rows`)
      setTimeout(() => setAiRowMappingMessage(''), 3000)

    } catch (error) {
      console.error('AI row mapping error:', error)
      setAiRowMappingMessage(`Error: ${error instanceof Error ? error.message : 'AI row mapping failed'}`)
      setTimeout(() => setAiRowMappingMessage(''), 5000)
    } finally {
      setAiRowMappingInProgress(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFileId || !variableColumn) return

    setSaveStatus('saving')

    try {
      const valueColumns = getValueColumns()

      const response = await fetch('http://localhost:3001/api/scenarios/save-scenario-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          fileId: selectedFileId,
          scenarioColumn: scenarioColumn,
          unitsColumn: unitsColumn,
          driverColumn: variableColumn,
          valueColumns: valueColumns,
          variableMappings: variableMappings
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save mapping')
      }

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  // Row drag handlers for variable mapping
  const handleRowDragStart = (rowIndex: number) => {
    setDraggedRowIndex(rowIndex)
  }

  const handleRowDrop = (driverCode: string) => {
    if (draggedRowIndex === null) return

    // Check if this driver already has a mapping
    const existingMappingIndex = variableMappings.findIndex(m => m.driver_code === driverCode)

    if (existingMappingIndex >= 0) {
      // Replace existing mapping
      const newMappings = [...variableMappings]
      newMappings[existingMappingIndex] = { csv_row_index: draggedRowIndex, driver_code: driverCode }
      setVariableMappings(newMappings)
    } else {
      // Add new mapping
      setVariableMappings([...variableMappings, { csv_row_index: draggedRowIndex, driver_code: driverCode }])
    }

    setDraggedRowIndex(null)
  }

  const getRowIdentifier = (row: CsvRow) => {
    if (!variableColumn) return ''
    return row[variableColumn] || ''
  }

  const getMappedRow = (driverCode: string): number | null => {
    const mapping = variableMappings.find(m => m.driver_code === driverCode)
    return mapping ? mapping.csv_row_index : null
  }

  const getValueColumns = () => {
    if (!valueStartColumn || !valueEndColumn) return []

    const startIdx = csvColumns.indexOf(valueStartColumn)
    const endIdx = csvColumns.indexOf(valueEndColumn)

    if (startIdx === -1 || endIdx === -1) return []

    return csvColumns.slice(startIdx, endIdx + 1)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '40px'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Map Scenario Data
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Configure how scenario CSV files are structured and map variable names to defined drivers
          </p>
        </div>

        {/* No Data Warning */}
        {availableTables.length === 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            marginBottom: '32px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px'
              }}>
                <AlertCircle style={{ width: '32px', height: '32px', color: '#ef4444', margin: '0 auto 12px' }} />
                <div style={{ color: '#fca5a5', fontSize: '14px' }}>
                  No scenario data loaded. Please upload scenario CSV files first in the "Load Scenarios" page.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Select File - Tile Based */}
        {availableTables.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                  Select Scenario File
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {availableTables.map(table => {
                  const isSelected = selectedFileId === table.fileId
                  return (
                    <button
                      key={table.fileId}
                      onClick={() => handleFileSelect(table.fileId, table.fileName)}
                      style={{
                        padding: '12px 20px',
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                        border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        minWidth: '200px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                        }
                      }}
                    >
                      <FileSpreadsheet className="w-5 h-5" style={{ color: isSelected ? '#10b981' : '#94a3b8' }} />
                      <span style={{
                        color: isSelected ? '#10b981' : '#e2e8f0',
                        fontSize: '14px',
                        fontWeight: isSelected ? 600 : 500
                      }}>
                        {table.fileName}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Configure Column Mapping with CSV Preview */}
        {selectedFileId && csvData.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                    Configure Column Structure - {selectedFileName}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Drag role chips onto column headers to assign their purpose
                  </p>
                </div>

                {/* AI Mapping Button */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <Button
                    onClick={handleAIMapping}
                    disabled={aiMappingInProgress}
                    style={{
                      backgroundColor: aiMappingInProgress ? '#64748b' : '#8b5cf6',
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      boxShadow: 'none'
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
                  {aiMappingMessage && (
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: aiMappingMessage.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                      border: `1px solid ${aiMappingMessage.includes('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                      borderRadius: '4px',
                      color: aiMappingMessage.includes('Error') ? '#ef4444' : '#8b5cf6',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      {aiMappingMessage}
                    </div>
                  )}
                </div>
              </div>

              {/* Draggable Role Tiles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Move className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">Column Roles:</h4>
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('scenario')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '2px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#60a5fa',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Scenario Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('variable')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '2px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#a855f7',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Variable Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('units')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(251, 146, 60, 0.2)',
                    border: '2px solid rgba(251, 146, 60, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fb923c',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(251, 146, 60, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Units Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('valueStart')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    border: '2px solid rgba(34, 197, 94, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#22c55e',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Value Start Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('valueEnd')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    border: '2px solid rgba(34, 197, 94, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#22c55e',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Value End Column
                </div>
              </div>

              {/* CSV Preview Table with Droppable Column Headers */}
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10 }}>
                    <tr>
                      {csvColumns.map((col) => {
                        const isScenarioCol = scenarioColumn === col
                        const isVariableCol = variableColumn === col
                        const isUnitsCol = unitsColumn === col
                        const isValueStartCol = valueStartColumn === col
                        const isValueEndCol = valueEndColumn === col
                        const valueColumns = getValueColumns()
                        const isInValueRange = valueColumns.includes(col)
                        const hasAssignment = isScenarioCol || isVariableCol || isUnitsCol || isValueStartCol || isValueEndCol

                        let bgColor = 'rgba(30, 41, 59, 0.9)'
                        let borderColor = 'rgba(71, 85, 105, 0.3)'
                        let textColor = '#94a3b8'
                        let badgeContent = null
                        let minWidth = 'auto'

                        if (isScenarioCol) {
                          bgColor = 'rgba(59, 130, 246, 0.15)'
                          borderColor = 'rgba(59, 130, 246, 0.5)'
                          textColor = '#60a5fa'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Scenario</span>
                        } else if (isVariableCol) {
                          bgColor = 'rgba(168, 85, 247, 0.15)'
                          borderColor = 'rgba(168, 85, 247, 0.5)'
                          textColor = '#a855f7'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Variable</span>
                        } else if (isUnitsCol) {
                          bgColor = 'rgba(251, 146, 60, 0.15)'
                          borderColor = 'rgba(251, 146, 60, 0.5)'
                          textColor = '#fb923c'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(251, 146, 60, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Units</span>
                          minWidth = '200px'
                        } else if (isValueStartCol) {
                          bgColor = 'rgba(34, 197, 94, 0.15)'
                          borderColor = 'rgba(34, 197, 94, 0.5)'
                          textColor = '#22c55e'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(34, 197, 94, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Start</span>
                        } else if (isValueEndCol) {
                          bgColor = 'rgba(34, 197, 94, 0.15)'
                          borderColor = 'rgba(34, 197, 94, 0.5)'
                          textColor = '#22c55e'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(34, 197, 94, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>End</span>
                        } else if (isInValueRange) {
                          bgColor = 'rgba(34, 197, 94, 0.08)'
                          borderColor = 'rgba(34, 197, 94, 0.3)'
                          textColor = '#22c55e'
                        }

                        return (
                          <th
                            key={col}
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (!hasAssignment) {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
                              }
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.style.backgroundColor = bgColor
                              e.currentTarget.style.borderColor = borderColor
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              handleColumnDrop(col)
                              e.currentTarget.style.backgroundColor = bgColor
                              e.currentTarget.style.borderColor = borderColor
                            }}
                            onClick={() => {
                              if (isScenarioCol) handleRemoveColumnAssignment('scenario')
                              else if (isVariableCol) handleRemoveColumnAssignment('variable')
                              else if (isUnitsCol) handleRemoveColumnAssignment('units')
                              else if (isValueStartCol) handleRemoveColumnAssignment('valueStart')
                              else if (isValueEndCol) handleRemoveColumnAssignment('valueEnd')
                            }}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontWeight: 600,
                              backgroundColor: bgColor,
                              border: `2px solid ${borderColor}`,
                              color: textColor,
                              cursor: hasAssignment ? 'pointer' : 'default',
                              transition: 'all 0.2s ease',
                              position: 'relative',
                              minWidth,
                              whiteSpace: 'nowrap'
                            }}
                            title={hasAssignment ? 'Click to remove assignment' : 'Drop role tile here'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{col}</span>
                              {badgeContent}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)' }}>
                        {csvColumns.map((col) => {
                          const valueColumns = getValueColumns()
                          const isInValueRange = valueColumns.includes(col)

                          return (
                            <td
                              key={col}
                              style={{
                                padding: '10px 16px',
                                color: '#cbd5e1',
                                backgroundColor: isInValueRange
                                  ? (idx % 2 === 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(34, 197, 94, 0.08)')
                                  : (idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.4)'),
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {row[col]}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                Showing first 5 rows
              </p>
            </div>
          </Card>
        )}

        {/* Row Mapping Section */}
        {selectedFileId && csvData.length > 0 && variableColumn && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                    Map Variables to Drivers
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Drag CSV rows from the left and drop them onto drivers on the right to create mappings
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <Button
                    onClick={handleAIRowMapping}
                    disabled={aiRowMappingInProgress || !variableColumn}
                    style={{
                      backgroundColor: aiRowMappingInProgress ? '#64748b' : '#8b5cf6',
                      padding: '8px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      boxShadow: 'none',
                      fontSize: '13px'
                    }}
                  >
                    {aiRowMappingInProgress ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        AI Mapping...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        AI Map Rows
                      </>
                    )}
                  </Button>
                  {aiRowMappingMessage && (
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: aiRowMappingMessage.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                      border: `1px solid ${aiRowMappingMessage.includes('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                      borderRadius: '4px',
                      color: aiRowMappingMessage.includes('Error') ? '#ef4444' : '#8b5cf6',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      {aiRowMappingMessage}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Left Panel - Draggable CSV Rows */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '12px' }}>
                    CSV Rows
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {csvData.map((row, index) => {
                      const identifier = getRowIdentifier(row)
                      if (!identifier) return null

                      return (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleRowDragStart(index)}
                          style={{
                            padding: '8px 12px',
                            marginBottom: '4px',
                            backgroundColor: 'rgba(51, 65, 85, 0.5)',
                            borderRadius: '6px',
                            cursor: 'grab',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s ease',
                            border: '1px solid transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                            e.currentTarget.style.transform = 'translateX(4px)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                            e.currentTarget.style.borderColor = 'transparent'
                            e.currentTarget.style.transform = 'translateX(0)'
                          }}
                        >
                          <GripVertical style={{ width: '14px', height: '14px', color: '#94a3b8', flexShrink: 0 }} />
                          <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{identifier}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right Panel - Driver Drop Targets */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '12px' }}>
                    Drivers
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {/* Physical Drivers Section */}
                    {drivers.filter(d => d.category?.toLowerCase() === 'physical').length > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '8px',
                          paddingLeft: '4px'
                        }}>
                          Physical Drivers
                        </div>
                        {drivers.filter(d => d.category?.toLowerCase() === 'physical').map((driver) => {
                          const mappedRowIndex = getMappedRow(driver.code)
                          const hasMapped = mappedRowIndex !== null

                          return (
                            <div
                              key={driver.driver_id}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.style.backgroundColor = hasMapped ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.4)'
                                e.currentTarget.style.borderColor = hasMapped ? 'rgba(34, 197, 94, 0.5)' : 'rgba(71, 85, 105, 0.3)'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                handleRowDrop(driver.code)
                                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'
                                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)'
                              }}
                              style={{
                                padding: '10px 12px',
                                marginBottom: '4px',
                                backgroundColor: hasMapped ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                                borderRadius: '6px',
                                border: `1px solid ${hasMapped ? 'rgba(34, 197, 94, 0.5)' : 'rgba(71, 85, 105, 0.3)'}`,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: hasMapped ? '#22c55e' : '#cbd5e1' }}>
                                    {driver.code}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {driver.name}
                                  </div>
                                </div>
                                {hasMapped && mappedRowIndex !== null && (
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#22c55e',
                                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    → {getRowIdentifier(csvData[mappedRowIndex])}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Transition Drivers Section */}
                    {drivers.filter(d => d.category?.toLowerCase() === 'transition').length > 0 && (
                      <div>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '8px',
                          paddingLeft: '4px'
                        }}>
                          Transition Drivers
                        </div>
                        {drivers.filter(d => d.category?.toLowerCase() === 'transition').map((driver) => {
                          const mappedRowIndex = getMappedRow(driver.code)
                          const hasMapped = mappedRowIndex !== null

                          return (
                            <div
                              key={driver.driver_id}
                              onDragOver={(e) => {
                                e.preventDefault()
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.style.backgroundColor = hasMapped ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.4)'
                                e.currentTarget.style.borderColor = hasMapped ? 'rgba(34, 197, 94, 0.5)' : 'rgba(71, 85, 105, 0.3)'
                              }}
                              onDrop={(e) => {
                                e.preventDefault()
                                handleRowDrop(driver.code)
                                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'
                                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.5)'
                              }}
                              style={{
                                padding: '10px 12px',
                                marginBottom: '4px',
                                backgroundColor: hasMapped ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.4)',
                                borderRadius: '6px',
                                border: `1px solid ${hasMapped ? 'rgba(34, 197, 94, 0.5)' : 'rgba(71, 85, 105, 0.3)'}`,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: hasMapped ? '#22c55e' : '#cbd5e1' }}>
                                    {driver.code}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {driver.name}
                                  </div>
                                </div>
                                {hasMapped && mappedRowIndex !== null && (
                                  <div style={{
                                    fontSize: '11px',
                                    color: '#22c55e',
                                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}>
                                    → {getRowIdentifier(csvData[mappedRowIndex])}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Save Button */}
        {selectedFileId && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !variableColumn}
              className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: saveStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px 32px',
                fontSize: '16px'
              }}
            >
              <Save className="w-5 h-5" style={{ marginRight: '8px' }} />
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error - Retry' : 'Save Configuration'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MapScenarios
