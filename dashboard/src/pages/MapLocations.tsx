import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, GripVertical, FileText, Move, Sparkles } from 'lucide-react'

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

interface Entity {
  entity_id: number
  entity_code: string
  entity_name: string
  parent_id: number | null
  level: number
}

const MapLocations: React.FC = () => {
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')

  // CSV Preview State
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [isLoadingMapping, setIsLoadingMapping] = useState(false)

  // Column Configuration State
  const [identifierColumn, setIdentifierColumn] = useState<string | null>(null)
  const [latitudeColumn, setLatitudeColumn] = useState<string | null>(null)
  const [longitudeColumn, setLongitudeColumn] = useState<string | null>(null)
  const [entityColumn, setEntityColumn] = useState<string | null>(null)
  const [valueStartColumn, setValueStartColumn] = useState<string | null>(null)
  const [valueEndColumn, setValueEndColumn] = useState<string | null>(null)

  // Drag state
  const [draggedRole, setDraggedRole] = useState<'identifier' | 'latitude' | 'longitude' | 'entity' | 'valueStart' | 'valueEnd' | null>(null)
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // Entity hierarchy and mappings
  const [entities, setEntities] = useState<Entity[]>([])
  const [entityMappings, setEntityMappings] = useState<Array<{csv_row_index: number, entity_id: number}>>([])

  // AI Mapping state
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false)
  const [aiMappingMessage, setAiMappingMessage] = useState('')
  const [aiRowMappingInProgress, setAiRowMappingInProgress] = useState(false)
  const [aiRowMappingMessage, setAiRowMappingMessage] = useState('')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Fetch available staging tables
  useEffect(() => {
    fetch(`http://localhost:3001/api/locations/staging-tables?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTables(data.tables || [])
        }
      })
      .catch(err => console.error('Error fetching staging tables:', err))
  }, [])

  // Fetch entities
  useEffect(() => {
    fetch(`http://localhost:3001/api/entities?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        setEntities(Array.isArray(data) ? data : [])
      })
      .catch(err => {
        console.error('Error fetching entities:', err)
        setEntities([])
      })
  }, [])

  // Auto-save mappings when they change
  useEffect(() => {
    if (!selectedFileId || !identifierColumn || isLoadingMapping) return

    const timeoutId = setTimeout(async () => {
      try {
        const valueColumns = getValueColumns()

        const payload = {
          dbPath,
          fileId: selectedFileId,
          identifierColumn,
          latitudeColumn,
          longitudeColumn,
          entityColumn,
          valueColumns,
          entityMappings
        }

        console.log('Auto-save payload:', payload)

        await fetch('http://localhost:3001/api/locations/save-location-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error('Auto-save error:', err)
      }
    }, 1000)

    return () => clearTimeout(timeoutId)
  }, [entityMappings, selectedFileId, identifierColumn, latitudeColumn, longitudeColumn, entityColumn, valueStartColumn, valueEndColumn])

  // Load CSV data when file is selected
  const handleFileSelect = async (fileId: number, fileName: string) => {
    console.log('File clicked:', fileId, fileName)
    setSelectedFileId(fileId)
    setSelectedFileName(fileName)
    setIsLoadingMapping(true)

    // Clear previous data
    setCsvData([])
    setCsvColumns([])
    setIdentifierColumn(null)
    setLatitudeColumn(null)
    setLongitudeColumn(null)
    setEntityColumn(null)
    setValueStartColumn(null)
    setValueEndColumn(null)
    setEntityMappings([])

    try {
      // Load saved mapping if it exists
      try {
        const mappingResponse = await fetch(`http://localhost:3001/api/locations/get-location-mapping?dbPath=${encodeURIComponent(dbPath)}&fileId=${fileId}`)
        const mappingResult = await mappingResponse.json()

        if (mappingResult.success && mappingResult.mapping) {
          const mapping = mappingResult.mapping
          console.log('Loading mapping:', mapping)
          if (mapping.identifierColumn) setIdentifierColumn(mapping.identifierColumn)
          if (mapping.latitudeColumn) setLatitudeColumn(mapping.latitudeColumn)
          if (mapping.longitudeColumn) setLongitudeColumn(mapping.longitudeColumn)
          if (mapping.entityColumn) setEntityColumn(mapping.entityColumn)
          if (mapping.valueColumns && mapping.valueColumns.length > 0) {
            setValueStartColumn(mapping.valueColumns[0])
            setValueEndColumn(mapping.valueColumns[mapping.valueColumns.length - 1])
          }
          setEntityMappings(mapping.entityMappings || [])
        }
      } catch (mappingError) {
        console.log('No saved mapping found or error loading mapping:', mappingError)
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

      const url = `http://localhost:3001/api/locations/staging-preview?dbPath=${encodeURIComponent(dbPath)}&tableName=${encodeURIComponent(tableInfo.tableName)}&limit=5`
      console.log('Fetching:', url)

      const response = await fetch(url)
      const result = await response.json()
      console.log('Response:', result)

      if (result.success && result.data) {
        console.log('Setting CSV data, rows:', result.data.length)
        setCsvData(result.data)
        if (result.data.length > 0) {
          const cols = Object.keys(result.data[0]).filter(col =>
            !['_rowid', 'imported_at', 'is_mapped', 'file_id', 'staging_id'].includes(col)
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

  const handleRoleDragStart = (role: 'identifier' | 'latitude' | 'longitude' | 'entity' | 'valueStart' | 'valueEnd') => {
    setDraggedRole(role)
  }

  const handleRoleDragEnd = () => {
    setDraggedRole(null)
  }

  const handleColumnDrop = (columnName: string) => {
    if (!draggedRole) return

    const roleMap = {
      identifier: setIdentifierColumn,
      latitude: setLatitudeColumn,
      longitude: setLongitudeColumn,
      entity: setEntityColumn,
      valueStart: setValueStartColumn,
      valueEnd: setValueEndColumn
    }

    roleMap[draggedRole](columnName)
    setDraggedRole(null)
  }

  const handleRemoveColumnAssignment = (role: 'identifier' | 'latitude' | 'longitude' | 'entity' | 'valueStart' | 'valueEnd') => {
    const roleMap = {
      identifier: setIdentifierColumn,
      latitude: setLatitudeColumn,
      longitude: setLongitudeColumn,
      entity: setEntityColumn,
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

      const prompt = `You are a location data mapping assistant. Analyze this CSV data and identify the column structure for location data.

CSV Columns: ${csvColumns.join(', ')}
CSV Sample (first 5 rows):
${JSON.stringify(csvSample, null, 2)}

Instructions:
Identify which columns are:
1. identifier - Column containing location names/identifiers
2. latitude - Column containing latitude coordinates (decimal degrees)
3. longitude - Column containing longitude coordinates (decimal degrees)
4. entity - Column containing entity/company names or codes (optional)
5. value_start - First column containing numeric values (e.g., first year or metric)
6. value_end - Last column containing numeric values (e.g., last year or metric)

Return ONLY a JSON object in this format:
{
  "identifier_column": "column_name",
  "latitude_column": "column_name",
  "longitude_column": "column_name",
  "entity_column": "column_name or null",
  "value_start_column": "column_name or null",
  "value_end_column": "column_name or null"
}

Rules:
- Latitude typically ranges from -90 to 90
- Longitude typically ranges from -180 to 180
- Identifier might be named like "location", "name", "site", "facility"
- Entity might be named like "company", "entity", "organization"
- Value columns are typically years, quarters, or metrics`

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
      if (aiResponse.identifier_column) setIdentifierColumn(aiResponse.identifier_column)
      if (aiResponse.latitude_column) setLatitudeColumn(aiResponse.latitude_column)
      if (aiResponse.longitude_column) setLongitudeColumn(aiResponse.longitude_column)
      if (aiResponse.entity_column) setEntityColumn(aiResponse.entity_column)
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
    if (csvData.length === 0 || entities.length === 0 || !entityColumn) {
      setAiRowMappingMessage('Error: Missing data or entity column not set')
      setTimeout(() => setAiRowMappingMessage(''), 3000)
      return
    }

    setAiRowMappingInProgress(true)
    setAiRowMappingMessage('AI analyzing rows...')

    try {
      // Prepare entity information
      const entityInfo = entities.map(e => ({
        entity_id: e.entity_id,
        entity_code: e.entity_code,
        entity_name: e.entity_name,
        level: e.level
      }))

      // Prepare CSV row information
      const csvRowInfo = csvData.map((row, index) => ({
        index: index,
        identifier: getRowIdentifier(row)
      })).filter(r => r.identifier)

      const prompt = `You are a location-to-entity mapping assistant. Map CSV location rows to entities in the hierarchy.

Available Entities:
${JSON.stringify(entityInfo, null, 2)}

CSV Rows (from "${entityColumn}" column):
${JSON.stringify(csvRowInfo, null, 2)}

Instructions:
Match each CSV row to the most appropriate entity based on:
1. The entity's name and code
2. The CSV row identifier text
3. Keywords and patterns that suggest ownership or association

Return ONLY a JSON array of mappings in this format:
[
  {"csv_row_index": 0, "entity_id": 123},
  {"csv_row_index": 1, "entity_id": 456}
]

Rules:
- Only include mappings you are confident about
- A CSV row can only map to one entity
- Not all rows need to be mapped
- Use the exact entity_id values from the Available Entities list`

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
      setEntityMappings(aiMappings)

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
    if (!selectedFileId || !identifierColumn) return

    setSaveStatus('saving')

    try {
      const valueColumns = getValueColumns()

      const response = await fetch('http://localhost:3001/api/locations/save-location-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          fileId: selectedFileId,
          identifierColumn,
          latitudeColumn,
          longitudeColumn,
          entityColumn,
          valueColumns,
          entityMappings
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

  // Row drag handlers for entity mapping
  const handleRowDragStart = (rowIndex: number) => {
    setDraggedRowIndex(rowIndex)
  }

  const handleRowDrop = (entityId: number) => {
    if (draggedRowIndex === null) return

    // Check if this entity already has a mapping
    const existingMappingIndex = entityMappings.findIndex(m => m.entity_id === entityId)

    if (existingMappingIndex >= 0) {
      // Replace existing mapping
      const newMappings = [...entityMappings]
      newMappings[existingMappingIndex] = { csv_row_index: draggedRowIndex, entity_id: entityId }
      setEntityMappings(newMappings)
    } else {
      // Add new mapping
      setEntityMappings([...entityMappings, { csv_row_index: draggedRowIndex, entity_id: entityId }])
    }

    setDraggedRowIndex(null)
  }

  const getRowIdentifier = (row: CsvRow) => {
    if (!entityColumn) return ''
    return row[entityColumn] || ''
  }

  const getMappedRow = (entityId: number): number | null => {
    const mapping = entityMappings.find(m => m.entity_id === entityId)
    return mapping ? mapping.csv_row_index : null
  }

  const getValueColumns = () => {
    if (!valueStartColumn || !valueEndColumn) return []

    const startIdx = csvColumns.indexOf(valueStartColumn)
    const endIdx = csvColumns.indexOf(valueEndColumn)

    if (startIdx === -1 || endIdx === -1) return []

    return csvColumns.slice(startIdx, endIdx + 1)
  }

  // Group entities by level
  const getEntitiesByLevel = () => {
    const byLevel: { [key: number]: Entity[] } = {}
    entities.forEach(e => {
      if (!byLevel[e.level]) byLevel[e.level] = []
      byLevel[e.level].push(e)
    })
    return byLevel
  }

  const entitiesByLevel = getEntitiesByLevel()

  return (
    <div className="p-12 max-w-7xl mx-auto" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Map Location Data
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Configure how location CSV files are structured and map locations to entities
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
                  No location data loaded. Please upload location CSV files first in the "Load Locations" page.
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
                Select Location File
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
                      <FileText className="w-5 h-5" style={{ color: isSelected ? '#10b981' : '#94a3b8' }} />
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
                  onDragStart={() => handleRoleDragStart('identifier')}
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
                  Identifier
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('latitude')}
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
                  Latitude
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('longitude')}
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
                  Longitude
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('entity')}
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
                  Entity
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
                  Value Start
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
                  Value End
                </div>
              </div>

              {/* CSV Preview Table with Droppable Column Headers */}
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10 }}>
                    <tr>
                      {csvColumns.map((col) => {
                        const isIdentifierCol = identifierColumn === col
                        const isLatitudeCol = latitudeColumn === col
                        const isLongitudeCol = longitudeColumn === col
                        const isEntityCol = entityColumn === col
                        const isValueStartCol = valueStartColumn === col
                        const isValueEndCol = valueEndColumn === col
                        const valueColumns = getValueColumns()
                        const isInValueRange = valueColumns.includes(col)
                        const hasAssignment = isIdentifierCol || isLatitudeCol || isLongitudeCol || isEntityCol || isValueStartCol || isValueEndCol

                        let bgColor = 'rgba(30, 41, 59, 0.9)'
                        let borderColor = 'rgba(71, 85, 105, 0.3)'
                        let textColor = '#94a3b8'
                        let badgeContent = null
                        let minWidth = 'auto'

                        if (isIdentifierCol) {
                          bgColor = 'rgba(59, 130, 246, 0.15)'
                          borderColor = 'rgba(59, 130, 246, 0.5)'
                          textColor = '#60a5fa'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>ID</span>
                        } else if (isLatitudeCol) {
                          bgColor = 'rgba(168, 85, 247, 0.15)'
                          borderColor = 'rgba(168, 85, 247, 0.5)'
                          textColor = '#a855f7'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Lat</span>
                        } else if (isLongitudeCol) {
                          bgColor = 'rgba(236, 72, 153, 0.15)'
                          borderColor = 'rgba(236, 72, 153, 0.5)'
                          textColor = '#ec4899'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(236, 72, 153, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Lng</span>
                        } else if (isEntityCol) {
                          bgColor = 'rgba(251, 146, 60, 0.15)'
                          borderColor = 'rgba(251, 146, 60, 0.5)'
                          textColor = '#fb923c'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(251, 146, 60, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Entity</span>
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
                              if (isIdentifierCol) handleRemoveColumnAssignment('identifier')
                              else if (isLatitudeCol) handleRemoveColumnAssignment('latitude')
                              else if (isLongitudeCol) handleRemoveColumnAssignment('longitude')
                              else if (isEntityCol) handleRemoveColumnAssignment('entity')
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
        {selectedFileId && csvData.length > 0 && entityColumn && (
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
                    Map Locations to Entities
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Drag CSV rows from the left and drop them onto entities on the right to create mappings
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginTop: '10px' }}>
                  <Button
                    onClick={handleAIRowMapping}
                    disabled={aiRowMappingInProgress || !entityColumn}
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

                {/* Right Panel - Entity Drop Targets (Grouped by Level) */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#cbd5e1', marginBottom: '12px' }}>
                    Entities (by hierarchy level)
                  </h4>
                  <div style={{
                    maxHeight: '400px',
                    overflowY: 'auto',
                    border: '1px solid rgba(71, 85, 105, 0.3)',
                    borderRadius: '8px',
                    padding: '8px'
                  }}>
                    {Object.keys(entitiesByLevel).sort((a, b) => Number(a) - Number(b)).map(level => (
                      <div key={level} style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#94a3b8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '8px',
                          paddingLeft: '4px'
                        }}>
                          Level {level}
                        </div>
                        {(entitiesByLevel[level] || []).map((entity) => {
                          const mappedRowIndex = getMappedRow(entity.entity_id)
                          const hasMapped = mappedRowIndex !== null

                          return (
                            <div
                              key={entity.entity_id}
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
                                handleRowDrop(entity.entity_id)
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
                                    {entity.entity_code}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {entity.entity_name}
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
                    ))}
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
              disabled={saveStatus === 'saving' || !identifierColumn}
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

export default MapLocations
