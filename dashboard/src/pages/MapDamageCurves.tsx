import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, GripVertical, FileSpreadsheet, Move, Sparkles } from 'lucide-react'

interface Peril {
  peril_id: number
  peril_type: string
  peril_code: string
  description: string
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

const MapDamageCurves: React.FC = () => {
  const [perils, setPerils] = useState<Peril[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  // CSV Preview State
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [isLoadingMapping, setIsLoadingMapping] = useState(false)

  // Column Configuration State
  const [inputColumn, setInputColumn] = useState<string | null>(null) // intensity/return period
  const [outputColumn, setOutputColumn] = useState<string | null>(null) // damage factor
  const [archetypeColumn, setArchetypeColumn] = useState<string | null>(null) // asset type
  const [perilColumn, setPerilColumn] = useState<string | null>(null) // peril type
  const [unitColumn, setUnitColumn] = useState<string | null>(null) // intensity unit
  const [valueTypeColumn, setValueTypeColumn] = useState<string | null>(null) // value type (PPE, BI, INVENTORY)

  // Drag state
  const [draggedRole, setDraggedRole] = useState<'input' | 'output' | 'archetype' | 'peril' | 'unit' | 'valueType' | null>(null)
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // Peril mappings: maps csv_row_index to peril_type
  const [perilMappings, setPerilMappings] = useState<Array<{csv_row_index: number, peril_type: string}>>([])

  // CSV Perils: unique peril values from full CSV
  const [csvPerils, setCsvPerils] = useState<string[]>([])

  // AI Mapping state
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false)
  const [aiMappingMessage, setAiMappingMessage] = useState('')
  const [aiRowMappingInProgress, setAiRowMappingInProgress] = useState(false)
  const [aiRowMappingMessage, setAiRowMappingMessage] = useState('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Fetch available staging tables (use damage_curve file type)
  useEffect(() => {
    fetch(`http://localhost:3001/api/damage-curves/staging-tables?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTables(data.tables || [])
        }
      })
      .catch(err => console.error('Error fetching staging tables:', err))
  }, [])

  // Fetch perils (physical risk drivers from driver table)
  useEffect(() => {
    fetch(`http://localhost:3001/api/perils?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (!data || data.length === 0) {
          // No physical risk drivers defined
          setPerils([])
        } else {
          // Use the physical risk drivers returned by the API
          setPerils(data)
        }
      })
      .catch(err => {
        console.error('Error fetching perils:', err)
        // Set empty array on error
        setPerils([])
      })
  }, [])

