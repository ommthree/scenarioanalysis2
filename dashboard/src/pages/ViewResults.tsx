import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, ChevronRight, ChevronDown, Building2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

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

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Load available scenarios, periods, entities, and initial data
  useEffect(() => {
    loadScenarios()
    loadEntities()
  }, [])

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

  const loadScenarios = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/results/scenarios?dbPath=${encodeURIComponent(dbPath)}`)
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
      console.error('Error loading scenarios:', error)
    }
  }

  const loadPeriods = async () => {
    try {
      let url = `http://localhost:3001/api/results/periods?dbPath=${encodeURIComponent(dbPath)}`
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
      console.error('Error loading periods:', error)
    }
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
    try {
      const response = await fetch(`http://localhost:3001/api/results/entities?dbPath=${encodeURIComponent(dbPath)}`)
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
      console.error('Error loading entities:', error)
    }
  }

  const loadResultsForPeriod = async (period: number, entityId: number | null) => {
    setLoading(true)
    try {
      let url = `http://localhost:3001/api/results/statement?dbPath=${encodeURIComponent(dbPath)}&period=${period}`
      if (entityId !== null) {
        url += `&entityId=${entityId}`
      }
      if (currentScenario !== null) {
        url += `&scenarioId=${currentScenario}`
      }

      const response = await fetch(url)
      const data = await response.json()

      // Debug: Log line items to check sign_convention
      console.log('[ViewResults] Received line items:', data.lineItems?.map((li: LineItem) => ({ code: li.code, sign_convention: li.sign_convention, value: li.value })))

      if (data.success) {
        // Group line items by section
        const sectionMap = new Map<string, LineItem[]>()

        data.lineItems.forEach((item: LineItem) => {
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

        // Load driver data for all line items to know which are expandable
        if (entityId !== null) {
          const newDriverData = new Map<string, DriverContribution[]>()
          for (const item of data.lineItems) {
            try {
              let driverUrl = `http://localhost:3001/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&period=${period}&entityId=${entityId}&lineItemCode=${item.code}`
              if (currentScenario !== null) {
                driverUrl += `&scenarioId=${currentScenario}`
              }
              const driverResponse = await fetch(driverUrl)
              const driverData = await driverResponse.json()
              if (driverData.success) {
                newDriverData.set(item.code, driverData.drivers || [])
              }
            } catch (error) {
              console.error(`Error loading drivers for ${item.code}:`, error)
            }
          }
          setDriverData(newDriverData)
        }
      }
    } catch (error) {
      console.error('Error loading results:', error)
    } finally {
      setLoading(false)
    }
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

    try {
      let url = `http://localhost:3001/api/results/driver-decomposition?dbPath=${encodeURIComponent(dbPath)}&period=${currentPeriod}&entityId=${currentEntity}&lineItemCode=${lineItemCode}`
      if (currentScenario !== null) {
        url += `&scenarioId=${currentScenario}`
      }
      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        // Store the result even if empty, so we know we've checked
        setDriverData(prev => new Map(prev).set(lineItemCode, data.drivers || []))
        return data.drivers && data.drivers.length > 0
      }
      return false
    } catch (error) {
      console.error('Error loading driver decomposition:', error)
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

  const renderEntityTree = (entities: Entity[], level = 0): JSX.Element => {
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
        </div>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
          Financial statement results by period
        </p>
      </div>

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
                              color: item.sign_convention === 'negative' ? '#ef4444' : '#22c55e',
                              fontWeight: '600',
                              fontFamily: 'monospace',
                              minWidth: '150px',
                              textAlign: 'right'
                            }}>
                              {item.sign_convention === 'negative' ? '(' : ''}{formatValue(item.value)}{item.sign_convention === 'negative' ? ')' : ''}
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
    </div>
  )
}
