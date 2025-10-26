import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, GripVertical, FileSpreadsheet, Move, Sparkles, CheckCircle2, Circle } from 'lucide-react'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'

interface PhysicalPeril {
  peril_id: number
  peril_type: string
  peril_code: string
  description: string
  category: string
}

interface Scenario {
  scenario_id: number
  code: string
  name: string
  scenario_number?: string
  source_file_id?: number
  source_file_name?: string
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

export default function MapHazardMaps() {
  const [physicalPerils, setPhysicalPerils] = useState<PhysicalPeril[]>([])
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [selectedPerilCode, setSelectedPerilCode] = useState<string | null>(null)

  // CSV Preview State
  const [csvData, setCsvData] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [isLoadingMapping, setIsLoadingMapping] = useState(false)

  // Column Configuration State
  const [latitudeColumn, setLatitudeColumn] = useState<string | null>(null)
  const [longitudeColumn, setLongitudeColumn] = useState<string | null>(null)
  const [intensityStartColumn, setIntensityStartColumn] = useState<string | null>(null)
  const [intensityEndColumn, setIntensityEndColumn] = useState<string | null>(null)
  const [varianceStartColumn, setVarianceStartColumn] = useState<string | null>(null)
  const [varianceEndColumn, setVarianceEndColumn] = useState<string | null>(null)
  const [unitsColumn, setUnitsColumn] = useState<string | null>(null)

  // Drag state
  const [draggedRole, setDraggedRole] = useState<'latitude' | 'longitude' | 'intensityStart' | 'intensityEnd' | 'varianceStart' | 'varianceEnd' | 'units' | null>(null)

  // AI Mapping state
  const [aiMappingInProgress, setAiMappingInProgress] = useState(false)
  const [aiMappingMessage, setAiMappingMessage] = useState('')

  // Scenario Linking State
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [currentMappingId, setCurrentMappingId] = useState<number | null>(null)
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set())
  const [_scenarioSaveStatus, _setScenarioSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = getDefaultDbPath()

  // Fetch available staged hazard map files
  useEffect(() => {
    fetch(apiUrl(`/api/staged-files/hazard_map?dbPath=${encodeURIComponent(dbPath)}`))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStagedFiles(data.files || [])
        }
      })
      .catch(err => logger.error('Error fetching staged files:', err))
  }, [])

  // Fetch physical perils (hazard types defined in scenarios)
  useEffect(() => {
    fetch(apiUrl(`/api/physical-perils?dbPath=${encodeURIComponent(dbPath)}`))
      .then(res => res.json())
      .then(data => {
        setPhysicalPerils(data || [])
      })
      .catch(err => logger.error('Error fetching physical perils:', err))
  }, [])

  // Fetch scenarios for linking
  useEffect(() => {
    fetch(apiUrl(`/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`))
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setScenarios(data.scenarios || [])
        }
      })
      .catch(err => logger.error('Error fetching scenarios:', err))
  }, [])

  // Auto-save mappings when they change
  useEffect(() => {
    if (!selectedFileId || !selectedPerilCode || !latitudeColumn || !longitudeColumn || isLoadingMapping) return

    const timeoutId = setTimeout(async () => {
      try {
        const intensityColumns = getIntensityColumns()
        const varianceColumns = getVarianceColumns()

        const payload = {
          dbPath,
          fileId: selectedFileId,
          perilType: selectedPerilCode,
          latitudeColumn,
          longitudeColumn,
          unitsColumn,
          intensityColumns,
          varianceColumns
        }

        logger.debug('Auto-save payload:', payload)

        const response = await fetch(apiUrl('/api/hazard-maps/save-hazard-map-mapping'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const result = await response.json()
        logger.debug('Auto-save result:', result)

        // Update mapping ID from response to enable Step 4
        if (result.success && result.mappingId) {
          setCurrentMappingId(result.mappingId)
        }
      } catch (err) {
        logger.error('Auto-save error:', err)
      }
    }, 1000) // Debounce for 1 second

    return () => clearTimeout(timeoutId)
  }, [selectedFileId, selectedPerilCode, latitudeColumn, longitudeColumn, unitsColumn, intensityStartColumn, intensityEndColumn, varianceStartColumn, varianceEndColumn])

  // Load CSV data when file is selected
  const handleFileSelect = async (fileId: number, fileName: string) => {
    logger.debug('File clicked:', fileId, fileName)

    // IMPORTANT: Set loading flag BEFORE changing any state to prevent auto-save race condition
    setIsLoadingMapping(true)

    setSelectedFileId(fileId)
    setSelectedFileName(fileName)

    // Clear previous data
    setCsvData([])
    setCsvColumns([])
    setLatitudeColumn(null)
    setLongitudeColumn(null)
    setIntensityStartColumn(null)
    setIntensityEndColumn(null)
    setVarianceStartColumn(null)
    setVarianceEndColumn(null)
    setUnitsColumn(null)
    setCurrentMappingId(null)
    setSelectedScenarios(new Set())

    try {
      // Load saved mapping if it exists
      try {
        const mappingResponse = await fetch(apiUrl(`/api/hazard-maps/get-hazard-map-mapping?dbPath=${encodeURIComponent(dbPath)}&fileId=${fileId}`))
        const mappingResult = await mappingResponse.json()

        if (mappingResult.success && mappingResult.mapping) {
          const mapping = mappingResult.mapping
          logger.debug('Loading mapping:', mapping)

          if (mapping.perilType) setSelectedPerilCode(mapping.perilType)
          if (mapping.latitudeColumn) setLatitudeColumn(mapping.latitudeColumn)
          if (mapping.longitudeColumn) setLongitudeColumn(mapping.longitudeColumn)
          if (mapping.unitsColumn) setUnitsColumn(mapping.unitsColumn)

          if (mapping.intensityColumns && mapping.intensityColumns.length > 0) {
            setIntensityStartColumn(mapping.intensityColumns[0])
            setIntensityEndColumn(mapping.intensityColumns[mapping.intensityColumns.length - 1])
          }

          if (mapping.varianceColumns && mapping.varianceColumns.length > 0) {
            setVarianceStartColumn(mapping.varianceColumns[0])
            setVarianceEndColumn(mapping.varianceColumns[mapping.varianceColumns.length - 1])
          }

          // Load mapping_id and scenario links
          if (mapping.mappingId) {
            setCurrentMappingId(mapping.mappingId)

            // Load existing scenario mappings
            try {
              const scenarioResponse = await fetch(
                apiUrl(`/api/hazard-maps/get-scenarios?dbPath=${encodeURIComponent(dbPath)}&mappingId=${mapping.mappingId}`)
              )
              const scenarioData = await scenarioResponse.json()
              if (scenarioData.success && scenarioData.scenarios) {
                setSelectedScenarios(new Set(scenarioData.scenarios.map((s: any) => s.code)))
              }
            } catch (err) {
              logger.error('Error loading scenario mappings:', err)
            }
          }
        }
      } catch (mappingError) {
        logger.debug('No saved mapping found or error loading mapping:', mappingError)
      }

      // Delay clearing the loading flag to ensure all state updates complete
      setTimeout(() => setIsLoadingMapping(false), 100)

      // Load CSV preview from staged file
      const url = apiUrl(`/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}&limit=5`)
      logger.debug('Fetching:', url)

      const response = await fetch(url)
      const result = await response.json()
      logger.debug('Response:', result)

      if (result.success && result.csvText) {
        // Parse CSV text into array of objects
        const lines = result.csvText.trim().split('\n')
        if (lines.length > 1) {
          const headers = lines[0].split(',')
          const dataRows = lines.slice(1, 6).map(line => { // Get first 5 rows
            const values = line.split(',')
            const row: any = {}
            headers.forEach((header, idx) => {
              row[header] = values[idx] || ''
            })
            return row
          })

          logger.debug('Setting CSV data, rows:', dataRows.length)
          logger.debug('Columns:', headers)
          setCsvData(dataRows)
          setCsvColumns(headers)
        }
      } else {
        logger.error('Failed to load data:', result)
      }
    } catch (error) {
      logger.error('Error loading CSV preview:', error)
    }
  }

  const handleRoleDragStart = (role: 'latitude' | 'longitude' | 'intensityStart' | 'intensityEnd' | 'varianceStart' | 'varianceEnd' | 'units') => {
    setDraggedRole(role)
  }

  const handleRoleDragEnd = () => {
    setDraggedRole(null)
  }

  const handleColumnDrop = (columnName: string) => {
    if (!draggedRole) return

    const roleMap = {
      latitude: setLatitudeColumn,
      longitude: setLongitudeColumn,
      intensityStart: setIntensityStartColumn,
      intensityEnd: setIntensityEndColumn,
      varianceStart: setVarianceStartColumn,
      varianceEnd: setVarianceEndColumn,
      units: setUnitsColumn
    }

    roleMap[draggedRole](columnName)
    setDraggedRole(null)
  }

  const handleRemoveColumnAssignment = (role: 'latitude' | 'longitude' | 'intensityStart' | 'intensityEnd' | 'varianceStart' | 'varianceEnd' | 'units') => {
    const roleMap = {
      latitude: setLatitudeColumn,
      longitude: setLongitudeColumn,
      intensityStart: setIntensityStartColumn,
      intensityEnd: setIntensityEndColumn,
      varianceStart: setVarianceStartColumn,
      varianceEnd: setVarianceEndColumn,
      units: setUnitsColumn
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

      const prompt = `You are a hazard map data mapping assistant. Analyze this CSV data and identify the column structure for hazard mapping.

CSV Columns: ${csvColumns.join(', ')}
CSV Sample (first 5 rows):
${JSON.stringify(csvSample, null, 2)}

Instructions:
Identify which columns are:
1. latitude - Column containing latitude coordinates
2. longitude - Column containing longitude coordinates
3. intensity_start - First column containing intensity values (e.g., period_1_intensity)
4. intensity_end - Last column containing intensity values (e.g., period_3_intensity)
5. variance_start - First column containing variance values (e.g., period_1_variance)
6. variance_end - Last column containing variance values (e.g., period_3_variance)

Return ONLY a JSON object in this format:
{
  "latitude_column": "column_name",
  "longitude_column": "column_name",
  "intensity_start_column": "column_name",
  "intensity_end_column": "column_name",
  "variance_start_column": "column_name",
  "variance_end_column": "column_name"
}

Rules:
- Latitude/longitude columns typically contain decimal coordinates
- Intensity columns typically contain numeric hazard intensity values
- Variance columns typically contain numeric variance/uncertainty values
- Column names may include words like "intensity", "variance", "period", "m", etc.`

      const response = await fetch(apiUrl('/api/claude/messages'), {
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
      if (aiResponse.latitude_column) setLatitudeColumn(aiResponse.latitude_column)
      if (aiResponse.longitude_column) setLongitudeColumn(aiResponse.longitude_column)
      if (aiResponse.intensity_start_column) setIntensityStartColumn(aiResponse.intensity_start_column)
      if (aiResponse.intensity_end_column) setIntensityEndColumn(aiResponse.intensity_end_column)
      if (aiResponse.variance_start_column) setVarianceStartColumn(aiResponse.variance_start_column)
      if (aiResponse.variance_end_column) setVarianceEndColumn(aiResponse.variance_end_column)

      setAiMappingMessage('Mapping performed')
      setTimeout(() => setAiMappingMessage(''), 3000)

    } catch (error) {
      logger.error('AI mapping error:', error)
      setAiMappingMessage(`Error: ${error instanceof Error ? error.message : 'AI mapping failed'}`)
      setTimeout(() => setAiMappingMessage(''), 5000)
    } finally {
      setAiMappingInProgress(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFileId || !selectedPerilCode || !latitudeColumn || !longitudeColumn) return

    setSaveStatus('saving')

    try {
      const intensityColumns = getIntensityColumns()
      const varianceColumns = getVarianceColumns()

      const response = await fetch(apiUrl('/api/hazard-maps/save-hazard-map-mapping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          fileId: selectedFileId,
          perilType: selectedPerilCode,
          latitudeColumn,
          longitudeColumn,
          unitsColumn,
          intensityColumns,
          varianceColumns
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save mapping')
      }

      // Load the mapping_id and existing scenario links
      if (result.mappingId) {
        setCurrentMappingId(result.mappingId)

        // Load existing scenario mappings
        try {
          const scenarioResponse = await fetch(
            apiUrl(`/api/hazard-maps/get-scenarios?dbPath=${encodeURIComponent(dbPath)}&mappingId=${result.mappingId}`)
          )
          const scenarioData = await scenarioResponse.json()
          if (scenarioData.success && scenarioData.scenarios) {
            setSelectedScenarios(new Set(scenarioData.scenarios.map((s: any) => s.code)))
          }
        } catch (err) {
          logger.error('Error loading scenario mappings:', err)
        }
      }

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      logger.error('Error saving:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const getIntensityColumns = () => {
    if (!intensityStartColumn || !intensityEndColumn) return []

    const startIdx = csvColumns.indexOf(intensityStartColumn)
    const endIdx = csvColumns.indexOf(intensityEndColumn)

    if (startIdx === -1 || endIdx === -1) return []

    return csvColumns.slice(startIdx, endIdx + 1)
  }

  const getVarianceColumns = () => {
    if (!varianceStartColumn || !varianceEndColumn) return []

    const startIdx = csvColumns.indexOf(varianceStartColumn)
    const endIdx = csvColumns.indexOf(varianceEndColumn)

    if (startIdx === -1 || endIdx === -1) return []

    return csvColumns.slice(startIdx, endIdx + 1)
  }

  const toggleScenario = async (scenarioCode: string) => {
    const newSelected = new Set(selectedScenarios)
    if (newSelected.has(scenarioCode)) {
      newSelected.delete(scenarioCode)
    } else {
      newSelected.add(scenarioCode)
    }
    setSelectedScenarios(newSelected)

    // Auto-save scenario selection
    if (currentMappingId) {
      try {
        await fetch(apiUrl('/api/hazard-maps/save-scenario-mappings'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dbPath,
            mappingId: currentMappingId,
            scenarioCodes: Array.from(newSelected)
          })
        })
      } catch (err) {
        logger.error('Error auto-saving scenario mappings:', err)
      }
    }
  }

  const handleSaveScenarios = async () => {
    if (!currentMappingId) return

    _setScenarioSaveStatus('saving')

    try {
      const response = await fetch(apiUrl('/api/hazard-maps/save-scenario-mappings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          mappingId: currentMappingId,
          scenarioCodes: Array.from(selectedScenarios)
        })
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save scenario mappings')
      }

      _setScenarioSaveStatus('success')
      setTimeout(() => _setScenarioSaveStatus('idle'), 2000)
    } catch (err) {
      logger.error('Error saving scenarios:', err)
      _setScenarioSaveStatus('error')
      setTimeout(() => _setScenarioSaveStatus('idle'), 3000)
    }
  }

  const selectedPeril = physicalPerils.find(p => p.peril_code === selectedPerilCode)

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
            Map Hazard Map Data
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Map hazard map CSV files to physical risk perils defined in scenarios
          </p>
        </div>

        {/* No Data Warning */}
        {stagedFiles.length === 0 && (
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
                  No hazard map data loaded. Please upload hazard map CSV files first in the "Load Hazard Maps" page.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select File */}
        {stagedFiles.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                Step 1: Select Hazard Map File
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {stagedFiles.map(file => {
                  const isSelected = selectedFileId === file.file_id
                  return (
                    <button
                      key={file.file_id}
                      onClick={() => handleFileSelect(file.file_id, file.file_name)}
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
                        {file.file_name}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </Card>
        )}

        {/* Step 2: Map to Physical Peril */}
        {selectedFileId && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                Step 2: Map to Physical Risk Peril
              </h3>

              {physicalPerils.length === 0 ? (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '14px'
                }}>
                  No physical risk perils found. Please define physical risks in your scenarios first.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                  {physicalPerils.map(peril => {
                    const isSelected = selectedPerilCode === peril.peril_code
                    return (
                      <button
                        key={peril.peril_id}
                        onClick={() => setSelectedPerilCode(peril.peril_code)}
                        style={{
                          padding: '16px',
                          backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                          border: isSelected ? '2px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                            e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                          }
                        }}
                      >
                        <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#a855f7' : '#e2e8f0', marginBottom: '4px' }}>
                          {peril.peril_type}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                          {peril.peril_code}
                        </div>
                        {peril.description && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                            {peril.description}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Step 3: Configure Column Mapping */}
        {selectedFileId && selectedPerilCode && csvData.length > 0 && (
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
                    Step 3: Configure Column Structure - {selectedFileName}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Mapping to: {selectedPeril?.peril_type} ({selectedPeril?.peril_code})
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
                  onDragStart={() => handleRoleDragStart('latitude')}
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
                  Latitude
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('longitude')}
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
                  Longitude
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('units')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '2px solid rgba(16, 185, 129, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#10b981',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Units
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('intensityStart')}
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
                  Intensity Start
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('intensityEnd')}
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
                  Intensity End
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('varianceStart')}
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
                  Variance Start
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('varianceEnd')}
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
                  Variance End
                </div>
              </div>

              {/* CSV Preview Table with Droppable Column Headers */}
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10 }}>
                    <tr>
                      {csvColumns.map((col) => {
                        const isLatitudeCol = latitudeColumn === col
                        const isLongitudeCol = longitudeColumn === col
                        const isUnitsCol = unitsColumn === col
                        const isIntensityStartCol = intensityStartColumn === col
                        const isIntensityEndCol = intensityEndColumn === col
                        const isVarianceStartCol = varianceStartColumn === col
                        const isVarianceEndCol = varianceEndColumn === col
                        const intensityColumns = getIntensityColumns()
                        const varianceColumns = getVarianceColumns()
                        const isInIntensityRange = intensityColumns.includes(col)
                        const isInVarianceRange = varianceColumns.includes(col)
                        const hasAssignment = isLatitudeCol || isLongitudeCol || isUnitsCol || isIntensityStartCol || isIntensityEndCol || isVarianceStartCol || isVarianceEndCol

                        let bgColor = 'rgba(30, 41, 59, 0.9)'
                        let borderColor = 'rgba(71, 85, 105, 0.3)'
                        let textColor = '#94a3b8'
                        let badgeContent = null

                        if (isLatitudeCol || isLongitudeCol) {
                          bgColor = 'rgba(59, 130, 246, 0.15)'
                          borderColor = 'rgba(59, 130, 246, 0.5)'
                          textColor = '#60a5fa'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>{isLatitudeCol ? 'Lat' : 'Lon'}</span>
                        } else if (isUnitsCol) {
                          bgColor = 'rgba(16, 185, 129, 0.15)'
                          borderColor = 'rgba(16, 185, 129, 0.5)'
                          textColor = '#10b981'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(16, 185, 129, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Units</span>
                        } else if (isIntensityStartCol || isIntensityEndCol) {
                          bgColor = 'rgba(251, 146, 60, 0.15)'
                          borderColor = 'rgba(251, 146, 60, 0.5)'
                          textColor = '#fb923c'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(251, 146, 60, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>{isIntensityStartCol ? 'Int Start' : 'Int End'}</span>
                        } else if (isVarianceStartCol || isVarianceEndCol) {
                          bgColor = 'rgba(168, 85, 247, 0.15)'
                          borderColor = 'rgba(168, 85, 247, 0.5)'
                          textColor = '#a855f7'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>{isVarianceStartCol ? 'Var Start' : 'Var End'}</span>
                        } else if (isInIntensityRange) {
                          bgColor = 'rgba(251, 146, 60, 0.08)'
                          borderColor = 'rgba(251, 146, 60, 0.3)'
                          textColor = '#fb923c'
                        } else if (isInVarianceRange) {
                          bgColor = 'rgba(168, 85, 247, 0.08)'
                          borderColor = 'rgba(168, 85, 247, 0.3)'
                          textColor = '#a855f7'
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
                              if (isLatitudeCol) handleRemoveColumnAssignment('latitude')
                              else if (isLongitudeCol) handleRemoveColumnAssignment('longitude')
                              else if (isUnitsCol) handleRemoveColumnAssignment('units')
                              else if (isIntensityStartCol) handleRemoveColumnAssignment('intensityStart')
                              else if (isIntensityEndCol) handleRemoveColumnAssignment('intensityEnd')
                              else if (isVarianceStartCol) handleRemoveColumnAssignment('varianceStart')
                              else if (isVarianceEndCol) handleRemoveColumnAssignment('varianceEnd')
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
                          const intensityColumns = getIntensityColumns()
                          const varianceColumns = getVarianceColumns()
                          const isInIntensityRange = intensityColumns.includes(col)
                          const isInVarianceRange = varianceColumns.includes(col)

                          return (
                            <td
                              key={col}
                              style={{
                                padding: '10px 16px',
                                color: '#cbd5e1',
                                backgroundColor: isInIntensityRange
                                  ? (idx % 2 === 0 ? 'rgba(251, 146, 60, 0.05)' : 'rgba(251, 146, 60, 0.08)')
                                  : isInVarianceRange
                                  ? (idx % 2 === 0 ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.08)')
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

        {/* Step 4: Link to Scenarios */}
        {currentMappingId && scenarios.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <div style={{ paddingTop: '6px', paddingBottom: '12px', paddingLeft: '24px', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '12px' }}>
                Step 4: Link to Scenarios
              </h3>
              <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '16px' }}>
                Select which scenarios should use this hazard map
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                {scenarios.map((scenario) => {
                  const isSelected = selectedScenarios.has(scenario.code)

                  return (
                    <button
                      key={scenario.code}
                      onClick={() => toggleScenario(scenario.code)}
                      style={{
                        padding: '16px',
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                        border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
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
                      {isSelected ? (
                        <CheckCircle2 style={{ width: '20px', height: '20px', color: '#10b981', flexShrink: 0 }} />
                      ) : (
                        <Circle style={{ width: '20px', height: '20px', color: '#64748b', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#10b981' : '#e2e8f0' }}>
                          {scenario.scenario_number && scenario.source_file_name
                            ? `Scenario ${scenario.scenario_number} from file ${scenario.source_file_name}`
                            : scenario.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {scenario.code}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px', textAlign: 'center' }}>
                Scenario selections are saved automatically
              </p>
            </div>
          </Card>
        )}

        {/* Save Configuration Button */}
        {selectedFileId && selectedPerilCode && latitudeColumn && longitudeColumn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
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