  // Auto-save mappings when they change
  useEffect(() => {
    if (!selectedFileId || !perilColumn || isLoadingMapping) return

    const timeoutId = setTimeout(async () => {
      try {
        const payload = {
          dbPath,
          fileId: selectedFileId,
          inputColumn: inputColumn,
          outputColumn: outputColumn,
          archetypeColumn: archetypeColumn,
          perilColumn: perilColumn,
          unitColumn: unitColumn,
          valueTypeColumn: valueTypeColumn,
          perilMappings: perilMappings
        }

        console.log('Auto-save payload:', payload)

        await fetch('http://localhost:3001/api/damage-curves/save-damage-curve-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Auto-save error:', err)
      }
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timeoutId)
  }, [perilMappings, selectedFileId, inputColumn, outputColumn, archetypeColumn, perilColumn, unitColumn, valueTypeColumn])

  // Extract unique perils from full CSV when peril column is assigned
  useEffect(() => {
    if (!selectedFileId || !perilColumn) {
      setCsvPerils([])
      return
    }

    const extractUniquePerils = async () => {
      try {
        const response = await fetch(`http://localhost:3001/api/staged-files/${selectedFileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
        const result = await response.json()

        if (result.success && result.csvText) {
          const lines = result.csvText.split('\n').filter(line => line.trim() !== '')
          if (lines.length > 0) {
            const headers = lines[0].split(',').map(h => h.trim())
            const perilColIndex = headers.indexOf(perilColumn)

            if (perilColIndex >= 0) {
              const uniquePerils = new Set<string>()

              // Parse all rows (not just first 5)
              lines.slice(1).forEach(line => {
                const values = line.split(',').map(v => v.trim())
                const perilValue = values[perilColIndex]
                if (perilValue && perilValue !== '') {
                  uniquePerils.add(perilValue)
                }
              })

              setCsvPerils(Array.from(uniquePerils).sort())
            }
          }
        }
      } catch (error) {
        console.error('Error extracting unique perils:', error)
      }
    }

    extractUniquePerils()
  }, [selectedFileId, perilColumn])

  // Load CSV data when file is selected
  const handleFileSelect = async (fileId: number, fileName: string) => {
    console.log('File clicked:', fileId, fileName)
    setSelectedFileId(fileId)
    setSelectedFileName(fileName)
    setIsLoadingMapping(true)

    // Clear previous data
    setCsvData([])
    setCsvColumns([])
    setCsvPerils([])
    setInputColumn(null)
    setOutputColumn(null)
    setArchetypeColumn(null)
    setPerilColumn(null)
    setUnitColumn(null)
    setValueTypeColumn(null)
    setPerilMappings([])

    try {
      // Load saved mapping if it exists
      try {
        const mappingResponse = await fetch(`http://localhost:3001/api/damage-curves/get-damage-curve-mapping?dbPath=${encodeURIComponent(dbPath)}&fileId=${fileId}`)
        const mappingResult = await mappingResponse.json()

        if (mappingResult.success && mappingResult.mapping) {
          const mapping = mappingResult.mapping
          console.log('Loading mapping:', mapping)
          if (mapping.inputColumn) setInputColumn(mapping.inputColumn)
          if (mapping.outputColumn) setOutputColumn(mapping.outputColumn)
          if (mapping.archetypeColumn) setArchetypeColumn(mapping.archetypeColumn)
          if (mapping.perilColumn) setPerilColumn(mapping.perilColumn)
          if (mapping.unitColumn) setUnitColumn(mapping.unitColumn)
          if (mapping.valueTypeColumn) setValueTypeColumn(mapping.valueTypeColumn)
          setPerilMappings(mapping.perilMappings || [])
        }
      } catch (mappingError) {
        console.log('No saved mapping found or error loading mapping:', mappingError)
        // Continue without loading mapping
      } finally {
        setIsLoadingMapping(false)
      }

      // Load CSV preview from staged_file.csv_content
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      console.log('Preview response:', result)

      if (result.success && result.csvText) {
        // Parse CSV text
        const lines = result.csvText.split('\n').filter(line => line.trim() !== '')
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim())
          const rows = lines.slice(1, 6).map(line => { // Limit to first 5 rows
            const values = line.split(',').map(v => v.trim())
            const row: CsvRow = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })
            return row
          })

          console.log('Setting CSV data, rows:', rows.length)
          setCsvData(rows)
          setCsvColumns(headers)
        }
      } else {
        console.error('Failed to load data:', result)
      }
    } catch (error) {
      console.error('Error loading CSV preview:', error)
    }
  }

  const handleRoleDragStart = (role: 'input' | 'output' | 'archetype' | 'peril' | 'unit' | 'valueType') => {
    setDraggedRole(role)
  }

  const handleRoleDragEnd = () => {
    setDraggedRole(null)
  }

  const handleColumnDrop = (columnName: string) => {
    if (!draggedRole) return

    const roleMap = {
      input: setInputColumn,
      output: setOutputColumn,
      archetype: setArchetypeColumn,
      peril: setPerilColumn,
      unit: setUnitColumn,
      valueType: setValueTypeColumn
    }

    roleMap[draggedRole](columnName)
    setDraggedRole(null)
  }

  const handleRemoveColumnAssignment = (role: 'input' | 'output' | 'archetype' | 'peril' | 'unit' | 'valueType') => {
    const roleMap = {
      input: setInputColumn,
      output: setOutputColumn,
      archetype: setArchetypeColumn,
      peril: setPerilColumn,
      unit: setUnitColumn,
      valueType: setValueTypeColumn
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

      const prompt = `You are a damage curve data mapping assistant. Analyze this CSV data and identify the column structure for damage curve mapping.

CSV Columns: ${csvColumns.join(', ')}
CSV Sample (first 5 rows):
${JSON.stringify(csvSample, null, 2)}

Instructions:
Identify which columns are:
1. input - Column containing intensity values or return periods (input to the damage function)
2. output - Column containing damage factors or percentages (output of the damage function, typically 0-1)
3. archetype - Column containing asset type or building archetype
4. peril - Column containing peril/hazard type (e.g., Flood, Hurricane)
5. unit - Column containing intensity unit (e.g., meters, km/h) - optional
6. value_type - Column containing value type (e.g., PPE, BI, INVENTORY) - optional

Return ONLY a JSON object in this format:
{
  "input_column": "column_name",
  "output_column": "column_name",
  "archetype_column": "column_name",
  "peril_column": "column_name",
  "unit_column": "column_name",
  "value_type_column": "column_name"
}

Rules:
- Input column is typically intensity, return_period, or similar
- Output column is typically damage_factor, damage_pct, impact, or similar
- Archetype column might be named asset_type, building_type, archetype
- Peril column might be named peril, hazard, event_type
- Unit column is optional and might be named unit, intensity_unit, or might not exist
- Value type column is optional and might be named value_type, asset_class, line_of_business, or similar (PPE/BI/INVENTORY)
- If a column doesn't exist, use null`

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
      if (aiResponse.input_column) setInputColumn(aiResponse.input_column)
      if (aiResponse.output_column) setOutputColumn(aiResponse.output_column)
      if (aiResponse.archetype_column) setArchetypeColumn(aiResponse.archetype_column)
      if (aiResponse.peril_column) setPerilColumn(aiResponse.peril_column)
      if (aiResponse.unit_column) setUnitColumn(aiResponse.unit_column)
      if (aiResponse.value_type_column) setValueTypeColumn(aiResponse.value_type_column)

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
    if (csvData.length === 0 || perils.length === 0 || !perilColumn) {
      setAiRowMappingMessage('Error: Missing data or peril column not set')
      setTimeout(() => setAiRowMappingMessage(''), 3000)
      return
    }

    setAiRowMappingInProgress(true)
    setAiRowMappingMessage('AI analyzing rows...')

    try {
      // Prepare peril information
      const perilInfo = perils.map(p => ({
        peril_type: p.peril_type,
        description: p.description
      }))

      // Prepare CSV row information
      const csvRowInfo = csvData.map((row, index) => ({
        index: index,
        identifier: getRowIdentifier(row)
      })).filter(r => r.identifier) // Only include rows with identifiers

      const prompt = `You are a damage curve mapping assistant. Map CSV rows to physical climate perils.

Available Perils:
${JSON.stringify(perilInfo, null, 2)}

CSV Rows (from "${perilColumn}" column):
${JSON.stringify(csvRowInfo, null, 2)}

Instructions:
Match each CSV row to the most appropriate peril based on:
1. The peril type and description
2. The CSV row identifier text
3. Keywords related to climate hazards (flood, hurricane, wildfire, earthquake, etc.)

Return ONLY a JSON array of mappings in this format:
[
  {"csv_row_index": 0, "peril_type": "FLOOD"},
  {"csv_row_index": 1, "peril_type": "HURRICANE"}
]

Rules:
- Only include mappings you are confident about
- A CSV row can only map to one peril
- Not all rows need to be mapped
- Use the exact peril_type values from the Available Perils list`

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
      setPerilMappings(aiMappings)

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
    if (!selectedFileId || !perilColumn) return

    setSaveStatus('saving')

    try {
      const response = await fetch('http://localhost:3001/api/damage-curves/save-damage-curve-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          fileId: selectedFileId,
          inputColumn: inputColumn,
          outputColumn: outputColumn,
          archetypeColumn: archetypeColumn,
          perilColumn: perilColumn,
          unitColumn: unitColumn,
          valueTypeColumn: valueTypeColumn,
          perilMappings: perilMappings
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

  // Row drag handlers for peril mapping
  const handleRowDragStart = (rowIndex: number) => {
    setDraggedRowIndex(rowIndex)
  }

  const handleRowDrop = (perilType: string) => {
    if (draggedRowIndex === null) return

    // Check if this peril already has a mapping
    const existingMappingIndex = perilMappings.findIndex(m => m.peril_type === perilType)

    if (existingMappingIndex >= 0) {
      // Replace existing mapping
      const newMappings = [...perilMappings]
      newMappings[existingMappingIndex] = { csv_row_index: draggedRowIndex, peril_type: perilType }
      setPerilMappings(newMappings)
    } else {
      // Add new mapping
      setPerilMappings([...perilMappings, { csv_row_index: draggedRowIndex, peril_type: perilType }])
    }

    setDraggedRowIndex(null)
  }

  const getRowIdentifier = (row: CsvRow) => {
    if (!perilColumn) return ''
    return row[perilColumn] || ''
  }

  const getMappedRow = (perilType: string): number | null => {
    const mapping = perilMappings.find(m => m.peril_type === perilType)
    return mapping ? mapping.csv_row_index : null
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div style={{ maxWidth: '1600px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Map Damage Curves
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Configure damage curve column structure and map rows to physical perils
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
                  No damage curve data loaded. Please upload damage curve CSV files first in the "Load Damage Curves" page.
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
                  Select Damage Curve File
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
                  onDragStart={() => handleRoleDragStart('input')}
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
                  Input Column (Intensity)
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('output')}
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
                  Output Column (Damage)
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('archetype')}
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
                  Archetype Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('peril')}
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
                  Peril Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('unit')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    border: '2px solid rgba(236, 72, 153, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#ec4899',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(236, 72, 153, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Unit Column
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('valueType')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    border: '2px solid rgba(99, 102, 241, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#6366f1',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Value Type Column
                </div>
              </div>

              {/* CSV Preview Table with Droppable Column Headers */}
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10 }}>
                    <tr>
                      {csvColumns.map((col) => {
                        const isInputCol = inputColumn === col
                        const isOutputCol = outputColumn === col
                        const isArchetypeCol = archetypeColumn === col
                        const isPerilCol = perilColumn === col
                        const isUnitCol = unitColumn === col
                        const isValueTypeCol = valueTypeColumn === col
                        const hasAssignment = isInputCol || isOutputCol || isArchetypeCol || isPerilCol || isUnitCol || isValueTypeCol

                        let bgColor = 'rgba(30, 41, 59, 0.9)'
                        let borderColor = 'rgba(71, 85, 105, 0.3)'
                        let textColor = '#94a3b8'
                        let badgeContent = null

                        if (isInputCol) {
                          bgColor = 'rgba(59, 130, 246, 0.15)'
                          borderColor = 'rgba(59, 130, 246, 0.5)'
                          textColor = '#60a5fa'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Input</span>
                        } else if (isOutputCol) {
                          bgColor = 'rgba(168, 85, 247, 0.15)'
                          borderColor = 'rgba(168, 85, 247, 0.5)'
                          textColor = '#a855f7'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Output</span>
                        } else if (isArchetypeCol) {
                          bgColor = 'rgba(251, 146, 60, 0.15)'
                          borderColor = 'rgba(251, 146, 60, 0.5)'
                          textColor = '#fb923c'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(251, 146, 60, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Archetype</span>
                        } else if (isPerilCol) {
                          bgColor = 'rgba(34, 197, 94, 0.15)'
                          borderColor = 'rgba(34, 197, 94, 0.5)'
                          textColor = '#22c55e'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(34, 197, 94, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Peril</span>
                        } else if (isUnitCol) {
                          bgColor = 'rgba(236, 72, 153, 0.15)'
                          borderColor = 'rgba(236, 72, 153, 0.5)'
                          textColor = '#ec4899'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(236, 72, 153, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Unit</span>
                        } else if (isValueTypeCol) {
                          bgColor = 'rgba(99, 102, 241, 0.15)'
                          borderColor = 'rgba(99, 102, 241, 0.5)'
                          textColor = '#6366f1'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(99, 102, 241, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Value Type</span>
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
                              if (isInputCol) handleRemoveColumnAssignment('input')
                              else if (isOutputCol) handleRemoveColumnAssignment('output')
                              else if (isArchetypeCol) handleRemoveColumnAssignment('archetype')
                              else if (isPerilCol) handleRemoveColumnAssignment('peril')
                              else if (isUnitCol) handleRemoveColumnAssignment('unit')
                              else if (isValueTypeCol) handleRemoveColumnAssignment('valueType')
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
                          return (
                            <td
                              key={col}
                              style={{
                                padding: '10px 16px',
                                color: '#cbd5e1',
                                backgroundColor: idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.4)',
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
        {selectedFileId && csvData.length > 0 && perilColumn && (
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
                    Map Rows to Perils
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Drag CSV rows from the left and drop them onto perils on the right to create mappings
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <Button
                    onClick={handleAIRowMapping}
                    disabled={aiRowMappingInProgress || !perilColumn}
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
                {/* Left Panel - Draggable CSV Rows (Unique Perils Only) */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '12px' }}>
                    CSV Perils
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {csvPerils.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                        {perilColumn ? 'Loading perils...' : 'Assign peril column above to see CSV perils'}
                      </div>
                    ) : (
                      csvPerils.map((perilName, index) => (
                        <div
                          key={perilName}
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
                          <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{perilName}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right Panel - Peril Drop Targets */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '12px' }}>
                    Physical Risk Drivers
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {perils.map((peril) => {
                      const mappedRowIndex = getMappedRow(peril.peril_type)
                      const hasMapped = mappedRowIndex !== null

                      return (
                        <div
                          key={peril.peril_id}
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
                            handleRowDrop(peril.peril_type)
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
                                {peril.peril_type}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                {peril.description}
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
              disabled={saveStatus === 'saving' || !perilColumn}
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

export default MapDamageCurves
