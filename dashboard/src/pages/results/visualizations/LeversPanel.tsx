import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, TrendingUp, ChevronRight, ChevronDown, Building2, Sparkles, FileText } from 'lucide-react'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import domtoimage from 'dom-to-image-more'

interface MacResult {
  action: string
  carbonAbatement: number
  cost: number
  mac: number | null
}

interface RoiResult {
  action: string
  investment: number
  benefit: number
  roi: number | null
}

interface Scenario {
  scenario_id: number
  code: string
  name: string
}

interface Entity {
  entity_id: number
  code: string
  name: string
  granularity_level: string
  parent_entity_id: number | null
  children?: Entity[]
}

export default function LeversPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [periods, setPeriods] = useState<number[]>([])
  const [currentScenario, setCurrentScenario] = useState<number | null>(null)
  const [currentEntity, setCurrentEntity] = useState<number | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())

  const [macResults, setMacResults] = useState<MacResult[]>([])
  const [macLoading, setMacLoading] = useState(false)

  const [roiResults, setRoiResults] = useState<RoiResult[]>([])
  const [roiLoading, setRoiLoading] = useState(false)

  // Scenario comparison data: { scenarioId: RoiResult[] }
  const [roiComparisonData, setRoiComparisonData] = useState<{[key: number]: RoiResult[]}>({})
  const [comparisonLoading, setComparisonLoading] = useState(false)

  const [startPeriod, setStartPeriod] = useState(1)
  const [endPeriod, setEndPeriod] = useState(1)

  // AI description state
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Refs for capture
  const macChartRef = useRef<HTMLDivElement>(null)
  const roiChartRef = useRef<HTMLDivElement>(null)

  const dbPath = getDefaultDbPath()

  const addMacToReport = async () => {
    if (!macChartRef.current) return

    try {
      // Find elements to temporarily style
      const cards = macChartRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = macChartRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = macChartRef.current.querySelectorAll('h2, h3') as NodeListOf<HTMLElement>
      const texts = macChartRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        background: macChartRef.current.style.background,
        padding: macChartRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

      // Apply white theme
      macChartRef.current.style.backgroundColor = '#ffffff'
      macChartRef.current.style.padding = '24px'
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
      const imageData = await domtoimage.toPng(macChartRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore styles
      macChartRef.current.style.background = originalStyles.background
      macChartRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i] })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i] })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i] })

      // Build caption
      const selectedScenario = scenarios.find(s => s.scenario_id === currentScenario)
      const selectedEntity = findEntityById(currentEntity, entities)
      const caption = `MAC Analysis: ${selectedScenario?.name || 'Scenario'} - ${selectedEntity?.name || 'Entity'} (Period ${startPeriod} to ${endPeriod})`

      // Save snippet
      const snippet = {
        id: `mac-${Date.now()}`,
        type: 'visualization' as const,
        source: 'mac' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      alert('Added MAC analysis to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture MAC:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const addRoiToReport = async () => {
    if (!roiChartRef.current) return

    try {
      // Find elements to temporarily style
      const cards = roiChartRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = roiChartRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = roiChartRef.current.querySelectorAll('h2, h3') as NodeListOf<HTMLElement>
      const texts = roiChartRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        background: roiChartRef.current.style.background,
        padding: roiChartRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

      // Apply white theme
      roiChartRef.current.style.backgroundColor = '#ffffff'
      roiChartRef.current.style.padding = '24px'
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
      const imageData = await domtoimage.toPng(roiChartRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore styles
      roiChartRef.current.style.background = originalStyles.background
      roiChartRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i] })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i] })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i] })

      // Build caption
      const selectedScenario = scenarios.find(s => s.scenario_id === currentScenario)
      const selectedEntity = findEntityById(currentEntity, entities)
      const caption = `ROI Analysis: ${selectedScenario?.name || 'Scenario'} - ${selectedEntity?.name || 'Entity'} (Period ${startPeriod} to ${endPeriod})`

      // Save snippet
      const snippet = {
        id: `roi-${Date.now()}`,
        type: 'visualization' as const,
        source: 'roi' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      alert('Added ROI analysis to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture ROI:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const generateAIDescription = async () => {
    setAiLoading(true)
    try {
      const selectedScenario = scenarios.find(s => s.scenario_id === currentScenario)
      const selectedEntity = findEntityById(currentEntity, entities)

      // Build comprehensive context
      const macContext = macResults.length > 0
        ? `MAC Analysis Results (${macResults.length} actions):\n` +
          macResults.map(r => `  - ${r.action}: Carbon Abatement = ${r.carbonAbatement.toFixed(0)} tCO₂e, Cost = $${r.cost.toFixed(0)}, MAC = ${r.mac !== null ? r.mac.toFixed(2) : 'N/A'} $/tCO₂e`).join('\n')
        : 'No MAC data available.'

      const roiContext = roiResults.length > 0
        ? `\n\nROI Analysis Results (${roiResults.length} actions):\n` +
          roiResults.map(r => `  - ${r.action}: Investment = $${r.investment.toFixed(0)}, Benefit = $${r.benefit.toFixed(0)}, ROI = ${r.roi !== null ? r.roi.toFixed(1) : 'N/A'}%`).join('\n')
        : '\n\nNo ROI data available.'

      // No Regrets analysis
      const actionMap: {[action: string]: {[scenarioId: number]: number}} = {}
      Object.entries(roiComparisonData).forEach(([scenarioId, results]) => {
        results.forEach(result => {
          if (!actionMap[result.action]) {
            actionMap[result.action] = {}
          }
          actionMap[result.action][parseInt(scenarioId)] = result.roi || 0
        })
      })
      const actions = Object.keys(actionMap)
      const noRegretActions = actions.filter(action => {
        const rois = Object.values(actionMap[action])
        return rois.length > 0 && rois.every(roi => roi > 0)
      })

      const noRegretsContext = Object.keys(roiComparisonData).length > 0
        ? `\n\nNo Regrets Analysis:\n  - Total actions analyzed: ${actions.length}\n  - No Regret actions (positive ROI in all ${scenarios.length} scenarios): ${noRegretActions.length > 0 ? noRegretActions.join(', ') : 'None'}`
        : '\n\nNo Regrets analysis not available.'

      const prompt = `You are analyzing cost-benefit and no-regrets data for decarbonization actions.

Context:
- Scenario: ${selectedScenario?.name || 'Unknown'} (${selectedScenario?.code || ''})
- Entity: ${selectedEntity?.name || 'Unknown'} (${selectedEntity?.code || ''})
- Time Range: Period ${startPeriod} to Period ${endPeriod}

${macContext}${roiContext}${noRegretsContext}

Please provide a 2-4 sentence narrative analysis that:
1. Highlights the most cost-effective actions (best MAC or ROI)
2. Identifies any no-regret actions that perform well across all scenarios
3. Provides strategic insight about which actions to prioritize

Be concise and focus on actionable insights for decision-makers.`

      const response = await fetch(apiUrl('/api/claude/messages'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'AI analysis failed')
      }

      const data = await response.json()
      if (data.content && data.content[0] && data.content[0].text) {
        setAiDescription(data.content[0].text)
      } else {
        setAiDescription('Unable to generate AI insights at this time.')
      }
    } catch (error) {
      logger.error('Error generating AI description:', error)
      setAiDescription('Error generating AI insights.')
    } finally {
      setAiLoading(false)
    }
  }

  const findEntityById = (id: number | null, entities: Entity[]): Entity | null => {
    if (id === null) return null
    for (const entity of entities) {
      if (entity.entity_id === id) return entity
      if (entity.children) {
        const found = findEntityById(id, entity.children)
        if (found) return found
      }
    }
    return null
  }

  // Load scenarios, entities, periods on mount
  useEffect(() => {
    loadScenarios()
    loadEntities()
  }, [])

  // Auto-select first scenario
  useEffect(() => {
    if (scenarios.length > 0 && !currentScenario) {
      setCurrentScenario(scenarios[0].scenario_id)
    }
  }, [scenarios])

  // Load periods when scenario selected
  useEffect(() => {
    if (currentScenario !== null) {
      loadPeriods()
    }
  }, [currentScenario])

  // Initialize period range when periods load
  useEffect(() => {
    if (periods.length > 0) {
      const minPeriod = Math.min(...periods)
      const maxPeriod = Math.max(...periods)
      setStartPeriod(minPeriod)
      setEndPeriod(maxPeriod)
    }
  }, [periods])

  // Load MAC and ROI data when scenario, entity, periods, and range are ready
  useEffect(() => {
    if (currentScenario !== null && currentEntity !== null && periods.length > 0) {
      loadMacCurve()
      loadRoiCurve()
    }
    // Always load No Regrets comparison for all scenarios
    if (scenarios.length > 0 && currentEntity !== null && periods.length > 0) {
      loadRoiComparison()
    }
  }, [currentScenario, currentEntity, periods, startPeriod, endPeriod, scenarios.length])

  const loadScenarios = async () => {
    try {
      const url = apiUrl(`/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`)
      const response = await fetch(url)
      const data = await response.json()
      if (data.success && data.scenarios) {
        setScenarios(data.scenarios)
      }
    } catch (error) {
      logger.error('Error loading scenarios:', error)
    }
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

  const loadEntities = async () => {
    try {
      const url = apiUrl(`/api/entities?dbPath=${encodeURIComponent(dbPath)}`)
      const response = await fetch(url)
      const flatEntities = await response.json()
      if (Array.isArray(flatEntities)) {
        const tree = buildEntityTree(flatEntities)
        setEntities(tree)
        if (tree.length > 0) {
          setCurrentEntity(tree[0].entity_id)
        }
      }
    } catch (error) {
      logger.error('Error loading entities:', error)
    }
  }

  const loadPeriods = async () => {
    if (currentScenario === null) return
    try {
      const url = apiUrl(`/api/results/periods?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}`)
      const response = await fetch(url)
      const data = await response.json()
      if (data.success && data.periods) {
        setPeriods(data.periods)
      }
    } catch (error) {
      logger.error('Error loading periods:', error)
    }
  }

  const loadMacCurve = async () => {
    if (currentScenario === null || currentEntity === null || periods.length === 0) return

    setMacLoading(true)

    try {
      const url = apiUrl(`/api/results/mac-curve?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}&startPeriod=${startPeriod}&endPeriod=${endPeriod}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.macCurve) {
        setMacResults(data.macCurve)
      } else {
        setMacResults([])
      }
    } catch (error) {
      logger.error('Error loading MAC curve:', error)
      setMacResults([])
    } finally {
      setMacLoading(false)
    }
  }

  const loadRoiCurve = async () => {
    if (currentScenario === null || currentEntity === null || periods.length === 0) return

    setRoiLoading(true)

    try {
      const url = apiUrl(`/api/results/roi-curve?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}&startPeriod=${startPeriod}&endPeriod=${endPeriod}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.roiCurve) {
        setRoiResults(data.roiCurve)
      } else {
        setRoiResults([])
      }
    } catch (error) {
      logger.error('Error loading ROI curve:', error)
      setRoiResults([])
    } finally {
      setRoiLoading(false)
    }
  }

  const loadRoiComparison = async () => {
    if (scenarios.length === 0 || currentEntity === null || periods.length === 0) return

    setComparisonLoading(true)
    const resultsMap: {[key: number]: RoiResult[]} = {}

    try {
      // Load ROI data for ALL scenarios
      await Promise.all(scenarios.map(async (scenario) => {
        const url = apiUrl(`/api/results/roi-curve?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenario.scenario_id}&entityId=${currentEntity}&startPeriod=${startPeriod}&endPeriod=${endPeriod}`)
        const response = await fetch(url)
        const data = await response.json()

        if (data.success && data.roiCurve) {
          resultsMap[scenario.scenario_id] = data.roiCurve
        } else {
          resultsMap[scenario.scenario_id] = []
        }
      }))

      setRoiComparisonData(resultsMap)
    } catch (error) {
      logger.error('Error loading ROI comparison:', error)
      setRoiComparisonData({})
    } finally {
      setComparisonLoading(false)
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
                  backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.2)'}`,
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
                      <ChevronDown style={{ width: '16px', height: '16px', color: '#a855f7' }} />
                    ) : (
                      <ChevronRight style={{ width: '16px', height: '16px', color: '#a855f7' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '24px' }} />}

                <Building2 style={{ width: '16px', height: '16px', color: '#a855f7', marginRight: '8px' }} />

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

  return (
    <div style={{ padding: '48px', minHeight: '100vh' }}>
      {/* Control Panel */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(139, 92, 246, 0.5)',
        marginBottom: '32px'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
            {/* Scenario Selector */}
            <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>
                  Scenario
                </label>
                <select
                  value={currentScenario || ''}
                  onChange={(e) => setCurrentScenario(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select Scenario</option>
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

            {/* Entity Tree Selector */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>
                Entity
              </label>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '6px',
                padding: '8px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)'
              }}>
                {entities.length > 0 ? renderEntityTree(entities) : (
                  <div style={{ color: '#94a3b8', fontSize: '13px', padding: '8px' }}>
                    No entities available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Time Range Selector */}
          {periods.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>
                Time Range: Period {startPeriod} to Period {endPeriod}
              </label>
              <div style={{ position: 'relative', height: '40px', marginBottom: '8px' }}>
                <input
                  type="range"
                  min={Math.min(...periods)}
                  max={Math.max(...periods)}
                  value={startPeriod}
                  onChange={(e) => {
                    const newStart = parseInt(e.target.value)
                    setStartPeriod(newStart)
                    if (newStart > endPeriod) {
                      setEndPeriod(newStart)
                    }
                  }}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    top: 0,
                    left: 0,
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: 'transparent',
                    outline: 'none',
                    appearance: 'none',
                    pointerEvents: 'auto',
                    zIndex: 2
                  }}
                />
                <input
                  type="range"
                  min={Math.min(...periods)}
                  max={Math.max(...periods)}
                  value={endPeriod}
                  onChange={(e) => {
                    const newEnd = parseInt(e.target.value)
                    setEndPeriod(newEnd)
                    if (newEnd < startPeriod) {
                      setStartPeriod(newEnd)
                    }
                  }}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    top: 0,
                    left: 0,
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    outline: 'none',
                    appearance: 'none',
                    pointerEvents: 'auto',
                    zIndex: 1
                  }}
                />
                <style>{`
                  input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #a855f7;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                  }

                  input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #a855f7;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                  }
                `}</style>
              </div>
              <div style={{
                fontSize: '12px',
                color: '#64748b',
                textAlign: 'center',
                paddingTop: '8px',
                borderTop: '1px solid rgba(71, 85, 105, 0.3)'
              }}>
                Analysis will cover {endPeriod - startPeriod + 1} period{endPeriod - startPeriod + 1 !== 1 ? 's' : ''} (P{startPeriod} to P{endPeriod})
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MAC Analysis Section */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(249, 115, 22, 0.5)'
      }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart3 size={24} style={{ color: '#f97316' }} />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0 }}>
                Marginal Abatement Cost (MAC) Analysis
              </h2>
            </div>
            <button
              onClick={addMacToReport}
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

          <div ref={macChartRef}>
            {macLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                Loading MAC data...
              </div>
            ) : macResults.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No MAC data available. Run calculations with individual actions enabled.
              </div>
            ) : (
              <>
                {/* MAC Table */}
                <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(249, 115, 22, 0.5)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: '#f97316', fontWeight: '700' }}>
                        Action
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#f97316', fontWeight: '700' }}>
                        Carbon Abatement (tCO₂e)
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#f97316', fontWeight: '700' }}>
                        Cost ($)
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#f97316', fontWeight: '700' }}>
                        MAC ($/tCO₂e)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {macResults.map((result, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>{result.action}</td>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', textAlign: 'right' }}>
                          {result.carbonAbatement.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', textAlign: 'right' }}>
                          {result.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', textAlign: 'right', fontWeight: '600' }}>
                          {result.mac !== null ? result.mac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MAC Chart */}
              {(() => {
                const sortedResults = [...macResults].sort((a, b) => (a.mac || 0) - (b.mac || 0))
                const chartData = sortedResults.map(result => {
                  const prevAbatement = sortedResults
                    .slice(0, sortedResults.indexOf(result))
                    .reduce((sum, r) => sum + r.carbonAbatement, 0)
                  return {
                    ...result,
                    cumulativeAbatement: prevAbatement
                  }
                })

                const minMAC = Math.min(...macResults.map(r => r.mac === null ? 0 : r.mac))
                const maxMAC = Math.max(...macResults.map(r => r.mac === null ? 0 : r.mac))
                const yPadding = Math.abs(maxMAC - minMAC) * 0.15
                const yMin = minMAC - yPadding
                const yMax = maxMAC + yPadding

                const chartWidth = 1000
                const chartHeight = 500
                const marginLeft = 80
                const marginRight = 40
                const marginTop = 60
                const marginBottom = 80
                const plotWidth = chartWidth - marginLeft - marginRight
                const plotHeight = chartHeight - marginTop - marginBottom

                const maxCumulativeAbatement = chartData.reduce((sum, d) => sum + d.carbonAbatement, 0)

                return (
                  <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
                    {/* Y-axis grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                      const yValue = yMin + ratio * (yMax - yMin)
                      const y = marginTop + (1 - ratio) * plotHeight
                      return (
                        <g key={ratio}>
                          <line
                            x1={marginLeft}
                            y1={y}
                            x2={chartWidth - marginRight}
                            y2={y}
                            stroke="#334155"
                            strokeWidth="1"
                            opacity={0.3}
                          />
                          <text
                            x={marginLeft - 10}
                            y={y}
                            textAnchor="end"
                            dominantBaseline="middle"
                            fill="#94a3b8"
                            fontSize="11"
                          >
                            {yValue.toFixed(0)}
                          </text>
                        </g>
                      )
                    })}

                    {/* Y-axis */}
                    <line
                      x1={marginLeft}
                      y1={marginTop}
                      x2={marginLeft}
                      y2={chartHeight - marginBottom}
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    {/* X-axis */}
                    <line
                      x1={marginLeft}
                      y1={chartHeight - marginBottom}
                      x2={chartWidth - marginRight}
                      y2={chartHeight - marginBottom}
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    {/* Zero line */}
                    <line
                      x1={marginLeft}
                      y1={marginTop + plotHeight * ((yMax - 0) / (yMax - yMin))}
                      x2={chartWidth - marginRight}
                      y2={marginTop + plotHeight * ((yMax - 0) / (yMax - yMin))}
                      stroke="#f97316"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                      opacity={0.6}
                    />

                    {/* Bars and Labels */}
                    {chartData.map((d, i) => {
                      const x = marginLeft + (d.cumulativeAbatement / maxCumulativeAbatement) * plotWidth
                      const barWidth = (d.carbonAbatement / maxCumulativeAbatement) * plotWidth
                      const mac = d.mac || 0
                      const barHeight = Math.abs((mac / (yMax - yMin)) * plotHeight)
                      const y = mac >= 0
                        ? marginTop + plotHeight * ((yMax - mac) / (yMax - yMin))
                        : marginTop + plotHeight * ((yMax - 0) / (yMax - yMin))

                      const color = mac < 0 ? '#22c55e' : mac < 50 ? '#f97316' : '#ef4444'

                      // Label positioning
                      const labelY = mac >= 0 ? y - 10 : y + barHeight + 15
                      const labelX = x + barWidth / 2

                      return (
                        <g key={i}>
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            opacity={0.85}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                          />
                          {/* Action Label */}
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="10"
                            fontWeight="600"
                          >
                            {d.action}
                          </text>
                          {/* MAC Value */}
                          <text
                            x={labelX}
                            y={y + barHeight / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize="11"
                            fontWeight="700"
                          >
                            ${mac.toFixed(1)}
                          </text>
                          <title>{`${d.action}\nMAC: ${mac.toFixed(2)} $/tCO₂e\nCarbon: ${d.carbonAbatement.toFixed(0)} tCO₂e\nCost: $${d.cost.toFixed(0)}`}</title>
                        </g>
                      )
                    })}

                    {/* Y-axis label */}
                    <text
                      x={20}
                      y={chartHeight / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 20 ${chartHeight / 2})`}
                      fill="#94a3b8"
                      fontSize="13"
                      fontWeight="600"
                    >
                      MAC ($/tCO₂e)
                    </text>

                    {/* X-axis label */}
                    <text
                      x={chartWidth / 2}
                      y={chartHeight - 10}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="13"
                      fontWeight="600"
                    >
                      Cumulative Carbon Abatement (tCO₂e)
                    </text>
                  </svg>
                )
              })()}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ROI Analysis Section */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(168, 85, 247, 0.5)',
        marginTop: '32px'
      }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TrendingUp size={24} style={{ color: '#a855f7' }} />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0 }}>
                Return on Investment (ROI) Analysis
              </h2>
            </div>
            <button
              onClick={addRoiToReport}
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

          <div ref={roiChartRef}>
            {roiLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                Loading ROI data...
              </div>
            ) : roiResults.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                No ROI data available. Run calculations with individual actions enabled.
              </div>
            ) : (
              <>
                {/* ROI Table */}
                <div style={{ overflowX: 'auto', marginBottom: '32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid rgba(168, 85, 247, 0.5)' }}>
                      <th style={{ textAlign: 'left', padding: '12px 16px', color: '#a855f7', fontWeight: '700' }}>
                        Action
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#a855f7', fontWeight: '700' }}>
                        Investment ($)
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#a855f7', fontWeight: '700' }}>
                        Benefit ($)
                      </th>
                      <th style={{ textAlign: 'right', padding: '12px 16px', color: '#a855f7', fontWeight: '700' }}>
                        ROI (%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {roiResults.map((result, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0' }}>{result.action}</td>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', textAlign: 'right' }}>
                          {result.investment.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#e2e8f0', textAlign: 'right' }}>
                          {result.benefit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: result.roi !== null && result.roi > 0 ? '#22c55e' : '#ef4444' }}>
                          {result.roi !== null ? result.roi.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ROI Chart */}
              {(() => {
                const sortedResults = [...roiResults].sort((a, b) => (b.roi || 0) - (a.roi || 0))

                const chartWidth = 1000
                const chartHeight = Math.max(400, sortedResults.length * 60)
                const marginLeft = 150
                const marginRight = 120
                const marginTop = 60
                const marginBottom = 80
                const plotWidth = chartWidth - marginLeft - marginRight
                const plotHeight = chartHeight - marginTop - marginBottom

                const maxROI = Math.max(...sortedResults.map(r => r.roi || 0), 10)
                const minROI = Math.min(...sortedResults.map(r => r.roi || 0), -10)
                const maxAbsROI = Math.max(Math.abs(maxROI), Math.abs(minROI))

                return (
                  <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
                    {/* Grid lines */}
                    {[...Array(5)].map((_, idx) => {
                      const roiValue = (minROI + (maxROI - minROI) * idx / 4)
                      const xPos = marginLeft + ((roiValue - minROI) / (maxROI - minROI)) * plotWidth
                      return (
                        <g key={idx}>
                          <line
                            x1={xPos}
                            y1={marginTop}
                            x2={xPos}
                            y2={chartHeight - marginBottom}
                            stroke="#334155"
                            strokeWidth="1"
                            opacity={0.3}
                          />
                          <text
                            x={xPos}
                            y={chartHeight - marginBottom + 20}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="11"
                          >
                            {roiValue.toFixed(1)}%
                          </text>
                        </g>
                      )
                    })}

                    {/* Y-axis */}
                    <line
                      x1={marginLeft}
                      y1={marginTop}
                      x2={marginLeft}
                      y2={chartHeight - marginBottom}
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    {/* X-axis */}
                    <line
                      x1={marginLeft}
                      y1={chartHeight - marginBottom}
                      x2={chartWidth - marginRight}
                      y2={chartHeight - marginBottom}
                      stroke="#64748b"
                      strokeWidth="2"
                    />
                    {/* Zero line */}
                    <line
                      x1={marginLeft}
                      y1={marginTop}
                      x2={marginLeft}
                      y2={chartHeight - marginBottom}
                      stroke="#a855f7"
                      strokeWidth="2"
                      strokeDasharray="6 3"
                      opacity={0.6}
                    />

                    {/* Bars */}
                    {sortedResults.map((d, i) => {
                      const barHeight = Math.min((plotHeight / sortedResults.length) * 0.7, 40)
                      const y = marginTop + (i * plotHeight / sortedResults.length) + (plotHeight / sortedResults.length - barHeight) / 2
                      const roi = d.roi || 0
                      const barWidth = (Math.abs(roi) / maxAbsROI) * plotWidth * 0.9

                      const color = roi > 0 ? '#22c55e' : '#ef4444'

                      return (
                        <g key={i}>
                          <rect
                            x={roi >= 0 ? marginLeft : marginLeft - barWidth}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={color}
                            opacity={0.85}
                            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.85'}
                          />
                          {/* Action label on left */}
                          <text
                            x={marginLeft - 10}
                            y={y + barHeight / 2}
                            textAnchor="end"
                            fill="#e2e8f0"
                            fontSize="12"
                            fontWeight="600"
                            dominantBaseline="middle"
                          >
                            {d.action}
                          </text>
                          {/* ROI value on bar or at end */}
                          <text
                            x={roi >= 0 ? marginLeft + barWidth + 10 : marginLeft - barWidth - 10}
                            y={y + barHeight / 2}
                            textAnchor={roi >= 0 ? 'start' : 'end'}
                            fill="#fff"
                            fontSize="12"
                            fontWeight="700"
                            dominantBaseline="middle"
                          >
                            {roi.toFixed(1)}%
                          </text>
                          <title>{`${d.action}\nROI: ${roi.toFixed(2)}%\nInvestment: $${d.investment.toFixed(0)}\nBenefit: $${d.benefit.toFixed(0)}`}</title>
                        </g>
                      )
                    })}

                    {/* X-axis label */}
                    <text
                      x={chartWidth / 2}
                      y={chartHeight - 20}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="13"
                      fontWeight="600"
                    >
                      Return on Investment (%)
                    </text>

                    {/* Chart Title */}
                    <text
                      x={chartWidth / 2}
                      y={marginTop - 30}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="16"
                      fontWeight="700"
                    >
                      ROI by Action (sorted by performance)
                    </text>
                  </svg>
                )
              })()}
            </>
          )}

          {/* No Regrets Dashboard */}
          {Object.keys(roiComparisonData).length > 0 && (
            <>
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', marginBottom: '24px', marginTop: '32px' }}>
                No Regrets Dashboard
              </h2>

              {/* Grouped Bar Chart */}
              {(() => {
                // Build grouped data structure: { action: { scenarioId: roi } }
                const actionMap: {[action: string]: {[scenarioId: number]: number}} = {}

                Object.entries(roiComparisonData).forEach(([scenarioId, results]) => {
                  results.forEach(result => {
                    if (!actionMap[result.action]) {
                      actionMap[result.action] = {}
                    }
                    actionMap[result.action][parseInt(scenarioId)] = result.roi || 0
                  })
                })

                const actions = Object.keys(actionMap)
                const numScenarios = scenarios.length
                const barGroupWidth = 60
                const barWidth = barGroupWidth / numScenarios
                const gapBetweenGroups = 30
                const totalWidth = actions.length * (barGroupWidth + gapBetweenGroups)

                // Scale chart width to fit number of actions (full panel width)
                const chartWidth = totalWidth + 250
                const chartHeight = 500
                const marginLeft = 100
                const marginRight = 150
                const marginTop = 80
                const marginBottom = 120
                const plotHeight = chartHeight - marginTop - marginBottom

                // Find min/max ROI across all data with 10% padding
                const allROIs = actions.flatMap(action =>
                  Object.values(actionMap[action])
                )
                const rawMaxROI = Math.max(...allROIs, 0)
                const rawMinROI = Math.min(...allROIs, 0)
                const roiRange = rawMaxROI - rawMinROI
                const padding = roiRange * 0.1 || 10
                const maxROI = rawMaxROI + padding
                const minROI = rawMinROI - padding

                // Check for "no regret" actions (all scenarios have positive ROI)
                const noRegretActions = actions.filter(action => {
                  const rois = Object.values(actionMap[action])
                  return rois.length > 0 && rois.every(roi => roi > 0)
                })

                // Color palette for scenarios
                const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

                return (
                  <div style={{ overflowX: 'auto', width: '100%' }}>
                    <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ display: 'block' }}>
                      {/* Grid lines */}
                      {[...Array(5)].map((_, idx) => {
                        const roiValue = minROI + (maxROI - minROI) * idx / 4
                        const y = marginTop + plotHeight - ((roiValue - minROI) / (maxROI - minROI)) * plotHeight
                        return (
                          <g key={idx}>
                            <line
                              x1={marginLeft}
                              y1={y}
                              x2={chartWidth - marginRight}
                              y2={y}
                              stroke="#334155"
                              strokeWidth="1"
                              opacity={0.3}
                            />
                            <text
                              x={marginLeft - 10}
                              y={y}
                              textAnchor="end"
                              dominantBaseline="middle"
                              fill="#94a3b8"
                              fontSize="11"
                            >
                              {roiValue.toFixed(0)}%
                            </text>
                          </g>
                        )
                      })}

                      {/* Y-axis */}
                      <line
                        x1={marginLeft}
                        y1={marginTop}
                        x2={marginLeft}
                        y2={chartHeight - marginBottom}
                        stroke="#64748b"
                        strokeWidth="2"
                      />
                      {/* X-axis */}
                      <line
                        x1={marginLeft}
                        y1={chartHeight - marginBottom}
                        x2={chartWidth - marginRight}
                        y2={chartHeight - marginBottom}
                        stroke="#64748b"
                        strokeWidth="2"
                      />
                      {/* Zero line */}
                      {minROI < 0 && maxROI > 0 && (
                        <line
                          x1={marginLeft}
                          y1={marginTop + plotHeight - ((0 - minROI) / (maxROI - minROI)) * plotHeight}
                          x2={chartWidth - marginRight}
                          y2={marginTop + plotHeight - ((0 - minROI) / (maxROI - minROI)) * plotHeight}
                          stroke="#f97316"
                          strokeWidth="2"
                          strokeDasharray="6 3"
                          opacity={0.6}
                        />
                      )}

                      {/* Y-axis label */}
                      <text
                        x={marginLeft - 60}
                        y={chartHeight / 2}
                        textAnchor="middle"
                        fill="#a855f7"
                        fontSize="13"
                        fontWeight="600"
                        transform={`rotate(-90, ${marginLeft - 60}, ${chartHeight / 2})`}
                      >
                        Return on Investment (%)
                      </text>

                      {/* Grouped Bars */}
                      {actions.map((action, actionIdx) => {
                        const groupX = marginLeft + actionIdx * (barGroupWidth + gapBetweenGroups)
                        const isNoRegret = noRegretActions.includes(action)

                        return (
                          <g key={action}>
                            {/* No regret highlight background */}
                            {isNoRegret && (
                              <rect
                                x={groupX - 5}
                                y={marginTop}
                                width={barGroupWidth + 10}
                                height={plotHeight}
                                fill="#22c55e"
                                opacity={0.1}
                              />
                            )}

                            {/* Bars for each scenario */}
                            {scenarios.map((scenario, scenarioIdx) => {
                              const scenarioId = scenario.scenario_id
                              const roi = actionMap[action][scenarioId] || 0
                              const barX = groupX + scenarioIdx * barWidth
                              const barHeight = Math.abs((roi / (maxROI - minROI)) * plotHeight)
                              const barY = roi >= 0
                                ? marginTop + plotHeight - ((roi - minROI) / (maxROI - minROI)) * plotHeight
                                : marginTop + plotHeight - ((0 - minROI) / (maxROI - minROI)) * plotHeight

                              return (
                                <rect
                                  key={scenarioId}
                                  x={barX}
                                  y={barY}
                                  width={barWidth - 2}
                                  height={barHeight}
                                  fill={colors[scenarioIdx % colors.length]}
                                  opacity={0.85}
                                >
                                  <title>{`${action}\n${scenarios.find(s => s.scenario_id === scenarioId)?.name}\nROI: ${roi.toFixed(1)}%`}</title>
                                </rect>
                              )
                            })}

                            {/* No Regret label above bars */}
                            {isNoRegret && (
                              <>
                                <text
                                  x={groupX + barGroupWidth / 2}
                                  y={marginTop - 30}
                                  textAnchor="middle"
                                  fill="#22c55e"
                                  fontSize="18"
                                  fontWeight="700"
                                >
                                  ✓
                                </text>
                                <text
                                  x={groupX + barGroupWidth / 2}
                                  y={marginTop - 10}
                                  textAnchor="middle"
                                  fill="#22c55e"
                                  fontSize="11"
                                  fontWeight="700"
                                >
                                  No Regret
                                </text>
                              </>
                            )}

                            {/* Action label */}
                            <text
                              x={groupX + barGroupWidth / 2}
                              y={chartHeight - marginBottom + 20}
                              textAnchor="end"
                              fill={isNoRegret ? '#22c55e' : '#e2e8f0'}
                              fontSize="11"
                              fontWeight={isNoRegret ? '700' : '400'}
                              transform={`rotate(-45, ${groupX + barGroupWidth / 2}, ${chartHeight - marginBottom + 20})`}
                            >
                              {action}
                            </text>
                          </g>
                        )
                      })}

                      {/* Legend */}
                      <g transform={`translate(${chartWidth - marginRight + 20}, ${marginTop})`}>
                        <text x={0} y={0} fill="#a855f7" fontSize="12" fontWeight="600">Scenarios:</text>
                        {scenarios.map((scenario, idx) => {
                          return (
                            <g key={scenario.scenario_id} transform={`translate(0, ${25 + idx * 25})`}>
                              <rect x={0} y={-8} width={15} height={15} fill={colors[idx % colors.length]} opacity={0.85} />
                              <text x={20} y={0} fill="#e2e8f0" fontSize="11">{scenario.name}</text>
                            </g>
                          )
                        })}
                      </g>
                    </svg>
                  </div>
                )
              })()}
            </>
          )}

          {comparisonLoading && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
              Loading no regrets analysis...
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      {(macResults.length > 0 || roiResults.length > 0) && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(139, 92, 246, 0.5)',
          marginTop: '32px'
        }}>
          <CardContent style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Sparkles size={24} style={{ color: '#8b5cf6' }} />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#fff', margin: 0 }}>
                AI Insights
              </h2>
            </div>

            {!aiDescription && !aiLoading && (
              <button
                onClick={generateAIDescription}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid #8b5cf6',
                  borderRadius: '6px',
                  color: '#8b5cf6',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.2)'
                }}
              >
                <Sparkles size={16} />
                Generate AI Insights
              </button>
            )}

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid rgba(139, 92, 246, 0.3)',
                  borderTop: '3px solid #8b5cf6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ color: '#94a3b8' }}>Generating AI insights...</span>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}

            {aiDescription && !aiLoading && (
              <div style={{
                padding: '20px',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#e2e8f0',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                {aiDescription}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
