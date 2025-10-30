import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiUrl, getDefaultDbPath } from '@/config'
import { Globe, BarChart3, Filter } from 'lucide-react'
import CountryChoroplethMap from '@/components/visualizations/CountryChoroplethMap'

interface Scenario {
  scenario_id: number
  code: string
  name: string
}

interface LineItem {
  code: string
  name: string
}

interface Entity {
  entity_id: number
  code: string
  name: string
}

interface DriverImpact {
  driver_code: string
  driver_name: string
  impact: number
  country?: string
}

interface CountryImpact {
  country: string
  impact: number
}

export default function RiskDashboard() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [scenarioA, setScenarioA] = useState<number | null>(null)
  const [scenarioB, setScenarioB] = useState<number | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<number | null>(null)
  const [selectedVariable, setSelectedVariable] = useState<string>('')
  const [selectedPeriod, setSelectedPeriod] = useState<number>(1)
  const [minPeriod, setMinPeriod] = useState<number>(1)
  const [maxPeriod, setMaxPeriod] = useState<number>(3)
  const [physicalDrivers, setPhysicalDrivers] = useState<DriverImpact[]>([])
  const [transitionDrivers, setTransitionDrivers] = useState<DriverImpact[]>([])
  const [physicalCountries, setPhysicalCountries] = useState<CountryImpact[]>([])
  const [transitionCountries, setTransitionCountries] = useState<CountryImpact[]>([])
  const [physicalDriverCountries, setPhysicalDriverCountries] = useState<DriverImpact[]>([])
  const [transitionDriverCountries, setTransitionDriverCountries] = useState<DriverImpact[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)

  useEffect(() => {
    loadScenarios()
    loadEntities()
    loadLineItems()
  }, [])

  useEffect(() => {
    if (scenarioA && scenarioB) {
      loadPeriodRange()
    }
  }, [scenarioA, scenarioB])

  useEffect(() => {
    if (scenarioA && scenarioB && selectedVariable) {
      loadRiskData()
    }
  }, [scenarioA, scenarioB, selectedVariable, selectedPeriod, selectedEntity])

  const loadScenarios = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(`${apiUrl('/api/scenarios/list')}?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      if (result.success) {
        setScenarios(result.scenarios)
      }
    } catch (error) {
      console.error('Failed to load scenarios:', error)
    }
  }

  const loadEntities = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(`${apiUrl('/api/entities')}?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      // API returns flat array with entity_code and entity_name
      const formattedEntities = result.map((entity: any) => ({
        entity_id: entity.entity_id,
        code: entity.entity_code,
        name: entity.entity_name
      }))
      setEntities(formattedEntities)
    } catch (error) {
      console.error('Failed to load entities:', error)
    }
  }

  const loadLineItems = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(`${apiUrl('/api/results/risk-line-items')}?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      if (result.success) {
        setLineItems(result.lineItems)
      }
    } catch (error) {
      console.error('Failed to load line items:', error)
    }
  }

  const loadPeriodRange = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const scenarioIds = [scenarioA, scenarioB].filter(Boolean).join(',')
      const response = await fetch(`${apiUrl('/api/results/period-range')}?dbPath=${encodeURIComponent(dbPath)}&scenarioIds=${scenarioIds}`)
      const result = await response.json()
      if (result.success) {
        setMinPeriod(result.minPeriod)
        setMaxPeriod(result.maxPeriod)
        // Reset period if it's outside the new range
        if (selectedPeriod > result.maxPeriod) {
          setSelectedPeriod(result.maxPeriod)
        } else if (selectedPeriod < result.minPeriod) {
          setSelectedPeriod(result.minPeriod)
        }
      }
    } catch (error) {
      console.error('Failed to load period range:', error)
    }
  }

  const loadRiskData = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl('/api/results/risk-dashboard'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          scenarioA,
          scenarioB,
          lineItemCode: selectedVariable,
          periodId: selectedPeriod,
          entityId: selectedEntity
        })
      })
      const result = await response.json()

      if (result.success) {
        setPhysicalDrivers(result.physicalDrivers || [])
        setTransitionDrivers(result.transitionDrivers || [])
        setPhysicalCountries(result.physicalCountries || [])
        setTransitionCountries(result.transitionCountries || [])
        setPhysicalDriverCountries(result.physicalDriverCountries || [])
        setTransitionDriverCountries(result.transitionDriverCountries || [])
      }
    } catch (error) {
      console.error('Failed to load risk data:', error)
    }
  }

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K'
    return num.toFixed(2)
  }

  const getColorForImpact = (impact: number) => {
    if (impact < 0) return '#ef4444' // Red for negative
    if (impact > 0) return '#22c55e' // Green for positive
    return '#94a3b8' // Gray for zero
  }

  const renderMap = (countries: CountryImpact[], driverCountries: DriverImpact[], title: string, color: string) => {
    // If driver is selected, filter countries to only those affected by that driver
    let displayCountries: CountryImpact[]

    if (selectedDriver) {
      // Filter to selected driver and aggregate by country
      const filteredByDriver = driverCountries.filter(dc =>
        dc.driver_code === selectedDriver
      )

      // Aggregate by country
      const countryMap = new Map<string, number>()
      filteredByDriver.forEach(dc => {
        const country = dc.country || ''
        if (country) {
          countryMap.set(country, (countryMap.get(country) || 0) + dc.impact)
        }
      })
      displayCountries = Array.from(countryMap.entries()).map(([country, impact]) => ({
        country,
        impact
      }))
    } else {
      displayCountries = countries
    }

    const maxImpact = Math.max(...displayCountries.map(c => Math.abs(c.impact)), 1)

    return (
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: `1px solid ${color}40`,
        height: '100%'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Globe style={{ width: '20px', height: '20px', color }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{title}</h3>
          </div>

          {/* Choropleth map */}
          <CountryChoroplethMap
            countries={countries}
            height="250px"
            color={color}
            selectedCountry={selectedCountry}
            onCountryClick={(country) => setSelectedCountry(selectedCountry === country ? null : country)}
          />

          {/* Country list */}
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {displayCountries.length > 0 ? displayCountries.map((country) => (
              <div
                key={country.country}
                onClick={() => setSelectedCountry(selectedCountry === country.country ? null : country.country)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: selectedCountry === country.country ? `${color}20` : 'transparent',
                  border: selectedCountry === country.country ? `1px solid ${color}` : '1px solid transparent',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedCountry !== country.country) {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCountry !== country.country) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '14px', color: '#fff' }}>{country.country}</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: getColorForImpact(country.impact)
                }}>
                  {formatNumber(country.impact)}
                </span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '14px' }}>
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderDriverBreakdown = (drivers: DriverImpact[], driverCountries: DriverImpact[], title: string, color: string) => {
    // If country is selected, aggregate drivers from driver-country data for that country
    // Otherwise use the pre-aggregated driver data
    let displayDrivers: DriverImpact[]

    if (selectedCountry) {
      // Filter to selected country and aggregate by driver
      const filteredByCountry = driverCountries.filter(dc =>
        dc.country?.toLowerCase() === selectedCountry.toLowerCase()
      )

      // Aggregate by driver code
      const driverMap = new Map<string, DriverImpact>()
      filteredByCountry.forEach(dc => {
        if (!driverMap.has(dc.driver_code)) {
          driverMap.set(dc.driver_code, {
            driver_code: dc.driver_code,
            driver_name: dc.driver_name,
            impact: 0
          })
        }
        driverMap.get(dc.driver_code)!.impact += dc.impact
      })
      displayDrivers = Array.from(driverMap.values())
    } else {
      displayDrivers = drivers
    }

    // Filter out zero-value drivers
    const nonZeroDrivers = displayDrivers.filter(d => Math.abs(d.impact) > 1e-10)
    const totalImpact = nonZeroDrivers.reduce((sum, d) => sum + Math.abs(d.impact), 0)

    // Calculate mosaic layout - tiles should fill entire space
    const containerWidth = 100 // percentage
    const containerHeight = 200 // pixels
    const gap = 4 // pixels

    return (
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: `1px solid ${color}40`,
        height: '100%'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <BarChart3 style={{ width: '20px', height: '20px', color }} />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{title}</h3>
          </div>

          {/* Mosaic chart */}
          <div style={{
            height: '200px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            padding: '8px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginBottom: '16px',
            alignContent: 'stretch'
          }}>
            {nonZeroDrivers.length > 0 ? nonZeroDrivers.map((driver, index) => {
              const percentage = (Math.abs(driver.impact) / totalImpact) * 100

              // Simple treemap: calculate width based on percentage
              // Adjust for gaps
              const numGaps = nonZeroDrivers.length - 1
              const availableWidth = containerWidth - (numGaps * (gap / containerWidth * 100))
              const width = (percentage / 100) * availableWidth

              return (
                <div
                  key={driver.driver_code}
                  onClick={() => setSelectedDriver(selectedDriver === driver.driver_code ? null : driver.driver_code)}
                  style={{
                    width: `calc(${width}% - ${gap * (nonZeroDrivers.length - 1) / nonZeroDrivers.length}px)`,
                    height: `calc(100% - ${gap * 0}px)`,
                    flexGrow: 0,
                    flexShrink: 0,
                    backgroundColor: selectedDriver === driver.driver_code ? color : `${color}60`,
                    border: selectedDriver === driver.driver_code ? `2px solid ${color}` : `1px solid ${color}40`,
                    borderRadius: '4px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'all 0.2s',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '0.8'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '1'
                  }}
                >
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#fff',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%'
                  }}>
                    {driver.driver_name}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    color: '#fff',
                    marginTop: '2px'
                  }}>
                    {formatNumber(driver.impact)}
                  </div>
                </div>
              )
            }) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                fontSize: '14px'
              }}>
                No data available
              </div>
            )}
          </div>

          {/* Driver list */}
          <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
            {drivers.map((driver) => (
              <div
                key={driver.driver_code}
                onClick={() => setSelectedDriver(selectedDriver === driver.driver_code ? null : driver.driver_code)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: selectedDriver === driver.driver_code ? `${color}20` : 'transparent',
                  border: selectedDriver === driver.driver_code ? `1px solid ${color}` : '1px solid transparent',
                  borderRadius: '4px',
                  marginBottom: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (selectedDriver !== driver.driver_code) {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedDriver !== driver.driver_code) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '14px', color: '#fff' }}>{driver.driver_name}</span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: getColorForImpact(driver.impact)
                }}>
                  {formatNumber(driver.impact)}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div style={{ padding: '24px', height: '100%' }}>
      {/* Controls */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        marginBottom: '24px'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {/* Test Case (Scenario A) */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Test Case
              </label>
              <select
                value={scenarioA || ''}
                onChange={(e) => setScenarioA(e.target.value ? parseInt(e.target.value) : null)}
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
                <option value="">Select test case...</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Base Case (Scenario B) */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Base Case
              </label>
              <select
                value={scenarioB || ''}
                onChange={(e) => setScenarioB(e.target.value ? parseInt(e.target.value) : null)}
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
                <option value="">Select base case...</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Variable */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Variable
              </label>
              <select
                value={selectedVariable}
                onChange={(e) => setSelectedVariable(e.target.value)}
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
                <option value="">Select variable...</option>
                {lineItems.map(item => (
                  <option key={item.code} value={item.code}>{item.name}</option>
                ))}
              </select>
            </div>

            {/* Entity */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Entity
              </label>
              <select
                value={selectedEntity || ''}
                onChange={(e) => setSelectedEntity(e.target.value ? parseInt(e.target.value) : null)}
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
                <option value="">Select entity...</option>
                {entities.map(entity => (
                  <option key={entity.entity_id} value={entity.entity_id}>{entity.name}</option>
                ))}
              </select>
            </div>

            {/* Period Slider */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Period: {selectedPeriod}
              </label>
              <input
                type="range"
                min={minPeriod}
                max={maxPeriod}
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  outline: 'none',
                  backgroundColor: 'rgba(59, 130, 246, 0.3)',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* Active Filters */}
            {(selectedCountry || selectedDriver) && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <Button
                  onClick={() => {
                    setSelectedCountry(null)
                    setSelectedDriver(null)
                  }}
                  size="sm"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    color: '#ef4444'
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </div>

          {(selectedCountry || selectedDriver) && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {selectedCountry && (
                <div style={{
                  padding: '4px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#3b82f6'
                }}>
                  Country: {selectedCountry}
                </div>
              )}
              {selectedDriver && (
                <div style={{
                  padding: '4px 12px',
                  backgroundColor: 'rgba(168, 85, 247, 0.2)',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  color: '#a855f7'
                }}>
                  Driver: {selectedDriver}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4-Quadrant Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', height: 'calc(100vh - 285px)' }}>
        {/* Top Left - Physical Risk Map */}
        {renderMap(physicalCountries, physicalDriverCountries, 'Physical Risk by Country', '#ef4444')}

        {/* Top Right - Transition Risk Map */}
        {renderMap(transitionCountries, transitionDriverCountries, 'Transition Risk by Country', '#8b5cf6')}

        {/* Bottom Left - Physical Risk Drivers */}
        {renderDriverBreakdown(physicalDrivers, physicalDriverCountries, 'Physical Risk by Driver', '#ef4444')}

        {/* Bottom Right - Transition Risk Drivers */}
        {renderDriverBreakdown(transitionDrivers, transitionDriverCountries, 'Transition Risk by Driver', '#8b5cf6')}
      </div>
    </div>
  )
}
