import { useState, useEffect } from 'react'
import { logger } from '@/utils/logger'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiUrl, getDefaultDbPath } from '@/config'

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
  action_id: number
  action_code: string
  action_name: string
  action_category: string
  description: string
  is_active: number
  is_mac_relevant: number
}

export default function ViewResults() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [currentScenario, setCurrentScenario] = useState<number | null>(null)
  const [periods, setPeriods] = useState<number[]>([])
  const [currentPeriod, setCurrentPeriod] = useState(1)
  const [entities, setEntities] = useState<Entity[]>([])
  const [currentEntity, setCurrentEntity] = useState<number | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [expandedLineItems, setExpandedLineItems] = useState<Set<string>>(new Set())
  const [driverData, setDriverData] = useState<Map<string, DriverContribution[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [lastRunMode, setLastRunMode] = useState<{ stochasticMode: boolean; whatIfMode: boolean; mcStartPeriod?: number } | null>(null)

  // What-if mode controls
  const [displayMode, setDisplayMode] = useState<'absolute' | 'delta'>('absolute')
  const [displayedActions, setDisplayedActions] = useState<Set<string>>(new Set())
  const [baseCaseActions, setBaseCaseActions] = useState<Set<string>>(new Set())
  const [managementActions, setManagementActions] = useState<ManagementAction[]>([])

  // MAC mode controls
  const [macModeActive, setMacModeActive] = useState(false)
  const [macStartPeriod, setMacStartPeriod] = useState(1)
  const [macEndPeriod, setMacEndPeriod] = useState(1)

  // MAC results data
  interface MacResult {
    action: string
    carbonAbatement: number
    cost: number
    mac: number | null
  }
  const [macResults, setMacResults] = useState<MacResult[]>([])
  const [macLoading, setMacLoading] = useState(false)

  // ROI mode controls
  const [roiModeActive, setRoiModeActive] = useState(false)
  const [roiStartPeriod, setRoiStartPeriod] = useState(1)
  const [roiEndPeriod, setRoiEndPeriod] = useState(1)

  // ROI results data
  interface RoiResult {
    action: string
    investment: number
    benefit: number
    roi: number | null
  }
  const [roiResults, setRoiResults] = useState<RoiResult[]>([])
  const [roiLoading, setRoiLoading] = useState(false)

  // MC results data
  interface McLineItem {
    code: string
    meanValue: number
  }
  const [mcResults, setMcResults] = useState<{mcPeriod: number; numDraws: number; lineItems: McLineItem[]} | null>(null)
  const [mcLoading, setMcLoading] = useState(false)

  // MC distribution data for selected line item
  interface McDistribution {
    lineItemCode: string
    numDraws: number
    draws: Array<{drawNumber: number; value: number}>
    statistics: {
      mean: number
      median: number
      std: number
      skew: number
      kurtosis: number
      min: number
      max: number
    }
    percentiles: {
      p5: number
      p25: number
      p50: number
      p75: number
      p95: number
    }
  }
  const [selectedMcLineItem, setSelectedMcLineItem] = useState<string | null>(null)
  const [mcDistribution, setMcDistribution] = useState<McDistribution | null>(null)
  const [mcDistLoading, setMcDistLoading] = useState(false)
  const [hoveredDraw, setHoveredDraw] = useState<{drawNumber: number; value: number} | null>(null)
  const [hoverPos, setHoverPos] = useState<{x: number; y: number} | null>(null)
  const [hoveredPercentile, setHoveredPercentile] = useState<string | null>(null)

  // Load available scenarios, periods, entities, and initial data
  useEffect(() => {
    loadScenarios()
    loadEntities()

    // Load last run mode from localStorage
    const saved = localStorage.getItem('lastRunMode')
    if (saved) {
      try {
        setLastRunMode(JSON.parse(saved))
      } catch (err) {
        logger.error('Failed to load last run mode:', err)
      }
    }
  }, [])

  // Load management actions when in what-if mode
  useEffect(() => {
    if (lastRunMode?.whatIfMode) {
      loadManagementActions()
    }
  }, [lastRunMode])

  // Reload results when what-if controls change
  useEffect(() => {
    if (lastRunMode?.whatIfMode && currentEntity !== null) {
      loadResultsForPeriod(currentPeriod, currentEntity)
    }
  }, [displayedActions, baseCaseActions, displayMode])

  // Reload periods when scenario changes
  useEffect(() => {
    if (currentScenario !== null) {
      loadPeriods()
    }
  }, [currentScenario])

  // Load data when period or entity changes
  useEffect(() => {
    if (periods.length > 0) {
      loadResultsForPeriod(currentPeriod, currentEntity)
    }
  }, [currentPeriod, currentEntity, periods])

  // Load MAC curve data when MAC mode is active
  useEffect(() => {
    if (macModeActive && currentScenario !== null && currentEntity !== null && periods.length > 0) {
      loadMacCurve()
    }
  }, [macModeActive, macStartPeriod, macEndPeriod, currentScenario, currentEntity])

  // Load ROI curve data when ROI mode is active
  useEffect(() => {
    if (roiModeActive && currentScenario !== null && currentEntity !== null && periods.length > 0) {
      loadRoiCurve()
    }
  }, [roiModeActive, roiStartPeriod, roiEndPeriod, currentScenario, currentEntity])

  // Load MC results when stochastic mode was used
  useEffect(() => {
    if (lastRunMode?.stochasticMode && currentScenario !== null && currentEntity !== null && periods.length > 0) {
      loadMcResults()
    }
  }, [lastRunMode, currentScenario, currentEntity, periods])

  const loadScenarios = async () => {
    const dbPath = getDefaultDbPath()
    try {
      const response = await fetch(apiUrl(`/api/results/scenarios?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()

      if (data.success && data.scenarios.length > 0) {
        setScenarios(data.scenarios)
        // Default to first scenario with multi-period data
        const multiPeriodScenario = data.scenarios.find((s: Scenario) => s.num_periods > 1)
        if (multiPeriodScenario) {
          setCurrentScenario(multiPeriodScenario.scenario_id)
        } else {
          setCurrentScenario(data.scenarios[0].scenario_id)
        }
      }
    } catch (error) {
      logger.error('Error loading scenarios:', error)
    }
  }

  const loadPeriods = async () => {
    const dbPath = getDefaultDbPath()
    try {
      let url = apiUrl(`/api/results/periods?dbPath=${encodeURIComponent(dbPath)}`)
      if (currentScenario !== null) {
        url += `&scenarioId=${currentScenario}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.periods.length > 0) {
        setPeriods(data.periods)
        setCurrentPeriod(data.periods[0])
      }
    } catch (error) {
      logger.error('Error loading periods:', error)
    }
  }

  const loadManagementActions = async () => {
    const dbPath = getDefaultDbPath()
    try {
      const response = await fetch(apiUrl(`/api/management-actions?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()

      if (data && Array.isArray(data)) {
        setManagementActions(data)
      }
    } catch (error) {
      logger.error('Error loading management actions:', error)
    }
  }

  const loadMacCurve = async () => {
    if (currentScenario === null || currentEntity === null) return

    setMacLoading(true)
    const dbPath = getDefaultDbPath()

    try {
      const url = apiUrl(`/api/results/mac-curve?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}&startPeriod=${macStartPeriod}&endPeriod=${macEndPeriod}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.macCurve) {
        setMacResults(data.macCurve)
      } else {
        logger.error('Failed to load MAC curve:', data.error)
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
    if (currentScenario === null || currentEntity === null) return

    setRoiLoading(true)
    const dbPath = getDefaultDbPath()

    try {
      const url = apiUrl(`/api/results/roi-curve?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}&startPeriod=${roiStartPeriod}&endPeriod=${roiEndPeriod}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.roiCurve) {
        setRoiResults(data.roiCurve)
      } else {
        logger.error('Failed to load ROI curve:', data.error)
        setRoiResults([])
      }
    } catch (error) {
      logger.error('Error loading ROI curve:', error)
      setRoiResults([])
    } finally {
      setRoiLoading(false)
    }
  }

  const loadMcDistribution = async (lineItemCode: string) => {
    if (currentScenario === null || currentEntity === null || !mcResults) return

    setMcDistLoading(true)
    setSelectedMcLineItem(lineItemCode)
    const dbPath = getDefaultDbPath()

    try {
      const url = apiUrl(`/api/results/mc-distribution?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&periodId=${mcResults.mcPeriod}&entityId=${currentEntity}&lineItemCode=${encodeURIComponent(lineItemCode)}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        setMcDistribution(data)
      } else {
        logger.error('Failed to load MC distribution:', data.error)
        setMcDistribution(null)
      }
    } catch (error) {
      logger.error('Error loading MC distribution:', error)
      setMcDistribution(null)
    } finally {
      setMcDistLoading(false)
    }
  }

  const loadMcResults = async () => {
    if (currentScenario === null || currentEntity === null || periods.length === 0) return

    setMcLoading(true)
    const dbPath = getDefaultDbPath()

    // MC period is exactly mcStartPeriod (slider value = actual MC period)
    const mcStartPeriod = lastRunMode?.mcStartPeriod || 3
    const mcPeriod = mcStartPeriod

    try {
      const url = apiUrl(`/api/results/mc-summary?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&periodId=${mcPeriod}&entityId=${currentEntity}`)
      const response = await fetch(url)
      const data = await response.json()

      if (data.success && data.lineItems) {
        setMcResults({
          mcPeriod: data.mcPeriod,
          numDraws: data.numDraws,
          lineItems: data.lineItems
        })
      } else {
        logger.error('Failed to load MC results:', data.error)
        setMcResults(null)
      }
    } catch (error) {
      logger.error('Error loading MC results:', error)
      setMcResults(null)
    } finally {
      setMcLoading(false)
    }
  }

  // Build what-if combination string from selected actions
  const buildWhatIfCombination = (selectedActions: Set<string>): string => {
    if (selectedActions.size === 0) {
      return 'BASE'
    }
    // Sort action codes alphabetically for consistent combination strings
    const sortedActions = Array.from(selectedActions).sort()
    return sortedActions.join('+')
  }

  const buildTree = (flatEntities: Entity[]): Entity[] => {
    const entityMap = new Map<number, Entity>()
    const roots: Entity[] = []

    // First pass: create all entities with children array
    flatEntities.forEach(e => {
      entityMap.set(e.entity_id, {
        ...e,
        children: []
      })
    })

    // Second pass: build tree structure
    flatEntities.forEach(e => {
      const entity = entityMap.get(e.entity_id)!
      if (e.parent_entity_id) {
        const parent = entityMap.get(e.parent_entity_id)
        if (parent) {
          parent.children!.push(entity)
        }
      } else {
        roots.push(entity)
      }
    })

    return roots
  }

  const loadEntities = async () => {
    const dbPath = getDefaultDbPath()
    try {
      const response = await fetch(apiUrl(`/api/results/entities?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()

      if (data.success && data.entities.length > 0) {
        const tree = buildTree(data.entities)
        setEntities(tree)
        // Set default to highest entity_id (root level)
        const maxEntity = Math.max(...data.entities.map((e: Entity) => e.entity_id))
        setCurrentEntity(maxEntity)
        // Expand all root nodes by default
        tree.forEach(e => {
          if (e.entity_id) expandedNodes.add(e.entity_id)
        })
        setExpandedNodes(new Set(expandedNodes))
      }
    } catch (error) {
      logger.error('Error loading entities:', error)
    }
  }

  const loadResultsForPeriod = async (period: number, entityId: number | null) => {
    setLoading(true)
    const dbPath = getDefaultDbPath()
    try {
      let baseUrl = apiUrl(`/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&period=${period}`)
      if (entityId !== null) {
        baseUrl += `&entityId=${entityId}`
      }
      if (currentScenario !== null) {
        baseUrl += `&scenarioId=${currentScenario}`
      }

      // In what-if mode, handle absolute vs delta display
      if (lastRunMode?.whatIfMode) {
        if (displayMode === 'absolute') {
          // Absolute mode: fetch one combination
          const whatIfCombination = buildWhatIfCombination(displayedActions)
          const url = baseUrl + `&whatIfCombination=${encodeURIComponent(whatIfCombination)}`

          const response = await fetch(url)
          const data = await response.json()

          // Debug: Log line items to check sign_convention
          logger.debug('[ViewResults] Received line items:', data.lineItems?.map((li: LineItem) => ({ code: li.code, sign_convention: li.sign_convention, value: li.value })))

          if (data.success) {
            processSectionsData(data.lineItems)
            if (entityId !== null) {
              await loadDriverDataAbsolute(dbPath, period, entityId, data.lineItems, displayedActions)
            }
          }
        } else {
          // Delta mode: fetch both combinations and calculate A - B
          const displayedCombination = buildWhatIfCombination(displayedActions)
          const baseCaseCombination = buildWhatIfCombination(baseCaseActions)

          const urlA = baseUrl + `&whatIfCombination=${encodeURIComponent(displayedCombination)}`
          const urlB = baseUrl + `&whatIfCombination=${encodeURIComponent(baseCaseCombination)}`

          // Fetch both in parallel
          const [responseA, responseB] = await Promise.all([
            fetch(urlA),
            fetch(urlB)
          ])

          const [dataA, dataB] = await Promise.all([
            responseA.json(),
            responseB.json()
          ])

          if (dataA.success && dataB.success) {
            // Build lookup map for base scenario values
            const baseScenarioMap = new Map<string, number>()
            dataB.lineItems.forEach((item: LineItem) => {
              baseScenarioMap.set(item.code, item.value)
            })

            // Calculate delta: A - B for each line item
            const deltaLineItems = dataA.lineItems.map((item: LineItem) => {
              const baseValue = baseScenarioMap.get(item.code) || 0
              return {
                ...item,
                value: item.value - baseValue
              }
            })

            processSectionsData(deltaLineItems)
            if (entityId !== null) {
              await loadDriverDataDelta(dbPath, period, entityId, dataA.lineItems, displayedActions, baseCaseActions)
            }
          }
        }
      } else {
        // Normal mode (no what-if): fetch without filtering
        const response = await fetch(baseUrl)
        const data = await response.json()

        // Debug: Log line items to check sign_convention
        logger.debug('[ViewResults] Received line items:', data.lineItems?.map((li: LineItem) => ({ code: li.code, sign_convention: li.sign_convention, value: li.value })))

        if (data.success) {
          processSectionsData(data.lineItems)
          if (entityId !== null) {
            await loadDriverDataAbsolute(dbPath, period, entityId, data.lineItems, new Set())
          }
        }
      }
    } catch (error) {
      logger.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
  }

  // Helper: Process line items into sections
  const processSectionsData = (lineItems: LineItem[]) => {
    const sectionMap = new Map<string, LineItem[]>()

    lineItems.forEach((item: LineItem) => {
      if (!sectionMap.has(item.section)) {
        sectionMap.set(item.section, [])
      }
      sectionMap.get(item.section)!.push(item)
    })

    // Convert to array of sections
    const sectionsArray: Section[] = Array.from(sectionMap.entries()).map(([name, items]) => ({
      name,
      items
    }))

    setSections(sectionsArray)

    // Expand all sections by default
    setExpandedSections(new Set(sectionsArray.map(s => s.name)))
  }

  // Helper: Load driver data in absolute mode
  const loadDriverDataAbsolute = async (
    dbPath: string,
    period: number,
    entityId: number,
    lineItems: LineItem[],
    selectedActions: Set<string>
  ) => {
    const newDriverData = new Map<string, DriverContribution[]>()
    for (const item of lineItems) {
      try {
        let driverUrl = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&period=${period}&entityId=${entityId}&lineItemCode=${item.code}`)
        if (currentScenario !== null) {
          driverUrl += `&scenarioId=${currentScenario}`
        }
        // In what-if mode, filter by the selected combination
        if (lastRunMode?.whatIfMode) {
          const whatIfCombination = buildWhatIfCombination(selectedActions)
          driverUrl += `&whatIfCombination=${encodeURIComponent(whatIfCombination)}`
        }
        const driverResponse = await fetch(driverUrl)
        const driverData = await driverResponse.json()
        if (driverData.success) {
          newDriverData.set(item.code, driverData.drivers || [])
        }
      } catch (error) {
        logger.error(`Error loading drivers for ${item.code}:`, error)
      }
    }
    setDriverData(newDriverData)
  }

  // Helper: Load driver data in delta mode (A - B)
  const loadDriverDataDelta = async (
    dbPath: string,
    period: number,
    entityId: number,
    lineItems: LineItem[],
    displayedActions: Set<string>,
    baseCaseActions: Set<string>
  ) => {
    const newDriverData = new Map<string, DriverContribution[]>()

    const displayedCombination = buildWhatIfCombination(displayedActions)
    const baseCaseCombination = buildWhatIfCombination(baseCaseActions)

    for (const item of lineItems) {
      try {
        let driverUrlBase = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&period=${period}&entityId=${entityId}&lineItemCode=${item.code}`)
        if (currentScenario !== null) {
          driverUrlBase += `&scenarioId=${currentScenario}`
        }

        const driverUrlA = driverUrlBase + `&whatIfCombination=${encodeURIComponent(displayedCombination)}`
        const driverUrlB = driverUrlBase + `&whatIfCombination=${encodeURIComponent(baseCaseCombination)}`

        // Fetch both in parallel
        const [responseA, responseB] = await Promise.all([
          fetch(driverUrlA),
          fetch(driverUrlB)
        ])

        const [dataA, dataB] = await Promise.all([
          responseA.json(),
          responseB.json()
        ])

        if (dataA.success && dataB.success) {
          // Build lookup map for base scenario driver values
          const baseScenarioDriverMap = new Map<string, number>()
          dataB.drivers.forEach((driver: DriverContribution) => {
            baseScenarioDriverMap.set(driver.driver_code, driver.value)
          })

          // Calculate delta: A - B for each driver
          const deltaDrivers = dataA.drivers.map((driver: DriverContribution) => {
            const baseValue = baseScenarioDriverMap.get(driver.driver_code) || 0
            return {
              ...driver,
              value: driver.value - baseValue
            }
          })

          newDriverData.set(item.code, deltaDrivers)
        }
      } catch (error) {
        logger.error(`Error loading drivers for ${item.code}:`, error)
      }
    }
    setDriverData(newDriverData)
  }

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName)
    } else {
      newExpanded.add(sectionName)
    }
    setExpandedSections(newExpanded)
  }

  const toggleNode = (entityId: number) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(entityId)) {
      newExpanded.delete(entityId)
    } else {
      newExpanded.add(entityId)
    }
    setExpandedNodes(newExpanded)
  }

  const loadDriverDecomposition = async (lineItemCode: string) => {
    if (!currentEntity) return false

    const dbPath = getDefaultDbPath()
    try {
      let baseUrl = apiUrl(`/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&period=${currentPeriod}&entityId=${currentEntity}&lineItemCode=${lineItemCode}`)
      if (currentScenario !== null) {
        baseUrl += `&scenarioId=${currentScenario}`
      }

      // In what-if mode, handle absolute vs delta display
      if (lastRunMode?.whatIfMode) {
        if (displayMode === 'absolute') {
          // Absolute mode: fetch one combination
          const whatIfCombination = buildWhatIfCombination(displayedActions)
          const url = baseUrl + `&whatIfCombination=${encodeURIComponent(whatIfCombination)}`

          const response = await fetch(url)
          const data = await response.json()

          if (data.success) {
            // Store the result even if empty, so we know we've checked
            setDriverData(prev => new Map(prev).set(lineItemCode, data.drivers || []))
            return data.drivers && data.drivers.length > 0
          }
        } else {
          // Delta mode: fetch both combinations and calculate A - B
          const displayedCombination = buildWhatIfCombination(displayedActions)
          const baseCaseCombination = buildWhatIfCombination(baseCaseActions)

          const urlA = baseUrl + `&whatIfCombination=${encodeURIComponent(displayedCombination)}`
          const urlB = baseUrl + `&whatIfCombination=${encodeURIComponent(baseCaseCombination)}`

          // Fetch both in parallel
          const [responseA, responseB] = await Promise.all([
            fetch(urlA),
            fetch(urlB)
          ])

          const [dataA, dataB] = await Promise.all([
            responseA.json(),
            responseB.json()
          ])

          if (dataA.success && dataB.success) {
            // Build lookup map for base scenario driver values
            const baseScenarioDriverMap = new Map<string, number>()
            dataB.drivers?.forEach((driver: DriverContribution) => {
              baseScenarioDriverMap.set(driver.driver_code, driver.value)
            })

            // Calculate delta: A - B for each driver
            const deltaDrivers = dataA.drivers?.map((driver: DriverContribution) => {
              const baseValue = baseScenarioDriverMap.get(driver.driver_code) || 0
              return {
                ...driver,
                value: driver.value - baseValue
              }
            }) || []

            setDriverData(prev => new Map(prev).set(lineItemCode, deltaDrivers))
            return deltaDrivers.length > 0
          }
        }
      } else {
        // Normal mode (no what-if): fetch without filtering
        const response = await fetch(baseUrl)
        const data = await response.json()

        if (data.success) {
          // Store the result even if empty, so we know we've checked
          setDriverData(prev => new Map(prev).set(lineItemCode, data.drivers || []))
          return data.drivers && data.drivers.length > 0
        }
      }
      return false
    } catch (error) {
      logger.error('Error loading driver decomposition:', error)
      return false
    }
  }

  const toggleLineItem = (lineItemCode: string) => {
    const newExpanded = new Set(expandedLineItems)
    if (newExpanded.has(lineItemCode)) {
      newExpanded.delete(lineItemCode)
    } else {
      newExpanded.add(lineItemCode)
      // Load driver data if not already loaded
      if (!driverData.has(lineItemCode)) {
        loadDriverDecomposition(lineItemCode)
      }
    }
    setExpandedLineItems(newExpanded)
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
                  backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(59, 130, 246, 0.2)'}`,
                  borderRadius: '6px',
                  marginBottom: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => setCurrentEntity(entity.entity_id)}
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
                      <ChevronDown style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                    ) : (
                      <ChevronRight style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '24px' }} />}

                <Building2 style={{ width: '16px', height: '16px', color: '#3b82f6', marginRight: '8px' }} />

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

  const findEntityInTree = (entities: Entity[], entityId: number): Entity | null => {
    for (const entity of entities) {
      if (entity.entity_id === entityId) {
        return entity
      }
      if (entity.children) {
        const found = findEntityInTree(entity.children, entityId)
        if (found) return found
      }
    }
    return null
  }

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <BarChart3 style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
            View Results
          </h1>
          {lastRunMode?.stochasticMode && (
            <span style={{
              padding: '4px 10px',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '12px',
              color: '#3b82f6',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              STOCHASTIC
            </span>
          )}
          {lastRunMode?.whatIfMode && (
            <span style={{
              padding: '4px 10px',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '12px',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              WHAT-IF
            </span>
          )}
        </div>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
          Financial statement results by period
        </p>
      </div>

      {/* What-If Mode Controls */}
      {lastRunMode?.whatIfMode && managementActions.length > 0 && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          marginBottom: '16px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Absolute vs Delta Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  Absolute
                </label>
                <div
                  onClick={() => setDisplayMode(displayMode === 'absolute' ? 'delta' : 'absolute')}
                  style={{
                    position: 'relative',
                    width: '52px',
                    height: '28px',
                    backgroundColor: displayMode === 'delta' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(71, 85, 105, 0.5)',
                    border: `1px solid ${displayMode === 'delta' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(71, 85, 105, 0.6)'}`,
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Toggle knob */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '2px',
                      left: displayMode === 'absolute' ? '2px' : '24px',
                      width: '22px',
                      height: '22px',
                      backgroundColor: displayMode === 'delta' ? '#10b981' : '#94a3b8',
                      borderRadius: '50%',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                    }}
                  />
                </div>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  Delta
                </label>

                {/* MAC Mode Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '40px', paddingLeft: '40px', borderLeft: '1px solid rgba(71, 85, 105, 0.5)' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    MAC Mode
                  </label>
                  <div
                    onClick={() => {
                      const newState = !macModeActive
                      setMacModeActive(newState)
                      if (newState && roiModeActive) {
                        setRoiModeActive(false)
                      }
                    }}
                    style={{
                      position: 'relative',
                      width: '52px',
                      height: '28px',
                      backgroundColor: macModeActive ? 'rgba(249, 115, 22, 0.3)' : 'rgba(71, 85, 105, 0.5)',
                      border: `1px solid ${macModeActive ? 'rgba(249, 115, 22, 0.5)' : 'rgba(71, 85, 105, 0.6)'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Toggle knob */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: macModeActive ? '24px' : '2px',
                        width: '22px',
                        height: '22px',
                        backgroundColor: macModeActive ? '#f97316' : '#94a3b8',
                        borderRadius: '50%',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </div>
                </div>

                {/* ROI Mode Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '40px', paddingLeft: '40px', borderLeft: '1px solid rgba(71, 85, 105, 0.5)' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    ROI Mode
                  </label>
                  <div
                    onClick={() => {
                      const newState = !roiModeActive
                      setRoiModeActive(newState)
                      if (newState && macModeActive) {
                        setMacModeActive(false)
                      }
                    }}
                    style={{
                      position: 'relative',
                      width: '52px',
                      height: '28px',
                      backgroundColor: roiModeActive ? 'rgba(168, 85, 247, 0.3)' : 'rgba(71, 85, 105, 0.5)',
                      border: `1px solid ${roiModeActive ? 'rgba(168, 85, 247, 0.5)' : 'rgba(71, 85, 105, 0.6)'}`,
                      borderRadius: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Toggle knob */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '2px',
                        left: roiModeActive ? '24px' : '2px',
                        width: '22px',
                        height: '22px',
                        backgroundColor: roiModeActive ? '#a855f7' : '#94a3b8',
                        borderRadius: '50%',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Displayed Run Action Toggles - Blue Theme */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  Displayed run:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '16px' }}>
                  {managementActions.map((action) => (
                    <button
                      key={action.action_code}
                      onClick={() => {
                        const newSet = new Set(displayedActions)
                        if (newSet.has(action.action_code)) {
                          newSet.delete(action.action_code)
                        } else {
                          newSet.add(action.action_code)
                        }
                        setDisplayedActions(newSet)
                      }}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: displayedActions.has(action.action_code)
                          ? 'rgba(59, 130, 246, 0.2)'
                          : 'rgba(30, 41, 59, 0.8)',
                        border: `1px solid ${displayedActions.has(action.action_code)
                          ? 'rgba(59, 130, 246, 0.5)'
                          : 'rgba(59, 130, 246, 0.3)'}`,
                        borderRadius: '6px',
                        color: displayedActions.has(action.action_code) ? '#3b82f6' : '#94a3b8',
                        fontSize: '13px',
                        fontWeight: displayedActions.has(action.action_code) ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {action.action_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Base Scenario Action Toggles (only in Delta mode) - Purple Theme */}
              {displayMode === 'delta' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    Base scenario:
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: '16px' }}>
                    {managementActions.map((action) => (
                      <button
                        key={action.action_code}
                        onClick={() => {
                          const newSet = new Set(baseCaseActions)
                          if (newSet.has(action.action_code)) {
                            newSet.delete(action.action_code)
                          } else {
                            newSet.add(action.action_code)
                          }
                          setBaseCaseActions(newSet)
                        }}
                        style={{
                          padding: '6px 14px',
                          backgroundColor: baseCaseActions.has(action.action_code)
                            ? 'rgba(168, 85, 247, 0.2)'
                            : 'rgba(30, 41, 59, 0.8)',
                          border: `1px solid ${baseCaseActions.has(action.action_code)
                            ? 'rgba(168, 85, 247, 0.5)'
                            : 'rgba(168, 85, 247, 0.3)'}`,
                          borderRadius: '6px',
                          color: baseCaseActions.has(action.action_code) ? '#a855f7' : '#94a3b8',
                          fontSize: '13px',
                          fontWeight: baseCaseActions.has(action.action_code) ? '600' : '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {action.action_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scenario Selector */}
      {scenarios.length > 0 && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          marginBottom: '16px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                Scenario
              </label>
              <select
                value={currentScenario || ''}
                onChange={(e) => setCurrentScenario(parseInt(e.target.value))}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  color: '#ffffff',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {scenarios.map((scenario) => (
                  <option key={scenario.scenario_id} value={scenario.scenario_id}>
                    {scenario.name} ({scenario.code}) - {scenario.num_periods} period{scenario.num_periods !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Slider and Entity Selector */}
      {periods.length > 0 && (
        <>
          <Card style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            marginBottom: '16px'
          }}>
            <CardContent style={{ padding: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    Time Period
                  </label>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    padding: '4px 16px',
                    borderRadius: '6px'
                  }}>
                    Period {currentPeriod}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ fontSize: '12px', color: '#64748b', minWidth: '60px' }}>
                    Period {Math.min(...periods)}
                  </span>
                  <input
                    type="range"
                    min={Math.min(...periods)}
                    max={Math.max(...periods)}
                    step={1}
                    value={currentPeriod}
                    onChange={(e) => setCurrentPeriod(parseInt(e.target.value))}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: 'rgba(71, 85, 105, 0.4)',
                      outline: 'none',
                      appearance: 'none'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#64748b', minWidth: '60px', textAlign: 'right' }}>
                    Period {Math.max(...periods)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entity Selector */}
          {entities.length > 0 && (
            <Card style={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              marginBottom: '24px'
            }}>
              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                    Select Entity
                  </label>
                  <ScrollArea style={{ maxHeight: '300px', paddingRight: '8px' }}>
                    {renderEntityTree(entities)}
                  </ScrollArea>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Financial Statement */}
      {loading ? (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <CardContent style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>Loading results...</p>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <CardContent style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8' }}>
              No results found. Please run a calculation first.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid rgba(59, 130, 246, 0.3)'
            }}>
              Financial Statement - Period {currentPeriod}
              {currentEntity && entities.length > 0 && (
                <span style={{ color: '#94a3b8', fontSize: '16px', fontWeight: '400', marginLeft: '12px' }}>
                  {findEntityInTree(entities, currentEntity)?.name || ''}
                </span>
              )}
            </h2>

            {sections.map((section) => (
              <div key={section.name} style={{ marginBottom: '24px' }}>
                {/* Section Header */}
                <div
                  onClick={() => toggleSection(section.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    marginBottom: '8px'
                  }}
                >
                  {expandedSections.has(section.name) ? (
                    <ChevronDown style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                  ) : (
                    <ChevronRight style={{ width: '20px', height: '20px', color: '#3b82f6' }} />
                  )}
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#3b82f6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {section.name}
                  </span>
                </div>

                {/* Section Items */}
                {expandedSections.has(section.name) && (
                  <div style={{ paddingLeft: '32px' }}>
                    {section.items.map((item) => {
                      const isExpanded = expandedLineItems.has(item.code)
                      const drivers = driverData.get(item.code)
                      const hasDrivers = drivers !== undefined && drivers.length > 0
                      const hasBeenChecked = driverData.has(item.code)

                      return (
                        <div key={item.code}>
                          {/* Line Item Row */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px 16px',
                              borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                              backgroundColor: item.is_computed ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                              cursor: hasDrivers || !hasBeenChecked ? 'pointer' : 'default'
                            }}
                            onClick={() => hasDrivers || !hasBeenChecked ? toggleLineItem(item.code) : null}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              {/* Expand/Collapse Icon - only show if has drivers or not yet checked */}
                              <div style={{ width: '16px', height: '16px' }}>
                                {(hasDrivers || !hasBeenChecked) && (
                                  isExpanded ? (
                                    <ChevronDown style={{ width: '16px', height: '16px', color: '#3b82f6' }} />
                                  ) : (
                                    <ChevronRight style={{ width: '16px', height: '16px', color: '#64748b' }} />
                                  )
                                )}
                              </div>

                              <span style={{
                                fontSize: '14px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                                minWidth: '120px'
                              }}>
                                {item.code}
                              </span>
                              <span style={{
                                fontSize: '14px',
                                color: '#fff',
                                fontWeight: item.is_computed ? '600' : '400'
                              }}>
                                {item.display_name}
                              </span>
                            </div>
                            <span style={{
                              fontSize: '16px',
                              color: (item.sign_convention === 'negative' || item.value < 0) ? '#ef4444' : '#22c55e',
                              fontWeight: '600',
                              fontFamily: 'monospace',
                              minWidth: '150px',
                              textAlign: 'right'
                            }}>
                              {(item.sign_convention === 'negative' || item.value < 0) ? '(' : ''}{formatValue(Math.abs(item.value))}{(item.sign_convention === 'negative' || item.value < 0) ? ')' : ''}
                            </span>
                          </div>

                          {/* Driver Contributions */}
                          {isExpanded && hasDrivers && (
                            <div style={{ paddingLeft: '48px', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
                              {drivers!.map((driver) => (
                                <div
                                  key={driver.driver_code}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '8px 16px',
                                    borderBottom: '1px solid rgba(71, 85, 105, 0.2)'
                                  }}
                                >
                                  <span style={{
                                    fontSize: '13px',
                                    color: '#94a3b8',
                                    fontFamily: 'monospace',
                                    fontStyle: 'italic'
                                  }}>
                                    Impact of {driver.driver_code.toLowerCase()}
                                  </span>
                                  <span style={{
                                    fontSize: '14px',
                                    color: driver.value < 0 ? '#ef4444' : '#22c55e',
                                    fontWeight: '500',
                                    fontFamily: 'monospace',
                                    minWidth: '150px',
                                    textAlign: 'right'
                                  }}>
                                    {driver.value < 0 ? '(' : ''}{formatValue(Math.abs(driver.value))}{driver.value < 0 ? ')' : ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* MAC Period Selector Panel (only visible in What-If mode when MAC mode is active) */}
      {lastRunMode?.whatIfMode && macModeActive && periods.length > 0 && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(249, 115, 22, 0.5)',
          marginTop: '24px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} style={{ color: '#f97316' }} />
                <label style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  MAC Curve Period Range
                </label>
              </div>

              {/* Combined Period Range Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                    Start: P{macStartPeriod}
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                    End: P{macEndPeriod}
                  </label>
                </div>

                {/* Dual-handle range slider container */}
                <div style={{ position: 'relative', width: '100%', height: '40px' }}>
                  {/* Background track */}
                  <div style={{
                    position: 'absolute',
                    top: '17px',
                    left: 0,
                    right: 0,
                    height: '6px',
                    backgroundColor: 'rgba(71, 85, 105, 0.5)',
                    borderRadius: '3px'
                  }} />

                  {/* Active range highlight */}
                  <div style={{
                    position: 'absolute',
                    top: '17px',
                    left: `${((macStartPeriod - periods[0]) / (periods[periods.length - 1] - periods[0])) * 100}%`,
                    width: `${((macEndPeriod - macStartPeriod) / (periods[periods.length - 1] - periods[0])) * 100}%`,
                    height: '6px',
                    backgroundColor: '#f97316',
                    borderRadius: '3px'
                  }} />

                  {/* Start Period Slider */}
                  <input
                    type="range"
                    min={periods[0]}
                    max={periods[periods.length - 1]}
                    value={macStartPeriod}
                    onChange={(e) => {
                      const newStart = parseInt(e.target.value)
                      setMacStartPeriod(newStart)
                      if (newStart > macEndPeriod) {
                        setMacEndPeriod(newStart)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: 0,
                      left: 0,
                      height: '40px',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      background: 'transparent',
                      pointerEvents: 'all',
                      cursor: 'pointer',
                      zIndex: macStartPeriod >= macEndPeriod - 1 ? 5 : 4
                    } as React.CSSProperties}
                  />

                  {/* End Period Slider */}
                  <input
                    type="range"
                    min={periods[0]}
                    max={periods[periods.length - 1]}
                    value={macEndPeriod}
                    onChange={(e) => {
                      const newEnd = parseInt(e.target.value)
                      setMacEndPeriod(newEnd)
                      if (newEnd < macStartPeriod) {
                        setMacStartPeriod(newEnd)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: 0,
                      left: 0,
                      height: '40px',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      background: 'transparent',
                      pointerEvents: 'all',
                      cursor: 'pointer',
                      zIndex: 3
                    } as React.CSSProperties}
                  />
                </div>

                <style>{`
                  input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #f97316;
                    border: 2px solid #fff;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                  }

                  input[type="range"]::-moz-range-thumb {
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    background: #f97316;
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
                MAC curve will be calculated for {macEndPeriod - macStartPeriod + 1} periods (P{macStartPeriod} to P{macEndPeriod})
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAC Results Table (only visible in What-If mode when MAC mode is active) */}
      {lastRunMode?.whatIfMode && macModeActive && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(249, 115, 22, 0.5)',
          marginTop: '24px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} style={{ color: '#f97316' }} />
                <label style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  Marginal Abatement Cost (MAC) Curve
                </label>
              </div>

              {macLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  Loading MAC curve...
                </div>
              ) : macResults.length === 0 ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  No single-action results available. Run calculations with individual actions enabled.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(249, 115, 22, 0.5)' }}>
                        <th style={{
                          textAlign: 'left',
                          padding: '12px 16px',
                          color: '#f97316',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Action
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#f97316',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Carbon Abatement (tCO₂e)
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#f97316',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Cost ($)
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#f97316',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          MAC ($/tCO₂e)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {macResults.map((result, index) => (
                        <tr
                          key={result.action}
                          style={{
                            borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                            backgroundColor: index % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent'
                          }}
                        >
                          <td style={{
                            padding: '12px 16px',
                            color: '#fff',
                            fontWeight: '600'
                          }}>
                            {result.action}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.carbonAbatement > 0 ? '#10b981' : result.carbonAbatement < 0 ? '#ef4444' : '#94a3b8',
                            textAlign: 'right',
                            fontFamily: 'monospace'
                          }}>
                            {result.carbonAbatement.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.cost > 0 ? '#ef4444' : result.cost < 0 ? '#10b981' : '#94a3b8',
                            textAlign: 'right',
                            fontFamily: 'monospace'
                          }}>
                            {result.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.mac === null ? '#64748b' : result.mac < 0 ? '#10b981' : '#f97316',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: '700'
                          }}>
                            {result.mac === null ? 'N/A' : result.mac.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MAC Curve Visualization */}
              {!macLoading && macResults.length > 0 && (() => {
                // Calculate cumulative carbon abatement and find min/max MAC for scaling
                let cumulativeCarbon = 0
                const chartData = macResults.map(result => {
                  const start = cumulativeCarbon
                  cumulativeCarbon += result.carbonAbatement
                  return {
                    ...result,
                    startX: start,
                    endX: cumulativeCarbon
                  }
                })

                const maxCarbon = cumulativeCarbon
                const minMAC = Math.min(...macResults.map(r => r.mac === null ? 0 : r.mac))
                const maxMAC = Math.max(...macResults.map(r => r.mac === null ? 0 : r.mac))

                // Add padding to y-axis
                const yPadding = Math.max(Math.abs(minMAC), Math.abs(maxMAC)) * 0.1
                const yMin = minMAC - yPadding
                const yMax = maxMAC + yPadding
                const yRange = yMax - yMin

                const chartWidth = 800
                const chartHeight = 400
                const margin = { top: 40, right: 40, bottom: 60, left: 80 }
                const plotWidth = chartWidth - margin.left - margin.right
                const plotHeight = chartHeight - margin.top - margin.bottom

                return (
                  <div style={{ marginTop: '32px', marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#f97316',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      MAC Curve Visualization
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                      <svg width={chartWidth} height={chartHeight} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                        {/* Y-axis */}
                        <line
                          x1={margin.left}
                          y1={margin.top}
                          x2={margin.left}
                          y2={chartHeight - margin.bottom}
                          stroke="#64748b"
                          strokeWidth="2"
                        />
                        {/* X-axis */}
                        <line
                          x1={margin.left}
                          y1={chartHeight - margin.bottom}
                          x2={chartWidth - margin.right}
                          y2={chartHeight - margin.bottom}
                          stroke="#64748b"
                          strokeWidth="2"
                        />

                        {/* Zero line */}
                        {yMin < 0 && yMax > 0 && (
                          <line
                            x1={margin.left}
                            y1={margin.top + plotHeight * (1 - (0 - yMin) / yRange)}
                            x2={chartWidth - margin.right}
                            y2={margin.top + plotHeight * (1 - (0 - yMin) / yRange)}
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        )}

                        {/* Y-axis labels */}
                        {[...Array(6)].map((_, i) => {
                          const value = yMin + (yRange * i / 5)
                          const y = margin.top + plotHeight * (1 - i / 5)
                          return (
                            <g key={i}>
                              <line
                                x1={margin.left - 5}
                                y1={y}
                                x2={margin.left}
                                y2={y}
                                stroke="#64748b"
                                strokeWidth="1"
                              />
                              <text
                                x={margin.left - 10}
                                y={y}
                                textAnchor="end"
                                alignmentBaseline="middle"
                                fill="#94a3b8"
                                fontSize="11px"
                                fontFamily="monospace"
                              >
                                {value.toFixed(0)}
                              </text>
                            </g>
                          )
                        })}

                        {/* Y-axis label */}
                        <text
                          x={margin.left - 60}
                          y={chartHeight / 2}
                          textAnchor="middle"
                          fill="#f97316"
                          fontSize="13px"
                          fontWeight="700"
                          transform={`rotate(-90, ${margin.left - 60}, ${chartHeight / 2})`}
                        >
                          MAC ($/tCO₂e)
                        </text>

                        {/* X-axis label */}
                        <text
                          x={chartWidth / 2}
                          y={chartHeight - 10}
                          textAnchor="middle"
                          fill="#f97316"
                          fontSize="13px"
                          fontWeight="700"
                        >
                          Cumulative Carbon Abatement (tCO₂e)
                        </text>

                        {/* MAC bars */}
                        {chartData.map((item, index) => {
                          if (item.mac === null) return null

                          const x = margin.left + (item.startX / maxCarbon) * plotWidth
                          const width = ((item.endX - item.startX) / maxCarbon) * plotWidth
                          const macNormalized = (item.mac - yMin) / yRange
                          const zeroNormalized = (0 - yMin) / yRange

                          let barY, barHeight
                          if (item.mac >= 0) {
                            // Positive MAC: bar goes from zero line up
                            barY = margin.top + plotHeight * (1 - macNormalized)
                            barHeight = plotHeight * (macNormalized - zeroNormalized)
                          } else {
                            // Negative MAC: bar goes from zero line down
                            barY = margin.top + plotHeight * (1 - zeroNormalized)
                            barHeight = plotHeight * (zeroNormalized - macNormalized)
                          }

                          const color = item.mac < 0 ? '#10b981' : item.mac < 50 ? '#f97316' : '#ef4444'

                          const centerX = x + width / 2
                          const textY = item.mac >= 0 ? barY - 5 : barY + Math.abs(barHeight) + 15

                          return (
                            <g key={index}>
                              <rect
                                x={x}
                                y={barY}
                                width={width}
                                height={Math.abs(barHeight)}
                                fill={color}
                                opacity="0.8"
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="1"
                              />
                              <title>{`${item.action}\nCarbon: ${item.carbonAbatement.toLocaleString()} tCO₂e\nMAC: $${item.mac.toFixed(2)}/tCO₂e`}</title>
                              {/* Action label */}
                              <text
                                x={centerX}
                                y={textY}
                                textAnchor="middle"
                                fill="#e2e8f0"
                                fontSize="10px"
                                fontWeight="600"
                              >
                                {item.action}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )
              })()}

              <div style={{
                fontSize: '12px',
                color: '#64748b',
                textAlign: 'left',
                paddingTop: '8px',
                borderTop: '1px solid rgba(71, 85, 105, 0.3)',
                lineHeight: '1.6'
              }}>
                <strong style={{ color: '#94a3b8' }}>Interpretation:</strong>
                <br />
                • <strong style={{ color: '#10b981' }}>Positive Carbon Abatement</strong> = Carbon reduction (good)
                <br />
                • <strong style={{ color: '#ef4444' }}>Positive Cost</strong> = Income loss (expense)
                <br />
                • <strong style={{ color: '#f97316' }}>Lower MAC</strong> = More cost-effective carbon reduction
                <br />
                • <strong style={{ color: '#10b981' }}>Negative MAC</strong> = Carbon reduction + income gain (best)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROI Period Selector Panel (only visible in What-If mode when ROI mode is active) */}
      {lastRunMode?.whatIfMode && roiModeActive && periods.length > 0 && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          marginTop: '24px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} style={{ color: '#a855f7' }} />
                <label style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  ROI Curve Period Range
                </label>
              </div>

              {/* Combined Period Range Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                    Start: P{roiStartPeriod}
                  </label>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                    End: P{roiEndPeriod}
                  </label>
                </div>

                {/* Dual-handle range slider container */}
                <div style={{ position: 'relative', width: '100%', height: '40px' }}>
                  {/* Background track */}
                  <div style={{
                    position: 'absolute',
                    top: '17px',
                    left: 0,
                    right: 0,
                    height: '6px',
                    backgroundColor: 'rgba(71, 85, 105, 0.5)',
                    borderRadius: '3px'
                  }} />

                  {/* Active range highlight */}
                  <div style={{
                    position: 'absolute',
                    top: '17px',
                    left: `${((roiStartPeriod - periods[0]) / (periods[periods.length - 1] - periods[0])) * 100}%`,
                    width: `${((roiEndPeriod - roiStartPeriod) / (periods[periods.length - 1] - periods[0])) * 100}%`,
                    height: '6px',
                    backgroundColor: '#a855f7',
                    borderRadius: '3px'
                  }} />

                  {/* Start Period Slider */}
                  <input
                    type="range"
                    min={periods[0]}
                    max={periods[periods.length - 1]}
                    value={roiStartPeriod}
                    onChange={(e) => {
                      const newStart = parseInt(e.target.value)
                      setRoiStartPeriod(newStart)
                      if (newStart > roiEndPeriod) {
                        setRoiEndPeriod(newStart)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: 0,
                      left: 0,
                      height: '40px',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      background: 'transparent',
                      pointerEvents: 'all',
                      cursor: 'pointer',
                      zIndex: roiStartPeriod >= roiEndPeriod - 1 ? 5 : 4
                    } as React.CSSProperties}
                  />

                  {/* End Period Slider */}
                  <input
                    type="range"
                    min={periods[0]}
                    max={periods[periods.length - 1]}
                    value={roiEndPeriod}
                    onChange={(e) => {
                      const newEnd = parseInt(e.target.value)
                      setRoiEndPeriod(newEnd)
                      if (newEnd < roiStartPeriod) {
                        setRoiStartPeriod(newEnd)
                      }
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      top: 0,
                      left: 0,
                      height: '40px',
                      WebkitAppearance: 'none',
                      appearance: 'none',
                      background: 'transparent',
                      pointerEvents: 'all',
                      cursor: 'pointer',
                      zIndex: 3
                    } as React.CSSProperties}
                  />
                </div>

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
                ROI curve will be calculated for {roiEndPeriod - roiStartPeriod + 1} periods (P{roiStartPeriod} to P{roiEndPeriod})
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ROI Results Table (only visible in What-If mode when ROI mode is active) */}
      {lastRunMode?.whatIfMode && roiModeActive && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          marginTop: '24px'
        }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} style={{ color: '#a855f7' }} />
                <label style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>
                  Return on Investment (ROI) Curve
                </label>
              </div>

              {roiLoading ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  Loading ROI curve...
                </div>
              ) : roiResults.length === 0 ? (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '40px',
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  No single-action results available. Run calculations with individual actions enabled.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid rgba(168, 85, 247, 0.5)' }}>
                        <th style={{
                          textAlign: 'left',
                          padding: '12px 16px',
                          color: '#a855f7',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Action
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#a855f7',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Investment ($)
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#a855f7',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          Benefit ($)
                        </th>
                        <th style={{
                          textAlign: 'right',
                          padding: '12px 16px',
                          color: '#a855f7',
                          fontWeight: '700',
                          fontSize: '13px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          ROI (benefit/investment)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {roiResults.map((result, index) => (
                        <tr
                          key={result.action}
                          style={{
                            borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                            backgroundColor: index % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = index % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'transparent'
                          }}
                        >
                          <td style={{
                            padding: '12px 16px',
                            color: '#fff',
                            fontWeight: '600'
                          }}>
                            {result.action}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.investment > 0 ? '#ef4444' : result.investment < 0 ? '#10b981' : '#94a3b8',
                            textAlign: 'right',
                            fontFamily: 'monospace'
                          }}>
                            {result.investment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.benefit > 0 ? '#10b981' : result.benefit < 0 ? '#ef4444' : '#94a3b8',
                            textAlign: 'right',
                            fontFamily: 'monospace'
                          }}>
                            {result.benefit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{
                            padding: '12px 16px',
                            color: result.roi === null ? '#64748b' : result.roi > 1 ? '#10b981' : '#a855f7',
                            textAlign: 'right',
                            fontFamily: 'monospace',
                            fontWeight: '700'
                          }}>
                            {result.roi === null ? 'N/A' : result.roi.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ROI Curve Visualization */}
              {!roiLoading && roiResults.length > 0 && (() => {
                // Sort by ROI descending for visualization
                const sortedResults = [...roiResults].sort((a, b) => (b.roi || 0) - (a.roi || 0))

                // Find min/max ROI for scaling
                const validRois = sortedResults.filter(r => r.roi !== null).map(r => r.roi!)
                if (validRois.length === 0) return null

                const minROI = Math.min(...validRois)
                const maxROI = Math.max(...validRois)

                // Add padding to y-axis
                const yPadding = Math.max(Math.abs(minROI), Math.abs(maxROI)) * 0.1
                const yMin = minROI - yPadding
                const yMax = maxROI + yPadding
                const yRange = yMax - yMin

                const chartWidth = 800
                const chartHeight = 400
                const margin = { top: 40, right: 40, bottom: 60, left: 80 }
                const plotWidth = chartWidth - margin.left - margin.right
                const plotHeight = chartHeight - margin.top - margin.bottom

                const barWidth = plotWidth / sortedResults.length

                return (
                  <div style={{ marginTop: '32px', marginBottom: '24px' }}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '700',
                      color: '#a855f7',
                      marginBottom: '16px',
                      textAlign: 'center'
                    }}>
                      ROI Curve Visualization
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                      <svg width={chartWidth} height={chartHeight} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                        {/* Y-axis */}
                        <line
                          x1={margin.left}
                          y1={margin.top}
                          x2={margin.left}
                          y2={chartHeight - margin.bottom}
                          stroke="#64748b"
                          strokeWidth="2"
                        />
                        {/* X-axis */}
                        <line
                          x1={margin.left}
                          y1={chartHeight - margin.bottom}
                          x2={chartWidth - margin.right}
                          y2={chartHeight - margin.bottom}
                          stroke="#64748b"
                          strokeWidth="2"
                        />

                        {/* Zero line (ROI = 1.0 break-even) */}
                        {yMin < 1 && yMax > 1 && (
                          <line
                            x1={margin.left}
                            y1={margin.top + plotHeight * (1 - (1 - yMin) / yRange)}
                            x2={chartWidth - margin.right}
                            y2={margin.top + plotHeight * (1 - (1 - yMin) / yRange)}
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                          />
                        )}

                        {/* Y-axis labels */}
                        {[...Array(6)].map((_, i) => {
                          const value = yMin + (yRange * i / 5)
                          const y = margin.top + plotHeight * (1 - i / 5)
                          return (
                            <g key={i}>
                              <line
                                x1={margin.left - 5}
                                y1={y}
                                x2={margin.left}
                                y2={y}
                                stroke="#64748b"
                                strokeWidth="1"
                              />
                              <text
                                x={margin.left - 10}
                                y={y}
                                textAnchor="end"
                                alignmentBaseline="middle"
                                fill="#94a3b8"
                                fontSize="11px"
                                fontFamily="monospace"
                              >
                                {value.toFixed(2)}
                              </text>
                            </g>
                          )
                        })}

                        {/* Y-axis label */}
                        <text
                          x={margin.left - 60}
                          y={chartHeight / 2}
                          textAnchor="middle"
                          fill="#a855f7"
                          fontSize="13px"
                          fontWeight="700"
                          transform={`rotate(-90, ${margin.left - 60}, ${chartHeight / 2})`}
                        >
                          ROI (benefit/investment)
                        </text>

                        {/* X-axis label */}
                        <text
                          x={chartWidth / 2}
                          y={chartHeight - 10}
                          textAnchor="middle"
                          fill="#a855f7"
                          fontSize="13px"
                          fontWeight="700"
                        >
                          Management Actions (sorted by ROI)
                        </text>

                        {/* ROI bars */}
                        {sortedResults.map((item, index) => {
                          if (item.roi === null) return null

                          const x = margin.left + index * barWidth
                          const roiNormalized = (item.roi - yMin) / yRange
                          const oneNormalized = (1 - yMin) / yRange

                          let barY, barHeight
                          if (item.roi >= 1) {
                            // ROI >= 1 (positive): bar goes from 1.0 line up
                            barY = margin.top + plotHeight * (1 - roiNormalized)
                            barHeight = plotHeight * (roiNormalized - oneNormalized)
                          } else {
                            // ROI < 1 (negative): bar goes from 1.0 line down
                            barY = margin.top + plotHeight * (1 - oneNormalized)
                            barHeight = plotHeight * (oneNormalized - roiNormalized)
                          }

                          const color = item.roi > 1 ? '#10b981' : '#a855f7'

                          const centerX = x + barWidth / 2
                          const textY = item.roi >= 1 ? barY - 5 : barY + Math.abs(barHeight) + 15

                          return (
                            <g key={index}>
                              <rect
                                x={x + 2}
                                y={barY}
                                width={barWidth - 4}
                                height={Math.abs(barHeight)}
                                fill={color}
                                opacity="0.8"
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="1"
                              />
                              <title>{`${item.action}\nInvestment: $${item.investment.toLocaleString()}\nBenefit: $${item.benefit.toLocaleString()}\nROI: ${item.roi.toFixed(2)}`}</title>
                              {/* Action label */}
                              <text
                                x={centerX}
                                y={textY}
                                textAnchor="middle"
                                fill="#e2e8f0"
                                fontSize="10px"
                                fontWeight="600"
                              >
                                {item.action}
                              </text>
                            </g>
                          )
                        })}
                      </svg>
                    </div>
                  </div>
                )
              })()}

              <div style={{
                fontSize: '12px',
                color: '#64748b',
                textAlign: 'left',
                paddingTop: '8px',
                borderTop: '1px solid rgba(71, 85, 105, 0.3)',
                lineHeight: '1.6'
              }}>
                <strong style={{ color: '#94a3b8' }}>Interpretation:</strong>
                <br />
                • <strong style={{ color: '#10b981' }}>ROI &gt; 1.0</strong> = Investment pays off (benefit exceeds cost)
                <br />
                • <strong style={{ color: '#a855f7' }}>ROI &lt; 1.0</strong> = Investment does not pay off
                <br />
                • <strong style={{ color: '#10b981' }}>Higher ROI</strong> = More efficient investment
                <br />
                • <strong style={{ color: '#64748b' }}>N/A</strong> = Zero investment (cannot calculate ROI)
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monte Carlo Results Panel - Shows only MC period with detailed financial statement structure */}
      {lastRunMode?.stochasticMode && mcResults && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          marginTop: '24px'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid rgba(168, 85, 247, 0.3)'
            }}>
              <span style={{ fontSize: '24px' }}>📊</span>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#e9d5ff',
                margin: 0
              }}>
                Monte Carlo Results - Period {mcResults.mcPeriod}
              </h2>
              <span style={{
                padding: '4px 12px',
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                borderRadius: '4px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#e9d5ff'
              }}>
                {mcResults.numDraws} draws
              </span>
              {currentEntity && entities.length > 0 && (
                <span style={{ color: '#c4b5fd', fontSize: '16px', fontWeight: '400', marginLeft: '12px' }}>
                  {findEntityInTree(entities, currentEntity)?.name || ''}
                </span>
              )}
            </div>

            <div style={{
              fontSize: '14px',
              color: '#c4b5fd',
              marginBottom: '20px',
              lineHeight: '1.6'
            }}>
              Mean values across {mcResults.numDraws} Monte Carlo simulation draws. These represent the average financial outcomes under stochastic conditions.
            </div>

            {mcLoading ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: '#94a3b8'
              }}>
                Loading Monte Carlo results...
              </div>
            ) : (
              (() => {
                // Group MC results by section similar to multi-year results
                const mcSectionMap = new Map<string, Array<{code: string, meanValue: number, display_name: string, is_computed: boolean, sign_convention: string}>>()

                mcResults.lineItems.forEach(item => {
                  // Find the line item definition to get section and display info
                  for (const section of sections) {
                    const lineItem = section.items.find(li => li.code === item.code)
                    if (lineItem) {
                      if (!mcSectionMap.has(section.name)) {
                        mcSectionMap.set(section.name, [])
                      }
                      mcSectionMap.get(section.name)!.push({
                        code: item.code,
                        meanValue: item.meanValue,
                        display_name: lineItem.display_name,
                        is_computed: lineItem.is_computed,
                        sign_convention: lineItem.sign_convention
                      })
                      break
                    }
                  }
                })

                return Array.from(mcSectionMap.entries()).map(([sectionName, items]) => (
                  <div key={sectionName} style={{ marginBottom: '24px' }}>
                    {/* Section Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#c084fc',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {sectionName}
                      </span>
                    </div>

                    {/* Line Items */}
                    <div style={{ paddingLeft: '32px' }}>
                      {items.map((item) => (
                        <div
                          key={item.code}
                          onClick={() => loadMcDistribution(item.code)}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
                            backgroundColor: selectedMcLineItem === item.code
                              ? 'rgba(168, 85, 247, 0.2)'
                              : item.is_computed ? 'rgba(168, 85, 247, 0.05)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedMcLineItem !== item.code) {
                              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedMcLineItem !== item.code) {
                              e.currentTarget.style.backgroundColor = item.is_computed ? 'rgba(168, 85, 247, 0.05)' : 'transparent'
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{
                              fontSize: '14px',
                              color: '#c4b5fd',
                              fontFamily: 'monospace',
                              minWidth: '120px'
                            }}>
                              {item.code}
                            </span>
                            <span style={{
                              fontSize: '14px',
                              color: '#fff',
                              fontWeight: item.is_computed ? '600' : '400'
                            }}>
                              {item.display_name}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '16px',
                            color: (item.sign_convention === 'negative' || item.meanValue < 0) ? '#f87171' : '#86efac',
                            fontWeight: '600',
                            fontFamily: 'monospace',
                            minWidth: '150px',
                            textAlign: 'right'
                          }}>
                            {(item.sign_convention === 'negative' || item.meanValue < 0) ? '(' : ''}{formatValue(Math.abs(item.meanValue))}{(item.sign_convention === 'negative' || item.meanValue < 0) ? ')' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()
            )}

            {/* MC Distribution Panel - Shows frequency distribution for selected line item */}
            {selectedMcLineItem && (
              <div style={{
                marginTop: '32px',
                paddingTop: '32px',
                borderTop: '2px solid rgba(168, 85, 247, 0.3)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '24px'
                }}>
                  <span style={{ fontSize: '20px' }}>📈</span>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#e9d5ff',
                    margin: 0
                  }}>
                    Distribution: {selectedMcLineItem}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedMcLineItem(null)
                      setMcDistribution(null)
                    }}
                    style={{
                      marginLeft: 'auto',
                      padding: '6px 12px',
                      backgroundColor: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      borderRadius: '4px',
                      color: '#e9d5ff',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Close
                  </button>
                </div>

                {mcDistLoading ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#94a3b8'
                  }}>
                    Loading distribution...
                  </div>
                ) : mcDistribution ? (
                  <>
                    {/* Statistics Summary */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '16px',
                      marginBottom: '24px',
                      padding: '16px',
                      backgroundColor: 'rgba(168, 85, 247, 0.05)',
                      borderRadius: '8px'
                    }}>
                      <div>
                        <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '4px' }}>Mean</div>
                        <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                          {formatValue(mcDistribution.statistics.mean)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '4px' }}>Median</div>
                        <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                          {formatValue(mcDistribution.statistics.median)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '4px' }}>Std Dev</div>
                        <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                          {formatValue(mcDistribution.statistics.std)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '4px' }}>Range</div>
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                          {formatValue(mcDistribution.statistics.min)} to {formatValue(mcDistribution.statistics.max)}
                        </div>
                      </div>
                    </div>

                    {/* Distribution Chart with KDE curve and markers */}
                    {(() => {
                      // Calculate KDE curve using Gaussian kernel
                      const draws = mcDistribution.draws
                      const values = draws.map(d => d.value)

                      // Check for zero variance (all values the same)
                      if (mcDistribution.statistics.std === 0 || mcDistribution.statistics.min === mcDistribution.statistics.max) {
                        return (
                          <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            backgroundColor: 'rgba(168, 85, 247, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid rgba(168, 85, 247, 0.2)'
                          }}>
                            <div style={{ fontSize: '16px', color: '#e9d5ff', marginBottom: '8px', fontWeight: '600' }}>
                              No Variation in Monte Carlo Draws
                            </div>
                            <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '16px' }}>
                              All {draws.length} draws have the same value: {formatValue(mcDistribution.statistics.mean)}
                            </div>
                            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                              This line item has no stochastic drivers affecting it, or all drivers produced identical results.
                            </div>
                          </div>
                        )
                      }

                      const bandwidth = 1.06 * mcDistribution.statistics.std * Math.pow(draws.length, -0.2) // Silverman's rule

                      // Generate KDE points
                      const numKdePoints = 200
                      const xMin = mcDistribution.statistics.min - bandwidth * 3
                      const xMax = mcDistribution.statistics.max + bandwidth * 3
                      const xStep = (xMax - xMin) / numKdePoints

                      const kdePoints: Array<{x: number; density: number}> = []
                      for (let i = 0; i <= numKdePoints; i++) {
                        const x = xMin + i * xStep
                        let density = 0
                        for (const val of values) {
                          const z = (x - val) / bandwidth
                          density += Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
                        }
                        density = density / (values.length * bandwidth)
                        kdePoints.push({ x, density })
                      }

                      // Chart dimensions
                      const chartWidth = 800
                      const chartHeight = 400
                      const margin = { top: 40, right: 60, bottom: 80, left: 80 }
                      const plotWidth = chartWidth - margin.left - margin.right
                      const plotHeight = chartHeight - margin.top - margin.bottom

                      // Scales
                      const maxDensity = Math.max(...kdePoints.map(p => p.density))
                      const xScale = (val: number) => margin.left + ((val - xMin) / (xMax - xMin)) * plotWidth
                      const yScale = (density: number) => margin.top + plotHeight - (density / maxDensity) * plotHeight

                      // Generate SVG path for KDE curve
                      const kdePath = kdePoints.map((p, i) =>
                        `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.density)}`
                      ).join(' ')

                      return (
                        <div style={{ position: 'relative' }}>
                          <svg width={chartWidth} height={chartHeight} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
                            {/* Gradient definitions */}
                            <defs>
                              <linearGradient id="kdeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                                <stop offset="25%" stopColor="#f97316" stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#a78bfa" stopOpacity="1" />
                                <stop offset="75%" stopColor="#3b82f6" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                              </linearGradient>
                              <linearGradient id="kdeAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.05" />
                              </linearGradient>
                            </defs>

                            {/* Y-axis */}
                            <line
                              x1={margin.left}
                              y1={margin.top}
                              x2={margin.left}
                              y2={margin.top + plotHeight}
                              stroke="#94a3b8"
                              strokeWidth="2"
                            />
                            <text
                              x={margin.left - 50}
                              y={margin.top + plotHeight / 2}
                              fill="#c4b5fd"
                              fontSize="14"
                              textAnchor="middle"
                              transform={`rotate(-90, ${margin.left - 50}, ${margin.top + plotHeight / 2})`}
                            >
                              Probability Density
                            </text>

                            {/* X-axis */}
                            <line
                              x1={margin.left}
                              y1={margin.top + plotHeight}
                              x2={margin.left + plotWidth}
                              y2={margin.top + plotHeight}
                              stroke="#94a3b8"
                              strokeWidth="2"
                            />
                            <text
                              x={margin.left + plotWidth / 2}
                              y={chartHeight - 20}
                              fill="#c4b5fd"
                              fontSize="14"
                              textAnchor="middle"
                            >
                              Value
                            </text>

                            {/* X-axis ticks */}
                            {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                              const val = xMin + frac * (xMax - xMin)
                              const x = xScale(val)
                              return (
                                <g key={frac}>
                                  <line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 5} stroke="#94a3b8" />
                                  <text x={x} y={margin.top + plotHeight + 20} fill="#94a3b8" fontSize="12" textAnchor="middle">
                                    {formatValue(val)}
                                  </text>
                                </g>
                              )
                            })}

                            {/* Mean line */}
                            <line
                              x1={xScale(mcDistribution.statistics.mean)}
                              y1={margin.top}
                              x2={xScale(mcDistribution.statistics.mean)}
                              y2={margin.top + plotHeight}
                              stroke="#a78bfa"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                            />
                            <text
                              x={xScale(mcDistribution.statistics.mean)}
                              y={margin.top - 5}
                              fill="#a78bfa"
                              fontSize="11"
                              fontWeight="600"
                              textAnchor="middle"
                            >
                              Mean
                            </text>

                            {/* KDE filled area */}
                            <path
                              d={`${kdePath} L ${xScale(xMax)} ${margin.top + plotHeight} L ${xScale(xMin)} ${margin.top + plotHeight} Z`}
                              fill="url(#kdeAreaGradient)"
                              stroke="none"
                            />

                            {/* KDE curve with gradient */}
                            <path
                              d={kdePath}
                              fill="none"
                              stroke="url(#kdeGradient)"
                              strokeWidth="3"
                              style={{ filter: 'drop-shadow(0 0 8px rgba(167, 139, 250, 0.5))' }}
                            />

                            {/* Percentile lines with hover interaction - MUST BE AFTER CURVE for z-order */}
                            {Object.entries(mcDistribution.percentiles).map(([key, val]) => {
                              const x = xScale(val)
                              const label = key === 'p50' ? 'Median' : key.toUpperCase()
                              const percentileColors: Record<string, string> = {
                                p5: '#ef4444',    // red
                                p25: '#f97316',   // orange
                                p50: '#e9d5ff',   // light purple (median)
                                p75: '#3b82f6',   // blue
                                p95: '#10b981'    // green
                              }
                              const color = percentileColors[key] || '#94a3b8'
                              const isHovered = hoveredPercentile === key
                              return (
                                <g key={key}>
                                  {/* Invisible wider hit area extending full chart height including margins */}
                                  <rect
                                    x={x - 10}
                                    y={0}
                                    width={20}
                                    height={chartHeight}
                                    fill="transparent"
                                    style={{ cursor: 'pointer' }}
                                    onMouseEnter={() => setHoveredPercentile(key)}
                                    onMouseLeave={() => setHoveredPercentile(null)}
                                  />
                                  {/* Visible line */}
                                  <line
                                    x1={x}
                                    y1={margin.top}
                                    x2={x}
                                    y2={margin.top + plotHeight}
                                    stroke={color}
                                    strokeWidth={isHovered ? 3 : (key === 'p50' ? 2 : 1)}
                                    strokeDasharray={key === 'p50' ? '5,5' : '2,2'}
                                    opacity={isHovered ? 0.9 : 0.5}
                                    style={{ pointerEvents: 'none', transition: 'all 0.2s' }}
                                  />
                                  {isHovered && (
                                    <>
                                      <text
                                        x={x}
                                        y={margin.top - 5}
                                        fill={color}
                                        fontSize="12"
                                        fontWeight="600"
                                        textAnchor="middle"
                                        style={{ pointerEvents: 'none' }}
                                      >
                                        {label}
                                      </text>
                                      <text
                                        x={x}
                                        y={margin.top - 20}
                                        fill={color}
                                        fontSize="11"
                                        textAnchor="middle"
                                        style={{ pointerEvents: 'none' }}
                                      >
                                        {formatValue(val)}
                                      </text>
                                    </>
                                  )}
                                </g>
                              )
                            })}

                            {/* Individual draw markers with color variation - positioned on KDE curve */}
                            {draws.map((draw, idx) => {
                              const x = xScale(draw.value)

                              // Find the density at this x value by interpolating KDE points
                              let density = 0
                              for (let i = 0; i < kdePoints.length - 1; i++) {
                                if (draw.value >= kdePoints[i].x && draw.value <= kdePoints[i + 1].x) {
                                  // Linear interpolation
                                  const t = (draw.value - kdePoints[i].x) / (kdePoints[i + 1].x - kdePoints[i].x)
                                  density = kdePoints[i].density + t * (kdePoints[i + 1].density - kdePoints[i].density)
                                  break
                                }
                              }
                              const y = yScale(density)

                              // Color based on position in distribution
                              const normalizedPos = (draw.value - mcDistribution.statistics.min) /
                                                   (mcDistribution.statistics.max - mcDistribution.statistics.min)
                              let markerColor = '#8b5cf6' // default purple
                              if (normalizedPos < 0.2) markerColor = '#ef4444' // red for low values
                              else if (normalizedPos < 0.4) markerColor = '#f97316' // orange
                              else if (normalizedPos > 0.8) markerColor = '#10b981' // green for high values
                              else if (normalizedPos > 0.6) markerColor = '#3b82f6' // blue

                              const isHovered = hoveredDraw?.drawNumber === draw.drawNumber

                              return (
                                <g key={draw.drawNumber}>
                                  {isHovered && (
                                    <circle
                                      cx={x}
                                      cy={y}
                                      r={12}
                                      fill={markerColor}
                                      opacity="0.2"
                                      style={{
                                        animation: 'pulse 1s infinite'
                                      }}
                                    />
                                  )}
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={isHovered ? 6 : 4}
                                    fill={isHovered ? '#fbbf24' : markerColor}
                                    stroke={isHovered ? '#fff' : '#a78bfa'}
                                    strokeWidth={isHovered ? 2 : 1}
                                    style={{
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease-in-out',
                                      filter: isHovered ? 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))' : 'none'
                                    }}
                                    onMouseEnter={(e) => {
                                      setHoveredDraw(draw)
                                      setHoverPos({ x: e.clientX, y: e.clientY })
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredDraw(null)
                                      setHoverPos(null)
                                    }}
                                  />
                                </g>
                              )
                            })}
                          </svg>

                          {/* Enhanced hover tooltip */}
                          {hoveredDraw && hoverPos && (
                            <div style={{
                              position: 'fixed',
                              left: hoverPos.x + 15,
                              top: hoverPos.y - 80,
                              backgroundColor: 'rgba(15, 23, 42, 0.98)',
                              border: '2px solid rgba(251, 191, 36, 0.6)',
                              borderRadius: '8px',
                              padding: '12px 16px',
                              fontSize: '13px',
                              color: '#fff',
                              pointerEvents: 'none',
                              zIndex: 1000,
                              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5), 0 0 20px rgba(251, 191, 36, 0.3)',
                              minWidth: '180px'
                            }}>
                              <div style={{
                                color: '#fbbf24',
                                fontWeight: '700',
                                marginBottom: '6px',
                                fontSize: '14px',
                                borderBottom: '1px solid rgba(251, 191, 36, 0.3)',
                                paddingBottom: '4px'
                              }}>
                                Draw #{hoveredDraw.drawNumber}
                              </div>
                              <div style={{ marginBottom: '4px' }}>
                                <span style={{ color: '#c4b5fd' }}>Value:</span>{' '}
                                <span style={{ color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                                  {formatValue(hoveredDraw.value)}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px' }}>
                                {hoveredDraw.value < mcDistribution.statistics.mean ? '↓ Below mean' : '↑ Above mean'}
                                {' '}({Math.abs(((hoveredDraw.value - mcDistribution.statistics.mean) / mcDistribution.statistics.mean) * 100).toFixed(1)}%)
                              </div>
                            </div>
                          )}

                          {/* Statistics table */}
                          <div style={{
                            marginTop: '24px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '16px'
                          }}>
                            <div style={{ padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '6px' }}>Skewness</div>
                              <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                                {mcDistribution.statistics.skew.toFixed(3)}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                {mcDistribution.statistics.skew > 0.5 ? 'Right-skewed' : mcDistribution.statistics.skew < -0.5 ? 'Left-skewed' : 'Symmetric'}
                              </div>
                            </div>
                            <div style={{ padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '6px' }}>Kurtosis</div>
                              <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                                {mcDistribution.statistics.kurtosis.toFixed(3)}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                {mcDistribution.statistics.kurtosis > 1 ? 'Heavy tails' : mcDistribution.statistics.kurtosis < -1 ? 'Light tails' : 'Normal-like'}
                              </div>
                            </div>
                            <div style={{ padding: '12px', backgroundColor: 'rgba(168, 85, 247, 0.05)', borderRadius: '6px' }}>
                              <div style={{ fontSize: '12px', color: '#c4b5fd', marginBottom: '6px' }}>IQR (P25-P75)</div>
                              <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
                                {formatValue(mcDistribution.percentiles.p75 - mcDistribution.percentiles.p25)}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                                Interquartile range
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#94a3b8'
                  }}>
                    Failed to load distribution data
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
