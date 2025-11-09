import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiUrl, getDefaultDbPath } from '@/config'
import { Globe, BarChart3, Filter, Sparkles, Play, Square, FileText } from 'lucide-react'
import CountryChoroplethMap from '@/components/visualizations/CountryChoroplethMap'
import domtoimage from 'dom-to-image-more'

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

interface ManagementAction {
  action_code: string
  name: string
  description?: string
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

  // What-if mode state
  const [whatIfMode, setWhatIfMode] = useState<boolean>(false)
  const [managementActions, setManagementActions] = useState<ManagementAction[]>([])
  const [selectedActions, setSelectedActions] = useState<Set<string>>(new Set())

  // Tooltip state
  const [tooltip, setTooltip] = useState<{visible: boolean; x: number; y: number; content: string} | null>(null)

  // AI description state
  const [aiDescription, setAiDescription] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false)
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const animationStartPeriodRef = useRef<number>(1)
  const dashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadScenarios()
    loadEntities()
    loadLineItems()

    // Load last run mode from localStorage (same as ViewResults)
    const saved = localStorage.getItem('lastRunMode')
    if (saved) {
      try {
        const runMode = JSON.parse(saved)
        setWhatIfMode(runMode.whatIfMode || false)
      } catch (err) {
        console.error('Failed to load last run mode:', err)
      }
    }
  }, [])

  useEffect(() => {
    if (scenarioA) {
      loadPeriodRange()
    }
  }, [scenarioA, scenarioB])

  useEffect(() => {
    if (whatIfMode) {
      loadManagementActions()
    }
  }, [whatIfMode])

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (scenarioA && selectedVariable) {
      loadRiskData()
    }
  }, [scenarioA, scenarioB, selectedVariable, selectedPeriod, selectedEntity, selectedActions])

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

  const loadManagementActions = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(`${apiUrl('/api/management-actions')}?dbPath=${encodeURIComponent(dbPath)}`)
      const actions = await response.json()
      // API returns flat array with action_code and action_name fields
      const formattedActions = actions.map((a: any) => ({
        action_code: a.action_code,
        name: a.action_name,
        description: a.description
      }))
      setManagementActions(formattedActions)
    } catch (error) {
      console.error('Failed to load management actions:', error)
    }
  }

  const buildWhatIfCombination = (selectedActions: Set<string>): string => {
    if (selectedActions.size === 0) {
      return 'BASE'
    }
    const sortedActions = Array.from(selectedActions).sort()
    return sortedActions.join('+')
  }

  const loadRiskData = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const body: any = {
        dbPath,
        scenarioA,
        scenarioB: scenarioB || null, // Make scenarioB optional
        lineItemCode: selectedVariable,
        periodId: selectedPeriod,
        entityId: selectedEntity
      }

      // Add what-if combination if in what-if mode
      if (whatIfMode) {
        const combination = buildWhatIfCombination(selectedActions)
        body.whatIfCombination = combination
        console.log('[RiskDashboard] What-if mode active, combination:', combination, 'selectedActions:', Array.from(selectedActions))
      }

      console.log('[RiskDashboard] Loading risk data with body:', body)

      const response = await fetch(apiUrl('/api/results/risk-dashboard'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const result = await response.json()

      console.log('[RiskDashboard] Received result:', result)

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

  const generateAIDescription = async () => {
    // Only generate if we have risk data
    if (physicalDrivers.length === 0 && transitionDrivers.length === 0) return

    setAiLoading(true)
    try {
      // Build context based on current selections
      const scenarioAName = scenarios.find(s => s.scenario_id === scenarioA)?.name || 'Scenario A'
      const scenarioBName = scenarioB ? scenarios.find(s => s.scenario_id === scenarioB)?.name : null
      const entityName = entities.find(e => e.entity_id === selectedEntity)?.name || 'entity'
      const variableName = lineItems.find(li => li.code === selectedVariable)?.name || selectedVariable

      let contextDescription = `Analyzing ${variableName} for ${entityName} in ${scenarioAName}`
      if (scenarioBName) {
        contextDescription += ` compared to ${scenarioBName}`
      }
      contextDescription += ` for Period ${selectedPeriod}.`

      // Add what-if context if applicable
      if (whatIfMode && selectedActions.size > 0) {
        const actionNames = Array.from(selectedActions)
          .map(code => managementActions.find(a => a.action_code === code)?.name || code)
          .join(', ')
        contextDescription += ` Management actions applied: ${actionNames}.`
      }

      // Extract physical risk data
      const physicalTotal = physicalDrivers.reduce((sum, d) => sum + d.impact, 0)
      const topPhysicalDrivers = [...physicalDrivers]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 5)
        .map(d => `${d.driver_name}: ${d.impact.toFixed(0)}`)

      const topPhysicalCountries = [...physicalCountries]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 5)
        .map(c => `${c.country}: ${c.impact.toFixed(0)}`)

      // Extract transition risk data
      const transitionTotal = transitionDrivers.reduce((sum, d) => sum + d.impact, 0)
      const topTransitionDrivers = [...transitionDrivers]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 5)
        .map(d => `${d.driver_name}: ${d.impact.toFixed(0)}`)

      const topTransitionCountries = [...transitionCountries]
        .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
        .slice(0, 5)
        .map(c => `${c.country}: ${c.impact.toFixed(0)}`)

      const prompt = `You are a financial and climate risk analysis expert. Analyze this risk dashboard data and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Physical Risk:
- Total Impact: ${physicalTotal.toFixed(0)}
- Top Drivers: ${topPhysicalDrivers.join(', ') || 'None'}
- Top Countries: ${topPhysicalCountries.join(', ') || 'None'}

Transition Risk:
- Total Impact: ${transitionTotal.toFixed(0)}
- Top Drivers: ${topTransitionDrivers.join(', ') || 'None'}
- Top Countries: ${topTransitionCountries.join(', ') || 'None'}

Provide a narrative summary that:
1. Compares physical vs transition risk prominence
2. Highlights the most significant drivers and geographic exposures
3. Identifies any interesting patterns or insights
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
    if (!dashboardRef.current) return

    try {
      // Find all card elements and buttons to temporarily style them
      const cards = dashboardRef.current.querySelectorAll('[style*="rgba(15, 23, 42"]') as NodeListOf<HTMLElement>
      const buttons = dashboardRef.current.querySelectorAll('button') as NodeListOf<HTMLElement>
      const leafletZoomControls = dashboardRef.current.querySelectorAll('.leaflet-control-zoom') as NodeListOf<HTMLElement>
      const titles = dashboardRef.current.querySelectorAll('h3') as NodeListOf<HTMLElement>
      const texts = dashboardRef.current.querySelectorAll('div, span') as NodeListOf<HTMLElement>

      // Store original styles
      const originalStyles = {
        bg: dashboardRef.current.style.backgroundColor,
        padding: dashboardRef.current.style.padding,
        cards: Array.from(cards).map(card => ({
          bg: card.style.backgroundColor,
          border: card.style.border,
          color: card.style.color
        })),
        buttons: Array.from(buttons).map(btn => ({
          display: btn.style.display
        })),
        leafletZoomControls: Array.from(leafletZoomControls).map(ctrl => ({
          display: ctrl.style.display
        })),
        titles: Array.from(titles).map(title => ({
          color: title.style.color
        })),
        texts: Array.from(texts).map(text => ({
          color: text.style.color
        }))
      }

      // Apply white theme for capture
      dashboardRef.current.style.backgroundColor = '#ffffff'
      dashboardRef.current.style.padding = '24px'

      // Style cards with light grey background and dark borders
      cards.forEach(card => {
        card.style.backgroundColor = '#f8f9fa'
        card.style.border = '1px solid #dee2e6'
      })

      // Hide buttons
      buttons.forEach(btn => {
        btn.style.display = 'none'
      })

      // Hide Leaflet zoom controls
      leafletZoomControls.forEach(ctrl => {
        ctrl.style.display = 'none'
      })

      // Change text to dark
      titles.forEach(title => {
        title.style.color = '#1e293b'
      })

      texts.forEach(text => {
        if (text.style.color && text.style.color.includes('rgb')) {
          text.style.color = '#334155'
        }
      })

      // Wait for styles to apply
      await new Promise(resolve => setTimeout(resolve, 100))

      // Capture the dashboard
      const imageData = await domtoimage.toPng(dashboardRef.current, {
        quality: 0.95,
        bgcolor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          backgroundColor: '#ffffff'
        }
      })

      // Restore all original styles
      dashboardRef.current.style.backgroundColor = originalStyles.bg
      dashboardRef.current.style.padding = originalStyles.padding

      cards.forEach((card, i) => {
        card.style.backgroundColor = originalStyles.cards[i].bg
        card.style.border = originalStyles.cards[i].border
      })

      buttons.forEach((btn, i) => {
        btn.style.display = originalStyles.buttons[i].display
      })

      leafletZoomControls.forEach((ctrl, i) => {
        ctrl.style.display = originalStyles.leafletZoomControls[i].display
      })

      titles.forEach((title, i) => {
        title.style.color = originalStyles.titles[i].color
      })

      texts.forEach((text, i) => {
        text.style.color = originalStyles.texts[i].color
      })

      console.log('Captured image data length:', imageData.length)
      console.log('Image data preview:', imageData.substring(0, 100))

      // Build caption with current selections
      const scenarioAName = scenarios.find(s => s.scenario_id === scenarioA)?.name || 'Scenario A'
      const scenarioBName = scenarioB ? scenarios.find(s => s.scenario_id === scenarioB)?.name : null
      const entityName = entities.find(e => e.entity_id === selectedEntity)?.name || 'All Entities'
      const variableName = lineItems.find(li => li.code === selectedVariable)?.name || selectedVariable

      let caption = `Risk Dashboard: ${variableName} for ${entityName} in ${scenarioAName}`
      if (scenarioBName) {
        caption += ` vs ${scenarioBName}`
      }
      caption += ` (Period ${selectedPeriod})`

      // Create snippet object
      const snippet = {
        id: `risk-dashboard-${Date.now()}`,
        type: 'visualization' as const,
        source: 'risk-dashboard' as const,
        imageData,
        caption,
        aiText: aiDescription || undefined,
        timestamp: Date.now()
      }

      // Save to localStorage
      const existing = localStorage.getItem('reportSnippets')
      const snippets = existing ? JSON.parse(existing) : []
      snippets.push(snippet)
      localStorage.setItem('reportSnippets', JSON.stringify(snippets))
      console.log('Saved snippet to localStorage. Total snippets:', snippets.length)

      alert('Added to report! Go to the Report page to see it.')
    } catch (error) {
      console.error('Failed to capture dashboard:', error)
      alert('Failed to add to report. Please try again.')
    }
  }

  const toggleAnimation = () => {
    if (isPlaying) {
      // Stop animation
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current)
        animationIntervalRef.current = null
      }
      setIsPlaying(false)
    } else {
      // Store the starting period for looping
      animationStartPeriodRef.current = selectedPeriod
      setIsPlaying(true)

      const periods = Array.from({ length: maxPeriod - minPeriod + 1 }, (_, i) => minPeriod + i)
      let currentIndex = periods.indexOf(selectedPeriod)

      if (currentIndex === -1) {
        currentIndex = 0
      }

      const runLoop = () => {
        animationIntervalRef.current = setInterval(() => {
          currentIndex++

          if (currentIndex >= periods.length) {
            // Reached end - pause and restart
            if (animationIntervalRef.current) {
              clearInterval(animationIntervalRef.current)
              animationIntervalRef.current = null
            }

            setTimeout(() => {
              // Reset to start period
              currentIndex = periods.indexOf(animationStartPeriodRef.current)
              if (currentIndex === -1) {
                currentIndex = 0
              }
              setSelectedPeriod(periods[currentIndex])

              // Continue looping
              setTimeout(() => {
                runLoop()
              }, 100)
            }, 2000)
          } else {
            setSelectedPeriod(periods[currentIndex])
          }
        }, 1200)
      }

      runLoop()
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
    const isTransitionRisk = title.includes('Transition')

    return (
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: `1px solid ${color}40`,
        height: '100%'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe style={{ width: '20px', height: '20px', color }} />
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>{title}</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isTransitionRisk && (
                <>
                  {isPlaying && (
                    <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>
                      Period {selectedPeriod}
                    </span>
                  )}
                  <button
                    onClick={toggleAnimation}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      backgroundColor: isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                      border: isPlaying ? '1px solid #ef4444' : '1px solid #22c55e',
                      borderRadius: '6px',
                      color: isPlaying ? '#ef4444' : '#22c55e',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isPlaying ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isPlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)'
                    }}
                  >
                    {isPlaying ? (
                      <>
                        <Square style={{ width: '16px', height: '16px' }} />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Play style={{ width: '16px', height: '16px' }} />
                        <span>Play</span>
                      </>
                    )}
                  </button>
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
                </>
              )}
            </div>
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

  // Binary space partitioning treemap with alternating horizontal/vertical splits
  const calculateTreemapLayout = (items: { value: number }[], width: number, height: number) => {
    const layout: { x: number; y: number; width: number; height: number }[] = []
    const indexMap: number[] = [] // Track which original index each rect corresponds to

    const layoutRecursive = (
      itemIndices: number[],
      x: number,
      y: number,
      w: number,
      h: number,
      horizontal: boolean
    ) => {
      if (itemIndices.length === 0) return

      if (itemIndices.length === 1) {
        const idx = itemIndices[0]
        layout[idx] = { x, y, width: w, height: h }
        return
      }

      // Calculate total value for this group
      const totalVal = itemIndices.reduce((sum, idx) => sum + items[idx].value, 0)

      // Split into two groups trying to balance them
      const mid = Math.ceil(itemIndices.length / 2)
      const firstHalf = itemIndices.slice(0, mid)
      const secondHalf = itemIndices.slice(mid)

      const firstVal = firstHalf.reduce((sum, idx) => sum + items[idx].value, 0)
      const ratio = firstVal / totalVal

      if (horizontal) {
        // Split horizontally - first group gets left portion, second gets right
        const splitX = x + w * ratio
        layoutRecursive(firstHalf, x, y, w * ratio, h, !horizontal)
        layoutRecursive(secondHalf, splitX, y, w * (1 - ratio), h, !horizontal)
      } else {
        // Split vertically - first group gets top portion, second gets bottom
        const splitY = y + h * ratio
        layoutRecursive(firstHalf, x, y, w, h * ratio, !horizontal)
        layoutRecursive(secondHalf, x, splitY, w, h * (1 - ratio), !horizontal)
      }
    }

    // Initialize layout array with correct size
    layout.length = items.length
    // Start with horizontal split at depth 0
    const indices = items.map((_, i) => i)
    layoutRecursive(indices, 0, 0, width, height, true)
    return layout
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

    // Find min and max for color gradient
    const maxPositiveImpact = Math.max(...nonZeroDrivers.map(d => d.impact), 0)
    const minNegativeImpact = Math.min(...nonZeroDrivers.map(d => d.impact), 0)

    // Function to get color based on impact value (red for negative, green for positive)
    const getImpactColor = (impact: number) => {
      if (impact < 0) {
        // Negative: scale from light red to dark red based on magnitude
        const intensity = Math.abs(minNegativeImpact) > 0
          ? Math.abs(impact) / Math.abs(minNegativeImpact)
          : 1
        const opacity = 0.4 + (intensity * 0.6) // Range from 0.4 to 1.0
        return `rgba(239, 68, 68, ${opacity})` // Red with varying opacity
      } else if (impact > 0) {
        // Positive: scale from light green to dark green based on magnitude
        const intensity = maxPositiveImpact > 0
          ? impact / maxPositiveImpact
          : 1
        const opacity = 0.4 + (intensity * 0.6) // Range from 0.4 to 1.0
        return `rgba(34, 197, 94, ${opacity})` // Green with varying opacity
      } else {
        // Zero impact (shouldn't happen due to filtering, but handle gracefully)
        return 'rgba(100, 116, 139, 0.3)' // Gray
      }
    }

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

          {/* Treemap with alternating splits */}
          <div style={{
            height: '200px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            padding: '8px',
            position: 'relative',
            marginBottom: '16px'
          }}>
            {nonZeroDrivers.length > 0 ? (() => {
              // Calculate treemap layout
              const treemapItems = nonZeroDrivers.map(d => ({ value: Math.abs(d.impact) }))
              const layout = calculateTreemapLayout(treemapItems, 100, 100) // Use percentage units

              return nonZeroDrivers.map((driver, index) => {
                const rect = layout[index]
                const gap = 0.3 // percentage gap

                // Calculate actual pixel dimensions (200px container height, aspect varies by width)
                // Assuming container is roughly square for treemap
                const containerPixelSize = 200
                const actualWidth = (rect.width * containerPixelSize) / 100
                const actualHeight = (rect.height * containerPixelSize) / 100

                // Only show labels if the box is large enough on both axes
                const showLabels = actualWidth > 70 && actualHeight > 45

                return (
                  <div
                    key={driver.driver_code}
                    onClick={() => setSelectedDriver(selectedDriver === driver.driver_code ? null : driver.driver_code)}
                    style={{
                      position: 'absolute',
                      left: `${rect.x + gap}%`,
                      top: `${rect.y + gap}%`,
                      width: `${rect.width - gap * 2}%`,
                      height: `${rect.height - gap * 2}%`,
                      backgroundColor: selectedDriver === driver.driver_code ? (driver.impact < 0 ? '#dc2626' : '#16a34a') : getImpactColor(driver.impact),
                      border: selectedDriver === driver.driver_code ? `2px solid ${driver.impact < 0 ? '#ef4444' : '#22c55e'}` : `1px solid rgba(100, 116, 139, 0.3)`,
                      borderRadius: '4px',
                      padding: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      overflow: 'hidden',
                      boxShadow: selectedDriver === driver.driver_code ? '0 8px 16px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                      willChange: 'transform, box-shadow'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.03)'
                      e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)'
                      e.currentTarget.style.zIndex = '10'
                      setTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        content: `${driver.driver_name}: ${formatNumber(driver.impact)}`
                      })
                    }}
                    onMouseMove={(e) => {
                      setTooltip(prev => prev ? {...prev, x: e.clientX, y: e.clientY} : null)
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1) translateY(0)'
                      e.currentTarget.style.boxShadow = selectedDriver === driver.driver_code ? '0 8px 16px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                      e.currentTarget.style.zIndex = selectedDriver === driver.driver_code ? '5' : '1'
                      setTooltip(null)
                    }}
                  >
                    {showLabels && (
                      <>
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
                      </>
                    )}
                  </div>
                )
              })
            })() : (
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
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: selectedDriver === driver.driver_code ? '0 4px 8px rgba(0,0,0,0.2)' : 'none',
                  willChange: 'transform, box-shadow'
                }}
                onMouseEnter={(e) => {
                  if (selectedDriver !== driver.driver_code) {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.3)'
                  }
                  e.currentTarget.style.transform = 'translateX(2px)'
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)'
                }}
                onMouseLeave={(e) => {
                  if (selectedDriver !== driver.driver_code) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                  e.currentTarget.style.transform = 'translateX(0)'
                  e.currentTarget.style.boxShadow = selectedDriver === driver.driver_code ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
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
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes simpleFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>

      {/* Controls */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        marginBottom: '24px',
        animation: 'fadeIn 0.4s ease-out'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Test Scenario (Scenario A) */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Test Scenario
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
                <option value="">Select test scenario...</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Base Scenario (Scenario B) */}
            <div>
              <label style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px', display: 'block' }}>
                Base Scenario <span style={{ fontSize: '12px', color: '#64748b' }}>(optional - leave blank for absolute values)</span>
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
                <option value="">Select base scenario...</option>
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
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
                Period: {selectedPeriod} <span style={{ fontSize: '12px', color: '#64748b' }}>(animation start point)</span>
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
          </div>

          {/* Active Filters */}
          <div style={{ minHeight: '56px', marginTop: '16px' }}>
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
          </div>
        </CardContent>
      </Card>

      {/* What-If Mode Action Toggles */}
      {whatIfMode && managementActions.length > 0 && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          marginBottom: '24px',
          animation: 'fadeIn 0.5s ease-out 0.1s both',
          minHeight: '140px'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '8px' }}>
                Filter by Actions (What-If Mode)
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                Select which actions to include in the displayed results.
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {managementActions.map(action => {
                const isActive = selectedActions.has(action.action_code)
                return (
                  <div
                    key={action.action_code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: 'rgba(51, 65, 85, 0.3)',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      borderRadius: '8px',
                      minWidth: '280px',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#fff' }}>
                        {action.name}
                      </div>
                      {action.description && (
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                          {action.description}
                        </div>
                      )}
                    </div>
                    {/* Toggle Switch */}
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
                          transition: 'all 0.3s',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4-Quadrant Grid */}
      <div ref={dashboardRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Top Left - Physical Risk Map */}
        <div style={{ animation: 'fadeInScale 0.6s ease-out 0.2s both' }}>
          {renderMap(physicalCountries, physicalDriverCountries, 'Physical Risk by Country', '#ef4444')}
        </div>

        {/* Top Right - Transition Risk Map */}
        <div style={{ animation: 'fadeInScale 0.6s ease-out 0.3s both' }}>
          {renderMap(transitionCountries, transitionDriverCountries, 'Transition Risk by Country', '#8b5cf6')}
        </div>

        {/* Bottom Left - Physical Risk Drivers */}
        <div style={{ animation: 'fadeInScale 0.6s ease-out 0.4s both' }}>
          {renderDriverBreakdown(physicalDrivers, physicalDriverCountries, 'Physical Risk by Driver', '#ef4444')}
        </div>

        {/* Bottom Right - Transition Risk Drivers */}
        <div style={{ animation: 'fadeInScale 0.6s ease-out 0.5s both' }}>
          {renderDriverBreakdown(transitionDrivers, transitionDriverCountries, 'Transition Risk by Driver', '#8b5cf6')}
        </div>
      </div>

      {/* AI Description Panel */}
      {(physicalDrivers.length > 0 || transitionDrivers.length > 0) && (
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
                Click the button above to generate AI-powered insights about this risk analysis
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tooltip */}
      {tooltip && tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: `${tooltip.x + 15}px`,
            top: `${tooltip.y + 15}px`,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 9999,
            whiteSpace: 'nowrap',
            transition: 'opacity 0.2s',
            opacity: 1
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
