import { useState, useEffect, useRef } from 'react'
import { TrendingUp, ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import JointDistributionPanel from '@/components/visualizations/JointDistributionPanel'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import domtoimage from 'dom-to-image-more'

interface McResults {
  scenarioId: number
  entityId: number
  mcPeriod: number
  numDraws: number
  lineItems: Array<{
    code: string
    name: string
    section: string
    mean: number
    stdDev: number
    p5: number
    p25: number
    p50: number
    p75: number
    p95: number
  }>
}

interface McDistribution {
  lineItemCode: string
  numDraws: number
  draws: Array<{ drawNumber: number; value: number }>
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

interface McTimeseries {
  lineItemCode: string
  numDraws: number
  periods: number[]
  draws: Array<{
    drawNumber: number
    values: number[]
  }>
  statistics: {
    mean: number[]
    p1: number[]
    p5: number[]
    p25: number[]
    p50: number[]
    p75: number[]
    p95: number[]
    p99: number[]
  }
  deterministic: number[]
}

interface Entity {
  entity_id: number
  code: string
  name: string
  granularity_level?: string
  parent_entity_id?: number | null
  children?: Entity[]
}

interface Scenario {
  scenario_id: number
  code: string
  name: string
}

export default function CorrelationsPanel() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [currentScenario, setCurrentScenario] = useState<number | null>(null)
  const [currentEntity, setCurrentEntity] = useState<number | null>(null)

  const [mcResults, setMcResults] = useState<McResults | null>(null)
  const [loading, setLoading] = useState(true)

  const [primaryVariable, setPrimaryVariable] = useState<string>('')
  const [secondaryVariable, setSecondaryVariable] = useState<string>('')

  const [mcDistribution, setMcDistribution] = useState<McDistribution | null>(null)
  const [mcTimeseries, setMcTimeseries] = useState<McTimeseries | null>(null)
  const [primaryDistribution, setPrimaryDistribution] = useState<McDistribution | null>(null)
  const [secondaryDistribution, setSecondaryDistribution] = useState<McDistribution | null>(null)

  const [hoveredDraw, setHoveredDraw] = useState<{ drawNumber: number; value: number } | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const [hoveredPercentile, setHoveredPercentile] = useState<string | null>(null)

  const [aiInsights, setAiInsights] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  // Entity tree state
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const statsTableRef = useRef<HTMLDivElement>(null)
  const distChartRef = useRef<HTMLDivElement>(null)
  const fanChartRef = useRef<HTMLDivElement>(null)
  const jointDistRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadScenarios()
    loadEntities()
  }, [])

  useEffect(() => {
    if (currentScenario && currentEntity) {
      loadMcResults()
    }
  }, [currentScenario, currentEntity])

  useEffect(() => {
    if (primaryVariable && mcResults) {
      loadMcDistribution(primaryVariable)
      loadMcTimeseries(primaryVariable)
    }
  }, [primaryVariable])

  useEffect(() => {
    if (secondaryVariable && mcResults) {
      loadSecondaryDistribution(secondaryVariable)
    }
  }, [secondaryVariable])

  useEffect(() => {
    if (mcResults && mcResults.lineItems.length > 0) {
      // Group line items by section and expand all sections by default
      const sections = new Set(mcResults.lineItems.map(item => item.section || 'Other'))
      setExpandedSections(sections)
    }
  }, [mcResults])

  const loadScenarios = async () => {
    const dbPath = getDefaultDbPath()
    try {
      const response = await fetch(apiUrl(`/api/results/scenarios?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()
      if (data.success && data.scenarios.length > 0) {
        setScenarios(data.scenarios)
        setCurrentScenario(data.scenarios[0].scenario_id)
      }
    } catch (error) {
      logger.error('Failed to load scenarios:', error)
    }
  }

  const buildEntityTree = (flatEntities: any[]): Entity[] => {
    const entityMap: { [key: number]: Entity } = {}
    const rootEntities: Entity[] = []

    // Convert API format to component format
    flatEntities.forEach((entity) => {
      entityMap[entity.entity_id] = {
        entity_id: entity.entity_id,
        code: entity.entity_code || entity.code,
        name: entity.entity_name || entity.name,
        granularity_level: entity.level || entity.granularity_level,
        parent_entity_id: entity.parent_id !== undefined ? entity.parent_id : entity.parent_entity_id,
        children: []
      }
    })

    // Build tree structure
    flatEntities.forEach((entity) => {
      const parentId = entity.parent_id !== undefined ? entity.parent_id : entity.parent_entity_id
      if (parentId === null) {
        rootEntities.push(entityMap[entity.entity_id])
      } else if (entityMap[parentId]) {
        entityMap[parentId].children!.push(entityMap[entity.entity_id])
      }
    })

    return rootEntities
  }

  const loadEntities = async () => {
    const dbPath = getDefaultDbPath()
    try {
      const response = await fetch(apiUrl(`/api/entities?dbPath=${encodeURIComponent(dbPath)}`))
      const data = await response.json()
      if (Array.isArray(data) && data.length > 0) {
        const tree = buildEntityTree(data)
        setEntities(tree)
        setCurrentEntity(data[0].entity_id)
      }
    } catch (error) {
      logger.error('Failed to load entities:', error)
    }
  }

  const loadMcResults = async () => {
    if (!currentScenario || !currentEntity) return

    setLoading(true)
    const dbPath = getDefaultDbPath()

    try {
      const response = await fetch(
        apiUrl(`/api/mc-results?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}`)
      )
      const data = await response.json()

      if (data.success && data.lineItems) {
        setMcResults({
          scenarioId: data.scenarioId,
          entityId: data.entityId,
          mcPeriod: data.mcPeriod,
          numDraws: data.numDraws,
          lineItems: data.lineItems
        })

        if (data.lineItems.length > 0) {
          setPrimaryVariable(data.lineItems[0].code)
          if (data.lineItems.length > 1) {
            setSecondaryVariable(data.lineItems[1].code)
          }
        }
      } else {
        logger.error('Failed to load MC results:', data.error)
      }
    } catch (error) {
      logger.error('Error loading MC results:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMcDistribution = async (lineItemCode: string) => {
    if (!currentScenario || !currentEntity || !mcResults) return

    const dbPath = getDefaultDbPath()

    try {
      const response = await fetch(
        apiUrl(`/api/results/mc-distribution?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&periodId=${mcResults.mcPeriod}&entityId=${currentEntity}&lineItemCode=${encodeURIComponent(lineItemCode)}`)
      )
      const data = await response.json()

      if (data.success) {
        // Transform values array to draws array with draw numbers
        const distributionWithDraws = {
          ...data.distribution,
          draws: data.distribution.values.map((value: number, index: number) => ({
            drawNumber: index,
            value: value
          }))
        }
        setMcDistribution(distributionWithDraws)
        setPrimaryDistribution(distributionWithDraws)
      }
    } catch (error) {
      logger.error('Error loading MC distribution:', error)
    }
  }

  const loadSecondaryDistribution = async (lineItemCode: string) => {
    if (!currentScenario || !currentEntity || !mcResults) return

    const dbPath = getDefaultDbPath()

    try {
      const response = await fetch(
        apiUrl(`/api/results/mc-distribution?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&periodId=${mcResults.mcPeriod}&entityId=${currentEntity}&lineItemCode=${encodeURIComponent(lineItemCode)}`)
      )
      const data = await response.json()

      if (data.success) {
        // Transform values array to draws array with draw numbers
        const distributionWithDraws = {
          ...data.distribution,
          draws: data.distribution.values.map((value: number, index: number) => ({
            drawNumber: index,
            value: value
          }))
        }
        setSecondaryDistribution(distributionWithDraws)
      }
    } catch (error) {
      logger.error('Error loading secondary distribution:', error)
    }
  }

  const loadMcTimeseries = async (lineItemCode: string) => {
    if (!currentScenario || !currentEntity) return

    const dbPath = getDefaultDbPath()

    try {
      const response = await fetch(
        apiUrl(`/api/mc-timeseries?dbPath=${encodeURIComponent(dbPath)}&scenarioId=${currentScenario}&entityId=${currentEntity}&lineItemCode=${encodeURIComponent(lineItemCode)}`)
      )
      const data = await response.json()

      if (data.success) {
        setMcTimeseries(data.timeseries)
      } else {
        logger.warn('MC timeseries endpoint not available yet')
        setMcTimeseries(null)
      }
    } catch (error) {
      logger.warn('MC timeseries not available:', error)
      setMcTimeseries(null)
    }
  }

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
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

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName)
      } else {
        newSet.add(sectionName)
      }
      return newSet
    })
  }

  const generateAiInsights = async () => {
    console.log('generateAiInsights called', { primaryVariable, primaryDistribution })
    if (!primaryVariable || !primaryDistribution) {
      console.log('Early return: missing primaryVariable or primaryDistribution')
      return
    }

    setAiLoading(true)
    try {
      // Find the selected line item details
      const selectedItem = mcResults?.lineItems.find(item => item.code === primaryVariable)
      const selectedScenario = scenarios.find(s => s.scenario_id === currentScenario)
      const selectedEntity = entities.find(e => e.entity_id === currentEntity)

      // Build context for the AI
      const contextDescription = `Analyzing Monte Carlo simulation results for ${selectedItem?.name || primaryVariable} in scenario "${selectedScenario?.name || currentScenario}" at entity "${selectedEntity?.name || currentEntity}".`

      // Extract key statistics from distribution
      const stats = primaryDistribution.statistics
      const range = stats.max - stats.min
      const cv = (stats.std / Math.abs(stats.mean)) * 100 // coefficient of variation

      // Determine distribution shape
      let distributionShape = 'symmetric'
      if (stats.skew > 0.5) distributionShape = 'right-skewed (positive skew)'
      else if (stats.skew < -0.5) distributionShape = 'left-skewed (negative skew)'

      let tailCharacter = 'normal'
      if (stats.kurtosis > 3) tailCharacter = 'heavy-tailed (more extreme values)'
      else if (stats.kurtosis < 3) tailCharacter = 'light-tailed (fewer extreme values)'

      const prompt = `You are a financial risk and Monte Carlo simulation expert. Analyze this Monte Carlo simulation result and provide a concise, insightful summary paragraph (2-4 sentences).

Context: ${contextDescription}

Statistics from 5000 Monte Carlo draws:
- Mean: ${stats.mean.toFixed(2)}
- Median: ${stats.median.toFixed(2)}
- Standard Deviation: ${stats.std.toFixed(2)}
- Coefficient of Variation: ${cv.toFixed(1)}%
- Range: ${stats.min.toFixed(2)} to ${stats.max.toFixed(2)} (spread: ${range.toFixed(2)})
- Skewness: ${stats.skew.toFixed(3)} (${distributionShape})
- Kurtosis: ${stats.kurtosis.toFixed(3)} (${tailCharacter})
- 5th-95th percentile range: ${primaryDistribution.p5.toFixed(2)} to ${primaryDistribution.p95.toFixed(2)}

Provide a narrative summary that:
1. Interprets the uncertainty and risk profile (using coefficient of variation and percentile range)
2. Explains what the skewness and kurtosis tell us about the distribution shape and tail risk
3. Highlights any important implications for decision-making
4. Uses business-friendly language

Keep it concise (2-4 sentences) and insightful. Do not use bullet points or lists in your response - write as a flowing paragraph.`

      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        throw new Error('AI insights generation failed')
      }

      const result = await response.json()
      const insights = result.content[0].text
      setAiInsights(insights)

    } catch (error) {
      console.error('AI insights error:', error)
      setAiInsights('Unable to generate AI insights. Please try again.')
    } finally {
      setAiLoading(false)
    }
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
                  padding: '8px 10px',
                  backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                  border: `1px solid ${isSelected ? 'rgba(168, 85, 247, 0.5)' : 'rgba(168, 85, 247, 0.2)'}`,
                  borderRadius: '4px',
                  marginBottom: '4px',
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
                    style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '6px' }}
                  >
                    {isExpanded ? (
                      <ChevronDown style={{ width: '14px', height: '14px', color: '#a855f7' }} />
                    ) : (
                      <ChevronRight style={{ width: '14px', height: '14px', color: '#a855f7' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '20px' }} />}

                <Building2 style={{ width: '14px', height: '14px', color: '#a855f7', marginRight: '6px' }} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: isSelected ? '600' : '400', color: '#fff' }}>
                    {entity.name}
                  </div>
                  {entity.granularity_level && (
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                      {entity.code} • {entity.granularity_level}
                    </div>
                  )}
                </div>
              </div>

              {hasChildren && isExpanded && renderEntityTree(entity.children!, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  const addToReport = async (elementRef: React.RefObject<HTMLDivElement>, panelType: string, variables: string[]) => {
    if (!elementRef.current || !mcResults) return

    try {
      const scenarioName = scenarios.find(s => s.scenario_id === currentScenario)?.name || ''
      const entityName = entities.find(e => e.entity_id === currentEntity)?.name || ''

      const dataUrl = await domtoimage.toPng(elementRef.current, {
        quality: 1,
        bgcolor: '#ffffff',
        style: {
          backgroundColor: '#ffffff',
          color: '#000000'
        }
      })

      const caption = `${panelType} | ${variables.join(' vs ')} | ${scenarioName} | ${entityName} | MC Period ${mcResults.mcPeriod}`

      const reportSnippets = JSON.parse(localStorage.getItem('reportSnippets') || '[]')
      reportSnippets.push({
        type: panelType,
        image: dataUrl,
        caption: caption,
        timestamp: new Date().toISOString()
      })
      localStorage.setItem('reportSnippets', JSON.stringify(reportSnippets))

      logger.info('Added to report:', caption)
    } catch (error) {
      logger.error('Error adding to report:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>Loading Monte Carlo results...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!mcResults || mcResults.lineItems.length === 0) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>No Monte Carlo results available. Please run a stochastic simulation first.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selectedItem = mcResults.lineItems.find(item => item.code === primaryVariable)

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '32px',
        paddingBottom: '16px',
        borderBottom: '2px solid rgba(168, 85, 247, 0.3)'
      }}>
        <TrendingUp size={32} style={{ color: '#a855f7' }} />
        <h1 style={{
          fontSize: '28px',
          fontWeight: '600',
          color: '#e9d5ff',
          margin: 0
        }}>
          Monte Carlo Analysis
        </h1>
        <span style={{
          padding: '6px 16px',
          backgroundColor: 'rgba(168, 85, 247, 0.2)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: '500',
          color: '#e9d5ff'
        }}>
          {mcResults.numDraws} draws
        </span>
      </div>

      {/* Controls */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        marginBottom: '24px'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', color: '#c4b5fd', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                Scenario
              </label>
              <select
                value={currentScenario || ''}
                onChange={(e) => setCurrentScenario(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                {scenarios.map(s => (
                  <option key={s.scenario_id} value={s.scenario_id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#c4b5fd', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                Entity
              </label>
              <div style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '6px',
                padding: '6px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)'
              }}>
                {entities.length > 0 ? renderEntityTree(entities, 0) : (
                  <div style={{ color: '#94a3b8', fontSize: '12px', padding: '6px' }}>
                    No entities available
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Statement Panel - MC Results with purple theme */}
      {mcResults && (
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          marginBottom: '24px'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px',
              paddingBottom: '16px',
              borderBottom: '2px solid rgba(168, 85, 247, 0.3)'
            }}>
              <h2 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: '#e9d5ff',
                margin: 0
              }}>
                Financial Statement - Period {mcResults.mcPeriod}
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
            </div>

            <div style={{
              fontSize: '13px',
              color: '#c4b5fd',
              marginBottom: '16px'
            }}>
              Click a line item to set it as Primary Variable. Shift+Click to set Secondary Variable.
            </div>

            <ScrollArea style={{ maxHeight: '500px' }}>
              <div style={{ paddingRight: '16px' }}>
                {/* Group line items by section */}
                {(() => {
                  // Map section codes to display names
                  const sectionDisplayNames: Record<string, string> = {
                    'profit_and_loss': 'Profit & Loss',
                    'balance_sheet': 'Balance Sheet',
                    'carbon_statement': 'Carbon Statement',
                    'Other': 'Other'
                  }

                  const sectionMap = new Map<string, typeof mcResults.lineItems>()
                  mcResults.lineItems.forEach((item) => {
                    const section = item.section || 'Other'
                    if (!sectionMap.has(section)) {
                      sectionMap.set(section, [])
                    }
                    sectionMap.get(section)!.push(item)
                  })

                  // Define section order
                  const sectionOrder = ['profit_and_loss', 'balance_sheet', 'carbon_statement', 'Other']
                  const sortedSections = Array.from(sectionMap.entries()).sort((a, b) => {
                    const indexA = sectionOrder.indexOf(a[0])
                    const indexB = sectionOrder.indexOf(b[0])
                    return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
                  })

                  return sortedSections.map(([sectionCode, items]) => {
                    const sectionName = sectionDisplayNames[sectionCode] || sectionCode
                    const isExpanded = expandedSections.has(sectionCode)

                    return (
                      <div key={sectionCode} style={{ marginBottom: '16px' }}>
                        {/* Section Header */}
                        <div
                          onClick={() => toggleSection(sectionCode)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 12px',
                            backgroundColor: 'rgba(168, 85, 247, 0.15)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            marginBottom: '8px',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.25)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown style={{ width: '18px', height: '18px', color: '#a855f7' }} />
                          ) : (
                            <ChevronRight style={{ width: '18px', height: '18px', color: '#a855f7' }} />
                          )}
                          <span style={{
                            fontSize: '14px',
                            fontWeight: '600',
                            color: '#a855f7',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            {sectionName}
                          </span>
                        </div>

                        {/* Section Items */}
                        {isExpanded && (
                          <div style={{ paddingLeft: '24px' }}>
                            {items.map((item) => (
                              <div
                                key={item.code}
                                onClick={(e) => {
                                  if (e.shiftKey) {
                                    setSecondaryVariable(item.code)
                                  } else {
                                    setPrimaryVariable(item.code)
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '10px 14px',
                                  borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
                                  backgroundColor:
                                    primaryVariable === item.code ? 'rgba(168, 85, 247, 0.3)' :
                                    secondaryVariable === item.code ? 'rgba(168, 85, 247, 0.2)' :
                                    'rgba(168, 85, 247, 0.05)',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  if (primaryVariable !== item.code && secondaryVariable !== item.code) {
                                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (primaryVariable !== item.code && secondaryVariable !== item.code) {
                                    e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.05)'
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {primaryVariable === item.code && (
                                    <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: '600', padding: '2px 6px', backgroundColor: 'rgba(168, 85, 247, 0.2)', borderRadius: '3px' }}>PRIMARY</span>
                                  )}
                                  {secondaryVariable === item.code && (
                                    <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: '600', padding: '2px 6px', backgroundColor: 'rgba(192, 132, 252, 0.2)', borderRadius: '3px' }}>SECONDARY</span>
                                  )}
                                  <span style={{
                                    fontSize: '12px',
                                    color: '#c4b5fd',
                                    fontFamily: 'monospace',
                                    minWidth: '90px'
                                  }}>
                                    {item.code}
                                  </span>
                                  <span style={{
                                    fontSize: '13px',
                                    color: '#fff',
                                    fontWeight: '500'
                                  }}>
                                    {item.name}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '14px',
                                  color: '#e9d5ff',
                                  fontWeight: '600',
                                  fontFamily: 'monospace',
                                  minWidth: '110px',
                                  textAlign: 'right'
                                }}>
                                  {formatValue(item.mean)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                })()}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Full Width Analysis Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>

        {/* Probability Distribution Panel with Statistics */}
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          width: '100%'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div ref={distChartRef}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e9d5ff', margin: 0 }}>
                  Probability Distribution
                </h3>
                <button
                  onClick={() => addToReport(distChartRef, 'Probability Distribution', [primaryVariable])}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '4px',
                    color: '#e9d5ff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Add to Report
                </button>
              </div>

              {mcDistribution ? (
                renderDistributionChart(mcDistribution)
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading distribution...
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fan Chart Panel */}
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          width: '100%'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div ref={fanChartRef}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e9d5ff', margin: 0 }}>
                  Fan Chart
                </h3>
                <button
                  onClick={() => addToReport(fanChartRef, 'Fan Chart', [primaryVariable])}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '4px',
                    color: '#e9d5ff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Add to Report
                </button>
              </div>

              {mcTimeseries ? (
                renderFanChart(mcTimeseries)
              ) : (
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(168, 85, 247, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)'
                }}>
                  <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>
                    Fan Chart Not Available
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Time series data endpoint needs to be implemented
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 3D Joint Distribution Panel */}
        <Card style={{
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid rgba(168, 85, 247, 0.5)',
          width: '100%'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <div ref={jointDistRef}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e9d5ff', margin: 0 }}>
                  Joint Distribution
                </h3>
                <button
                  onClick={() => addToReport(jointDistRef, '3D Joint Distribution', [primaryVariable, secondaryVariable])}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: 'rgba(168, 85, 247, 0.3)',
                    border: '1px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '4px',
                    color: '#e9d5ff',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}
                >
                  Add to Report
                </button>
              </div>

              {primaryDistribution && secondaryDistribution ? (
                renderJointDistribution()
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  Loading joint distribution...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Panel */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        marginTop: '32px'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#e9d5ff', margin: 0 }}>
              AI Insights
            </h3>
            <button
              onClick={generateAiInsights}
              disabled={aiLoading}
              style={{
                padding: '8px 16px',
                backgroundColor: aiLoading ? 'rgba(168, 85, 247, 0.2)' : 'rgba(168, 85, 247, 0.5)',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                borderRadius: '6px',
                color: '#e9d5ff',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              {aiLoading ? 'Generating...' : 'Generate Insights'}
            </button>
          </div>

          {aiInsights ? (
            <div style={{
              backgroundColor: 'rgba(168, 85, 247, 0.05)',
              borderRadius: '8px',
              padding: '16px',
              color: '#c4b5fd',
              fontSize: '14px',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {aiInsights}
            </div>
          ) : (
            <div style={{
              padding: '32px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px'
            }}>
              Click "Generate Insights" to analyze the selected variable using AI
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  function renderDistributionChart(distribution: McDistribution) {
    if (!distribution || !distribution.draws || distribution.draws.length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          No distribution data available
        </div>
      )
    }

    const draws = distribution.draws
    const values = draws.map(d => d.value)

    // Check for zero variance
    if (distribution.statistics.std === 0 || distribution.statistics.min === distribution.statistics.max) {
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
            All {draws.length} draws have the same value: {formatValue(distribution.statistics.mean)}
          </div>
        </div>
      )
    }

    const bandwidth = 1.06 * distribution.statistics.std * Math.pow(draws.length, -0.2)

    // Generate KDE points
    const numKdePoints = 200
    const xMin = distribution.statistics.min - bandwidth * 3
    const xMax = distribution.statistics.max + bandwidth * 3
    const xStep = (xMax - xMin) / numKdePoints

    const kdePoints: Array<{ x: number; density: number }> = []
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

    // Chart dimensions - wider for better visibility
    const chartWidth = 1000
    const chartHeight = 350
    const margin = { top: 30, right: 280, bottom: 60, left: 60 }
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
            x1={margin.left} y1={margin.top}
            x2={margin.left} y2={margin.top + plotHeight}
            stroke="#94a3b8" strokeWidth="2"
          />
          <text
            x={margin.left - 45} y={margin.top + plotHeight / 2}
            fill="#c4b5fd" fontSize="11" textAnchor="middle"
            transform={`rotate(-90, ${margin.left - 45}, ${margin.top + plotHeight / 2})`}
          >
            Density
          </text>

          {/* X-axis */}
          <line
            x1={margin.left} y1={margin.top + plotHeight}
            x2={margin.left + plotWidth} y2={margin.top + plotHeight}
            stroke="#94a3b8" strokeWidth="2"
          />
          <text
            x={margin.left + plotWidth / 2} y={chartHeight - 15}
            fill="#c4b5fd" fontSize="11" textAnchor="middle"
          >
            Value
          </text>

          {/* X-axis ticks */}
          {[0, 0.5, 1].map(frac => {
            const val = xMin + frac * (xMax - xMin)
            const x = xScale(val)
            return (
              <g key={frac}>
                <line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 5} stroke="#94a3b8" />
                <text x={x} y={margin.top + plotHeight + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">
                  {formatValue(val)}
                </text>
              </g>
            )
          })}

          {/* Mean line */}
          <line
            x1={xScale(distribution.statistics.mean)} y1={margin.top}
            x2={xScale(distribution.statistics.mean)} y2={margin.top + plotHeight}
            stroke="#a78bfa" strokeWidth="2" strokeDasharray="5,5"
          />

          {/* KDE filled area */}
          <path
            d={`${kdePath} L ${xScale(xMax)} ${margin.top + plotHeight} L ${xScale(xMin)} ${margin.top + plotHeight} Z`}
            fill="url(#kdeAreaGradient)" stroke="none"
          />

          {/* KDE curve */}
          <path
            d={kdePath} fill="none"
            stroke="url(#kdeGradient)" strokeWidth="2"
          />

          {/* Percentile lines */}
          {Object.entries(distribution.percentiles).map(([key, val]) => {
            const x = xScale(val)
            const percentileColors: Record<string, string> = {
              p5: '#ef4444', p25: '#f97316', p50: '#e9d5ff', p75: '#3b82f6', p95: '#10b981'
            }
            const color = percentileColors[key] || '#94a3b8'
            const isHovered = hoveredPercentile === key
            return (
              <g key={key}>
                <rect
                  x={x - 10} y={0} width={20} height={chartHeight}
                  fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredPercentile(key)}
                  onMouseLeave={() => setHoveredPercentile(null)}
                />
                <line
                  x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight}
                  stroke={color} strokeWidth={isHovered ? 2 : 1}
                  strokeDasharray="2,2" opacity={isHovered ? 0.9 : 0.5}
                  style={{ pointerEvents: 'none' }}
                />
                {isHovered && (
                  <text
                    x={x} y={margin.top - 5}
                    fill={color} fontSize="10" fontWeight="600" textAnchor="middle"
                  >
                    {key.toUpperCase()}: {formatValue(val)}
                  </text>
                )}
              </g>
            )
          })}

          {/* Statistics Panel in right margin - Two columns */}
          <g>
            <text x={chartWidth - 260} y={margin.top} fill="#e9d5ff" fontSize="16" fontWeight="700">Statistics</text>

            {/* Left Column */}
            <text x={chartWidth - 260} y={margin.top + 28} fill="#c4b5fd" fontSize="13" fontWeight="600">Mean:</text>
            <text x={chartWidth - 260} y={margin.top + 46} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{formatValue(distribution.statistics.mean)}</text>

            <text x={chartWidth - 260} y={margin.top + 70} fill="#c4b5fd" fontSize="13" fontWeight="600">Median:</text>
            <text x={chartWidth - 260} y={margin.top + 88} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{formatValue(distribution.statistics.median)}</text>

            <text x={chartWidth - 260} y={margin.top + 112} fill="#c4b5fd" fontSize="13" fontWeight="600">Std Dev:</text>
            <text x={chartWidth - 260} y={margin.top + 130} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{formatValue(distribution.statistics.std)}</text>

            <text x={chartWidth - 260} y={margin.top + 154} fill="#c4b5fd" fontSize="13" fontWeight="600">Min:</text>
            <text x={chartWidth - 260} y={margin.top + 172} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{formatValue(distribution.statistics.min)}</text>

            {/* Right Column */}
            <text x={chartWidth - 130} y={margin.top + 28} fill="#c4b5fd" fontSize="13" fontWeight="600">Skewness:</text>
            <text x={chartWidth - 130} y={margin.top + 46} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{distribution.statistics.skew.toFixed(3)}</text>

            <text x={chartWidth - 130} y={margin.top + 70} fill="#c4b5fd" fontSize="13" fontWeight="600">Kurtosis:</text>
            <text x={chartWidth - 130} y={margin.top + 88} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{distribution.statistics.kurtosis.toFixed(3)}</text>

            <text x={chartWidth - 130} y={margin.top + 112} fill="#c4b5fd" fontSize="13" fontWeight="600">Max:</text>
            <text x={chartWidth - 130} y={margin.top + 130} fill="#fff" fontSize="14" fontWeight="700" fontFamily="monospace">{formatValue(distribution.statistics.max)}</text>
          </g>

          {/* Draw markers */}
          {draws.map((draw) => {
            const x = xScale(draw.value)
            let density = 0
            for (let i = 0; i < kdePoints.length - 1; i++) {
              if (draw.value >= kdePoints[i].x && draw.value <= kdePoints[i + 1].x) {
                const t = (draw.value - kdePoints[i].x) / (kdePoints[i + 1].x - kdePoints[i].x)
                density = kdePoints[i].density + t * (kdePoints[i + 1].density - kdePoints[i].density)
                break
              }
            }
            const y = yScale(density)

            const normalizedPos = (draw.value - distribution.statistics.min) /
              (distribution.statistics.max - distribution.statistics.min)
            let markerColor = '#8b5cf6'
            if (normalizedPos < 0.2) markerColor = '#ef4444'
            else if (normalizedPos < 0.4) markerColor = '#f97316'
            else if (normalizedPos > 0.8) markerColor = '#10b981'
            else if (normalizedPos > 0.6) markerColor = '#3b82f6'

            const isHovered = hoveredDraw?.drawNumber === draw.drawNumber

            return (
              <circle
                key={draw.drawNumber}
                cx={x} cy={y}
                r={isHovered ? 5 : 3}
                fill={isHovered ? '#fbbf24' : markerColor}
                stroke={isHovered ? '#fff' : '#a78bfa'}
                strokeWidth={isHovered ? 2 : 1}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => {
                  setHoveredDraw(draw)
                  setHoverPos({ x: e.clientX, y: e.clientY })
                }}
                onMouseLeave={() => {
                  setHoveredDraw(null)
                  setHoverPos(null)
                }}
              />
            )
          })}
        </svg>

        {hoveredDraw && hoverPos && (
          <div style={{
            position: 'fixed',
            left: hoverPos.x + 15,
            top: hoverPos.y - 60,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            borderRadius: '6px',
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 1000
          }}>
            <div style={{ fontSize: '11px', color: '#c4b5fd', marginBottom: '4px' }}>
              Draw #{hoveredDraw.drawNumber}
            </div>
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600', fontFamily: 'monospace' }}>
              {formatValue(hoveredDraw.value)}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderFanChart(timeseries: McTimeseries) {
    if (!timeseries || !timeseries.periods || timeseries.periods.length === 0 || !timeseries.statistics) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          No timeseries data available
        </div>
      )
    }

    const chartWidth = 900
    const chartHeight = 300
    const margin = { top: 30, right: 40, bottom: 60, left: 60 }
    const plotWidth = chartWidth - margin.left - margin.right
    const plotHeight = chartHeight - margin.top - margin.bottom

    const periods = timeseries.periods
    const minPeriod = Math.min(...periods)
    const maxPeriod = Math.max(...periods)

    // Find min/max values across all series
    const allValues = [
      ...(timeseries.statistics.p1 || []),
      ...(timeseries.statistics.p99 || []),
      ...(timeseries.deterministic || [])
    ].filter(v => v != null && !isNaN(v))

    if (allValues.length === 0) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>
            No Valid Data for Fan Chart
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            All timeseries values are identical or invalid
          </div>
        </div>
      )
    }

    const minValue = Math.min(...allValues)
    const maxValue = Math.max(...allValues)

    // Check for zero range
    if (minValue === maxValue || isNaN(minValue) || isNaN(maxValue)) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>
            No Variation in Timeseries
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            All values are {formatValue(minValue)}
          </div>
        </div>
      )
    }

    const xScale = (period: number) => margin.left + ((period - minPeriod) / (maxPeriod - minPeriod)) * plotWidth
    const yScale = (value: number) => margin.top + plotHeight - ((value - minValue) / (maxValue - minValue)) * plotHeight

    // Generate paths
    const deterministicPath = periods.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.deterministic[i])}`
    ).join(' ')

    // Only generate percentile paths if the data exists
    const hasP1P99 = timeseries.statistics.p1 && timeseries.statistics.p99
    const hasP5P95 = timeseries.statistics.p5 && timeseries.statistics.p95
    const hasP25P75 = timeseries.statistics.p25 && timeseries.statistics.p75

    const p99Path = hasP1P99 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p99[i])}`).join(' ') : ''
    const p95Path = hasP5P95 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p95[i])}`).join(' ') : ''
    const p75Path = hasP25P75 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p75[i])}`).join(' ') : ''
    const p25Path = hasP25P75 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p25[i])}`).join(' ') : ''
    const p5Path = hasP5P95 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p5[i])}`).join(' ') : ''
    const p1Path = hasP1P99 ? periods.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p)} ${yScale(timeseries.statistics.p1[i])}`).join(' ') : ''

    // Create area paths (need to reverse for closing)
    const p1ToP99Area = hasP1P99 ? p1Path + ' ' + periods.slice().reverse().map((p, i) =>
      `L ${xScale(p)} ${yScale(timeseries.statistics.p99[periods.length - 1 - i])}`
    ).join(' ') + ' Z' : ''

    const p5ToP95Area = hasP5P95 ? p5Path + ' ' + periods.slice().reverse().map((p, i) =>
      `L ${xScale(p)} ${yScale(timeseries.statistics.p95[periods.length - 1 - i])}`
    ).join(' ') + ' Z' : ''

    const p25ToP75Area = hasP25P75 ? p25Path + ' ' + periods.slice().reverse().map((p, i) =>
      `L ${xScale(p)} ${yScale(timeseries.statistics.p75[periods.length - 1 - i])}`
    ).join(' ') + ' Z' : ''

    return (
      <div style={{ position: 'relative' }}>
        <svg width={chartWidth} height={chartHeight} style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
          {/* Y-axis */}
          <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#94a3b8" strokeWidth="2" />
          <text x={margin.left - 45} y={margin.top + plotHeight / 2} fill="#c4b5fd" fontSize="11" textAnchor="middle"
            transform={`rotate(-90, ${margin.left - 45}, ${margin.top + plotHeight / 2})`}>
            Value
          </text>

          {/* X-axis */}
          <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight}
            stroke="#94a3b8" strokeWidth="2" />
          <text x={margin.left + plotWidth / 2} y={chartHeight - 15} fill="#c4b5fd" fontSize="11" textAnchor="middle">
            Period
          </text>

          {/* X-axis ticks */}
          {periods.map((p, idx) => {
            if (idx % Math.ceil(periods.length / 5) === 0 || idx === periods.length - 1) {
              const x = xScale(p)
              return (
                <g key={p}>
                  <line x1={x} y1={margin.top + plotHeight} x2={x} y2={margin.top + plotHeight + 5} stroke="#94a3b8" />
                  <text x={x} y={margin.top + plotHeight + 18} fill="#94a3b8" fontSize="10" textAnchor="middle">{p}</text>
                </g>
              )
            }
            return null
          })}

          {/* Shaded areas */}
          {hasP1P99 && <path d={p1ToP99Area} fill="rgba(168, 85, 247, 0.08)" stroke="none" />}
          {hasP5P95 && <path d={p5ToP95Area} fill="rgba(168, 85, 247, 0.15)" stroke="none" />}
          {hasP25P75 && <path d={p25ToP75Area} fill="rgba(168, 85, 247, 0.25)" stroke="none" />}

          {/* Percentile lines */}
          {hasP1P99 && <path d={p1Path} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.4" />}
          {hasP5P95 && <path d={p5Path} stroke="#ef4444" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.6" />}
          {hasP25P75 && <path d={p25Path} stroke="#f97316" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.7" />}
          {hasP25P75 && <path d={p75Path} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.7" />}
          {hasP5P95 && <path d={p95Path} stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.6" />}
          {hasP1P99 && <path d={p99Path} stroke="#10b981" strokeWidth="1" strokeDasharray="3,3" fill="none" opacity="0.4" />}

          {/* Deterministic line */}
          <path d={deterministicPath} stroke="#a78bfa" strokeWidth="3" fill="none" />
        </svg>

        <div style={{
          marginTop: '8px',
          fontSize: '11px',
          color: '#94a3b8',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <span><span style={{ color: '#a78bfa' }}>━━</span> Deterministic</span>
          <span><span style={{ color: '#ef4444' }}>┅┅</span> P5-P95</span>
          <span><span style={{ color: '#f97316' }}>┅┅</span> P25-P75</span>
        </div>
      </div>
    )
  }

  function renderJointDistribution() {
    if (!primaryDistribution || !secondaryDistribution) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          Select both primary and secondary variables to view joint distribution
        </div>
      )
    }

    if (!primaryDistribution.draws || !secondaryDistribution.draws ||
        primaryDistribution.draws.length === 0 || secondaryDistribution.draws.length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          No distribution data available
        </div>
      )
    }

    // Calculate correlation between primary and secondary variables
    const primaryValues = primaryDistribution.draws.map(d => d.value)
    const secondaryValues = secondaryDistribution.draws.map(d => d.value)

    // Check for zero variance in either variable
    const primaryStd = primaryDistribution.statistics?.std || 0
    const secondaryStd = secondaryDistribution.statistics?.std || 0

    if (primaryStd === 0 || secondaryStd === 0) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>
            No Variation in Variables
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {primaryStd === 0 && secondaryStd === 0 ? 'Both variables' : primaryStd === 0 ? 'Primary variable' : 'Secondary variable'} have zero variance
          </div>
        </div>
      )
    }

    // Calculate means
    const meanX = primaryValues.reduce((a, b) => a + b, 0) / primaryValues.length
    const meanY = secondaryValues.reduce((a, b) => a + b, 0) / secondaryValues.length

    // Calculate covariance and standard deviations
    let covariance = 0
    let varX = 0
    let varY = 0

    for (let i = 0; i < primaryValues.length; i++) {
      const dx = primaryValues[i] - meanX
      const dy = secondaryValues[i] - meanY
      covariance += dx * dy
      varX += dx * dx
      varY += dy * dy
    }

    const correlation = covariance / Math.sqrt(varX * varY)

    // Check if correlation is valid
    if (isNaN(correlation) || !isFinite(correlation)) {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}>
          <div style={{ fontSize: '14px', color: '#c4b5fd', marginBottom: '8px' }}>
            Cannot Calculate Correlation
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            Variables may have insufficient variation
          </div>
        </div>
      )
    }

    return (
      <div style={{ height: '900px' }}>
        <JointDistributionPanel
          variable1={primaryVariable}
          variable2={secondaryVariable}
          correlation={correlation}
          onClose={() => {}}
        />
      </div>
    )
  }
}
