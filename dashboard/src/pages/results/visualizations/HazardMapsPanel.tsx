import { useState, useEffect } from 'react'
import { Map, Box } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import HazardMap from '@/components/visualizations/HazardMap'
import HazardSurface3D from '@/components/visualizations/HazardSurface3D'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface HazardPoint {
  lat: number
  lng: number
  intensity: number
  label: string
}

interface Entity {
  entity_id: number
  entity_code: string
  entity_name: string
  parent_id: number | null
  level: string
  lat?: number
  lng?: number
}

interface EntityLocation {
  entity_id: number
  entity_code: string
  entity_name: string
  lat: number
  lng: number
}

export default function HazardMapsPanel() {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [hazardData, setHazardData] = useState<CsvData | null>(null)
  const [selectedIntensityColumn, setSelectedIntensityColumn] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set())
  const [entityLocations, setEntityLocations] = useState<EntityLocation[]>([])

  useEffect(() => {
    fetchStagedFiles()
    fetchEntities()
  }, [])

  useEffect(() => {
    if (selectedEntityIds.size > 0) {
      fetchEntityLocations()
    } else {
      setEntityLocations([])
    }
  }, [selectedEntityIds])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/hazard_map?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
        if (result.files && result.files.length > 0) {
          handleSelectFile(result.files[0].file_id)
        }
      }
      setLoading(false)
    } catch (error) {
      logger.error('Failed to fetch staged files:', error)
      setLoading(false)
    }
  }

  const handleSelectFile = async (fileId: number) => {
    setSelectedFileId(fileId)
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setHazardData(parsed)

        // Auto-select first intensity column
        const firstIntensityCol = parsed.headers.find(h =>
          h.toLowerCase().includes('intensity') || h.toLowerCase().includes('variance')
        )
        if (firstIntensityCol) {
          setSelectedIntensityColumn(firstIntensityCol)
        }
      }
    } catch (error) {
      logger.error('Failed to load hazard map preview:', error)
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

  const fetchEntities = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/entities?dbPath=${encodeURIComponent(dbPath)}`))
      const entities = await response.json()

      if (Array.isArray(entities)) {
        setEntities(entities)
      }
    } catch (error) {
      logger.error('Failed to fetch entities:', error)
    }
  }

  const fetchEntityLocations = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const entityIds = Array.from(selectedEntityIds).join(',')
      const response = await fetch(apiUrl(`/api/entity-locations?dbPath=${encodeURIComponent(dbPath)}&entityIds=${entityIds}`))
      const result = await response.json()

      if (result.success) {
        setEntityLocations(result.locations || [])
      }
    } catch (error) {
      logger.error('Failed to fetch entity locations:', error)
      setEntityLocations([])
    }
  }

  const handleEntityToggle = (entityId: number, parentId: number | null) => {
    const newSelection = new Set(selectedEntityIds)

    if (newSelection.has(entityId)) {
      // Deselecting - remove this entity
      newSelection.delete(entityId)
    } else {
      // Selecting - check for parent/child conflicts
      // Remove parent if selecting child
      if (parentId) {
        newSelection.delete(parentId)
      }
      // Remove children if selecting parent
      entities.forEach(e => {
        if (e.parent_id === entityId) {
          newSelection.delete(e.entity_id)
        }
      })
      newSelection.add(entityId)
    }

    setSelectedEntityIds(newSelection)
  }

  const getHazardPoints = (): HazardPoint[] => {
    const points: HazardPoint[] = []

    if (!hazardData || !selectedIntensityColumn) return points

    const headers = hazardData.headers
    const latIdx = headers.findIndex(h => /^lat/i.test(h))
    const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))
    const intensityIdx = headers.findIndex(h => h === selectedIntensityColumn)

    if (latIdx !== -1 && lngIdx !== -1 && intensityIdx !== -1) {
      for (let i = 0; i < hazardData.rows.length; i++) {
        const row = hazardData.rows[i]
        const lat = parseFloat(row[latIdx])
        const lng = parseFloat(row[lngIdx])
        const intensity = parseFloat(row[intensityIdx])

        if (!isNaN(lat) && !isNaN(lng) && !isNaN(intensity)) {
          const label = row[0] || `Point ${i + 1}`
          points.push({ lat, lng, intensity, label })
        }
      }
    }

    return points
  }

  const hazardPoints = getHazardPoints()

  if (loading) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>Loading hazard maps...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <Map style={{ width: '32px', height: '32px', color: '#ec4899' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
              Hazard Maps
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Geographic visualization of physical climate hazards (floods, wildfires, hurricanes, etc.). Surface shows hazard intensity across the region.
          </p>

          {/* Entity Selector */}
          {entities.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                Select Entities to Display ({selectedEntityIds.size} selected)
              </label>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px'
              }}>
                {entities.map(entity => {
                  const isSelected = selectedEntityIds.has(entity.entity_id)
                  const isParent = entity.parent_id === null
                  const hasChildren = entities.some(e => e.parent_id === entity.entity_id)
                  const childrenSelected = entities.filter(e =>
                    e.parent_id === entity.entity_id && selectedEntityIds.has(e.entity_id)
                  ).length

                  return (
                    <button
                      key={entity.entity_id}
                      onClick={() => handleEntityToggle(entity.entity_id, entity.parent_id)}
                      style={{
                        padding: '12px',
                        backgroundColor: isSelected
                          ? 'rgba(236, 72, 153, 0.2)'
                          : 'rgba(30, 41, 59, 0.5)',
                        border: isSelected
                          ? '2px solid rgba(236, 72, 153, 0.6)'
                          : '1px solid rgba(71, 85, 105, 0.5)',
                        borderRadius: '8px',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textAlign: 'left',
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)'
                          e.currentTarget.style.borderColor = 'rgba(236, 72, 153, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)'
                          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)'
                        }
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: isParent ? '#ec4899' : '#3b82f6', marginBottom: '4px' }}>
                        {entity.entity_code}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                        {entity.entity_name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {isParent ? (
                          hasChildren ? `Group (${childrenSelected > 0 ? childrenSelected + ' child selected' : 'has children'})` : 'Group'
                        ) : (
                          'Company'
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
              {selectedEntityIds.size > 0 && entityLocations.length === 0 && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  border: '1px solid rgba(251, 191, 36, 0.3)',
                  borderRadius: '6px',
                  color: '#fbbf24',
                  fontSize: '12px'
                }}>
                  Selected entities have no location data. Add latitude/longitude to entity metadata to display on map.
                </div>
              )}
            </div>
          )}

          {/* File Selector */}
          {stagedFiles.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
                Select Hazard Map File
              </label>
              <select
                value={selectedFileId || ''}
                onChange={(e) => handleSelectFile(Number(e.target.value))}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                {stagedFiles.map(f => (
                  <option key={f.file_id} value={f.file_id}>
                    {f.file_name} ({f.row_count} points)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Intensity Column Selector */}
          {hazardData && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
                Select Intensity Column
              </label>
              <select
                value={selectedIntensityColumn}
                onChange={(e) => setSelectedIntensityColumn(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                {hazardData.headers
                  .filter(h => h.toLowerCase().includes('intensity') || h.toLowerCase().includes('variance'))
                  .map(h => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      {hazardPoints.length > 0 && (
        <>
          <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
            <CardContent style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Map style={{ width: '24px', height: '24px', color: '#ec4899' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>
                  2D Heatmap View
                </h3>
              </div>
              <HazardMap points={hazardPoints} height="700px" />
              <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                Showing {hazardPoints.length} hazard data points • Heatmap visualization with smooth gradient interpolation
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <CardContent style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Box style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>
                  3D Surface View
                </h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                Interactive 3D visualization • Drag to rotate • Scroll to zoom • Fly over the hazard surface with map base
              </p>
              {hazardPoints.length > 0 ? (
                <HazardSurface3D points={hazardPoints} entityLocations={entityLocations} height="700px" />
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                  No hazard points available for 3D visualization
                </div>
              )}
              <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                Showing {hazardPoints.length} hazard data points • 3D surface with geographic map projection
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {stagedFiles.length === 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>
              No hazard map files loaded. Upload files via the Load Hazard Maps page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
