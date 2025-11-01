import { useState, useEffect } from 'react'
import { Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import {
  LineChart,
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
      const filledData = { period: periodId }

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
                <div style={{ width: '100%', height: '450px' }}>
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
                        label={{ value: 'Statements', angle: 90, position: 'insideRight', fill: '#a855f7', offset: 20 }}
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
                      const elements: JSX.Element[] = []
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
                              onMouseEnter={(data: any, index: number, e: any) => {
                                if (e && e.target) {
                                  e.target.style.fillOpacity = '1'
                                  e.target.style.filter = 'brightness(1.2)'
                                }
                              }}
                              onMouseLeave={(data: any, index: number, e: any) => {
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
    </div>
  )
}
