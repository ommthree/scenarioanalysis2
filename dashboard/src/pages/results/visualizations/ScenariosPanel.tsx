import { useState, useEffect, useRef } from 'react'
import { Sparkles, FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import domtoimage from 'dom-to-image-more'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Bar,
  ComposedChart,
} from 'recharts'

interface Scenario {
  scenario_id: number
  code: string
  name: string
  description: string | null
  num_periods: number
  statement_template_id: number
  source_file_name?: string
}

interface LineItem {
  item_code: string
  item_name: string
}

interface StatementItem {
  item_code: string
  item_name: string
}

export default function ScenariosPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<Set<number>>(new Set())
  const [scenarioData, setScenarioData] = useState<any[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set())
  const [allDriversData, setAllDriversData] = useState<Map<number, any[]>>(new Map())
  const [statementItems, setStatementItems] = useState<StatementItem[]>([])
  const [selectedStatements, setSelectedStatements] = useState<Set<string>>(new Set())
  const [allStatementsData, setAllStatementsData] = useState<Map<number, any[]>>(new Map())
  const [loading, setLoading] = useState(true)

  // AI Description
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Ref for capture
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadScenarios()
  }, [])

  useEffect(() => {
    if (allDriversData.size > 0 || allStatementsData.size > 0) {
      buildChartData()
    }
  }, [selectedDrivers, selectedScenarios, allDriversData, selectedStatements, allStatementsData])

  const loadScenarios = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()

      if (data.success && data.scenarios) {
        setScenarios(data.scenarios)
        if (data.scenarios.length > 0) {
          // Auto-select first scenario
          const firstId = data.scenarios[0].scenario_id
          setSelectedScenarios(new Set([firstId]))
          loadScenarioData(firstId)
        }
      }
      setLoading(false)
    } catch (error) {
      logger.error('Failed to load scenarios:', error)
      setLoading(false)
    }
  }

  const loadScenarioData = async (scenarioId: number) => {
    try {
      const dbPath = getDefaultDbPath()

      // Load all drivers for this scenario from scenario_drivers table
      const driversResponse = await fetch(
        apiUrl(`/api/scenarios/${scenarioId}/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      )
      const driversData = await driversResponse.json()

      if (driversData.success && driversData.drivers && driversData.drivers.length > 0) {
        // Store all drivers data in Map indexed by scenario_id
        const newData = new Map(allDriversData)
        newData.set(scenarioId, driversData.drivers)
        setAllDriversData(newData)

        // Populate drivers list if not already loaded
        if (lineItems.length === 0) {
          // Get unique drivers with their names
          const uniqueDrivers = new Map()
          driversData.drivers.forEach((d: any) => {
            if (!uniqueDrivers.has(d.driver_code)) {
              uniqueDrivers.set(d.driver_code, {
                item_code: d.driver_code,
                item_name: d.driver_name || d.driver_code
              })
            }
          })
          setLineItems(Array.from(uniqueDrivers.values()))
        }
      }

      // Load statement line items for this scenario
      const statementsResponse = await fetch(
        apiUrl(`/api/scenarios/${scenarioId}/results?dbPath=${encodeURIComponent(dbPath)}`)
      )
      const statementsData = await statementsResponse.json()

      if (statementsData.success && statementsData.results && statementsData.results.length > 0) {
        // Store all statements data in Map indexed by scenario_id
        const newStmtData = new Map(allStatementsData)
        newStmtData.set(scenarioId, statementsData.results)
        setAllStatementsData(newStmtData)

        // Populate statement items list if not already loaded
        if (statementItems.length === 0) {
          // Get unique statement line items with their names
          const uniqueStatements = new Map()
          statementsData.results.forEach((s: any) => {
            if (!uniqueStatements.has(s.item_code)) {
              uniqueStatements.set(s.item_code, {
                item_code: s.item_code,
                item_name: s.item_name || s.item_code
              })
            }
          })
          setStatementItems(Array.from(uniqueStatements.values()))
        }
      }
    } catch (error) {
      logger.error('Failed to load scenario data:', error)
    }
  }

  const buildChartData = () => {
    if ((allDriversData.size === 0 && allStatementsData.size === 0) ||
        (selectedDrivers.size === 0 && selectedStatements.size === 0) ||
        selectedScenarios.size === 0) {
      setScenarioData([])
      return
    }

    // Collect all series names and all periods
    const allSeriesNames = new Set<string>()
    const periodMap = new Map()

    // Iterate through all selected scenarios
    selectedScenarios.forEach(scenarioId => {
      const scenarioDrivers = allDriversData.get(scenarioId)
      const scenarioStatements = allStatementsData.get(scenarioId)

      const scenario = scenarios.find(s => s.scenario_id === scenarioId)
      const scenarioPrefix = scenarios.length > 1 && selectedScenarios.size > 1
        ? `${scenario?.code || scenario?.name || `S${scenarioId}`} - `
        : ''

      // Add driver data
      if (scenarioDrivers) {
        scenarioDrivers.forEach((d: any) => {
          if (selectedDrivers.has(d.driver_code)) {
            if (!periodMap.has(d.period_id)) {
              periodMap.set(d.period_id, { period: d.period_id })
            }
            const driverName = d.driver_name || d.driver_code
            const seriesName = `${scenarioPrefix}${driverName}`
            allSeriesNames.add(seriesName)
            periodMap.get(d.period_id)[seriesName] = d.value || 0
          }
        })
      }

      // Add statement data
      if (scenarioStatements) {
        scenarioStatements.forEach((s: any) => {
          if (selectedStatements.has(s.item_code)) {
            if (!periodMap.has(s.period_id)) {
              periodMap.set(s.period_id, { period: s.period_id })
            }
            const statementName = s.item_name || s.item_code
            const seriesName = `${scenarioPrefix}${statementName}`
            allSeriesNames.add(seriesName)
            periodMap.get(s.period_id)[seriesName] = s.value || 0
          }
        })
      }
    })

    // Convert to array and sort by period
    const sortedPeriods = Array.from(periodMap.keys()).sort((a, b) => a - b)

    // Build final chart data in strict period order
    const chartData = sortedPeriods.map(periodId => {
      const periodData = periodMap.get(periodId)
      const filledData: any = { period: periodId }

      // Add all series values (or null if missing)
      allSeriesNames.forEach(seriesName => {
        filledData[seriesName] = periodData[seriesName] !== undefined ? periodData[seriesName] : null
      })

      return filledData
    })

    setScenarioData(chartData)
  }

  const toggleDriver = (driverCode: string) => {
    const newSelected = new Set(selectedDrivers)
    if (newSelected.has(driverCode)) {
      newSelected.delete(driverCode)
    } else {
      newSelected.add(driverCode)
    }
    setSelectedDrivers(newSelected)
  }

  const toggleStatement = (statementCode: string) => {
    // Only allow one statement at a time
    if (selectedStatements.has(statementCode)) {
      setSelectedStatements(new Set())
    } else {
      setSelectedStatements(new Set([statementCode]))
    }
  }

  const toggleScenario = (scenarioId: number) => {
    const newSelected = new Set(selectedScenarios)
    if (newSelected.has(scenarioId)) {
      newSelected.delete(scenarioId)
      // Remove data for this scenario
      const newData = new Map(allDriversData)
      newData.delete(scenarioId)
      setAllDriversData(newData)
      const newStmtData = new Map(allStatementsData)
      newStmtData.delete(scenarioId)
      setAllStatementsData(newStmtData)
    } else {
      newSelected.add(scenarioId)
      // Load data for this scenario
      loadScenarioData(scenarioId)
    }
    setSelectedScenarios(newSelected)
  }

  const generateAIDescription = async () => {
    if (scenarioData.length === 0) return

    setAiLoading(true)
    try {
      // Build context based on current selections
      const selectedScenariosList = Array.from(selectedScenarios)
        .map(id => scenarios.find(s => s.scenario_id === id)?.name || `Scenario ${id}`)
        .join(', ')

      const selectedDriversList = Array.from(selectedDrivers)
        .map(code => lineItems.find(i => i.item_code === code)?.item_name || code)
        .join(', ')

      const selectedStatementsList = Array.from(selectedStatements)
        .map(code => statementItems.find(i => i.item_code === code)?.item_name || code)
        .join(', ')

      let contextDescription = `Analyzing scenario comparison: ${selectedScenariosList}.`

      const items: string[] = []
      if (selectedDriversList) items.push(`Drivers: ${selectedDriversList}`)
      if (selectedStatementsList) items.push(`Statements: ${selectedStatementsList}`)

      if (items.length > 0) {
        contextDescription += ` Selected items: ${items.join('; ')}.`
      }

      // Extract period range and values from chart data
      const periods = scenarioData.map(d => d.period)
      const minPeriod = Math.min(...periods)
      const maxPeriod = Math.max(...periods)

      // Get all series names (excluding 'period' key)
      const seriesNames = Object.keys(scenarioData[0] || {}).filter(k => k !== 'period')

      // Build summary of series data
      const seriesSummaries = seriesNames.map(seriesName => {
        const values = scenarioData.map(d => d[seriesName]).filter(v => v !== null && v !== undefined)
        if (values.length === 0) return null

        const startValue = values[0]
        const endValue = values[values.length - 1]
        const change = endValue - startValue
        const percentChange = startValue !== 0 ? ((change / startValue) * 100).toFixed(1) : 'N/A'

        return `- ${seriesName}: ${startValue.toFixed(0)} → ${endValue.toFixed(0)} (${change > 0 ? '+' : ''}${change.toFixed(0)}, ${percentChange}% change)`
      }).filter(s => s !== null)

      const prompt = `You are a financial and climate scenario analysis expert. Analyze this scenario comparison data and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Period Range: ${minPeriod} to ${maxPeriod}

Series Data:
${seriesSummaries.join('\n')}

Provide a narrative summary that:
1. Explains the overall trends and patterns across scenarios
2. Highlights the most significant changes or differences between scenarios
3. Identifies any interesting insights or implications
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
      // Find elements to temporarily style
      const cards = chartRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = chartRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const titles = chartRef.current.querySelectorAll('h3') as NodeListOf<HTMLElement>
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

      // Apply white theme for capture
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

      // Capture using dom-to-image-more
      const imageData = await domtoimage.toPng(chartRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', backgroundColor: '#ffffff' }
      })

      // Restore all original styles
      chartRef.current.style.background = originalStyles.background
      chartRef.current.style.padding = originalStyles.padding
      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })
      buttons.forEach((btn, i) => { btn.style.display = originalStyles.buttons[i] })
      titles.forEach((title, i) => { title.style.color = originalStyles.titles[i] })
      texts.forEach((text, i) => { text.style.color = originalStyles.texts[i] })

      // Build caption
      const scenarioNames = Array.from(selectedScenarios)
        .map(id => scenarios.find(s => s.scenario_id === id)?.name || `Scenario ${id}`)
        .join(', ')
      const driverNames = Array.from(selectedDrivers)
        .map(code => lineItems.find(i => i.item_code === code)?.item_name || code)
        .join(', ')
      const statementNames = Array.from(selectedStatements)
        .map(code => statementItems.find(i => i.item_code === code)?.item_name || code)
        .join(', ')

      const caption = `Scenarios: ${scenarioNames}${driverNames ? `; Drivers: ${driverNames}` : ''}${statementNames ? `; Statements: ${statementNames}` : ''}`

      // Save snippet
      const snippet = {
        id: `scenarios-${Date.now()}`,
        type: 'visualization' as const,
        source: 'scenarios' as const,
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
      console.error('Failed to capture chart:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const getDriverColor = (index: number) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']
    return colors[index % colors.length]
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>Loading scenarios...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px', width: 'fit-content', minWidth: '100%' }}>
        <CardContent style={{ padding: '32px' }}>
          {/* Scenarios Table */}
          <ScrollArea style={{ maxHeight: '300px', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>CODE</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>NAME</th>
                  <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>PERIODS</th>
                  <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>SOURCE FILE</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(scenario => (
                  <tr
                    key={scenario.scenario_id}
                    onClick={() => toggleScenario(scenario.scenario_id)}
                    style={{
                      backgroundColor: selectedScenarios.has(scenario.scenario_id) ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedScenarios.has(scenario.scenario_id)) {
                        e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedScenarios.has(scenario.scenario_id)) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '14px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>{scenario.code}</td>
                    <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '14px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>{scenario.name}</td>
                    <td style={{ padding: '12px', color: '#3b82f6', fontSize: '14px', fontWeight: '600', textAlign: 'center', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>{scenario.num_periods}</td>
                    <td style={{ padding: '12px', color: '#94a3b8', fontSize: '13px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>{scenario.source_file_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Visualization Card */}
      {selectedScenarios.size > 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            {/* Add to Report Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
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
            {/* Driver Toggle Buttons */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                Select Drivers to Plot (Line Chart)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {lineItems.map((item, index) => {
                  const isSelected = selectedDrivers.has(item.item_code)
                  const color = getDriverColor(index)
                  return (
                    <button
                      key={item.item_code}
                      onClick={() => toggleDriver(item.item_code)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: isSelected ? color : 'rgba(30, 41, 59, 0.8)',
                        border: `2px solid ${color}`,
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontWeight: isSelected ? '600' : '400',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: isSelected ? 1 : 0.6
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = isSelected ? '1' : '0.6'
                      }}
                    >
                      {item.item_name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Statement Toggle Buttons */}
            {statementItems.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '12px' }}>
                  Select Statement Items to Plot (Bar Chart)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {statementItems.map((item, index) => {
                    const isSelected = selectedStatements.has(item.item_code)
                    // Varied purple/pink colors for statement buttons
                    const colors = ['#a855f7', '#ec4899', '#d946ef', '#c026d3', '#7c3aed', '#9333ea']
                    const color = colors[index % colors.length]
                    return (
                      <button
                        key={item.item_code}
                        onClick={() => toggleStatement(item.item_code)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: isSelected ? color : 'rgba(30, 41, 59, 0.8)',
                          border: `2px solid ${color}`,
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: isSelected ? '600' : '400',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          opacity: isSelected ? 1 : 0.6,
                          boxShadow: isSelected ? `0 0 12px ${color}` : 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1'
                          e.currentTarget.style.transform = 'scale(1.05)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = isSelected ? '1' : '0.6'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                        {item.item_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Chart */}
            {scenarioData.length > 0 ? (
              <>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                  {selectedScenarios.size === 1
                    ? `Scenario: ${scenarios.find(s => s.scenario_id === Array.from(selectedScenarios)[0])?.name}`
                    : `Comparing ${selectedScenarios.size} Scenarios`}
                </h3>
                <div style={{ width: 'calc(100% - 10px)', height: '450px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={scenarioData}
                    margin={{ top: 5, right: 60, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.5)" />
                    <XAxis
                      dataKey="period"
                      stroke="#94a3b8"
                      label={{ value: 'Period', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke="#94a3b8"
                      domain={['auto', 'auto']}
                      label={{ value: 'Drivers', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                    />
                    {selectedStatements.size > 0 && (
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#a855f7"
                        domain={['auto', 'auto']}
                        label={{ value: 'Statements', angle: 90, position: 'insideRight', fill: '#a855f7', offset: -30 }}
                      />
                    )}
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#fff'
                      }}
                      cursor={{ stroke: 'rgba(59, 130, 246, 0.5)', strokeWidth: 2 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    {(() => {
                      const elements: React.ReactElement[] = []
                      let colorIndex = 0

                      selectedScenarios.forEach(scenarioId => {
                        const scenario = scenarios.find(s => s.scenario_id === scenarioId)
                        const scenarioPrefix = selectedScenarios.size > 1
                          ? `${scenario?.code || scenario?.name || `S${scenarioId}`} - `
                          : ''

                        // Add driver lines
                        selectedDrivers.forEach(driverCode => {
                          const driver = lineItems.find(i => i.item_code === driverCode)
                          if (!driver) return

                          const seriesName = `${scenarioPrefix}${driver.item_name}`
                          const color = getDriverColor(colorIndex)
                          colorIndex++

                          elements.push(
                            <Line
                              key={`${scenarioId}-${driverCode}`}
                              yAxisId="left"
                              type="monotone"
                              dataKey={seriesName}
                              stroke={color}
                              strokeWidth={2}
                              name={seriesName}
                              dot={{ fill: color, r: 4 }}
                              activeDot={{ r: 6 }}
                              connectNulls={false}
                            />
                          )
                        })

                        // Add statement bars
                        selectedStatements.forEach(statementCode => {
                          const statement = statementItems.find(i => i.item_code === statementCode)
                          if (!statement) return

                          const seriesName = `${scenarioPrefix}${statement.item_name}`
                          const statementIndex = statementItems.findIndex(i => i.item_code === statementCode)
                          const colors = ['#a855f7', '#ec4899', '#d946ef', '#c026d3', '#7c3aed', '#9333ea']
                          const barColor = colors[statementIndex % colors.length]

                          elements.push(
                            <Bar
                              key={`${scenarioId}-${statementCode}`}
                              yAxisId="right"
                              dataKey={seriesName}
                              fill={barColor}
                              fillOpacity={0.7}
                              name={seriesName}
                              radius={[4, 4, 0, 0]}
                              onMouseEnter={(_data: any, _index: number, e: any) => {
                                if (e && e.target) {
                                  e.target.style.fillOpacity = '1'
                                  e.target.style.filter = 'brightness(1.2)'
                                }
                              }}
                              onMouseLeave={(_data: any, _index: number, e: any) => {
                                if (e && e.target) {
                                  e.target.style.fillOpacity = '0.7'
                                  e.target.style.filter = 'brightness(1)'
                                }
                              }}
                            />
                          )
                        })
                      })

                      return elements
                    })()}
                  </ComposedChart>
                </ResponsiveContainer>
                </div>
              </>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                {selectedDrivers.size === 0 ? 'Select at least one driver to plot.' : 'No data available for selected drivers.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Insights Panel */}
      {scenarioData.length > 0 && (
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
                Click the button above to generate AI-powered insights about this scenario comparison
              </div>
            )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
