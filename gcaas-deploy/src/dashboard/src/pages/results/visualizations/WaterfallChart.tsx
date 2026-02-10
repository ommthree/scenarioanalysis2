import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ChevronRight, ChevronDown, Building2, FileText } from 'lucide-react'
import domtoimage from 'dom-to-image-more'
import { getDefaultDbPath, apiUrl } from '@/config'

interface Scenario {
  scenario_id: number
  name: string
}

interface LineItem {
  code: string
  display_name: string
}

interface Entity {
  entity_id: number
  name: string
  code: string
  granularity_level: string
  parent_entity_id: number | null
  children?: Entity[]
}

interface DriverContribution {
  driver_code: string
  driver_name: string
  value: number
  category?: string
}

interface ActionImpact {
  action_code: string
  action_name: string
  impact: number
}

type WaterfallMode = 'period-to-period' | 'scenario-to-scenario' | 'action-impact'

export default function WaterfallChart() {
  const dbPath = getDefaultDbPath()

  // State
  const [mode, setMode] = useState<WaterfallMode>('period-to-period')
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [periods, setPeriods] = useState<number[]>([])

  // Mode 1: Period-to-Period
  const [p2pScenario, setP2pScenario] = useState<number | null>(null)
  const [p2pEntity, setP2pEntity] = useState<number | null>(null)
  const [p2pPeriod1, setP2pPeriod1] = useState<number | null>(null)
  const [p2pPeriod2, setP2pPeriod2] = useState<number | null>(null)
  const [p2pLineItem, setP2pLineItem] = useState<string>('')

  // Mode 2: Scenario-to-Scenario
  const [s2sPeriod, setS2sPeriod] = useState<number | null>(null)
  const [s2sEntity, setS2sEntity] = useState<number | null>(null)
  const [s2sScenario1, setS2sScenario1] = useState<number | null>(null)
  const [s2sScenario2, setS2sScenario2] = useState<number | null>(null)
  const [s2sLineItem, setS2sLineItem] = useState<string>('')

  // Mode 3: Action Impact
  const [aiScenario, setAiScenario] = useState<number | null>(null)
  const [aiEntity, setAiEntity] = useState<number | null>(null)
  const [aiPeriod, setAiPeriod] = useState<number | null>(null)
  const [aiLineItem, setAiLineItem] = useState<string>('')

  // Data
  const [waterfallData, setWaterfallData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<{x: number, y: number, content: any} | null>(null)

  // AI Description
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Entity tree state
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())

  // Ref for capture
  const chartRef = useRef<HTMLDivElement>(null)

  // Cross terms toggle
  const [showCrossTerms, setShowCrossTerms] = useState(false)

  // Load initial data
  useEffect(() => {
    loadScenarios()
    loadLineItems()
    loadEntities()
    loadPeriods()
  }, [])

  const loadScenarios = async () => {
    try {
      const response = await fetch(`${apiUrl('/api/scenarios/list')}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      if (data.success) {
        setScenarios(data.scenarios || [])
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    }
  }

  const loadLineItems = async () => {
    try {
      // Use the risk-line-items endpoint
      const response = await fetch(`${apiUrl('/api/results/risk-line-items')}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      if (data.success && data.lineItems) {
        const items = data.lineItems.map((item: any) => ({
          code: item.code,
          display_name: item.name
        }))
        setLineItems(items)
      }
    } catch (error) {
      console.error('Failed to load line items:', error)
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
      const response = await fetch(`${apiUrl('/api/entities')}?dbPath=${encodeURIComponent(dbPath)}`)
      const flatEntities = await response.json()
      if (Array.isArray(flatEntities)) {
        const tree = buildEntityTree(flatEntities)
        setEntities(tree)
      }
    } catch (error) {
      console.error('Failed to load entities:', error)
    }
  }

  const loadPeriods = async () => {
    try {
      const response = await fetch(`${apiUrl('/api/results/periods')}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      if (data.success && data.periods) {
        setPeriods(data.periods)
      }
    } catch (error) {
      console.error('Failed to load periods:', error)
      // Fallback to default periods
      setPeriods([0, 1, 2, 3, 4, 5])
    }
  }

  // Auto-generate waterfall when all required fields are filled
  useEffect(() => {
    const canGenerate =
      (mode === 'period-to-period' && p2pScenario && p2pEntity && p2pPeriod1 !== null && p2pPeriod2 !== null && p2pLineItem) ||
      (mode === 'scenario-to-scenario' && s2sPeriod !== null && s2sEntity && s2sScenario1 && s2sScenario2 && s2sLineItem) ||
      (mode === 'action-impact' && aiScenario && aiEntity && aiPeriod !== null && aiLineItem)

    if (canGenerate && !loading) {
      loadWaterfallData()
    }
  }, [mode, p2pScenario, p2pEntity, p2pPeriod1, p2pPeriod2, p2pLineItem, s2sPeriod, s2sEntity, s2sScenario1, s2sScenario2, s2sLineItem, aiScenario, aiEntity, aiPeriod, aiLineItem])

  const loadWaterfallData = async () => {
    setLoading(true)
    try {
      if (mode === 'period-to-period' && p2pScenario && p2pEntity && p2pPeriod1 !== null && p2pPeriod2 !== null && p2pLineItem) {
        await loadPeriodToPeriodData()
      } else if (mode === 'scenario-to-scenario' && s2sPeriod !== null && s2sEntity && s2sScenario1 && s2sScenario2 && s2sLineItem) {
        await loadScenarioToScenarioData()
      } else if (mode === 'action-impact' && aiScenario && aiEntity && aiPeriod !== null && aiLineItem) {
        await loadActionImpactData()
      }
    } catch (error) {
      console.error('Failed to load waterfall data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodToPeriodData = async () => {
    if (p2pPeriod1 === null || p2pPeriod2 === null) return

    // Generate array of consecutive periods from p2pPeriod1 to p2pPeriod2
    const startPeriod = Math.min(p2pPeriod1, p2pPeriod2)
    const endPeriod = Math.max(p2pPeriod1, p2pPeriod2)
    const periodRange = []
    for (let p = startPeriod; p <= endPeriod; p++) {
      periodRange.push(p)
    }

    // Fetch driver decomposition for all periods in range
    const responses = await Promise.all(
      periodRange.map(period =>
        fetch(`${apiUrl('/api/results/driver-decomposition')}?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${p2pScenario}&period=${period}&entityId=${p2pEntity}&lineItemCode=${p2pLineItem}`)
      )
    )

    const allPeriodData = await Promise.all(responses.map(r => r.json()))

    if (!allPeriodData.every(d => d.success)) {
      console.error('Failed to fetch data for all periods')
      return
    }

    const waterfallItems: any[] = []

    // Start with the first period
    const firstPeriodData = allPeriodData[0]
    const signMultiplier = firstPeriodData.signConvention === 'negative' ? -1 : 1
    const startValue = firstPeriodData.lineItemValue || 0

    waterfallItems.push({
      type: 'start',
      label: `Period ${periodRange[0]}`,
      value: startValue,
      cumulative: startValue
    })

    let cumulative = startValue

    // Build consecutive waterfalls for each period transition
    for (let i = 0; i < periodRange.length - 1; i++) {
      const currentPeriod = periodRange[i]
      const nextPeriod = periodRange[i + 1]
      const data1 = allPeriodData[i]
      const data2 = allPeriodData[i + 1]

      const drivers1 = data1.drivers || []
      const drivers2 = data2.drivers || []

      // Create a map of driver changes for this transition
      const driverMap = new Map<string, { name: string; change: number; category: string }>()

      const allDriverCodes = new Set([
        ...drivers1.map((d: DriverContribution) => d.driver_code),
        ...drivers2.map((d: DriverContribution) => d.driver_code)
      ])

      allDriverCodes.forEach((code) => {
        const d1 = drivers1.find((d: DriverContribution) => d.driver_code === code)
        const d2 = drivers2.find((d: DriverContribution) => d.driver_code === code)
        const d1Value = (d1?.value || 0) * signMultiplier
        const d2Value = (d2?.value || 0) * signMultiplier
        const change = d2Value - d1Value

        if (Math.abs(change) > 0.01) {
          driverMap.set(code, {
            name: d2?.driver_name || d1?.driver_name || code,
            change,
            category: d2?.category || d1?.category || 'Other'
          })
        }
      })

      // Add driver bars for this transition
      Array.from(driverMap.entries()).forEach(([code, data]) => {
        cumulative += data.change
        waterfallItems.push({
          type: 'driver',
          label: data.name,
          value: data.change,
          cumulative,
          category: data.category
        })
      })

      // Add cross terms if needed
      const actualNextValue = data2.lineItemValue || 0
      const crossTerms = actualNextValue - cumulative
      if (Math.abs(crossTerms) > 0.01) {
        cumulative += crossTerms
        waterfallItems.push({
          type: 'driver',
          label: 'Cross Terms',
          value: crossTerms,
          cumulative,
          category: 'Other',
          isCrossTerm: true
        })
      }

      // Add intermediate period marker (end of current transition, start of next)
      waterfallItems.push({
        type: i === periodRange.length - 2 ? 'end' : 'intermediate',
        label: `Period ${nextPeriod}`,
        value: actualNextValue,
        cumulative: actualNextValue
      })

      cumulative = actualNextValue
    }

    console.log('=== Multi-Period Waterfall Debug ===')
    console.log('Period Range:', periodRange)
    console.log('Waterfall Items:', waterfallItems.length)
    console.log('=========================================')

    setWaterfallData(waterfallItems)
  }

  const loadScenarioToScenarioData = async () => {
    // Fetch driver decomposition for both scenarios
    const [response1, response2] = await Promise.all([
      fetch(`${apiUrl('/api/results/driver-decomposition')}?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${s2sScenario1}&period=${s2sPeriod}&entityId=${s2sEntity}&lineItemCode=${s2sLineItem}`),
      fetch(`${apiUrl('/api/results/driver-decomposition')}?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${s2sScenario2}&period=${s2sPeriod}&entityId=${s2sEntity}&lineItemCode=${s2sLineItem}`)
    ])

    const [data1, data2] = await Promise.all([response1.json(), response2.json()])

    if (data1.success && data2.success) {
      const drivers1 = data1.drivers || []
      const drivers2 = data2.drivers || []

      // Create a map of driver changes
      const driverMap = new Map<string, { name: string; change: number; category: string }>()

      // Check all drivers from both scenarios
      const allDriverCodes = new Set([
        ...drivers1.map((d: DriverContribution) => d.driver_code),
        ...drivers2.map((d: DriverContribution) => d.driver_code)
      ])

      // If line item has negative sign convention, driver contributions are inverted
      // (e.g., EXPENSES contributions are negative, but we want to show absolute expense changes)
      const signMultiplier = data1.signConvention === 'negative' ? -1 : 1

      allDriverCodes.forEach((code) => {
        const d1 = drivers1.find((d: DriverContribution) => d.driver_code === code)
        const d2 = drivers2.find((d: DriverContribution) => d.driver_code === code)
        const d1Value = (d1?.value || 0) * signMultiplier
        const d2Value = (d2?.value || 0) * signMultiplier
        const change = d2Value - d1Value

        if (Math.abs(change) > 0.01) {
          driverMap.set(code, {
            name: d2?.driver_name || d1?.driver_name || code,
            change,
            category: d2?.category || d1?.category || 'Other'
          })
        }
      })

      // Build waterfall data
      const scenario1Name = scenarios.find(s => s.scenario_id === s2sScenario1)?.name || `Scenario ${s2sScenario1}`
      const scenario2Name = scenarios.find(s => s.scenario_id === s2sScenario2)?.name || `Scenario ${s2sScenario2}`
      const startValue = data1.lineItemValue || 0
      const endValue = data2.lineItemValue || 0

      console.log('=== Scenario-to-Scenario Waterfall Debug ===')
      console.log('Line Item:', s2sLineItem)
      console.log('Entity:', s2sEntity)
      console.log('Period:', s2sPeriod)
      console.log('Scenario 1:', s2sScenario1, '→ Scenario 2:', s2sScenario2)
      console.log('')
      console.log('Sign Convention:', data1.signConvention)
      console.log('Sign Multiplier:', signMultiplier, '(1 = use as-is, -1 = flip sign)')
      console.log('')
      console.log('Start Value (Scenario 1):', startValue)
      console.log('End Value (Scenario 2):', endValue)
      console.log('Actual Difference:', endValue - startValue)
      console.log('')
      console.log('Driver Contributions (Scenario 1):')
      drivers1.forEach((d: DriverContribution) => {
        console.log(`  ${d.driver_code}: ${d.value} × ${signMultiplier} = ${d.value * signMultiplier}`)
      })
      console.log('')
      console.log('Driver Contributions (Scenario 2):')
      drivers2.forEach((d: DriverContribution) => {
        console.log(`  ${d.driver_code}: ${d.value} × ${signMultiplier} = ${d.value * signMultiplier}`)
      })
      console.log('')
      console.log('Driver Changes:')
      Array.from(driverMap.entries()).forEach(([code, data]) => {
        const d1 = drivers1.find((d: DriverContribution) => d.driver_code === code)
        const d2 = drivers2.find((d: DriverContribution) => d.driver_code === code)
        const d1Val = (d1?.value || 0) * signMultiplier
        const d2Val = (d2?.value || 0) * signMultiplier
        console.log(`  ${code}: ${d2Val} - ${d1Val} = ${data.change}`)
      })
      console.log('')
      const sumDriverChanges = Array.from(driverMap.values()).reduce((sum, d) => sum + d.change, 0)
      console.log('Sum of Driver Changes:', sumDriverChanges)
      console.log('Calculated End Value:', startValue + sumDriverChanges)
      console.log('Actual End Value:', endValue)
      console.log('Residual:', endValue - (startValue + sumDriverChanges))
      console.log('==========================================')
      console.log('')
      const waterfallItems = [
        { type: 'start', label: scenario1Name, value: startValue, cumulative: startValue }
      ]

      let cumulative = startValue
      Array.from(driverMap.entries()).forEach(([code, data]) => {
        cumulative += data.change
        waterfallItems.push({
          type: 'driver',
          label: data.name,
          value: data.change,
          cumulative,
          category: data.category
        })
      })

      // Add cross terms if there's a difference between calculated and actual end value
      const calculatedEnd = cumulative
      const crossTerms = endValue - calculatedEnd
      if (Math.abs(crossTerms) > 0.01) {
        cumulative += crossTerms
        waterfallItems.push({
          type: 'driver',
          label: 'Cross Terms',
          value: crossTerms,
          cumulative,
          category: 'Other',
          isCrossTerm: true
        })
      }

      waterfallItems.push({
        type: 'end',
        label: scenario2Name,
        value: endValue,
        cumulative: endValue
      })

      setWaterfallData(waterfallItems)
    }
  }

  const loadActionImpactData = async () => {
    // Fetch all what-if combinations for this scenario
    const url = `${apiUrl('/api/results/what-if-values')}?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${aiScenario}&entityId=${aiEntity}&period=${aiPeriod}&lineItemCode=${aiLineItem}`
    console.log('Action Impact API URL:', url)

    const response = await fetch(url)
    const data = await response.json()

    console.log('Action Impact API Response:', data)

    if (!data.success || !data.results) {
      console.log('No results found:', data)
      setWaterfallData([])
      return
    }

    // Group by what-if combination
    const byCombo: Record<string, number> = {}
    data.results.forEach((row: any) => {
      const combo = row.what_if_combination || 'BASE'
      byCombo[combo] = row.value
    })

    console.log('Grouped by what-if combination:', byCombo)

    // Get BASE value
    const baseValue = byCombo['BASE'] || 0

    // Get individual actions (single action combinations)
    const actions: Array<{code: string, name: string, value: number}> = []
    Object.keys(byCombo).forEach(combo => {
      if (combo !== 'BASE' && !combo.includes('+')) {
        actions.push({
          code: combo,
          name: combo.replace(/_/g, ' '),
          value: byCombo[combo]
        })
      }
    })

    console.log('Individual actions found:', actions)

    // Build waterfall
    const waterfallItems: any[] = []

    // Start bar
    waterfallItems.push({
      type: 'start',
      label: 'Baseline',
      value: baseValue,
      cumulative: baseValue
    })

    let cumulative = baseValue

    // Action bars - show impact of each action
    actions.forEach(action => {
      const impact = action.value - baseValue
      cumulative += impact

      waterfallItems.push({
        type: 'driver',
        label: action.name,
        value: impact,
        cumulative,
        category: impact < 0 ? 'Negative' : 'Positive'
      })
    })

    // End bar (should match sum of all actions if available)
    const allActionsCombo = actions.map(a => a.code).sort().join('+')
    const finalValue = byCombo[allActionsCombo] || cumulative

    waterfallItems.push({
      type: 'end',
      label: 'With Actions',
      value: finalValue,
      cumulative: finalValue
    })

    console.log('Waterfall items:', waterfallItems)
    setWaterfallData(waterfallItems)
  }

  const addToReport = async () => {
    if (!chartRef.current) return

    try {
      // Find elements to temporarily style
      const cards = chartRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = chartRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = chartRef.current.querySelectorAll('h2, h3') as NodeListOf<HTMLElement>
      const texts = chartRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        background: chartRef.current.style.background,
        padding: chartRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

      // Apply white theme
      chartRef.current.style.backgroundColor = '#ffffff'
      chartRef.current.style.padding = '24px'
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
      const imageData = await domtoimage.toPng(chartRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore styles
      chartRef.current.style.background = originalStyles.background
      chartRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i] })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i] })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i] })

      // Build caption based on mode and current selections
      let caption = 'Waterfall Analysis: '
      if (mode === 'period-to-period') {
        const scenario = scenarios.find(s => s.scenario_id === p2pScenario)
        const entity = findEntityInTree(entities, p2pEntity)
        const lineItem = lineItems.find(li => li.code === p2pLineItem)
        caption += `${lineItem?.display_name || p2pLineItem} for ${entity?.name || 'entity'} in ${scenario?.name || 'scenario'} from Period ${p2pPeriod1} to Period ${p2pPeriod2}`
      } else if (mode === 'scenario-to-scenario') {
        const scenario1 = scenarios.find(s => s.scenario_id === s2sScenario1)
        const scenario2 = scenarios.find(s => s.scenario_id === s2sScenario2)
        const entity = findEntityInTree(entities, s2sEntity)
        const lineItem = lineItems.find(li => li.code === s2sLineItem)
        caption += `${lineItem?.display_name || s2sLineItem} for ${entity?.name || 'entity'} comparing ${scenario1?.name || 'scenario 1'} vs ${scenario2?.name || 'scenario 2'} in Period ${s2sPeriod}`
      } else if (mode === 'action-impact') {
        const scenario = scenarios.find(s => s.scenario_id === aiScenario)
        const entity = findEntityInTree(entities, aiEntity)
        const lineItem = lineItems.find(li => li.code === aiLineItem)
        caption += `Action Impact on ${lineItem?.display_name || aiLineItem} for ${entity?.name || 'entity'} in ${scenario?.name || 'scenario'} Period ${aiPeriod}`
      }

      // Save snippet
      const snippet = {
        id: `waterfall-${Date.now()}`,
        type: 'visualization' as const,
        source: 'waterfall' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      alert('Added to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const findEntityInTree = (entities: Entity[], entityId: number | null): Entity | null => {
    if (!entityId) return null
    for (const entity of entities) {
      if (entity.entity_id === entityId) return entity
      if (entity.children) {
        const found = findEntityInTree(entity.children, entityId)
        if (found) return found
      }
    }
    return null
  }

  const generateAIDescription = async () => {
    if (waterfallData.length === 0) return

    setAiLoading(true)
    try {
      // Build context based on mode
      let contextDescription = ''
      if (mode === 'period-to-period') {
        const scenario = scenarios.find(s => s.scenario_id === p2pScenario)
        const entity = entities.find(e => e.entity_id === p2pEntity)
        const lineItem = lineItems.find(li => li.code === p2pLineItem)
        contextDescription = `Analyzing ${lineItem?.display_name || p2pLineItem} for ${entity?.name || 'entity'} in scenario "${scenario?.name || ''}" from Period ${p2pPeriod1} to Period ${p2pPeriod2}.`
      } else if (mode === 'scenario-to-scenario') {
        const scenario1 = scenarios.find(s => s.scenario_id === s2sScenario1)
        const scenario2 = scenarios.find(s => s.scenario_id === s2sScenario2)
        const entity = entities.find(e => e.entity_id === s2sEntity)
        const lineItem = lineItems.find(li => li.code === s2sLineItem)
        contextDescription = `Comparing ${lineItem?.display_name || s2sLineItem} for ${entity?.name || 'entity'} between scenario "${scenario1?.name || ''}" and "${scenario2?.name || ''}" in Period ${s2sPeriod}.`
      }

      // Extract driver changes
      const driverChanges = waterfallData
        .filter(item => item.type === 'driver' && item.label !== 'Cross Terms')
        .map(item => ({
          driver: item.label,
          change: item.value,
          category: item.category
        }))

      const startValue = waterfallData.find(item => item.type === 'start')?.value || 0
      const endValue = waterfallData.find(item => item.type === 'end')?.value || 0
      const totalChange = endValue - startValue

      const prompt = `You are a financial and climate risk analysis expert. Analyze this waterfall chart data and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Waterfall Data:
- Start Value: ${startValue.toFixed(0)}
- End Value: ${endValue.toFixed(0)}
- Total Change: ${totalChange.toFixed(0)}

Driver Contributions:
${driverChanges.map(d => `- ${d.driver}: ${d.change > 0 ? '+' : ''}${d.change.toFixed(0)} (${d.category || 'Other'})`).join('\n')}

Provide a narrative summary that:
1. Explains the overall change and direction
2. Highlights the most significant drivers (positive or negative)
3. Identifies any interesting patterns or insights
4. Uses business-friendly language

Keep it concise (2-4 sentences) and insightful. Do not use bullet points or lists in your response - write as a flowing paragraph.`

      const response = await fetch(apiUrl('/api/claude/messages'), {
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

  // Process waterfall data based on cross terms toggle
  const getProcessedWaterfallData = () => {
    if (showCrossTerms || waterfallData.length === 0) {
      return waterfallData
    }

    // Find cross terms items
    const crossTermsItems = waterfallData.filter(item => item.isCrossTerm)
    if (crossTermsItems.length === 0) {
      return waterfallData
    }

    // Sum all cross terms values
    const totalCrossTerms = crossTermsItems.reduce((sum, item) => sum + item.value, 0)

    // Deep copy items and filter out cross terms
    const result = waterfallData
      .filter(item => !item.isCrossTerm)
      .map(item => ({ ...item }))

    // Get driver items for distribution
    const driverItems = result.filter(item => item.type === 'driver')
    const totalDriverAbsValue = driverItems.reduce((sum, item) => sum + Math.abs(item.value), 0)

    // Distribute cross terms pro-rata among drivers
    // Option A: Sign-aware distribution (positives to positives, negatives to negatives)
    if (driverItems.length > 0) {
      if (totalCrossTerms > 0) {
        // Distribute positive cross terms to positive drivers
        const posDrivers = driverItems.filter(item => item.value > 0)
        const sumPositive = posDrivers.reduce((sum, item) => sum + item.value, 0)

        if (sumPositive > 0) {
          // Option A: distribute to same-sign bars
          for (const item of result) {
            if (item.type === 'driver' && item.value > 0) {
              const proportion = item.value / sumPositive
              item.value = item.value + totalCrossTerms * proportion
            }
          }
        } else {
          // Option B fallback: distribute proportionally to all bars by magnitude
          for (const item of result) {
            if (item.type === 'driver') {
              const proportion = Math.abs(item.value) / totalDriverAbsValue
              item.value = item.value + totalCrossTerms * proportion
            }
          }
        }
      } else if (totalCrossTerms < 0) {
        // Distribute negative cross terms to negative drivers
        const negDrivers = driverItems.filter(item => item.value < 0)
        const sumNegativeAbs = negDrivers.reduce((sum, item) => sum + Math.abs(item.value), 0)

        if (sumNegativeAbs > 0) {
          // Option A: distribute to same-sign bars
          for (const item of result) {
            if (item.type === 'driver' && item.value < 0) {
              const proportion = Math.abs(item.value) / sumNegativeAbs
              item.value = item.value + totalCrossTerms * proportion
            }
          }
        } else {
          // Option B fallback: distribute proportionally to all bars by magnitude
          for (const item of result) {
            if (item.type === 'driver') {
              const proportion = Math.abs(item.value) / totalDriverAbsValue
              item.value = item.value + totalCrossTerms * proportion
            }
          }
        }
      }
    }

    // Recalculate cumulative values
    let cumulative = 0
    for (let i = 0; i < result.length; i++) {
      if (result[i].type === 'start') {
        cumulative = result[i].value
        result[i].cumulative = result[i].value
      } else if (result[i].type === 'driver') {
        cumulative += result[i].value
        result[i].cumulative = cumulative
      } else if (result[i].type === 'end' || result[i].type === 'intermediate') {
        result[i].cumulative = result[i].value
        cumulative = result[i].value
      }
    }

    return result
  }

  const renderWaterfall = () => {
    const processedData = getProcessedWaterfallData()
    if (processedData.length === 0) return null

    const maxValue = Math.max(...processedData.map(d => Math.abs(d.cumulative)))
    const chartHeight = 400
    const chartWidth = 900
    const barWidth = (chartWidth - 100) / processedData.length
    const margin = { top: 40, right: 40, bottom: 80, left: 100 }

    const yScale = (value: number) => {
      return margin.top + (chartHeight - margin.top - margin.bottom) * (1 - (value / (maxValue * 1.2)))
    }

    const getBarColor = (item: any) => {
      if (item.type === 'start' || item.type === 'end' || item.type === 'intermediate') return '#64748b'
      return item.value >= 0 ? '#10b981' : '#ef4444'
    }

    return (
      <div style={{ marginTop: '32px', overflowX: 'auto' }}>
        <svg width={chartWidth} height={chartHeight + margin.bottom}>
          {/* Y-axis */}
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={chartHeight - margin.bottom}
            stroke="#475569"
            strokeWidth={2}
          />

          {/* Zero line */}
          <line
            x1={margin.left}
            y1={yScale(0)}
            x2={chartWidth - margin.right}
            y2={yScale(0)}
            stroke="#475569"
            strokeWidth={1}
            strokeDasharray="4"
          />

          {/* Bars */}
          {processedData.map((item, i) => {
            const x = margin.left + i * barWidth + barWidth * 0.1
            const width = barWidth * 0.8

            let barY, barHeight
            if (item.type === 'start' || item.type === 'end' || item.type === 'intermediate') {
              barY = yScale(item.value)
              barHeight = yScale(0) - yScale(item.value)
            } else {
              const prevCumulative = i > 0 ? processedData[i - 1].cumulative : 0
              const currentCumulative = item.cumulative
              barY = yScale(Math.max(prevCumulative, currentCumulative))
              barHeight = Math.abs(yScale(currentCumulative) - yScale(prevCumulative))
            }

            // Connector line to next bar
            const showConnector = i < processedData.length - 1 && item.type !== 'end'
            const nextX = margin.left + (i + 1) * barWidth + barWidth * 0.1

            const isHovered = hoveredBar === i

            return (
              <g key={i}>
                {/* Bar */}
                <rect
                  x={x}
                  y={barY}
                  width={width}
                  height={Math.abs(barHeight)}
                  fill={getBarColor(item)}
                  stroke={isHovered ? '#60a5fa' : '#1e293b'}
                  strokeWidth={isHovered ? 2 : 1}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    filter: isHovered ? 'brightness(1.2) drop-shadow(0 0 8px rgba(59, 130, 246, 0.6))' : 'none',
                    opacity: isHovered ? 1 : 0.95,
                    animation: `barGrow 0.6s ease-out ${i * 0.05}s both`
                  }}
                  onMouseEnter={(e) => {
                    setHoveredBar(i)
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      content: item
                    })
                  }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      content: item
                    })
                  }}
                  onMouseLeave={() => {
                    setHoveredBar(null)
                    setTooltip(null)
                  }}
                />

                {/* Connector line */}
                {showConnector && (
                  <line
                    x1={x + width}
                    y1={yScale(item.cumulative)}
                    x2={nextX}
                    y2={yScale(item.cumulative)}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="2"
                  />
                )}

                {/* Value label */}
                <text
                  x={x + width / 2}
                  y={barY - 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="12"
                  fontWeight="500"
                >
                  {item.value.toFixed(0)}
                </text>

                {/* X-axis label */}
                <text
                  x={x + width / 2}
                  y={chartHeight - margin.bottom + 20}
                  textAnchor="end"
                  transform={`rotate(-45, ${x + width / 2}, ${chartHeight - margin.bottom + 20})`}
                  fill="#94a3b8"
                  fontSize="11"
                >
                  {item.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    )
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

  const renderEntityTree = (entities: Entity[], level = 0, onSelect: (id: number) => void, selectedId: number | null): React.ReactElement => {
    return (
      <div style={{ marginLeft: level > 0 ? '24px' : '0px' }}>
        {entities.map((entity) => {
          const hasChildren = entity.children && entity.children.length > 0
          const isExpanded = entity.entity_id ? expandedNodes.has(entity.entity_id) : false
          const isSelected = selectedId === entity.entity_id

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
                onClick={() => onSelect(entity.entity_id)}
              >
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (entity.entity_id) toggleNode(entity.entity_id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '6px' }}
                  >
                    {isExpanded ? (
                      <ChevronDown style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
                    ) : (
                      <ChevronRight style={{ width: '14px', height: '14px', color: '#3b82f6' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '20px' }} />}

                <Building2 style={{ width: '14px', height: '14px', color: '#3b82f6', marginRight: '6px' }} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: isSelected ? '600' : '400', color: '#fff' }}>
                    {entity.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {entity.code} • {entity.granularity_level}
                  </div>
                </div>
              </div>

              {hasChildren && isExpanded && renderEntityTree(entity.children!, level + 1, onSelect, selectedId)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', position: 'relative' }}>
      {/* CSS Animations */}
      <style>{`
        @keyframes barGrow {
          from {
            transform: scaleY(0);
            opacity: 0;
          }
          to {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -90%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%);
          }
        }
      `}</style>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            padding: '12px 16px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '500',
            pointerEvents: 'none',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(59, 130, 246, 0.4)',
            whiteSpace: 'nowrap',
            animation: 'tooltipFadeIn 0.15s ease-out'
          }}
        >
          <div style={{ fontWeight: '600', marginBottom: '4px', color: '#60a5fa', fontSize: '13px' }}>
            {tooltip.content.label}
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '12px', marginBottom: '4px' }}>
            Value: <span style={{ color: '#fff', fontWeight: '600' }}>{tooltip.content.value?.toFixed(0)}</span>
          </div>
          {tooltip.content.cumulative !== undefined && (
            <div style={{ color: '#cbd5e1', fontSize: '12px' }}>
              Cumulative: <span style={{ color: '#fff', fontWeight: '600' }}>{tooltip.content.cumulative?.toFixed(0)}</span>
            </div>
          )}
        </div>
      )}

      <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', marginBottom: '24px' }}>
        Waterfall Analysis
      </h1>

      {/* Mode Selection */}
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setMode('period-to-period')}
              style={{
                padding: '12px 24px',
                backgroundColor: mode === 'period-to-period' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                color: '#ffffff',
                border: mode === 'period-to-period' ? '2px solid #3b82f6' : '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Period to Period
            </button>
            <button
              onClick={() => setMode('scenario-to-scenario')}
              style={{
                padding: '12px 24px',
                backgroundColor: mode === 'scenario-to-scenario' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                color: '#ffffff',
                border: mode === 'scenario-to-scenario' ? '2px solid #3b82f6' : '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Scenario to Scenario
            </button>
            <button
              onClick={() => setMode('action-impact')}
              style={{
                padding: '12px 24px',
                backgroundColor: mode === 'action-impact' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                color: '#ffffff',
                border: mode === 'action-impact' ? '2px solid #3b82f6' : '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Action Impact (What-If)
            </button>
          </div>

          {/* Cross Terms Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            marginTop: '16px'
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#cbd5e1',
              fontWeight: '500',
              gap: '12px'
            }}>
              <span>Show cross terms separately</span>
              <div
                onClick={() => setShowCrossTerms(!showCrossTerms)}
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '24px',
                  backgroundColor: showCrossTerms ? '#3b82f6' : '#475569',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  border: '2px solid ' + (showCrossTerms ? '#60a5fa' : '#64748b')
                }}
              >
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  left: showCrossTerms ? '22px' : '2px',
                  width: '16px',
                  height: '16px',
                  backgroundColor: '#fff',
                  borderRadius: '50%',
                  transition: 'left 0.2s',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </label>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
              (When off, cross terms are distributed pro-rata among drivers)
            </span>
          </div>

          {/* Period to Period Mode */}
          {mode === 'period-to-period' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Scenario
                </label>
                <select
                  value={p2pScenario || ''}
                  onChange={(e) => setP2pScenario(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  From Period
                </label>
                <select
                  value={p2pPeriod1 ?? ''}
                  onChange={(e) => setP2pPeriod1(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select period...</option>
                  {periods.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  To Period
                </label>
                <select
                  value={p2pPeriod2 ?? ''}
                  onChange={(e) => setP2pPeriod2(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select period...</option>
                  {periods.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Line Item
                </label>
                <select
                  value={p2pLineItem}
                  onChange={(e) => setP2pLineItem(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select line item...</option>
                  {lineItems.map(li => (
                    <option key={li.code} value={li.code}>{li.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Entity
                </label>
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)'
                }}>
                  {entities.length > 0 ? renderEntityTree(entities, 0, setP2pEntity, p2pEntity) : (
                    <div style={{ color: '#94a3b8', fontSize: '12px', padding: '6px' }}>
                      No entities available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Scenario to Scenario Mode */}
          {mode === 'scenario-to-scenario' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Period
                </label>
                <select
                  value={s2sPeriod ?? ''}
                  onChange={(e) => setS2sPeriod(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select period...</option>
                  {periods.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  From Scenario
                </label>
                <select
                  value={s2sScenario1 || ''}
                  onChange={(e) => setS2sScenario1(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  To Scenario
                </label>
                <select
                  value={s2sScenario2 || ''}
                  onChange={(e) => setS2sScenario2(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Line Item
                </label>
                <select
                  value={s2sLineItem}
                  onChange={(e) => setS2sLineItem(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select line item...</option>
                  {lineItems.map(li => (
                    <option key={li.code} value={li.code}>{li.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Entity
                </label>
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)'
                }}>
                  {entities.length > 0 ? renderEntityTree(entities, 0, setS2sEntity, s2sEntity) : (
                    <div style={{ color: '#94a3b8', fontSize: '12px', padding: '6px' }}>
                      No entities available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Impact Mode */}
          {mode === 'action-impact' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Scenario (What-If)
                </label>
                <select
                  value={aiScenario || ''}
                  onChange={(e) => setAiScenario(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => (
                    <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Period
                </label>
                <select
                  value={aiPeriod || ''}
                  onChange={(e) => setAiPeriod(e.target.value ? parseInt(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select period...</option>
                  {periods.map(p => (
                    <option key={p} value={p}>Period {p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Line Item
                </label>
                <select
                  value={aiLineItem}
                  onChange={(e) => setAiLineItem(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  <option value="">Select line item...</option>
                  {lineItems.map(li => (
                    <option key={li.code} value={li.code}>{li.display_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                  Entity
                </label>
                <div style={{
                  maxHeight: '180px',
                  overflowY: 'auto',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)'
                }}>
                  {entities.length > 0 ? renderEntityTree(entities, 0, setAiEntity, aiEntity) : (
                    <div style={{ color: '#94a3b8', fontSize: '12px', padding: '6px' }}>
                      No entities available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
              Generating waterfall...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Waterfall Chart */}
      {waterfallData.length > 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0 }}>
                Driver Waterfall
              </h2>
              <button
                onClick={addToReport}
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
            <div ref={chartRef}>
              {renderWaterfall()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Description Panel */}
      {waterfallData.length > 0 && (
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
                    Generate AI Description
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
                Click the button above to generate AI-powered insights about this waterfall analysis
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
