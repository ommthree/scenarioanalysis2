import React, { useState, useEffect, useRef } from 'react'
import { logger } from '@/utils/logger'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronRight, ChevronDown, Building2, FileText, Sparkles } from 'lucide-react'
import { apiUrl, getDefaultDbPath } from '@/config'
import domtoimage from 'dom-to-image-more'

interface LineItem {
  code: string
  display_name: string
  section: string
  is_computed: boolean
  sign_convention?: string
  value: number
}

interface DriverContribution {
  driver_code: string
  driver_name: string
  value: number
}

interface Section {
  name: string
  items: LineItem[]
}

interface Entity {
  entity_id: number
  code: string
  name: string
  granularity_level: string
  parent_entity_id: number | null
  children?: Entity[]
}

interface Scenario {
  scenario_id: number
  code: string
  name: string
  num_periods: number
}

interface ResultData {
  [entityId: number]: {
    [scenarioId: number]: {
      [period: number]: {
        withActions: Section[]
        withoutActions: Section[]
      }
    }
  }
}

interface DriverData {
  [entityId: number]: {
    [scenarioId: number]: {
      [period: number]: {
        [lineItemCode: string]: {
          withActions: DriverContribution[]
          withoutActions: DriverContribution[]
        }
      }
    }
  }
}

