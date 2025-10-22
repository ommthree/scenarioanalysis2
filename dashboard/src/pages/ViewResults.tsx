import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, ChevronRight, ChevronDown } from 'lucide-react'

interface LineItem {
  code: string
  display_name: string
  section: string
  is_computed: boolean
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
}

export default function ViewResults() {
  const [periods, setPeriods] = useState<number[]>([])
  const [currentPeriod, setCurrentPeriod] = useState(1)
  const [entities, setEntities] = useState<Entity[]>([])
  const [currentEntity, setCurrentEntity] = useState<number | null>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  // Load available periods, entities, and initial data
  useEffect(() => {
    loadPeriods()
    loadEntities()
  }, [])

  // Load data when period or entity changes
  useEffect(() => {
    if (periods.length > 0) {
      loadResultsForPeriod(currentPeriod, currentEntity)
    }
  }, [currentPeriod, currentEntity, periods])

  const loadPeriods = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/results/periods?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()

      if (data.success && data.periods.length > 0) {
        setPeriods(data.periods)
        setCurrentPeriod(data.periods[0])
      }
    } catch (error) {
      console.error('Error loading periods:', error)
    }
  }

  const loadEntities = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/results/entities?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()

      if (data.success && data.entities.length > 0) {
        setEntities(data.entities)
        // Set default to highest entity_id (root level)
        const maxEntity = Math.max(...data.entities.map((e: Entity) => e.entity_id))
        setCurrentEntity(maxEntity)
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

      const response = await fetch(url)
      const data = await response.json()

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
              <CardContent style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                    Entity
                  </label>
                  <select
                    value={currentEntity ?? ''}
                    onChange={(e) => setCurrentEntity(parseInt(e.target.value))}
                    style={{
                      backgroundColor: 'rgba(30, 41, 59, 0.9)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '6px',
                      padding: '12px',
                      color: '#fff',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {entities.map((entity) => (
                      <option key={entity.entity_id} value={entity.entity_id}>
                        {entity.name} ({entity.code}) - {entity.granularity_level}
                      </option>
                    ))}
                  </select>
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
                  {entities.find(e => e.entity_id === currentEntity)?.name || ''}
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
                    {section.items.map((item) => (
                      <div
                        key={item.code}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                          backgroundColor: item.is_computed ? 'rgba(34, 197, 94, 0.05)' : 'transparent'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                          color: item.value < 0 ? '#ef4444' : '#22c55e',
                          fontWeight: '600',
                          fontFamily: 'monospace',
                          minWidth: '150px',
                          textAlign: 'right'
                        }}>
                          {item.value < 0 ? '(' : ''}{formatValue(Math.abs(item.value))}{item.value < 0 ? ')' : ''}
                        </span>
                      </div>
                    ))}
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
