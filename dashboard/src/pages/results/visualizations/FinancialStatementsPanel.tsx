import { useState, useEffect, useRef } from 'react'
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

  logger.log('FinancialStatementsPanel: Component loaded - showing placeholder')
  
  return (
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '60px' }}>
            <FileText style={{ width: '48px', height: '48px', margin: '0 auto 16px', color: '#06b6d4' }} />
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
              Financial Statements - Under Reconstruction
            </h2>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>
              This page is being rebuilt with enhanced features:
            </p>
            <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto', lineHeight: '2', fontSize: '13px' }}>
              <li>✓ Multi-scenario selection and comparison</li>
              <li>✓ Multi-entity selection with automatic parent rollups</li>
              <li>✓ Period range selector (two-ended slider)</li>
              <li>✓ Enhanced expand/collapse for entities, sections, and line items</li>
              <li>✓ Driver decomposition on computed line items</li>
              <li>✓ Column collapse/expand functionality</li>
              <li>✓ Delta mode (With/Without Actions)</li>
              <li>✓ AI-powered insights generation</li>
              <li>✓ Export to Report with professional formatting</li>
            </ul>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '24px' }}>
              The original version has been backed up. Full implementation coming soon.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