export default function FinancialStatementsPanel() {
  const statementRef = useRef<HTMLDivElement>(null)

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<Set<number>>(new Set())
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(new Set())
  const [periodRange, setPeriodRange] = useState<[number, number]>([1, 1])
  const [maxPeriod, setMaxPeriod] = useState(1)
  const [deltaMode, setDeltaMode] = useState(false)
  const [lastRunMode, setLastRunMode] = useState<{ whatIfMode: boolean } | null>(null)
  const [expandedEntities, setExpandedEntities] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set())
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [resultData, setResultData] = useState<ResultData>({})
  const [driverData, setDriverData] = useState<DriverData>({})
  const [loading, setLoading] = useState(false)
  const [aiInsights, setAiInsights] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    loadScenarios()
    loadEntities()
    checkLastRunMode()
  }, [])

  useEffect(() => {
    if (selectedScenarios.size > 0) {
      loadMaxPeriod()
    }
  }, [selectedScenarios])

  useEffect(() => {
    if (selectedScenarios.size > 0 && selectedEntities.size > 0) {
      loadAllResults()
    }
  }, [selectedScenarios, selectedEntities, periodRange, deltaMode])

  const checkLastRunMode = () => {
    const saved = localStorage.getItem('lastRunMode')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLastRunMode(parsed)
        setDeltaMode(parsed.whatIfMode === true)
      } catch (e) {
        logger.error('Failed to parse lastRunMode', e)
      }
    }
  }

  const loadScenarios = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/results/scenarios?dbPath=${encodeURIComponent(dbPath)}`))
      if (!response.ok) throw new Error('Failed to load scenarios')
      const data = await response.json()
      setScenarios(data.scenarios || [])
      if (data.scenarios && data.scenarios.length > 0) {
        setSelectedScenarios(new Set([data.scenarios[0].scenario_id]))
      }
    } catch (error) {
      logger.error('Error loading scenarios:', error)
    }
  }

  const loadEntities = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/entities?dbPath=${encodeURIComponent(dbPath)}`))
      if (!response.ok) throw new Error('Failed to load entities')
      const data = await response.json()
      const entityMap = new Map<number, Entity>()
      data.forEach((e: Entity) => {
        entityMap.set(e.entity_id, { ...e, children: [] })
      })
      const rootEntities: Entity[] = []
      entityMap.forEach((entity) => {
        if (entity.parent_entity_id) {
          const parent = entityMap.get(entity.parent_entity_id)
          if (parent) {
            parent.children!.push(entity)
          }
        } else {
          rootEntities.push(entity)
        }
      })
      setEntities(rootEntities)
      if (rootEntities.length > 0 && rootEntities[0].children && rootEntities[0].children.length > 0) {
        setSelectedEntities(new Set([rootEntities[0].children[0].entity_id]))
      }
    } catch (error) {
      logger.error('Error loading entities:', error)
    }
  }

  const loadMaxPeriod = async () => {
    try {
      const firstScenarioId = Array.from(selectedScenarios)[0]
      const scenario = scenarios.find(s => s.scenario_id === firstScenarioId)
      if (scenario) {
        setMaxPeriod(scenario.num_periods)
        setPeriodRange([1, Math.min(5, scenario.num_periods)])
      }
    } catch (error) {
      logger.error('Error loading max period:', error)
    }
  }

  const loadAllResults = async () => {
    setLoading(true)
    try {
      const dbPath = getDefaultDbPath()
      const newResultData: ResultData = {}
      const newDriverData: DriverData = {}
      const allEntitiesNeeded = getEntitiesWithParents(Array.from(selectedEntities))
      
      for (const entityId of allEntitiesNeeded) {
        newResultData[entityId] = {}
        newDriverData[entityId] = {}
        for (const scenarioId of selectedScenarios) {
          newResultData[entityId][scenarioId] = {}
          newDriverData[entityId][scenarioId] = {}
          for (let period = periodRange[0]; period <= periodRange[1]; period++) {
            if (deltaMode && lastRunMode?.whatIfMode) {
              const urlWithActions = apiUrl(`/api/results/financial-statements?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&includeActions=true`)
              const urlWithoutActions = apiUrl(`/api/results/financial-statements?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&includeActions=false`)
              const [resWithActions, resWithoutActions] = await Promise.all([
                fetch(urlWithActions),
                fetch(urlWithoutActions)
              ])
              if (!resWithActions.ok || !resWithoutActions.ok) {
                throw new Error('Failed to fetch financial statements')
              }
              const dataWithActions = await resWithActions.json()
              const dataWithoutActions = await resWithoutActions.json()
              newResultData[entityId][scenarioId][period] = {
                withActions: organizeSections(dataWithActions.lineItems || []),
                withoutActions: organizeSections(dataWithoutActions.lineItems || [])
              }
            } else {
              const url = apiUrl(`/api/results/financial-statements?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}`)
              const res = await fetch(url)
              if (!res.ok) throw new Error('Failed to fetch financial statements')
              const data = await res.json()
              const sections = organizeSections(data.lineItems || [])
              newResultData[entityId][scenarioId][period] = {
                withActions: sections,
                withoutActions: sections
              }
            }
            newDriverData[entityId][scenarioId][period] = {}
          }
        }
      }
      setResultData(newResultData)
      setDriverData(newDriverData)
    } catch (error) {
      logger.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
  }

  const organizeSections = (lineItems: LineItem[]): Section[] => {
    const sectionMap = new Map<string, LineItem[]>()
    lineItems.forEach(item => {
      if (!sectionMap.has(item.section)) {
        sectionMap.set(item.section, [])
      }
      sectionMap.get(item.section)!.push(item)
    })
    return Array.from(sectionMap.entries()).map(([name, items]) => ({ name, items }))
  }

  const getEntitiesWithParents = (entityIds: number[]): number[] => {
    const result = new Set<number>(entityIds)
    const flatMap = new Map<number, Entity>()
    const buildFlatMap = (entities: Entity[]) => {
      entities.forEach(e => {
        flatMap.set(e.entity_id, e)
        if (e.children) buildFlatMap(e.children)
      })
    }
    buildFlatMap(entities)
    entityIds.forEach(entityId => {
      let current = flatMap.get(entityId)
      while (current && current.parent_entity_id) {
        result.add(current.parent_entity_id)
        current = flatMap.get(current.parent_entity_id)
      }
    })
    return Array.from(result)
  }

  const getEntityById = (entityId: number): Entity | null => {
    const findEntity = (entities: Entity[]): Entity | null => {
      for (const entity of entities) {
        if (entity.entity_id === entityId) return entity
        if (entity.children) {
          const found = findEntity(entity.children)
          if (found) return found
        }
      }
      return null
    }
    return findEntity(entities)
  }

  const isParentEntity = (entityId: number): boolean => {
    return !selectedEntities.has(entityId) && getEntitiesWithParents(Array.from(selectedEntities)).includes(entityId)
  }

  const getRolledUpValue = (entityId: number, scenarioId: number, period: number, lineItemCode: string, withActions: boolean): number => {
    const entity = getEntityById(entityId)
    if (!entity || !entity.children) return 0
    let total = 0
    entity.children.forEach(child => {
      const data = resultData[child.entity_id]?.[scenarioId]?.[period]
      if (data) {
        const sections = withActions ? data.withActions : data.withoutActions
        sections.forEach(section => {
          const item = section.items.find(i => i.code === lineItemCode)
          if (item) total += item.value
        })
      }
      total += getRolledUpValue(child.entity_id, scenarioId, period, lineItemCode, withActions)
    })
    return total
  }

  const loadDriverDecomposition = async (entityId: number, scenarioId: number, period: number, lineItemCode: string) => {
    try {
      const dbPath = getDefaultDbPath()
      if (deltaMode && lastRunMode?.whatIfMode) {
        const urlWithActions = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}&includeActions=true`)
        const urlWithoutActions = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}&includeActions=false`)
        const [resWithActions, resWithoutActions] = await Promise.all([fetch(urlWithActions), fetch(urlWithoutActions)])
        if (!resWithActions.ok || !resWithoutActions.ok) throw new Error('Failed to fetch driver decomposition')
        const dataWithActions = await resWithActions.json()
        const dataWithoutActions = await resWithoutActions.json()
        setDriverData(prev => ({
          ...prev,
          [entityId]: {
            ...prev[entityId],
            [scenarioId]: {
              ...prev[entityId]?.[scenarioId],
              [period]: {
                ...prev[entityId]?.[scenarioId]?.[period],
                [lineItemCode]: {
                  withActions: dataWithActions.drivers || [],
                  withoutActions: dataWithoutActions.drivers || []
                }
              }
            }
          }
        }))
      } else {
        const url = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}`)
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch driver decomposition')
        const data = await res.json()
        const drivers = data.drivers || []
        setDriverData(prev => ({
          ...prev,
          [entityId]: {
            ...prev[entityId],
            [scenarioId]: {
              ...prev[entityId]?.[scenarioId],
              [period]: {
                ...prev[entityId]?.[scenarioId]?.[period],
                [lineItemCode]: {
                  withActions: drivers,
                  withoutActions: drivers
                }
              }
            }
          }
        }))
      }
    } catch (error) {
      logger.error('Error loading driver decomposition:', error)
    }
  }

  const toggleEntityExpanded = (entityId: number) => {
    setExpandedEntities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entityId)) newSet.delete(entityId)
      else newSet.add(entityId)
      return newSet
    })
  }

  const toggleSectionExpanded = (entityId: number, sectionName: string) => {
    const key = `${entityId}-${sectionName}`
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) newSet.delete(key)
      else newSet.add(key)
      return newSet
    })
  }

  const toggleLineItemExpanded = (entityId: number, lineItemCode: string) => {
    const key = `${entityId}-${lineItemCode}`
    setExpandedLineItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
        selectedScenarios.forEach(scenarioId => {
          for (let period = periodRange[0]; period <= periodRange[1]; period++) {
            if (!driverData[entityId]?.[scenarioId]?.[period]?.[lineItemCode]) {
              loadDriverDecomposition(entityId, scenarioId, period, lineItemCode)
            }
          }
        })
      }
      return newSet
    })
  }

  const toggleColumnCollapsed = (key: string) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(key)) newSet.delete(key)
      else newSet.add(key)
      return newSet
    })
  }

  const generateAiInsights = async () => {
    if (selectedScenarios.size === 0 || selectedEntities.size === 0) return
    setAiLoading(true)
    try {
      const scenarioNames = Array.from(selectedScenarios).map(id =>
        scenarios.find(s => s.scenario_id === id)?.name || `Scenario ${id}`
      ).join(', ')
      const entityNames = Array.from(selectedEntities).map(id =>
        getEntityById(id)?.name || `Entity ${id}`
      ).join(', ')
      const periodText = periodRange[0] === periodRange[1]
        ? `period ${periodRange[0]}`
        : `periods ${periodRange[0]} to ${periodRange[1]}`
      const modeText = deltaMode ? 'with/without actions comparison' : 'absolute values'
      const prompt = `You are a financial analyst reviewing financial statements. Provide a concise analytical summary (3-4 sentences) of the financial statements for:

Scenarios: ${scenarioNames}
Entities: ${entityNames}
Time Period: ${periodText}
Display Mode: ${modeText}

Focus on:
1. Overall financial position and trends
2. Key areas of strength or concern
3. Notable changes or patterns across periods/scenarios
4. Strategic insights for decision-makers

Use business-friendly language and avoid excessive financial jargon. Write as a flowing paragraph, not bullet points.`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })
      if (!response.ok) throw new Error('Failed to generate AI insights')
      const result = await response.json()
      setAiInsights(result.content[0].text)
    } catch (error) {
      logger.error('Error generating AI insights:', error)
      setAiInsights('Unable to generate AI insights. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const addToReport = async () => {
    if (!statementRef.current) return
    try {
      const element = statementRef.current
      const originalStyles = {
        backgroundColor: element.style.backgroundColor,
        color: element.style.color,
        padding: element.style.padding
      }
      element.style.backgroundColor = '#ffffff'
      element.style.color = '#000000'
      element.style.padding = '40px'
      const buttons = element.querySelectorAll('button')
      const originalButtonDisplay: string[] = []
      buttons.forEach((btn, i) => {
        originalButtonDisplay[i] = (btn as HTMLElement).style.display
        ;(btn as HTMLElement).style.display = 'none'
      })
      const cells = element.querySelectorAll('[data-cell]')
      cells.forEach(cell => {
        const el = cell as HTMLElement
        el.style.border = '1px solid #333'
        el.style.backgroundColor = '#fff'
        el.style.color = '#000'
      })
      await new Promise(resolve => setTimeout(resolve, 100))
      const dataUrl = await domtoimage.toPng(element, {
        quality: 0.95,
        bgcolor: '#ffffff'
      })
      element.style.backgroundColor = originalStyles.backgroundColor
      element.style.color = originalStyles.color
      element.style.padding = originalStyles.padding
      buttons.forEach((btn, i) => {
        ;(btn as HTMLElement).style.display = originalButtonDisplay[i]
      })
      cells.forEach(cell => {
        const el = cell as HTMLElement
        el.style.border = ''
        el.style.backgroundColor = ''
        el.style.color = ''
      })
      const scenarioNames = Array.from(selectedScenarios).map(id =>
        scenarios.find(s => s.scenario_id === id)?.name || `Scenario ${id}`
      ).join(', ')
      const entityNames = Array.from(selectedEntities).map(id =>
        getEntityById(id)?.name || `Entity ${id}`
      ).join(', ')
      const periodText = periodRange[0] === periodRange[1]
        ? `Period ${periodRange[0]}`
        : `Periods ${periodRange[0]}-${periodRange[1]}`
      const caption = `Financial Statements: ${scenarioNames} | ${entityNames} | ${periodText}${deltaMode ? ' | With/Without Actions' : ''}`
      const snippets = JSON.parse(localStorage.getItem('reportSnippets') || '[]')
      snippets.push({
        id: Date.now(),
        type: 'visualization',
        source: 'financial-statements',
        imageData: dataUrl,
        caption: caption,
        aiText: aiInsights || '',
        timestamp: new Date().toISOString()
      })
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      logger.log('Added financial statements to report')
    } catch (error) {
      logger.error('Error adding to report:', error)
    }
  }

  const formatValue = (value: number): string => {
    if (Math.abs(value) < 1000) return value.toFixed(0)
    if (Math.abs(value) < 1000000) return (value / 1000).toFixed(1) + 'K'
    return (value / 1000000).toFixed(1) + 'M'
  }

  const handleScenarioToggle = (scenarioId: number) => {
    setSelectedScenarios(prev => {
      const newSet = new Set(prev)
      if (newSet.has(scenarioId)) newSet.delete(scenarioId)
      else newSet.add(scenarioId)
      return newSet
    })
  }

  const handleEntityToggle = (entityId: number) => {
    setSelectedEntities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entityId)) newSet.delete(entityId)
      else newSet.add(entityId)
      return newSet
    })
  }

  const renderEntitySelector = (entity: Entity, depth: number = 0): JSX.Element[] => {
    const result: JSX.Element[] = []
    result.push(
      <div key={entity.entity_id} style={{
        marginLeft: `${depth * 20}px`,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center'
      }}>
        <input
          type="checkbox"
          checked={selectedEntities.has(entity.entity_id)}
          onChange={() => handleEntityToggle(entity.entity_id)}
          style={{ marginRight: '8px', cursor: 'pointer' }}
        />
        <Building2 style={{ width: '14px', height: '14px', marginRight: '6px', color: '#06b6d4' }} />
        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{entity.name}</span>
      </div>
    )
    if (entity.children) {
      entity.children.forEach(child => {
        result.push(...renderEntitySelector(child, depth + 1))
      })
    }
    return result
  }

  logger.log('FinancialStatementsPanel rendered')

  return (
    <div ref={statementRef} style={{ padding: '24px', minHeight: '100vh' }}>
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <CardContent style={{ padding: '24px' }}>
          {/* Title and Controls */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0, display: 'flex', alignItems: 'center' }}>
                <FileText style={{ width: '24px', height: '24px', marginRight: '10px', color: '#06b6d4' }} />
                Financial Statements
              </h2>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={generateAiInsights}
                  disabled={aiLoading || selectedScenarios.size === 0 || selectedEntities.size === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid #8b5cf6',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: aiLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: (aiLoading || selectedScenarios.size === 0 || selectedEntities.size === 0) ? 0.5 : 1
                  }}
                >
                  <Sparkles style={{ width: '16px', height: '16px' }} />
                  {aiLoading ? 'Generating...' : 'Generate AI Insights'}
                </button>
                <button
                  onClick={addToReport}
                  disabled={selectedScenarios.size === 0 || selectedEntities.size === 0}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid #a855f7',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '13px',
                    cursor: selectedScenarios.size === 0 || selectedEntities.size === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    opacity: (selectedScenarios.size === 0 || selectedEntities.size === 0) ? 0.5 : 1
                  }}
                >
                  <FileText style={{ width: '16px', height: '16px' }} />
                  Add to Report
                </button>
              </div>
            </div>

            {/* Control Panel */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Scenario Selector */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(100, 116, 139, 0.3)'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>
                  Scenarios
                </h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {scenarios.map(scenario => (
                    <div key={scenario.scenario_id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedScenarios.has(scenario.scenario_id)}
                        onChange={() => handleScenarioToggle(scenario.scenario_id)}
                        style={{ marginRight: '8px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{scenario.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Entity Selector */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(100, 116, 139, 0.3)'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>
                  Entities
                </h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {entities.map(entity => renderEntitySelector(entity))}
                </div>
              </div>

              {/* Period Range & Options */}
              <div style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(100, 116, 139, 0.3)'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', marginBottom: '12px' }}>
                  Period Range
                </h3>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>Start: {periodRange[0]}</span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>End: {periodRange[1]}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max={maxPeriod}
                    value={periodRange[0]}
                    onChange={(e) => setPeriodRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), periodRange[1])])}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <input
                    type="range"
                    min="1"
                    max={maxPeriod}
                    value={periodRange[1]}
                    onChange={(e) => setPeriodRange([periodRange[0], Math.max(periodRange[0], parseInt(e.target.value))])}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
                  <input
                    type="checkbox"
                    checked={deltaMode}
                    onChange={(e) => setDeltaMode(e.target.checked)}
                    disabled={!lastRunMode?.whatIfMode}
                    style={{ marginRight: '8px', cursor: lastRunMode?.whatIfMode ? 'pointer' : 'not-allowed' }}
                  />
                  <span style={{ fontSize: '13px', color: lastRunMode?.whatIfMode ? '#e2e8f0' : '#64748b' }}>
                    Show With/Without Actions
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Statements Table */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Loading financial statements...
            </div>
          )}

          {!loading && selectedScenarios.size === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Please select at least one scenario
            </div>
          )}

          {!loading && selectedScenarios.size > 0 && selectedEntities.size === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Please select at least one entity
            </div>
          )}

          {!loading && selectedScenarios.size > 0 && selectedEntities.size > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                {/* Column Headers */}
                <thead>
                  {/* Top header: With Actions / Without Actions */}
                  {deltaMode && (
                    <tr>
                      <th style={{
                        position: 'sticky',
                        left: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        padding: '12px 8px',
                        borderBottom: '2px solid rgba(100, 116, 139, 0.3)',
                        color: '#e2e8f0',
                        fontWeight: '600',
                        textAlign: 'left',
                        zIndex: 20
                      }}>
                        Line Item
                      </th>
                      {[{ key: 'withActions', label: 'With Actions' }, { key: 'withoutActions', label: 'Without Actions' }].map(actionMode => {
                        const totalCols = (periodRange[1] - periodRange[0] + 1) * selectedScenarios.size
                        return (
                          <th key={actionMode.key} colSpan={totalCols} style={{
                            padding: '12px 8px',
                            borderBottom: '2px solid rgba(100, 116, 139, 0.3)',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            color: '#06b6d4',
                            fontWeight: '700',
                            textAlign: 'center'
                          }}>
                            {actionMode.label}
                          </th>
                        )
                      })}
                    </tr>
                  )}

                  {/* Period headers */}
                  <tr>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      padding: '8px',
                      borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                      color: '#94a3b8',
                      fontWeight: '500',
                      textAlign: 'left',
                      fontSize: '11px',
                      zIndex: 20
                    }}>
                      {!deltaMode && 'Line Item'}
                    </th>
                    {(deltaMode ? [{ key: 'withActions' }, { key: 'withoutActions' }] : [{ key: 'single' }]).map(actionMode => {
                      return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                        const period = periodRange[0] + periodIdx
                        const scenarioCount = selectedScenarios.size
                        return (
                          <th key={`${actionMode.key}-period-${period}`} colSpan={scenarioCount} style={{
                            padding: '8px',
                            borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                            backgroundColor: 'rgba(30, 41, 59, 0.4)',
                            color: '#a5b4fc',
                            fontWeight: '600',
                            textAlign: 'center',
                            fontSize: '11px'
                          }}>
                            Period {period}
                          </th>
                        )
                      })
                    })}
                  </tr>

                  {/* Scenario headers */}
                  <tr>
                    <th style={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      padding: '8px',
                      borderBottom: '2px solid rgba(100, 116, 139, 0.5)',
                      zIndex: 20
                    }}></th>
                    {(deltaMode ? [{ key: 'withActions' }, { key: 'withoutActions' }] : [{ key: 'single' }]).map(actionMode => {
                      return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                        const period = periodRange[0] + periodIdx
                        return Array.from(selectedScenarios).map(scenarioId => {
                          const scenario = scenarios.find(s => s.scenario_id === scenarioId)
                          const colKey = `${actionMode.key}-${scenarioId}-${period}`
                          const isCollapsed = collapsedColumns.has(colKey)
                          return (
                            <th
                              key={colKey}
                              data-cell
                              style={{
                                padding: '8px 4px',
                                borderBottom: '2px solid rgba(100, 116, 139, 0.5)',
                                backgroundColor: 'rgba(30, 41, 59, 0.3)',
                                color: '#c4b5fd',
                                fontWeight: '500',
                                textAlign: 'center',
                                fontSize: '10px',
                                cursor: 'pointer',
                                minWidth: isCollapsed ? '30px' : '80px'
                              }}
                              onClick={() => toggleColumnCollapsed(colKey)}
                            >
                              {isCollapsed ? (
                                <ChevronRight style={{ width: '14px', height: '14px', margin: '0 auto' }} />
                              ) : (
                                scenario?.name || `S${scenarioId}`
                              )}
                            </th>
                          )
                        })
                      })
                    })}
                  </tr>
                </thead>

                {/* Table Body: Entities → Sections → Line Items */}
                <tbody>
                  {getEntitiesWithParents(Array.from(selectedEntities)).map(entityId => {
                    const entity = getEntityById(entityId)
                    if (!entity) return null
                    const isParent = isParentEntity(entityId)
                    const isExpanded = expandedEntities.has(entityId)
                    const hasData = resultData[entityId]

                    // Get first available section data for this entity
                    const firstScenarioId = Array.from(selectedScenarios)[0]
                    const firstPeriod = periodRange[0]
                    const sections = hasData?.[firstScenarioId]?.[firstPeriod]?.withActions || []

                    return (
                      <React.Fragment key={`entity-${entityId}`}>
                        {/* Entity Header Row */}
                        <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.15)' }}>
                          <td
                            data-cell
                            style={{
                              position: 'sticky',
                              left: 0,
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              padding: '10px 8px',
                              borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                              color: '#fff',
                              fontWeight: '700',
                              fontSize: '13px',
                              cursor: 'pointer',
                              zIndex: 10
                            }}
                            onClick={() => toggleEntityExpanded(entityId)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {isExpanded ? (
                                <ChevronDown style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                              ) : (
                                <ChevronRight style={{ width: '16px', height: '16px', marginRight: '6px' }} />
                              )}
                              <Building2 style={{ width: '16px', height: '16px', marginRight: '8px', color: '#06b6d4' }} />
                              {entity.name}
                              {isParent && <span style={{ marginLeft: '8px', fontSize: '10px', color: '#94a3b8' }}>(rollup)</span>}
                            </div>
                          </td>
                          {(deltaMode ? [{ key: 'withActions' }, { key: 'withoutActions' }] : [{ key: 'single' }]).map(actionMode => {
                            return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                              const period = periodRange[0] + periodIdx
                              return Array.from(selectedScenarios).map(scenarioId => {
                                const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                const isCollapsed = collapsedColumns.has(colKey)
                                if (isCollapsed) {
                                  return <td key={colKey} data-cell style={{ padding: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(100, 116, 139, 0.3)' }}></td>
                                }
                                return <td key={colKey} data-cell style={{ padding: '4px', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '1px solid rgba(100, 116, 139, 0.3)' }}></td>
                              })
                            })
                          })}
                        </tr>

                        {/* Sections and Line Items */}
                        {isExpanded && sections.map(section => {
                          const sectionKey = `${entityId}-${section.name}`
                          const isSectionExpanded = expandedSections.has(sectionKey)

                          return (
                            <React.Fragment key={sectionKey}>
                              {/* Section Header Row */}
                              <tr style={{ backgroundColor: 'rgba(100, 116, 139, 0.1)' }}>
                                <td
                                  data-cell
                                  style={{
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: 'rgba(30, 41, 59, 0.7)',
                                    padding: '8px 8px 8px 24px',
                                    borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                                    color: '#c4b5fd',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    zIndex: 10
                                  }}
                                  onClick={() => toggleSectionExpanded(entityId, section.name)}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {isSectionExpanded ? (
                                      <ChevronDown style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                                    ) : (
                                      <ChevronRight style={{ width: '14px', height: '14px', marginRight: '6px' }} />
                                    )}
                                    {section.name}
                                  </div>
                                </td>
                                {(deltaMode ? [{ key: 'withActions' }, { key: 'withoutActions' }] : [{ key: 'single' }]).map(actionMode => {
                                  return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                                    const period = periodRange[0] + periodIdx
                                    return Array.from(selectedScenarios).map(scenarioId => {
                                      const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                      const isCollapsed = collapsedColumns.has(colKey)
                                      if (isCollapsed) {
                                        return <td key={colKey} data-cell style={{ padding: '4px', backgroundColor: 'rgba(100, 116, 139, 0.05)', borderBottom: '1px solid rgba(100, 116, 139, 0.2)' }}></td>
                                      }
                                      return <td key={colKey} data-cell style={{ padding: '4px', backgroundColor: 'rgba(100, 116, 139, 0.05)', borderBottom: '1px solid rgba(100, 116, 139, 0.2)' }}></td>
                                    })
                                  })
                                })}
                              </tr>

                              {/* Line Item Rows */}
                              {isSectionExpanded && section.items.map(lineItem => {
                                const lineItemKey = `${entityId}-${lineItem.code}`
                                const isLineItemExpanded = expandedLineItems.has(lineItemKey)

                                return (
                                  <React.Fragment key={lineItemKey}>
                                    {/* Line Item Row */}
                                    <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.3)' }}>
                                      <td
                                        data-cell
                                        style={{
                                          position: 'sticky',
                                          left: 0,
                                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                                          padding: '6px 8px 6px 40px',
                                          borderBottom: '1px solid rgba(100, 116, 139, 0.15)',
                                          color: '#e2e8f0',
                                          fontSize: '11px',
                                          cursor: lineItem.is_computed ? 'pointer' : 'default',
                                          zIndex: 10
                                        }}
                                        onClick={() => lineItem.is_computed && toggleLineItemExpanded(entityId, lineItem.code)}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          {lineItem.is_computed && (
                                            isLineItemExpanded ? (
                                              <ChevronDown style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                                            ) : (
                                              <ChevronRight style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                                            )
                                          )}
                                          {lineItem.display_name}
                                        </div>
                                      </td>
                                      {(deltaMode ? [{ key: 'withActions', withActions: true }, { key: 'withoutActions', withActions: false }] : [{ key: 'single', withActions: true }]).map(actionMode => {
                                        return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                                          const period = periodRange[0] + periodIdx
                                          return Array.from(selectedScenarios).map(scenarioId => {
                                            const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                            const isCollapsed = collapsedColumns.has(colKey)
                                            if (isCollapsed) {
                                              return <td key={colKey} data-cell style={{ padding: '4px', borderBottom: '1px solid rgba(100, 116, 139, 0.15)' }}></td>
                                            }

                                            let value = 0
                                            if (isParent) {
                                              value = getRolledUpValue(entityId, scenarioId, period, lineItem.code, actionMode.withActions ?? true)
                                            } else {
                                              const data = resultData[entityId]?.[scenarioId]?.[period]
                                              if (data) {
                                                const sections = actionMode.withActions ? data.withActions : data.withoutActions
                                                const foundSection = sections.find(s => s.name === section.name)
                                                const foundItem = foundSection?.items.find(i => i.code === lineItem.code)
                                                value = foundItem?.value || 0
                                              }
                                            }

                                            return (
                                              <td key={colKey} data-cell style={{
                                                padding: '6px 8px',
                                                borderBottom: '1px solid rgba(100, 116, 139, 0.15)',
                                                textAlign: 'right',
                                                color: '#e2e8f0',
                                                fontFamily: 'monospace',
                                                fontSize: '11px'
                                              }}>
                                                {formatValue(value)}
                                              </td>
                                            )
                                          })
                                        })
                                      })}
                                    </tr>

                                    {/* Driver Decomposition Rows */}
                                    {isLineItemExpanded && lineItem.is_computed && (
                                      <>
                                        {(() => {
                                          const firstScenarioId = Array.from(selectedScenarios)[0]
                                          const firstPeriod = periodRange[0]
                                          const drivers = driverData[entityId]?.[firstScenarioId]?.[firstPeriod]?.[lineItem.code]?.withActions || []

                                          return drivers.map(driver => (
                                            <tr key={`${lineItemKey}-driver-${driver.driver_code}`} style={{ backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
                                              <td
                                                data-cell
                                                style={{
                                                  position: 'sticky',
                                                  left: 0,
                                                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                                  padding: '4px 8px 4px 56px',
                                                  borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
                                                  color: '#c4b5fd',
                                                  fontSize: '10px',
                                                  fontStyle: 'italic',
                                                  zIndex: 10
                                                }}
                                              >
                                                {driver.driver_name}
                                              </td>
                                              {(deltaMode ? [{ key: 'withActions', withActions: true }, { key: 'withoutActions', withActions: false }] : [{ key: 'single', withActions: true }]).map(actionMode => {
                                                return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                                                  const period = periodRange[0] + periodIdx
                                                  return Array.from(selectedScenarios).map(scenarioId => {
                                                    const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                                    const isCollapsed = collapsedColumns.has(colKey)
                                                    if (isCollapsed) {
                                                      return <td key={colKey} data-cell style={{ padding: '4px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)' }}></td>
                                                    }

                                                    const driverValue = driverData[entityId]?.[scenarioId]?.[period]?.[lineItem.code]
                                                    const drivers = actionMode.withActions ? driverValue?.withActions : driverValue?.withoutActions
                                                    const foundDriver = drivers?.find(d => d.driver_code === driver.driver_code)
                                                    const value = foundDriver?.value || 0

                                                    return (
                                                      <td key={colKey} data-cell style={{
                                                        padding: '4px 8px',
                                                        borderBottom: '1px solid rgba(100, 116, 139, 0.1)',
                                                        textAlign: 'right',
                                                        color: '#c4b5fd',
                                                        fontFamily: 'monospace',
                                                        fontSize: '10px'
                                                      }}>
                                                        {formatValue(value)}
                                                      </td>
                                                    )
                                                  })
                                                })
                                              })}
                                            </tr>
                                          ))
                                        })()}
                                      </>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Insights Panel */}
      {aiInsights && (
        <Card style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginTop: '32px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Sparkles style={{ width: '20px', height: '20px', marginRight: '12px', color: '#8b5cf6', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#c4b5fd', marginBottom: '8px' }}>
                  AI Insights
                </h3>
                <p style={{ fontSize: '13px', color: '#e9d5ff', lineHeight: '1.6', margin: 0 }}>
                  {aiInsights}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
