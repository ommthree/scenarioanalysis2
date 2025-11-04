import { useState, useEffect, useRef } from 'react'
import { Map, Box, ChevronRight, ChevronDown, Building2, Sparkles, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import HazardMap from '@/components/visualizations/HazardMap'
import HazardSurface3D from '@/components/visualizations/HazardSurface3D'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import domtoimage from 'dom-to-image-more'

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
  code: string
  name: string
  granularity_level: string
  parent_entity_id: number | null
  children?: Entity[]
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
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [currentEntity, setCurrentEntity] = useState<number | null>(null)
  const [entityLocations, setEntityLocations] = useState<EntityLocation[]>([])
  const [showLocations, setShowLocations] = useState(false)

  // AI Description
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Refs for capture
  const map2DRef = useRef<HTMLDivElement>(null)
  const map3DRef = useRef<HTMLDivElement>(null)

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

  const buildEntityTree = (entities: any[]): Entity[] => {
    const entityMap: { [key: number]: Entity } = {}
    const rootEntities: Entity[] = []

    // Convert API format to component format
    entities.forEach((entity) => {
      entityMap[entity.entity_id] = {
        entity_id: entity.entity_id,
        code: entity.entity_code,
        name: entity.entity_name,
        granularity_level: entity.level,
        parent_entity_id: entity.parent_id,
        lat: entity.lat,
        lng: entity.lng,
        children: []
      }
    })

    // Build tree structure
    entities.forEach((entity) => {
      if (entity.parent_id === null) {
        rootEntities.push(entityMap[entity.entity_id])
      } else if (entityMap[entity.parent_id]) {
        entityMap[entity.parent_id].children!.push(entityMap[entity.entity_id])
      }
    })

    return rootEntities
  }

  const fetchEntities = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/entities?dbPath=${encodeURIComponent(dbPath)}`))
      const flatEntities = await response.json()

      if (Array.isArray(flatEntities)) {
        const tree = buildEntityTree(flatEntities)
        setEntities(tree)
        if (tree.length > 0) {
          setCurrentEntity(tree[0].entity_id)
          setSelectedEntityIds(new Set([tree[0].entity_id]))
        }
      }
    } catch (error) {
      logger.error('Failed to fetch entities:', error)
    }
  }

  // Helper to collect all descendant entity IDs
  const collectDescendantIds = (entityId: number, allEntities: Entity[]): number[] => {
    const ids: number[] = [entityId]
    const flatEntities: Entity[] = []

    // Flatten entity tree
    const flatten = (nodes: Entity[]) => {
      nodes.forEach(node => {
        flatEntities.push(node)
        if (node.children && node.children.length > 0) {
          flatten(node.children)
        }
      })
    }
    flatten(allEntities)

    // Find children recursively
    const findChildren = (parentId: number) => {
      flatEntities.forEach(entity => {
        if (entity.parent_entity_id === parentId && !ids.includes(entity.entity_id)) {
          ids.push(entity.entity_id)
          findChildren(entity.entity_id)
        }
      })
    }

    findChildren(entityId)
    return ids
  }

  const fetchEntityLocations = async () => {
    try {
      const dbPath = getDefaultDbPath()

      // Collect all entity IDs including descendants
      const allEntityIds: number[] = []
      selectedEntityIds.forEach(entityId => {
        const descendantIds = collectDescendantIds(entityId, entities)
        descendantIds.forEach(id => {
          if (!allEntityIds.includes(id)) {
            allEntityIds.push(id)
          }
        })
      })

      const entityIds = allEntityIds.join(',')
      const response = await fetch(apiUrl(`/api/locations?dbPath=${encodeURIComponent(dbPath)}&entityIds=${entityIds}`))
      const locations = await response.json()

      if (Array.isArray(locations)) {
        // Transform location data to match EntityLocation interface
        const transformedLocations: EntityLocation[] = locations
          .filter(loc => loc.latitude != null && loc.longitude != null)
          .map(loc => ({
            entity_id: loc.entity_id,
            entity_code: loc.location_code,
            entity_name: loc.location_name || loc.location_code,
            lat: loc.latitude,
            lng: loc.longitude
          }))
        setEntityLocations(transformedLocations)
      }
    } catch (error) {
      logger.error('Failed to fetch entity locations:', error)
      setEntityLocations([])
    }
  }

  const toggleNode = (entityId: number) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(entityId)) {
        newSet.delete(entityId)
      } else {
        newSet.add(entityId)
      }
      return newSet
    })
  }

  const handleEntitySelect = (entityId: number) => {
    setCurrentEntity(entityId)
    setSelectedEntityIds(new Set([entityId]))
  }

  const renderEntityTree = (entities: Entity[], level = 0): React.ReactElement => {
    return (
      <div style={{ marginLeft: level > 0 ? '24px' : '0px' }}>
        {entities.map((entity) => {
          const hasChildren = entity.children && entity.children.length > 0
          const isExpanded = entity.entity_id ? expandedNodes.has(entity.entity_id) : false
          const isSelected = currentEntity === entity.entity_id

          return (
            <div key={entity.entity_id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: isSelected ? 'rgba(236, 72, 153, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(236, 72, 153, 0.5)' : 'rgba(236, 72, 153, 0.2)'}`,
                  borderRadius: '6px',
                  marginBottom: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => handleEntitySelect(entity.entity_id)}
              >
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (entity.entity_id) toggleNode(entity.entity_id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                  >
                    {isExpanded ? (
                      <ChevronDown style={{ width: '16px', height: '16px', color: '#ec4899' }} />
                    ) : (
                      <ChevronRight style={{ width: '16px', height: '16px', color: '#ec4899' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '24px' }} />}

                <Building2 style={{ width: '16px', height: '16px', color: '#ec4899', marginRight: '8px' }} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: isSelected ? '600' : '400', color: '#fff' }}>
                    {entity.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    {entity.code} • {entity.granularity_level}
                  </div>
                </div>
              </div>

              {hasChildren && isExpanded && renderEntityTree(entity.children!, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  const add2DToReport = async () => {
    if (!map2DRef.current) return

    try {
      // Find elements to temporarily style
      const cards = map2DRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = map2DRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const leafletZoomControls = map2DRef.current.querySelectorAll('.leaflet-control-zoom') as NodeListOf<HTMLElement>
      const titles = map2DRef.current.querySelectorAll('h2, h3') as NodeListOf<HTMLElement>
      const texts = map2DRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        background: map2DRef.current.style.background,
        padding: map2DRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        leafletZoomControls: Array.from(leafletZoomControls).map(ctrl => ctrl.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

      // Apply white theme
      map2DRef.current.style.backgroundColor = '#ffffff'
      map2DRef.current.style.padding = '24px'
      cards.forEach(card => {
        card.style.backgroundColor = '#f8f9fa'
        card.style.border = '1px solid #dee2e6'
      })
      buttons.forEach(btn => { btn.style.display = 'none' })
      leafletZoomControls.forEach(ctrl => { ctrl.style.display = 'none' })
      titles.forEach(title => { title.style.color = '#1e293b' })
      texts.forEach(text => {
        if (text.style.color && text.style.color.includes('rgb')) {
          text.style.color = '#334155'
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture
      const imageData = await domtoimage.toPng(map2DRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore styles
      map2DRef.current.style.background = originalStyles.background
      map2DRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i].display })
      leafletZoomControls.forEach((ctrl, i) => { ctrl.style.display = originalStyles.leafletZoomControls[i].display })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i].color })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i].color })

      // Build caption
      const selectedFile = stagedFiles.find(f => f.file_id === selectedFileId)
      const flattenEntities = (entities: Entity[]): Entity[] => {
        const result: Entity[] = []
        const flatten = (nodes: Entity[]) => {
          nodes.forEach(node => {
            result.push(node)
            if (node.children && node.children.length > 0) {
              flatten(node.children)
            }
          })
        }
        flatten(entities)
        return result
      }
      const allEntities = flattenEntities(entities)
      const selectedEntity = allEntities.find(e => e.entity_id === currentEntity)
      const caption = `Physical Risk - 2D Heatmap: ${selectedIntensityColumn} from ${selectedFile?.file_name || 'hazard map'} (${selectedEntity?.name || 'All Entities'})`

      // Save snippet
      const snippet = {
        id: `hazard-2d-${Date.now()}`,
        type: 'visualization' as const,
        source: 'hazard-2d' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      alert('Added 2D hazard map to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture 2D map:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const add3DToReport = async () => {
    if (!map3DRef.current) return

    try {
      // Find elements to temporarily style
      const cards = map3DRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = map3DRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = map3DRef.current.querySelectorAll('h2, h3') as NodeListOf<HTMLElement>
      const texts = map3DRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        background: map3DRef.current.style.background,
        padding: map3DRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

      // Apply white theme
      map3DRef.current.style.backgroundColor = '#ffffff'
      map3DRef.current.style.padding = '24px'
      cards.forEach(card => {
        card.style.backgroundColor = '#f8f9fa'
        card.style.border = '1px solid #dee2e6'
      })
      buttons.forEach(btn => { btn.style.display = 'none' })
      titles.forEach(title => { title.style.color = '#1e293b' })
      texts.forEach(text => {
        if (text.style.color && text.style.color.includes('rgb')) {
          text.style.color = '#334155'
        }
      })

      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture
      const imageData = await domtoimage.toPng(map3DRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore styles
      map3DRef.current.style.background = originalStyles.background
      map3DRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i].display })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i].color })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i].color })

      // Build caption
      const selectedFile = stagedFiles.find(f => f.file_id === selectedFileId)
      const flattenEntities = (entities: Entity[]): Entity[] => {
        const result: Entity[] = []
        const flatten = (nodes: Entity[]) => {
          nodes.forEach(node => {
            result.push(node)
            if (node.children && node.children.length > 0) {
              flatten(node.children)
            }
          })
        }
        flatten(entities)
        return result
      }
      const allEntities = flattenEntities(entities)
      const selectedEntity = allEntities.find(e => e.entity_id === currentEntity)
      const caption = `Physical Risk - 3D Surface: ${selectedIntensityColumn} from ${selectedFile?.file_name || 'hazard map'} (${selectedEntity?.name || 'All Entities'})`

      // Save snippet
      const snippet = {
        id: `hazard-3d-${Date.now()}`,
        type: 'visualization' as const,
        source: 'hazard-3d' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      alert('Added 3D hazard surface to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture 3D map:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const generateAIDescription = async () => {
    if (hazardPoints.length === 0) return

    setAiLoading(true)
    try {
      // Build context based on current selections
      const selectedFile = stagedFiles.find(f => f.file_id === selectedFileId)
      const fileName = selectedFile?.file_name || 'hazard map'

      // Get entity hierarchy information
      const flattenEntities = (entities: Entity[]): Entity[] => {
        const result: Entity[] = []
        const flatten = (nodes: Entity[]) => {
          nodes.forEach(node => {
            result.push(node)
            if (node.children && node.children.length > 0) {
              flatten(node.children)
            }
          })
        }
        flatten(entities)
        return result
      }

      const allEntities = flattenEntities(entities)
      const selectedEntity = allEntities.find(e => e.entity_id === currentEntity)
      const entityInfo = selectedEntity
        ? `Entity: ${selectedEntity.name} (${selectedEntity.code}, ${selectedEntity.granularity_level})`
        : 'No entity selected'

      let contextDescription = `Analyzing physical climate hazard map from file: ${fileName}. ${entityInfo}. Hazard type: ${selectedIntensityColumn}.`

      // Calculate intensity statistics
      const intensityValues = hazardPoints.map(p => p.intensity)
      const minIntensity = Math.min(...intensityValues)
      const maxIntensity = Math.max(...intensityValues)
      const avgIntensity = intensityValues.reduce((sum, v) => sum + v, 0) / intensityValues.length

      const statsDescription = `Data points: ${hazardPoints.length}. Intensity range: ${minIntensity.toFixed(2)} to ${maxIntensity.toFixed(2)} (avg: ${avgIntensity.toFixed(2)}).`

      let locationInfo = ''
      if (showLocations && entityLocations.length > 0) {
        locationInfo = ` Entity locations displayed: ${entityLocations.length} locations.`
      }

      const prompt = `You are a climate risk and physical hazard analysis expert. Analyze this hazard map data and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Statistics: ${statsDescription}${locationInfo}

Provide a narrative summary that:
1. Explains the overall hazard distribution and geographic patterns
2. Highlights areas or aspects of highest concern or risk
3. Identifies any interesting insights about the hazard intensity distribution
4. Uses business-friendly language appropriate for risk assessment

Keep it concise (2-4 sentences) and insightful. Do not use bullet points or lists in your response - write as a flowing paragraph.`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        throw new Error('AI description failed')
      }

      const result = await response.json()
      const description = result.content[0].text
      setAiDescription(description)

    } catch (error) {
      console.error('AI description error:', error)
      setAiDescription('Unable to generate AI description. Please try again.')
    } finally {
      setAiLoading(false)
    }
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
              Physical Risk
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Geographic visualization of physical climate hazards (floods, wildfires, hurricanes, etc.). Surface shows hazard intensity across the region.
          </p>

          {/* Entity Selector */}
          {entities.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                Select Entity to Display
              </label>
              {renderEntityTree(entities)}
            </div>
          )}

          {/* Location Toggle */}
          {selectedEntityIds.size > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  console.log('Toggle clicked, current state:', showLocations, 'locations:', entityLocations.length)
                  if (entityLocations.length > 0) {
                    setShowLocations(prev => {
                      console.log('Setting showLocations to:', !prev)
                      return !prev
                    })
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: entityLocations.length > 0 ? '#94a3b8' : '#64748b',
                  fontSize: '14px',
                  cursor: entityLocations.length > 0 ? 'pointer' : 'not-allowed',
                  userSelect: 'none',
                  opacity: entityLocations.length > 0 ? 1 : 0.5
                }}
              >
                <div style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: showLocations ? 'rgba(59, 130, 246, 0.8)' : 'rgba(71, 85, 105, 0.5)',
                      transition: 'background-color 0.3s',
                      borderRadius: '24px',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        height: '18px',
                        width: '18px',
                        left: showLocations ? '23px' : '3px',
                        bottom: '2px',
                        backgroundColor: '#fff',
                        transition: 'left 0.3s',
                        borderRadius: '50%',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontWeight: '500', color: showLocations ? '#fff' : '#94a3b8' }}>
                  Show Locations ({entityLocations.length})
                </span>
              </div>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Map style={{ width: '24px', height: '24px', color: '#ec4899' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>
                    2D Heatmap View
                  </h3>
                </div>
                <button
                  onClick={add2DToReport}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid #a855f7',
                    borderRadius: '6px',
                    color: '#a855f7',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px' }} />
                  <span>Add to Report</span>
                </button>
              </div>
              <div ref={map2DRef}>
                <HazardMap
                  points={hazardPoints}
                  pinnedPoints={showLocations ? entityLocations.map(loc => ({
                    lat: loc.lat,
                    lng: loc.lng,
                    intensity: 0,
                    label: loc.entity_name || loc.entity_code
                  })) : []}
                  height="700px"
                />
                <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                  Showing {hazardPoints.length} hazard data points • Heatmap visualization with smooth gradient interpolation
                </div>
              </div>
            </CardContent>
          </Card>

          <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <CardContent style={{ padding: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Box style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>
                    3D Surface View
                  </h3>
                </div>
                <button
                  onClick={add3DToReport}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid #a855f7',
                    borderRadius: '6px',
                    color: '#a855f7',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px' }} />
                  <span>Add to Report</span>
                </button>
              </div>
              <div ref={map3DRef}>
                <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                  Interactive 3D visualization • Drag to rotate • Scroll to zoom • Fly over the hazard surface with map base
                </p>
                {hazardPoints.length > 0 ? (
                  <HazardSurface3D points={hazardPoints} entityLocations={showLocations ? entityLocations : []} height="700px" />
                ) : (
                  <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    No hazard points available for 3D visualization
                  </div>
                )}
                <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                  Showing {hazardPoints.length} hazard data points • 3D surface with geographic map projection
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Insights Panel */}
          <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginTop: '32px' }}>
            <CardContent style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff' }}>
                  AI Insights
                </h2>
                <button
                  onClick={generateAIDescription}
                  disabled={aiLoading}
                  style={{
                    backgroundColor: aiLoading ? '#64748b' : '#8b5cf6',
                    padding: '10px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    color: '#ffffff',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!aiLoading) {
                      e.currentTarget.style.backgroundColor = '#7c3aed'
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!aiLoading) {
                      e.currentTarget.style.backgroundColor = '#8b5cf6'
                      e.currentTarget.style.transform = 'scale(1)'
                    }
                  }}
                >
                  {aiLoading ? (
                    <>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        border: '2px solid rgba(255, 255, 255, 0.3)',
                        borderTopColor: '#ffffff',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <style>{`
                        @keyframes spin {
                          to { transform: rotate(360deg); }
                        }
                      `}</style>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles style={{ width: '16px', height: '16px' }} />
                      Generate Insights
                    </>
                  )}
                </button>
              </div>

              {aiDescription ? (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '15px',
                  lineHeight: '1.6'
                }}>
                  {aiDescription}
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  Click the button above to generate AI-powered insights about this hazard map
                </div>
              )}
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
