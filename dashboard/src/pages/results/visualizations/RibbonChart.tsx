import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, ChevronRight, ChevronDown, Building2, FileText } from 'lucide-react'
import Plot from 'react-plotly.js'
import domtoimage from 'dom-to-image-more'
import { getDefaultDbPath } from '@/config'

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

type RibbonMode = 'period-to-period' | 'scenario-to-scenario' | 'driver-mapping'

export default function RibbonChart() {
  const dbPath = getDefaultDbPath()

  // State
  const [mode, setMode] = useState<RibbonMode>('period-to-period')
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

  // Mode 3: Driver Mapping (auto-loaded with defaults)
  const [dmScenario, setDmScenario] = useState<number | null>(null)
  const [dmEntity, setDmEntity] = useState<number | null>(null)
  const [dmPeriod, setDmPeriod] = useState<number | null>(null)

  // Auto-set defaults for driver mapping mode
  useEffect(() => {
    if (mode === 'driver-mapping' && scenarios.length > 0 && entities.length > 0 && periods.length > 0) {
      if (!dmScenario) setDmScenario(scenarios[0].scenario_id)
      if (!dmEntity) setDmEntity(entities[0].entity_id)
      // Skip period 0 if it exists, use period 1
      if (!dmPeriod) {
        const firstValidPeriod = periods.find(p => p > 0) || periods[0]
        setDmPeriod(firstValidPeriod)
      }
    }
  }, [mode, scenarios, entities, periods])

  // Data
  const [ribbonData, setRibbonData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // AI Description
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Entity tree state
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())

  // Ref for capture
  const chartRef = useRef<HTMLDivElement>(null)

  // Load initial data
  useEffect(() => {
    loadScenarios()
    loadLineItems()
    loadEntities()
    loadPeriods()
  }, [])

  // Helper function to duplicate values for ribbon corners (4 points per bar)
  const getVal = (values: number[], sub: number, axis: 'x' | 'y'): number[] => {
    const result: number[] = []
    for (const val of values) {
      if (axis === 'x') {
        result.push(val - sub, val + sub)
      } else {
        result.push(val, val)
      }
    }
    return result
  }

  const loadScenarios = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`)
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
      const response = await fetch(`http://localhost:3001/api/results/risk-line-items?dbPath=${encodeURIComponent(dbPath)}`)
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
      const response = await fetch(`http://localhost:3001/api/entities?dbPath=${encodeURIComponent(dbPath)}`)
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
      const response = await fetch(`http://localhost:3001/api/results/periods?dbPath=${encodeURIComponent(dbPath)}`)
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

  // Auto-generate ribbon when all required fields are filled
  useEffect(() => {
    const canGenerate =
      (mode === 'period-to-period' && p2pScenario && p2pEntity && p2pPeriod1 !== null && p2pPeriod2 !== null && p2pLineItem) ||
      (mode === 'scenario-to-scenario' && s2sPeriod !== null && s2sEntity && s2sScenario1 && s2sScenario2 && s2sLineItem) ||
      (mode === 'driver-mapping' && dmScenario && dmEntity && dmPeriod !== null)

    if (canGenerate && !loading) {
      loadRibbonData()
    }
  }, [mode, p2pScenario, p2pEntity, p2pPeriod1, p2pPeriod2, p2pLineItem, s2sPeriod, s2sEntity, s2sScenario1, s2sScenario2, s2sLineItem, dmScenario, dmEntity, dmPeriod])

  const loadRibbonData = async () => {
    setLoading(true)
    try {
      if (mode === 'period-to-period' && p2pScenario && p2pEntity && p2pPeriod1 !== null && p2pPeriod2 !== null && p2pLineItem) {
        await loadPeriodToPeriodData()
      } else if (mode === 'scenario-to-scenario' && s2sPeriod !== null && s2sEntity && s2sScenario1 && s2sScenario2 && s2sLineItem) {
        await loadScenarioToScenarioData()
      } else if (mode === 'driver-mapping' && dmScenario && dmEntity && dmPeriod !== null) {
        await loadDriverMappingData()
      }
    } catch (error) {
      console.error('Failed to load ribbon data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPeriodToPeriodData = async () => {
    if (p2pPeriod1 === null || p2pPeriod2 === null) return

    // Generate array of consecutive periods
    const startPeriod = Math.min(p2pPeriod1, p2pPeriod2)
    const endPeriod = Math.max(p2pPeriod1, p2pPeriod2)
    const periodRange = []
    for (let p = startPeriod; p <= endPeriod; p++) {
      periodRange.push(p)
    }

    // Fetch driver decomposition for all periods
    const responses = await Promise.all(
      periodRange.map(period =>
        fetch(`http://localhost:3001/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${p2pScenario}&period=${period}&entityId=${p2pEntity}&lineItemCode=${p2pLineItem}`)
      )
    )

    const allPeriodData = await Promise.all(responses.map(r => r.json()))

    if (!allPeriodData.every(d => d.success)) {
      console.error('Failed to fetch data for all periods')
      return
    }

    // Build ribbon data structure
    const ribbonItems: any[] = []
    const signMultiplier = allPeriodData[0].signConvention === 'negative' ? -1 : 1

    // Collect all unique drivers across all periods
    const allDriverCodes = new Set<string>()
    allPeriodData.forEach(data => {
      const drivers = data.drivers || []
      drivers.forEach((d: DriverContribution) => {
        allDriverCodes.add(d.driver_code)
      })
    })

    // Build ribbon data for each period
    periodRange.forEach((period, i) => {
      const data = allPeriodData[i]
      const drivers = data.drivers || []
      const lineItemValue = data.lineItemValue || 0

      const periodData: any = {
        period,
        lineItemValue,
        drivers: {}
      }

      // Add contribution for each driver
      allDriverCodes.forEach(driverCode => {
        const driver = drivers.find((d: DriverContribution) => d.driver_code === driverCode)
        periodData.drivers[driverCode] = {
          value: (driver?.value || 0) * signMultiplier,
          name: driver?.driver_name || driverCode,
          category: driver?.category || 'Other'
        }
      })

      ribbonItems.push(periodData)
    })

    setRibbonData(ribbonItems)
  }

  const loadScenarioToScenarioData = async () => {
    // Fetch driver decomposition for both scenarios
    const [response1, response2] = await Promise.all([
      fetch(`http://localhost:3001/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${s2sScenario1}&period=${s2sPeriod}&entityId=${s2sEntity}&lineItemCode=${s2sLineItem}`),
      fetch(`http://localhost:3001/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${s2sScenario2}&period=${s2sPeriod}&entityId=${s2sEntity}&lineItemCode=${s2sLineItem}`)
    ])

    const [data1, data2] = await Promise.all([response1.json(), response2.json()])

    if (!data1.success || !data2.success) {
      console.error('Failed to fetch scenario data')
      return
    }

    const signMultiplier = data1.signConvention === 'negative' ? -1 : 1
    const scenario1Name = scenarios.find(s => s.scenario_id === s2sScenario1)?.name || `Scenario ${s2sScenario1}`
    const scenario2Name = scenarios.find(s => s.scenario_id === s2sScenario2)?.name || `Scenario ${s2sScenario2}`

    // Collect all unique drivers
    const allDriverCodes = new Set<string>()
    ;[data1.drivers || [], data2.drivers || []].forEach(drivers => {
      drivers.forEach((d: DriverContribution) => {
        allDriverCodes.add(d.driver_code)
      })
    })

    const ribbonItems = [
      {
        label: scenario1Name,
        lineItemValue: data1.lineItemValue || 0,
        drivers: {}
      },
      {
        label: scenario2Name,
        lineItemValue: data2.lineItemValue || 0,
        drivers: {}
      }
    ]

    // Add driver contributions
    allDriverCodes.forEach(driverCode => {
      const d1 = (data1.drivers || []).find((d: DriverContribution) => d.driver_code === driverCode)
      const d2 = (data2.drivers || []).find((d: DriverContribution) => d.driver_code === driverCode)

      ribbonItems[0].drivers[driverCode] = {
        value: (d1?.value || 0) * signMultiplier,
        name: d1?.driver_name || d2?.driver_name || driverCode,
        category: d1?.category || d2?.category || 'Other'
      }

      ribbonItems[1].drivers[driverCode] = {
        value: (d2?.value || 0) * signMultiplier,
        name: d2?.driver_name || d1?.driver_name || driverCode,
        category: d2?.category || d1?.category || 'Other'
      }
    })

    setRibbonData(ribbonItems)
  }

  const loadDriverMappingData = async () => {
    // Query distinct driver-to-lineitem mappings from statement_result_by_driver
    const url = `http://localhost:3001/api/results/driver-mappings?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${dmScenario}&entityId=${dmEntity}&period=${dmPeriod}`
    console.log('Loading driver mappings from:', url)
    const response = await fetch(url)
    const data = await response.json()
    console.log('Driver mappings response:', data)

    if (!data.success || !data.mappings) {
      console.log('No mappings found')
      setRibbonData([])
      return
    }

    console.log('Setting ribbonData with', data.mappings.length, 'mappings')
    // Store the mappings for Sankey diagram
    setRibbonData(data.mappings)
  }

  const generateAIDescription = async () => {
    if (ribbonData.length === 0) return

    setAiLoading(true)
    try {
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

      const prompt = `You are a financial and climate risk analysis expert. Analyze this ribbon chart data and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Ribbon Data: ${JSON.stringify(ribbonData.slice(0, 3))}

Provide a narrative summary that:
1. Explains the overall trends and patterns
2. Highlights key driver contributions
3. Identifies any interesting insights
4. Uses business-friendly language

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

  const addToReport = async () => {
    if (!chartRef.current) return

    try {
      const cards = chartRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = chartRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = chartRef.current.querySelectorAll('h2') as NodeListOf<HTMLElement>
      const texts = chartRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      const originalStyles = {
        background: chartRef.current.style.background,
        padding: chartRef.current.style.padding,
        cards: Array.from(cards).map(card => ({ bg: card.style.backgroundColor, border: card.style.border })),
        buttons: Array.from(buttons).map(btn => btn.style.display),
        titles: Array.from(titles).map(title => title.style.color),
        texts: Array.from(texts).map(text => text.style.color)
      }

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

      const imageData = await domtoimage.toPng(chartRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      chartRef.current.style.background = originalStyles.background
      chartRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i] })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i] })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i] })

      let caption = ''
      if (mode === 'period-to-period') {
        const scenario = scenarios.find(s => s.scenario_id === p2pScenario)
        const entity = entities.find(e => e.entity_id === p2pEntity)
        const lineItem = lineItems.find(li => li.code === p2pLineItem)
        caption = `Ribbon Chart: ${scenario?.name || 'Unknown'} | ${entity?.name || 'Entity'} | ${lineItem?.display_name || 'Item'} | Periods ${p2pPeriod1}-${p2pPeriod2}`
      } else if (mode === 'scenario-to-scenario') {
        const scenario1 = scenarios.find(s => s.scenario_id === s2sScenario1)
        const scenario2 = scenarios.find(s => s.scenario_id === s2sScenario2)
        const entity = entities.find(e => e.entity_id === s2sEntity)
        const lineItem = lineItems.find(li => li.code === s2sLineItem)
        caption = `Ribbon Chart: ${scenario1?.name || 'S1'} vs ${scenario2?.name || 'S2'} | ${entity?.name || 'Entity'} | ${lineItem?.display_name || 'Item'} | Period ${s2sPeriod}`
      } else {
        caption = `Ribbon Chart: Driver Mapping | ${scenarios.find(s => s.scenario_id === dmScenario)?.name || 'Scenario'} | Period ${dmPeriod}`
      }

      const snippet = {
        id: `ribbon-${Date.now()}`,
        type: 'visualization' as const,
        source: 'ribbon' as const,
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
      console.error('Failed to capture ribbon chart:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const renderRibbon = () => {
    if (ribbonData.length === 0) return null

    // For period-to-period and scenario-to-scenario modes - Proper Ribbon Chart
    if (mode === 'period-to-period' || mode === 'scenario-to-scenario') {
      // Get all unique drivers
      const allDriverCodes = new Set<string>()
      ribbonData.forEach(item => {
        Object.keys(item.drivers || {}).forEach(code => allDriverCodes.add(code))
      })
      const driverList = Array.from(allDriverCodes)

      // Color palette
      const colorPalette = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
        '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
      ]
      const driverColors: Record<string, string> = {}
      driverList.forEach((code, idx) => {
        driverColors[code] = colorPalette[idx % colorPalette.length]
      })

      // Filter out periods where ALL drivers have zero or near-zero values
      const filteredRibbonData = ribbonData.filter(item => {
        // Only exclude period if ALL drivers are zero/near-zero
        return Object.values(item.drivers).some(d => Math.abs(d.value || 0) >= 0.01)
      })

      if (filteredRibbonData.length === 0) {
        return <div style={{ padding: '32px', color: '#94a3b8' }}>No data available for visualization</div>
      }

      // Calculate total magnitude across all drivers and periods to filter out tiny drivers
      const driverTotals: Record<string, number> = {}
      let grandTotal = 0

      filteredRibbonData.forEach(item => {
        Object.entries(item.drivers).forEach(([code, driver]) => {
          const value = Math.abs(driver.value || 0)
          driverTotals[code] = (driverTotals[code] || 0) + value
          grandTotal += value
        })
      })

      // Filter out drivers that are less than 1% of total magnitude
      const significantDrivers = driverList.filter(code => {
        const percentage = (driverTotals[code] || 0) / grandTotal
        return percentage >= 0.01  // Keep drivers that are at least 1% of total
      })

      console.log('=== Driver Filtering ===')
      console.log('Grand total:', grandTotal)
      console.log('Driver totals:', driverTotals)
      Object.keys(driverTotals).forEach(code => {
        const pct = ((driverTotals[code] / grandTotal) * 100).toFixed(2)
        console.log(`${code}: ${pct}% of total`)
      })
      console.log('Filtered from', driverList.length, 'to', significantDrivers.length, 'drivers')

      // Use significantDrivers instead of driverList for the rest of the visualization
      const activeDriverList = significantDrivers

      if (activeDriverList.length === 0) {
        return <div style={{ padding: '32px', color: '#94a3b8' }}>No significant drivers to display</div>
      }

      // Build data frame: rows = drivers, columns = periods
      // Calculate cumulative upper/lower bounds for stacking with gaps
      const driverData: Record<string, { upper: number[], lower: number[], midpoint: number }> = {}

      // Calculate appropriate gap based on driver value variance (only for active drivers)
      const allDriverValues: number[] = []
      filteredRibbonData.forEach(item => {
        activeDriverList.forEach(code => {
          const val = Math.abs(item.drivers[code]?.value || 0)
          if (val > 0.01) allDriverValues.push(val)
        })
      })

      // Calculate variance to determine gap size
      const mean = allDriverValues.reduce((sum, val) => sum + val, 0) / allDriverValues.length
      const variance = allDriverValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / allDriverValues.length
      const stdDev = Math.sqrt(variance)
      const coefficientOfVariation = stdDev / mean  // Normalized measure of variance

      // Dynamic gap: base 8% + additional gap based on variance (exponential growth for high variance)
      const baseGap = 0.08  // Reduced from 0.15 to make chart more compact
      // Use steeper exponential curve: varianceGap stays minimal for low CV, explodes for high CV
      const varianceGap = Math.min(1.5, Math.pow(coefficientOfVariation, 2.5) * 4.0)  // Reduced cap to 150% additional
      const gapBetweenRibbons = mean * (baseGap + varianceGap)

      console.log('=== Ribbon Chart Gap Calculation ===')
      console.log('Driver values:', allDriverValues)
      console.log('Mean:', mean)
      console.log('Std Dev:', stdDev)
      console.log('Coefficient of Variation:', coefficientOfVariation)
      console.log('Base Gap:', baseGap)
      console.log('Variance Gap:', varianceGap)
      console.log('Final Gap:', gapBetweenRibbons)
      console.log('Total Gap %:', ((baseGap + varianceGap) * 100).toFixed(1) + '%')
      console.log('=== Ribbon Rendering Debug ===')
      console.log('filteredRibbonData.length:', filteredRibbonData.length)
      console.log('activeDriverList:', activeDriverList)

      filteredRibbonData.forEach((item, periodIdx) => {
        // Sort drivers by value at this period for consistent stacking
        const sortedDrivers = activeDriverList
          .map(code => ({
            code,
            value: Math.abs(item.drivers[code]?.value || 0)
          }))
          .filter(d => d.value > 0.01)  // Only include non-zero drivers
          .sort((a, b) => a.value - b.value)

        console.log(`Period ${periodIdx + 1}: sortedDrivers:`, sortedDrivers)

        let cumulative = 0
        sortedDrivers.forEach(({ code, value }, idx) => {
          if (!driverData[code]) {
            driverData[code] = {
              upper: [],
              lower: [],
              midpoint: 0
            }
          }

          const lower = cumulative
          const upper = cumulative + value
          cumulative = upper + gapBetweenRibbons  // Add gap after each ribbon

          driverData[code].upper.push(upper)
          driverData[code].lower.push(lower)

          // Store midpoint for first period (for annotations)
          if (periodIdx === 0) {
            driverData[code].midpoint = (upper + lower) / 2
          }
        })
      })

      // Create x-axis values
      const numPeriods = filteredRibbonData.length
      const xValues = Array.from({ length: numPeriods }, (_, i) => i + 1)
      const xReversed = [...xValues].reverse()

      // Build Plotly traces
      const traces: any[] = []
      const annotations: any[] = []

      console.log('=== Driver Data Summary ===')
      console.log('driverData keys:', Object.keys(driverData))
      Object.keys(driverData).forEach(code => {
        console.log(`${code}: upper.length=${driverData[code].upper.length}, upper values:`, driverData[code].upper)
        console.log(`${code}: lower.length=${driverData[code].lower.length}, lower values:`, driverData[code].lower)
      })

      // Add ribbons (go.Scatter with fill='toself')
      activeDriverList.forEach(driverCode => {
        const data = driverData[driverCode]
        if (!data || data.upper.length === 0) return

        // Build x and y arrays following the exact Medium article pattern
        const barHalfWidth = 0.12  // Flat sections to constrain spline (reduced from 0.15)
        const edgeOffset = 0.15  // Extra offset for edge points to prevent overlap with curvier splines
        const xForward = getVal(xValues, barHalfWidth, 'x')
        const xBackward = [...xForward].reverse()  // Reverse AFTER getVal to maintain proper order

        const yUpperDoubled = getVal(data.upper, 0, 'y')
        const yLowerDoubled = getVal(data.lower, 0, 'y')
        const yLowerReversed = [...yLowerDoubled].reverse()

        // Add extra points at both ends to prevent spline overshoot
        const firstX = xValues[0]
        const lastX = xValues[xValues.length - 1]

        // Extra points before first position (further out to avoid overlap)
        const extraStartX = [firstX - edgeOffset, firstX - edgeOffset]
        const firstUpperY = data.upper[0]
        const firstLowerY = data.lower[0]
        const extraStartY = [firstLowerY, firstUpperY]  // Lower then upper for correct path

        // Extra points after last position (further out to avoid overlap)
        const extraEndX = [lastX + edgeOffset, lastX + edgeOffset]
        const lastUpperY = data.upper[data.upper.length - 1]
        const lastLowerY = data.lower[data.lower.length - 1]
        const extraEndY = [lastUpperY, lastLowerY]  // Upper then lower for correct path

        // Path: forward along top, extra end points, backward along bottom, extra start points
        const xPath = [...xForward, ...extraEndX, ...xBackward, ...extraStartX]
        const yPath = [...yUpperDoubled, ...extraEndY, ...yLowerReversed, ...extraStartY]

        traces.push({
          type: 'scatter',
          x: xPath,
          y: yPath,
          fill: 'toself',
          fillcolor: driverColors[driverCode],
          opacity: 0.5,
          line: {
            color: 'rgba(0,0,0,0)',  // Transparent line to hide edge artifacts
            shape: 'spline',
            width: 0,
            smoothing: 1.3  // Higher smoothing for curvier ribbons
          },
          mode: 'lines',
          name: driverCode,
          showlegend: false,
          hovertemplate: ' ',
          cliponaxis: true  // Clip content outside axis range
        })

        // Add annotation for first period
        const driver = ribbonData[0].drivers[driverCode]
        if (driver) {
          annotations.push({
            xref: 'paper',
            yref: 'y',
            x: -0.01,
            y: data.midpoint,
            text: driver.name,
            align: 'right',
            xanchor: 'right',
            font: {
              family: 'Arial',
              size: 12,
              color: driverColors[driverCode]
            },
            showarrow: false
          })
        }
      })

      // Add individual bars positioned at ribbon heights (not stacked)
      filteredRibbonData.forEach((item, periodIdx) => {
        activeDriverList.forEach(code => {
          const data = driverData[code]
          if (!data || !item.drivers[code]) return

          const driver = item.drivers[code]
          const value = Math.abs(driver.value || 0)
          if (value < 0.01) return

          // Get the lower and upper bounds from driverData for this period
          const lower = data.lower[periodIdx]
          const upper = data.upper[periodIdx]
          const barHeight = upper - lower
          const barHeightScale = 1.1  // Make bars 1.1x taller visually

          // Expand bar height while keeping it centered at the original position
          const centerY = (upper + lower) / 2
          const scaledHalfHeight = (barHeight * barHeightScale) / 2
          const scaledBase = centerY - scaledHalfHeight
          const scaledHeight = barHeight * barHeightScale

          traces.push({
            type: 'bar',
            x: [periodIdx + 1],
            y: [scaledHeight],
            base: [scaledBase],  // Adjust base to keep bar centered
            width: [0.05],  // Narrow bar width
            name: driver.name,
            marker: {
              color: driverColors[code],
              opacity: 0.7
            },
            text: [value.toFixed(0)],
            textposition: 'inside',
            textfont: {
              size: 10,
              color: 'white'
            },
            showlegend: false,
            hovertemplate: `<b>${driver.name}</b><br>${value.toFixed(0)}<extra></extra>`
          })
        })
      })

      console.log('=== Traces Built ===')
      console.log('Total traces:', traces.length)
      console.log('Ribbon traces:', traces.filter(t => t.type === 'scatter').length)
      console.log('Bar traces:', traces.filter(t => t.type === 'bar').length)

      // Collect all driver bar boundaries for clipping rectangles (between bars within stacks)
      const allBarBoundaries: Array<{x: number, y: number}> = []
      filteredRibbonData.forEach((item, periodIdx) => {
        // Sort drivers by their upper boundary to get boundaries in vertical order
        const sortedDrivers = activeDriverList
          .map(code => ({
            code,
            upper: driverData[code]?.upper[periodIdx],
            lower: driverData[code]?.lower[periodIdx]
          }))
          .filter(d => d.upper !== undefined && d.lower !== undefined)
          .sort((a, b) => a.upper - b.upper)

        // Add clipping at each boundary (which is both the upper of one driver and lower of the next)
        sortedDrivers.forEach(driver => {
          allBarBoundaries.push({ x: periodIdx + 1, y: driver.upper })
        })
      })

      // X-axis labels
      const xLabels = filteredRibbonData.map((item, idx) =>
        mode === 'period-to-period' ? `P${item.period}` : item.label
      )

      const layout: any = {
        title: {
          text: `Driver Flow ${mode === 'period-to-period' ? 'Across Periods' : 'Between Scenarios'}`,
          font: { color: '#ffffff', size: 18 }
        },
        barmode: 'stack',
        bargap: 0.7,
        plot_bgcolor: 'rgba(15, 23, 42, 0.9)',
        paper_bgcolor: 'rgba(15, 23, 42, 0.9)',
        font: { color: '#e2e8f0', size: 12 },
        height: 600,
        margin: { l: 150, r: 20, t: 60, b: 60 },
        xaxis: {
          range: [0.98, numPeriods + 0.02],
          tickmode: 'array',
          tickvals: xValues,
          ticktext: xLabels,
          showticklabels: true,
          fixedrange: true,
          gridcolor: 'rgba(71, 85, 105, 0.3)'
        },
        yaxis: {
          showticklabels: false,
          showgrid: false,
          fixedrange: true
        },
        annotations: annotations,
        shapes: [
          // Add clipping rectangles at each individual driver bar boundary
          ...allBarBoundaries.map(boundary => ({
            type: 'rect',
            xref: 'x',
            yref: 'y',
            x0: boundary.x - 0.06,
            x1: boundary.x + 0.06,
            y0: boundary.y - 8,
            y1: boundary.y + 8,
            fillcolor: 'rgba(15, 23, 42, 0.9)',
            line: { width: 0 },
            layer: 'above'
          }))
        ]
      }

      const config: any = {
        displayModeBar: true,
        displaylogo: false,
        responsive: true
      }

      return (
        <div style={{ marginTop: '32px' }}>
          <Plot
            data={traces}
            layout={layout}
            config={config}
            style={{ width: '100%', height: '600px' }}
          />
        </div>
      )
    }

    // For driver-mapping mode - Sankey diagram
    if (mode === 'driver-mapping') {
      console.log('Rendering Sankey with ribbonData:', ribbonData)

      if (ribbonData.length === 0) {
        return (
          <div style={{ marginTop: '32px', padding: '24px', color: '#94a3b8', textAlign: 'center' }}>
            No driver mappings found for this scenario/entity/period combination.
          </div>
        )
      }

      // Build nodes and links for Sankey diagram
      // Separate driver and line item nodes to avoid name collisions causing loops
      const drivers = Array.from(new Set(ribbonData.map((m: any) => m.driver_code)))
      const lineItems = Array.from(new Set(ribbonData.map((m: any) => m.line_item_code)))

      console.log('Drivers:', drivers)
      console.log('Line Items:', lineItems)

      // Node labels without prefixes
      const nodeLabels = [...drivers, ...lineItems]

      // Map original codes to node indices (drivers first, then line items)
      const driverIndices = new Map(drivers.map((d, idx) => [d, idx]))
      const lineItemIndices = new Map(lineItems.map((li, idx) => [li, idx + drivers.length]))

      const sources = ribbonData.map((m: any) => driverIndices.get(m.driver_code))
      const targets = ribbonData.map((m: any) => lineItemIndices.get(m.line_item_code))
      // Equal width flows
      const values = ribbonData.map(() => 1)

      console.log('Sankey data - sources:', sources, 'targets:', targets, 'values:', values)

      return (
        <div style={{ marginTop: '32px' }}>
          <Plot
            data={[
              {
                type: 'sankey',
                orientation: 'h',
                node: {
                  pad: 15,
                  thickness: 30,
                  line: {
                    color: 'rgba(59, 130, 246, 0.5)',
                    width: 0.5
                  },
                  label: nodeLabels,
                  color: nodeLabels.map((_, idx) =>
                    idx < drivers.length ? '#10b981' : '#3b82f6'
                  )
                },
                link: {
                  source: sources,
                  target: targets,
                  value: values,
                  color: 'rgba(59, 130, 246, 0.2)'
                }
              }
            ]}
            layout={{
              title: {
                text: 'Driver to Line Item Mapping',
                font: { color: '#ffffff', size: 18 }
              },
              font: { color: '#94a3b8', size: 12 },
              paper_bgcolor: 'rgba(15, 23, 42, 0.9)',
              plot_bgcolor: 'rgba(15, 23, 42, 0.9)',
              width: 1000,
              height: 600,
              margin: { l: 10, r: 10, t: 50, b: 10 }
            }}
            config={{ displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
      )
    }

    return null
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
                  backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.2)'}`,
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
                      <ChevronDown style={{ width: '14px', height: '14px', color: '#06b6d4' }} />
                    ) : (
                      <ChevronRight style={{ width: '14px', height: '14px', color: '#06b6d4' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '20px' }} />}

                <Building2 style={{ width: '14px', height: '14px', color: '#06b6d4', marginRight: '6px' }} />

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
    <div style={{ padding: '24px', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', marginBottom: '24px' }}>
        Ribbon Analysis
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
              onClick={() => setMode('driver-mapping')}
              style={{
                padding: '12px 24px',
                backgroundColor: mode === 'driver-mapping' ? '#3b82f6' : 'rgba(30, 41, 59, 0.8)',
                color: '#ffffff',
                border: mode === 'driver-mapping' ? '2px solid #3b82f6' : '1px solid rgba(71, 85, 105, 0.5)',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Driver Mapping
            </button>
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
                  border: '1px solid rgba(6, 182, 212, 0.3)',
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
                  border: '1px solid rgba(6, 182, 212, 0.3)',
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

          {/* Driver Mapping Mode - No form needed, auto-loads */}

          {loading && (
            <div style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px', fontStyle: 'italic' }}>
              Generating ribbon chart...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ribbon Chart */}
      {ribbonData.length > 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', margin: 0 }}>
                Driver Ribbon Chart
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
              >
                <FileText style={{ width: '16px', height: '16px' }} />
                <span>Add to Report</span>
              </button>
            </div>
            <div ref={chartRef}>
            {renderRibbon()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Description Panel */}
      {ribbonData.length > 0 && (
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
                Click the button above to generate AI-powered insights about this ribbon analysis
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
