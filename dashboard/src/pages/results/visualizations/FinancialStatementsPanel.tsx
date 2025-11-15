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
  has_drivers?: boolean
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

interface ManagementAction {
  action_code: string
  name: string
  description?: string
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
  const tableRef = useRef<HTMLDivElement>(null)

  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<Set<number>>(new Set())
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntities, setSelectedEntities] = useState<Set<number>>(new Set())
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [periodRange, setPeriodRange] = useState<[number, number]>([0, 0])
  const [maxPeriod, setMaxPeriod] = useState(0)
  const [deltaMode, setDeltaMode] = useState(false)
  const [lastRunMode, setLastRunMode] = useState<{ whatIfMode: boolean } | null>(null)
  const [managementActions, setManagementActions] = useState<ManagementAction[]>([])
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set())
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
    if (lastRunMode?.whatIfMode) {
      loadManagementActions()
    }
  }, [lastRunMode])

  useEffect(() => {
    if (selectedScenarios.size > 0 && selectedEntities.size > 0) {
      loadAllResults()
    }
  }, [selectedScenarios, selectedEntities, periodRange, deltaMode, selectedActions])

  const checkLastRunMode = () => {
    const saved = localStorage.getItem('lastRunMode')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLastRunMode(parsed)
        // Don't auto-enable delta mode - let user toggle it
        // setDeltaMode(parsed.whatIfMode === true)
        logger.debug('Last run mode:', parsed)
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
      data.forEach((e: any) => {
        entityMap.set(e.entity_id, {
          entity_id: e.entity_id,
          code: e.entity_code,
          name: e.entity_name,
          granularity_level: e.level,
          parent_entity_id: e.parent_id,
          children: []
        })
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
      logger.debug('Loaded entities:', rootEntities)
      // Auto-select all parent (root) entities by default
      const parentEntityIds = rootEntities.map(e => e.entity_id)
      setSelectedEntities(new Set(parentEntityIds))
      logger.debug('Auto-selected parent entities:', parentEntityIds)
    } catch (error) {
      logger.error('Error loading entities:', error)
    }
  }

  const loadMaxPeriod = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const firstScenarioId = Array.from(selectedScenarios)[0]
      // Query actual max period from database
      const response = await fetch(apiUrl(`/api/results/max-period?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${firstScenarioId}`))
      if (!response.ok) throw new Error('Failed to load max period')
      const data = await response.json()
      const maxPeriodValue = data.maxPeriod || 5
      setMaxPeriod(maxPeriodValue)
      setPeriodRange([0, maxPeriodValue])
    } catch (error) {
      logger.error('Error loading max period:', error)
      // Fallback to reasonable default
      setMaxPeriod(5)
      setPeriodRange([0, 5])
    }
  }

  const loadManagementActions = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(`${apiUrl('/api/management-actions')}?dbPath=${encodeURIComponent(dbPath)}`)
      const actions = await response.json()
      const formattedActions = actions.map((action: any) => ({
        action_code: action.action_code,
        name: action.action_name,
        description: action.description
      }))
      setManagementActions(formattedActions)
    } catch (error) {
      logger.error('Failed to load management actions:', error)
    }
  }

  const buildWhatIfCombination = (selectedActions: Set<string>): string => {
    if (selectedActions.size === 0) {
      return 'BASE'
    }
    const sortedActions = Array.from(selectedActions).sort()
    return sortedActions.join('+')
  }

  const loadAllResults = async () => {
    setLoading(true)
    try {
      const dbPath = getDefaultDbPath()
      const newResultData: ResultData = {}
      const newDriverData: DriverData = {}
      if (selectedEntities.size === 0) return

      // Load data for all selected entities
      for (const entityId of selectedEntities) {
        newResultData[entityId] = {}
        newDriverData[entityId] = {}
        for (const scenarioId of selectedScenarios) {
          newResultData[entityId][scenarioId] = {}
          newDriverData[entityId][scenarioId] = {}
          for (let period = periodRange[0]; period <= periodRange[1]; period++) {
            if (deltaMode && lastRunMode?.whatIfMode) {
              // Delta mode: compare selected actions vs BASE
              const combinationWith = buildWhatIfCombination(selectedActions)
              const combinationWithout = 'BASE'
              const urlWithActions = apiUrl(`/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&whatIfCombination=${encodeURIComponent(combinationWith)}`)
              const urlWithoutActions = apiUrl(`/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&whatIfCombination=${encodeURIComponent(combinationWithout)}`)
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
              // Driver data loaded on-demand when line items are expanded
              newDriverData[entityId][scenarioId][period] = {}
            } else if (lastRunMode?.whatIfMode) {
              // What-if mode without delta: fetch selected action combination only
              const combination = buildWhatIfCombination(selectedActions)
              const url = apiUrl(`/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&whatIfCombination=${encodeURIComponent(combination)}`)
              const res = await fetch(url)
              if (!res.ok) throw new Error('Failed to fetch financial statements')
              const data = await res.json()
              const sections = organizeSections(data.lineItems || [])
              newResultData[entityId][scenarioId][period] = {
                withActions: sections,
                withoutActions: sections
              }
              // Driver data loaded on-demand when line items are expanded
              newDriverData[entityId][scenarioId][period] = {}
            } else {
              // Normal mode: no what-if
              const url = apiUrl(`/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}`)
              const res = await fetch(url)
              if (!res.ok) throw new Error('Failed to fetch financial statements')
              const data = await res.json()
              const sections = organizeSections(data.lineItems || [])
              newResultData[entityId][scenarioId][period] = {
                withActions: sections,
                withoutActions: sections
              }
              // Driver data loaded on-demand when line items are expanded
              newDriverData[entityId][scenarioId][period] = {}
            }
          }
        }
      }
      setResultData(newResultData)
      setDriverData(newDriverData)
      logger.debug('Loaded result data:', newResultData)
    } catch (error) {
      logger.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
  }

  const organizeSections = (lineItems: LineItem[]): Section[] => {
    const sectionMap = new Map<string, Map<string, LineItem>>()

    // Group by section and deduplicate by code (keep last occurrence)
    lineItems.forEach(item => {
      if (!sectionMap.has(item.section)) {
        sectionMap.set(item.section, new Map())
      }
      // Keep the last occurrence of each line item code (overwrite previous)
      const sectionItems = sectionMap.get(item.section)!
      sectionItems.set(item.code, item)
    })

    // Convert to Section array
    const sections = Array.from(sectionMap.entries()).map(([name, itemsMap]) => ({
      name,
      items: Array.from(itemsMap.values())
    }))
    logger.debug('Organized sections:', sections)
    return sections
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
    const entity = getEntityById(entityId)
    return entity !== null && entity.children !== undefined && entity.children.length > 0
  }

  const hasDrivers = (entityId: number, lineItemCode: string): boolean => {
    const firstScenarioId = Array.from(selectedScenarios)[0]
    if (!firstScenarioId) return false
    // Check if any period has drivers for this line item
    for (let p = periodRange[0]; p <= periodRange[1]; p++) {
      const drivers = driverData[entityId]?.[firstScenarioId]?.[p]?.[lineItemCode]?.withActions || []
      if (drivers.length > 0) return true
    }
    return false
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
        // Delta mode: compare selected actions vs BASE
        const combinationWith = buildWhatIfCombination(selectedActions)
        const combinationWithout = 'BASE'
        const urlWithActions = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}&whatIfCombination=${encodeURIComponent(combinationWith)}`)
        const urlWithoutActions = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}&whatIfCombination=${encodeURIComponent(combinationWithout)}`)
        const [resWithActions, resWithoutActions] = await Promise.all([fetch(urlWithActions), fetch(urlWithoutActions)])
        if (!resWithActions.ok || !resWithoutActions.ok) {
          logger.error(`Failed to fetch driver decomposition: withActions=${resWithActions.status}, withoutActions=${resWithoutActions.status}`)
          return
        }
        const dataWithActions = await resWithActions.json()
        const dataWithoutActions = await resWithoutActions.json()
        if (dataWithActions.success && dataWithoutActions.success) {
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
        }
      } else if (lastRunMode?.whatIfMode) {
        // What-if mode without delta: use selected action combination
        const combination = buildWhatIfCombination(selectedActions)
        const url = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}&whatIfCombination=${encodeURIComponent(combination)}`)
        const res = await fetch(url)
        if (!res.ok) {
          logger.error(`Failed to fetch driver decomposition: ${res.status}`)
          return
        }
        const data = await res.json()
        if (data.success) {
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
      } else {
        // Normal mode: no what-if
        const url = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${scenarioId}&period=${period}&entityId=${entityId}&lineItemCode=${lineItemCode}`)
        const res = await fetch(url)
        if (!res.ok) {
          logger.error(`Failed to fetch driver decomposition: ${res.status}`)
          return
        }
        const data = await res.json()
        if (data.success) {
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
      const entityName = entityNames
      const periodText = periodRange[0] === periodRange[1]
        ? `period ${periodRange[0]}`
        : `periods ${periodRange[0]} to ${periodRange[1]}`
      const modeText = deltaMode ? 'with/without actions comparison' : 'absolute values'
      const prompt = `You are a financial analyst reviewing financial statements. Provide a concise analytical summary (3-4 sentences) of the financial statements for:

Scenarios: ${scenarioNames}
Entity: ${entityName}
Time Period: ${periodText}
Display Mode: ${modeText}

Focus on:
1. Overall financial position and trends
2. Key areas of strength or concern
3. Notable changes or patterns across periods/scenarios
4. Strategic insights for decision-makers

Use business-friendly language and avoid excessive financial jargon. Write as a flowing paragraph, not bullet points.`

      const response = await fetch(apiUrl('/api/claude/messages'), {
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
    if (!tableRef.current) return
    try {
      const element = tableRef.current

      // Store original styles for all elements we'll modify
      const table = element.querySelector('table') as HTMLElement
      const headers = element.querySelectorAll('th') as NodeListOf<HTMLElement>
      const cells = element.querySelectorAll('td') as NodeListOf<HTMLElement>
      const chevrons = element.querySelectorAll('svg') as NodeListOf<SVGElement>

      const originalStyles = {
        elementBg: element.style.backgroundColor,
        elementPadding: element.style.padding,
        tableBorder: table?.style.border || '',
        headers: Array.from(headers).map(h => ({ bg: h.style.backgroundColor, color: h.style.color, border: h.style.border })),
        cells: Array.from(cells).map(c => ({ bg: c.style.backgroundColor, color: c.style.color, border: c.style.border })),
        chevrons: Array.from(chevrons).map(c => c.style.display)
      }

      // Apply black-on-white theme
      element.style.backgroundColor = '#ffffff'
      element.style.padding = '24px'

      if (table) {
        table.style.border = '1px solid #333333'
      }

      // Style headers - dark background with white text
      headers.forEach(header => {
        header.style.backgroundColor = '#f8f9fa'
        header.style.color = '#1e293b'
        header.style.border = '1px solid #333333'
      })

      // Style data cells - white background with dark text
      cells.forEach(cell => {
        cell.style.backgroundColor = '#ffffff'
        cell.style.color = '#1e293b'
        cell.style.border = '1px solid #333333'
      })

      // Hide all chevron icons (they don't print well)
      chevrons.forEach(chevron => {
        chevron.style.display = 'none'
      })

      // Wait for style changes to take effect
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture the table
      const dataUrl = await domtoimage.toPng(element, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left' }
      })

      // Restore original styles
      element.style.backgroundColor = originalStyles.elementBg
      element.style.padding = originalStyles.elementPadding

      if (table) {
        table.style.border = originalStyles.tableBorder
      }

      headers.forEach((header, i) => {
        header.style.backgroundColor = originalStyles.headers[i].bg
        header.style.color = originalStyles.headers[i].color
        header.style.border = originalStyles.headers[i].border
      })

      cells.forEach((cell, i) => {
        cell.style.backgroundColor = originalStyles.cells[i].bg
        cell.style.color = originalStyles.cells[i].color
        cell.style.border = originalStyles.cells[i].border
      })

      chevrons.forEach((chevron, i) => {
        chevron.style.display = originalStyles.chevrons[i]
      })

      // Build caption
      const scenarioNames = Array.from(selectedScenarios).map((id, idx) =>
        `Scenario ${idx + 1}`
      ).join(', ')
      const entityName = Array.from(selectedEntities).map(id =>
        getEntityById(id)?.name || `Entity ${id}`
      ).join(', ')
      const periodText = periodRange[0] === periodRange[1]
        ? `Period ${periodRange[0]}`
        : `Periods ${periodRange[0]}-${periodRange[1]}`
      const caption = `Financial Statements: ${scenarioNames} | ${entityName} | ${periodText}${deltaMode ? ' | With/Without Actions' : ''}`

      // Save snippet
      const snippet = {
        id: `financial-statements-${Date.now()}`,
        type: 'visualization' as const,
        source: 'financial-statements' as const,
        imageData: dataUrl,
        caption,
        aiText: aiInsights || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))

      logger.debug('Added financial statements to report')

      // Show success message
      alert('✓ Financial Statements added to Report!\n\nGo to the Report page to view and edit your capture.')
    } catch (error) {
      logger.error('Error adding to report:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const formatValue = (value: number): string => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
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
      if (newSet.has(entityId)) {
        newSet.delete(entityId)
      } else {
        newSet.add(entityId)
        // Auto-select parent entities when child is selected
        const entity = getEntityById(entityId)
        if (entity && entity.parent_entity_id) {
          let parentId = entity.parent_entity_id
          while (parentId) {
            newSet.add(parentId)
            const parent = getEntityById(parentId)
            parentId = parent?.parent_entity_id || null
          }
        }
      }
      return newSet
    })
  }

  const toggleNode = (nodeId: number) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) newSet.delete(nodeId)
      else newSet.add(nodeId)
      return newSet
    })
  }

  const renderEntityTree = (entities: Entity[], level = 0): React.ReactElement => {
    return (
      <div style={{ marginLeft: level > 0 ? '24px' : '0px' }}>
        {entities.map((entity) => {
          const hasChildren = entity.children && entity.children.length > 0
          const isExpanded = expandedNodes.has(entity.entity_id)
          const isSelected = selectedEntities.has(entity.entity_id)

          return (
            <div key={entity.entity_id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)'}`,
                  borderRadius: '4px',
                  marginBottom: '4px',
                  cursor: 'pointer'
                }}
                onClick={() => handleEntityToggle(entity.entity_id)}
              >
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleNode(entity.entity_id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '6px', padding: 0 }}
                  >
                    {isExpanded ? (
                      <ChevronDown style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                    ) : (
                      <ChevronRight style={{ width: '14px', height: '14px', color: '#94a3b8' }} />
                    )}
                  </button>
                )}
                <Building2 style={{ width: '14px', height: '14px', marginRight: '8px', color: '#06b6d4', marginLeft: hasChildren ? 0 : '20px' }} />
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{entity.name}</span>
              </div>
              {hasChildren && isExpanded && renderEntityTree(entity.children, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  logger.debug('FinancialStatementsPanel rendered')

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

            {/* Control Panel */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: lastRunMode?.whatIfMode ? '300px 300px 1fr' : '300px 300px 300px',
              gap: '16px',
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
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {scenarios.map(scenario => {
                    const isSelected = selectedScenarios.has(scenario.scenario_id)
                    return (
                      <div key={scenario.scenario_id} style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{scenario.name}</span>
                        <div
                          onClick={() => handleScenarioToggle(scenario.scenario_id)}
                          style={{
                            width: '44px',
                            height: '24px',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(100, 116, 139, 0.3)',
                            borderRadius: '12px',
                            position: 'relative',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(100, 116, 139, 0.5)'}`
                          }}
                        >
                          <div style={{
                            width: '18px',
                            height: '18px',
                            backgroundColor: '#fff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: isSelected ? '22px' : '2px',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }} />
                        </div>
                      </div>
                    )
                  })}
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
                  Entity
                </h3>
                <div style={{
                  maxHeight: '150px',
                  overflowY: 'auto',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)'
                }}>
                  {entities.length > 0 ? renderEntityTree(entities, 0) : (
                    <div style={{ color: '#94a3b8', fontSize: '12px', padding: '6px' }}>
                      No entities available
                    </div>
                  )}
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
                    min="0"
                    max={maxPeriod}
                    value={periodRange[0]}
                    onChange={(e) => setPeriodRange([parseInt(e.target.value), Math.max(parseInt(e.target.value), periodRange[1])])}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={maxPeriod}
                    value={periodRange[1]}
                    onChange={(e) => setPeriodRange([periodRange[0], Math.max(periodRange[0], parseInt(e.target.value))])}
                    style={{ width: '100%' }}
                  />
                </div>
                {lastRunMode?.whatIfMode && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0', marginBottom: '8px' }}>
                        Select Actions for "With Actions":
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                        {managementActions.map(action => {
                          const isActive = selectedActions.has(action.action_code)
                          return (
                            <div
                              key={action.action_code}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '10px 14px',
                                backgroundColor: 'rgba(51, 65, 85, 0.3)',
                                border: '1px solid rgba(100, 116, 139, 0.3)',
                                borderRadius: '6px',
                                minWidth: '280px',
                                transition: 'all 0.2s'
                              }}
                            >
                              <div style={{ flex: 1, marginRight: '12px' }}>
                                <div style={{ fontSize: '13px', fontWeight: '500', color: '#fff' }}>
                                  {action.name}
                                </div>
                                {action.description && (
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {action.description}
                                  </div>
                                )}
                              </div>
                              <div
                                onClick={() => {
                                  const newActions = new Set(selectedActions)
                                  if (isActive) {
                                    newActions.delete(action.action_code)
                                  } else {
                                    newActions.add(action.action_code)
                                  }
                                  setSelectedActions(newActions)
                                }}
                                style={{
                                  width: '48px',
                                  height: '24px',
                                  backgroundColor: isActive ? '#a855f7' : 'rgba(100, 116, 139, 0.5)',
                                  borderRadius: '12px',
                                  position: 'relative',
                                  cursor: 'pointer',
                                  transition: 'all 0.3s',
                                  flexShrink: 0
                                }}
                              >
                                <div
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '50%',
                                    position: 'absolute',
                                    top: '2px',
                                    left: isActive ? '26px' : '2px',
                                    transition: 'left 0.3s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                  }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(100, 116, 139, 0.3)' }}>
                      <span style={{ fontSize: '13px', color: '#e2e8f0', marginRight: '12px' }}>
                        Show Comparison (With vs Without)
                      </span>
                      <div
                        onClick={() => setDeltaMode(!deltaMode)}
                        style={{
                          width: '48px',
                          height: '24px',
                          backgroundColor: deltaMode ? '#3b82f6' : 'rgba(100, 116, 139, 0.5)',
                          borderRadius: '12px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          flexShrink: 0
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#ffffff',
                            borderRadius: '50%',
                            position: 'absolute',
                            top: '2px',
                            left: deltaMode ? '26px' : '2px',
                            transition: 'left 0.3s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
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
            <div ref={tableRef} style={{ overflowX: 'auto', marginBottom: '20px' }}>
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
                      {[{ key: 'withoutActions', label: 'Without Actions' }, { key: 'withActions', label: 'With Actions' }].map(actionMode => {
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
                    {(deltaMode ? [{ key: 'withoutActions' }, { key: 'withActions' }] : [{ key: 'single' }]).flatMap(actionMode => {
                      return Array.from(selectedScenarios).map((scenarioId, scenarioIdx) => {
                        const periodCount = periodRange[1] - periodRange[0] + 1
                        return (
                          <th key={`${actionMode.key}-scenario-${scenarioId}`} colSpan={periodCount} style={{
                            padding: '8px',
                            borderBottom: '1px solid rgba(100, 116, 139, 0.3)',
                            backgroundColor: 'rgba(30, 41, 59, 0.4)',
                            color: '#a5b4fc',
                            fontWeight: '600',
                            textAlign: 'center',
                            fontSize: '11px'
                          }}>
                            Scenario {scenarioIdx + 1}
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
                    {(deltaMode ? [{ key: 'withoutActions' }, { key: 'withActions' }] : [{ key: 'single' }]).flatMap(actionMode => {
                      return Array.from(selectedScenarios).flatMap((scenarioId, scenarioIdx) => {
                        return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                          const period = periodRange[0] + periodIdx
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
                                `Period ${period}`
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
                  {Array.from(selectedEntities).map(entityId => {
                    const entity = getEntityById(entityId)
                    if (!entity) return null
                    const isParent = isParentEntity(entityId)
                    const isExpanded = expandedEntities.has(entityId)
                    const hasData = resultData[entityId]

                    // Collect all unique sections and line items across all periods in range
                    const firstScenarioId = Array.from(selectedScenarios)[0]
                    const sectionMap = new Map<string, Section>()

                    for (let p = periodRange[0]; p <= periodRange[1]; p++) {
                      const periodSections = hasData?.[firstScenarioId]?.[p]?.withActions || []
                      periodSections.forEach(section => {
                        if (!sectionMap.has(section.name)) {
                          sectionMap.set(section.name, { name: section.name, items: [] })
                        }
                        const existingSection = sectionMap.get(section.name)!
                        section.items.forEach(item => {
                          const existingItemIdx = existingSection.items.findIndex(i => i.code === item.code)
                          if (existingItemIdx === -1) {
                            existingSection.items.push(item)
                          } else {
                            // Merge has_drivers - if any period has drivers, show chevron
                            const existingItem = existingSection.items[existingItemIdx]
                            if (item.has_drivers && !existingItem.has_drivers) {
                              existingItem.has_drivers = true
                            }
                          }
                        })
                      })
                    }

                    const sections = Array.from(sectionMap.values())

                    if (sections.length === 0) {
                      logger.debug(`No sections for entity ${entityId}, scenario ${firstScenarioId} across periods ${periodRange[0]}-${periodRange[1]}`)
                    }

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
                          {(deltaMode ? [{ key: 'withoutActions' }, { key: 'withActions' }] : [{ key: 'single' }]).flatMap(actionMode => {
                            return [...Array(periodRange[1] - periodRange[0] + 1)].flatMap((_, periodIdx) => {
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
                                {(deltaMode ? [{ key: 'withoutActions' }, { key: 'withActions' }] : [{ key: 'single' }]).flatMap(actionMode => {
                                  return [...Array(periodRange[1] - periodRange[0] + 1)].flatMap((_, periodIdx) => {
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
                                // Only show chevron if line item has actual driver data in database
                                const canExpand = lineItem.has_drivers === true

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
                                          cursor: canExpand ? 'pointer' : 'default',
                                          zIndex: 10
                                        }}
                                        onClick={() => canExpand && toggleLineItemExpanded(entityId, lineItem.code)}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                          {canExpand ? (
                                            isLineItemExpanded ? (
                                              <ChevronDown style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                                            ) : (
                                              <ChevronRight style={{ width: '12px', height: '12px', marginRight: '6px' }} />
                                            )
                                          ) : (
                                            <span style={{ width: '18px', display: 'inline-block' }} />
                                          )}
                                          {lineItem.display_name}
                                        </div>
                                      </td>
                                      {(deltaMode ? [{ key: 'withoutActions', withActions: false }, { key: 'withActions', withActions: true }] : [{ key: 'single', withActions: true }]).flatMap(actionMode => {
                                        return Array.from(selectedScenarios).flatMap(scenarioId => {
                                          return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                                            const period = periodRange[0] + periodIdx
                                            const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                            const isCollapsed = collapsedColumns.has(colKey)
                                            if (isCollapsed) {
                                              return <td key={colKey} data-cell style={{ padding: '4px', borderBottom: '1px solid rgba(100, 116, 139, 0.15)' }}></td>
                                            }

                                            let value = 0
                                            let hasValue = false
                                            const data = resultData[entityId]?.[scenarioId]?.[period]
                                            if (data) {
                                              const sections = actionMode.withActions ? data.withActions : data.withoutActions
                                              const foundSection = sections.find(s => s.name === section.name)
                                              const foundItem = foundSection?.items.find(i => i.code === lineItem.code)
                                              if (foundItem !== undefined) {
                                                hasValue = true
                                                value = foundItem.value
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
                                                {hasValue ? formatValue(value) : '-'}
                                              </td>
                                            )
                                          })
                                        })
                                      })}
                                    </tr>

                                    {/* Driver Decomposition Rows */}
                                    {isLineItemExpanded && lineItem.has_drivers && (
                                      <>
                                        {(() => {
                                          const firstScenarioId = Array.from(selectedScenarios)[0]
                                          // Collect all unique drivers across all periods in range
                                          const driverMap = new Map<string, DriverContribution>()
                                          for (let p = periodRange[0]; p <= periodRange[1]; p++) {
                                            // Check both withActions and withoutActions to get all driver names
                                            const withActionsDrivers = driverData[entityId]?.[firstScenarioId]?.[p]?.[lineItem.code]?.withActions || []
                                            const withoutActionsDrivers = driverData[entityId]?.[firstScenarioId]?.[p]?.[lineItem.code]?.withoutActions || []
                                            withActionsDrivers.forEach(driver => {
                                              if (!driverMap.has(driver.driver_code)) {
                                                driverMap.set(driver.driver_code, driver)
                                              }
                                            })
                                            withoutActionsDrivers.forEach(driver => {
                                              if (!driverMap.has(driver.driver_code)) {
                                                driverMap.set(driver.driver_code, driver)
                                              }
                                            })
                                          }
                                          const drivers = Array.from(driverMap.values())

                                          // Only render rows if there are actually drivers
                                          if (drivers.length === 0) return null

                                          return drivers.map((driver, driverIdx) => (
                                            <tr key={`${lineItemKey}-driver-${driver.driver_code}-${driverIdx}`} style={{ backgroundColor: 'rgba(139, 92, 246, 0.05)' }}>
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
                                              {(deltaMode ? [{ key: 'withoutActions', withActions: false }, { key: 'withActions', withActions: true }] : [{ key: 'single', withActions: true }]).flatMap(actionMode => {
                                                return Array.from(selectedScenarios).flatMap((scenarioId) => {
                                                  return [...Array(periodRange[1] - periodRange[0] + 1)].map((_, periodIdx) => {
                                                    const period = periodRange[0] + periodIdx
                                                    const colKey = `${actionMode.key}-${scenarioId}-${period}`
                                                    const isCollapsed = collapsedColumns.has(colKey)
                                                    if (isCollapsed) {
                                                      return <td key={colKey} data-cell style={{ padding: '4px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)' }}></td>
                                                    }

                                                    const driverValue = driverData[entityId]?.[scenarioId]?.[period]?.[lineItem.code]
                                                    const drivers = actionMode.withActions ? driverValue?.withActions : driverValue?.withoutActions
                                                    const foundDriver = drivers?.find(d => d.driver_code === driver.driver_code)
                                                    const hasValue = foundDriver !== undefined
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
                                                        {hasValue ? formatValue(value) : '-'}
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
      {(selectedScenarios.size > 0 && selectedEntities.size > 0) && (
        <Card style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          marginTop: '32px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Sparkles style={{ width: '20px', height: '20px', marginRight: '12px', color: '#8b5cf6', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#c4b5fd', margin: 0 }}>
                    AI Insights
                  </h3>
                  <button
                    onClick={generateAiInsights}
                    disabled={aiLoading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#8b5cf6',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: aiLoading ? 'not-allowed' : 'pointer',
                      opacity: aiLoading ? 0.6 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    {aiLoading ? (
                      <>
                        <span style={{
                          display: 'inline-block',
                          width: '12px',
                          height: '12px',
                          border: '2px solid #fff',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite',
                          marginRight: '6px'
                        }}></span>
                        Generating...
                      </>
                    ) : 'Generate Insights'}
                  </button>
                </div>
                {aiInsights && (
                  <p style={{ fontSize: '13px', color: '#e9d5ff', lineHeight: '1.6', margin: 0 }}>
                    {aiInsights}
                  </p>
                )}
                {!aiInsights && !aiLoading && (
                  <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                    Click "Generate Insights" to get AI-powered analysis of the financial statements.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
