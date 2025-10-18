import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, GripVertical } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'

interface Driver {
  driver_id: number
  code: string
  name: string
  description: string
  category: string
}

interface TableInfo {
  tableName: string
  fileName: string
  fileId: number
}

interface FileConfig {
  tableName: string
  scenarioColumn: string
  variableColumn: string
  classificationColumns: { column: string; entityLevel: string }[]
}

interface VariableMapping {
  variableValue: string
  driverCode: string
}

const MapScenarios: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [availableTables, setAvailableTables] = useState<TableInfo[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [selectedFileName, setSelectedFileName] = useState<string>('')
  const [tableColumns, setTableColumns] = useState<string[]>([])
  const [uniqueVariables, setUniqueVariables] = useState<string[]>([])
  const [entityLevels, setEntityLevels] = useState<string[]>([])

  // Configuration state
  const [scenarioColumn, setScenarioColumn] = useState<string>('')
  const [variableColumn, setVariableColumn] = useState<string>('')

  // Drag and drop state for classification columns
  const [columnBuckets, setColumnBuckets] = useState<{ [key: string]: string[] }>({
    'not-mapped': []
  })

  // Drag and drop state for variable mapping
  const [variableMappings, setVariableMappings] = useState<{ [driverCode: string]: string[] }>({})
  const [unmappedVariables, setUnmappedVariables] = useState<string[]>([])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Fetch available staging tables
  useEffect(() => {
    fetch(`http://localhost:3001/api/scenarios/staging-tables?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAvailableTables(data.tables || [])
        }
      })
      .catch(err => console.error('Error fetching staging tables:', err))
  }, [])

  // Fetch drivers
  useEffect(() => {
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        setDrivers(data || [])
      })
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  // Fetch entity levels
  useEffect(() => {
    fetch(`http://localhost:3001/api/entity-levels?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const levels = data.levels || []
          setEntityLevels(levels)

          // Initialize buckets for each entity level
          const buckets: { [key: string]: string[] } = { 'not-mapped': [] }
          levels.forEach((level: string) => {
            buckets[level] = []
          })
          setColumnBuckets(buckets)
        }
      })
      .catch(err => console.error('Error fetching entity levels:', err))
  }, [])

  // Fetch columns when table selected
  useEffect(() => {
    if (!selectedTable) return

    fetch(`http://localhost:3001/api/scenarios/staging-columns?dbPath=${encodeURIComponent(dbPath)}&tableName=${encodeURIComponent(selectedTable)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const cols = (data.columns || []).map((c: any) => c.name)
          setTableColumns(cols)

          // Put all non-year columns in "not-mapped" bucket initially
          const nonYearCols = cols.filter((col: string) => !col.toLowerCase().startsWith('y') && col !== '_rowid')
          setColumnBuckets(prev => ({
            ...prev,
            'not-mapped': nonYearCols
          }))
        }
      })
      .catch(err => console.error('Error fetching columns:', err))
  }, [selectedTable])

  // Fetch unique variable values when variable column is selected
  useEffect(() => {
    if (!selectedTable || !variableColumn) return

    fetch(`http://localhost:3001/api/scenarios/unique-values?dbPath=${encodeURIComponent(dbPath)}&tableName=${encodeURIComponent(selectedTable)}&columnName=${encodeURIComponent(variableColumn)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const values = data.values || []
          setUniqueVariables(values)
          setUnmappedVariables(values)

          // Initialize empty mappings for all drivers
          const mappings: { [driverCode: string]: string[] } = {}
          drivers.forEach(driver => {
            mappings[driver.code] = []
          })
          setVariableMappings(mappings)
        }
      })
      .catch(err => console.error('Error fetching unique values:', err))
  }, [selectedTable, variableColumn, drivers])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEndClassification = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeColumn = active.id as string
    const targetBucket = over.id as string

    // Find which bucket the column is currently in
    let sourceBucket: string | null = null
    for (const [bucket, columns] of Object.entries(columnBuckets)) {
      if (columns.includes(activeColumn)) {
        sourceBucket = bucket
        break
      }
    }

    if (!sourceBucket || sourceBucket === targetBucket) return

    // Remove from scenario/variable column selections if being moved
    if (activeColumn === scenarioColumn) setScenarioColumn('')
    if (activeColumn === variableColumn) setVariableColumn('')

    // Move column between buckets
    setColumnBuckets(prev => ({
      ...prev,
      [sourceBucket]: prev[sourceBucket].filter(col => col !== activeColumn),
      [targetBucket]: [...prev[targetBucket], activeColumn]
    }))
  }

  const handleDragEndVariableMapping = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const variable = active.id as string
    const targetDriverCode = over.id as string

    // Remove from unmapped if present
    if (unmappedVariables.includes(variable)) {
      setUnmappedVariables(prev => prev.filter(v => v !== variable))
      setVariableMappings(prev => ({
        ...prev,
        [targetDriverCode]: [...(prev[targetDriverCode] || []), variable]
      }))
      return
    }

    // Find which driver this variable is currently mapped to
    let sourceDriver: string | null = null
    for (const [driverCode, variables] of Object.entries(variableMappings)) {
      if (variables.includes(variable)) {
        sourceDriver = driverCode
        break
      }
    }

    if (sourceDriver === targetDriverCode) return

    if (sourceDriver) {
      // Move between drivers
      setVariableMappings(prev => ({
        ...prev,
        [sourceDriver]: prev[sourceDriver].filter(v => v !== variable),
        [targetDriverCode]: [...(prev[targetDriverCode] || []), variable]
      }))
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')

    try {
      // Build classification columns config
      const classificationColumns: { column: string; entityLevel: string }[] = []
      Object.entries(columnBuckets).forEach(([bucket, columns]) => {
        if (bucket !== 'not-mapped') {
          columns.forEach(col => {
            classificationColumns.push({ column: col, entityLevel: bucket })
          })
        }
      })

      const config: FileConfig = {
        tableName: selectedTable,
        scenarioColumn,
        variableColumn,
        classificationColumns
      }

      // Build variable mappings
      const mappings: VariableMapping[] = []
      Object.entries(variableMappings).forEach(([driverCode, variables]) => {
        variables.forEach(variable => {
          mappings.push({ variableValue: variable, driverCode })
        })
      })

      const response = await fetch('http://localhost:3001/api/scenarios/save-file-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          config,
          mappings
        })
      })

      if (!response.ok) throw new Error('Failed to save configuration')

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const physicalDrivers = drivers.filter(d => d.category === 'physical')
  const transitionDrivers = drivers.filter(d => d.category === 'transition')

  const DraggableColumn = ({ column }: { column: string }) => (
    <div
      style={{
        padding: '10px 12px',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        border: '1px solid rgba(59, 130, 246, 0.4)',
        borderRadius: '6px',
        color: '#60a5fa',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'grab',
        transition: 'all 0.2s'
      }}
    >
      <GripVertical className="w-4 h-4" />
      {column}
    </div>
  )

  const DraggableVariable = ({ variable }: { variable: string }) => (
    <div
      style={{
        padding: '10px 12px',
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: '6px',
        color: '#a855f7',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'grab',
        transition: 'all 0.2s'
      }}
    >
      <GripVertical className="w-4 h-4" />
      {variable}
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '40px'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Map Scenario Data
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Configure how scenario CSV files are structured and map variable names to defined drivers
          </p>
        </div>

        {/* No Data Warning */}
        {availableTables.length === 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            marginBottom: '32px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <div style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px'
              }}>
                <AlertCircle style={{ width: '32px', height: '32px', color: '#ef4444', margin: '0 auto 12px' }} />
                <div style={{ color: '#fca5a5', fontSize: '14px' }}>
                  No scenario data loaded. Please upload scenario CSV files first in the "Load Scenarios" page.
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Select File */}
        {availableTables.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
                Step 1: Select Scenario File
              </h3>
              <select
                value={selectedTable}
                onChange={(e) => {
                  const tableName = e.target.value
                  const tableInfo = availableTables.find(t => t.tableName === tableName)
                  setSelectedTable(tableName)
                  setSelectedFileName(tableInfo?.fileName || '')
                  setScenarioColumn('')
                  setVariableColumn('')
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  color: '#ffffff',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '8px'
                }}
              >
                <option value="">-- Select File --</option>
                {availableTables.map(table => (
                  <option key={table.tableName + table.fileId} value={table.tableName}>
                    {table.fileName}
                  </option>
                ))}
              </select>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Identify Columns */}
        {selectedTable && tableColumns.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            marginBottom: '24px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '16px' }}>
                Step 2: Identify Column Structure
              </h3>

              <div style={{ display: 'grid', gap: '20px' }}>
                {/* Scenario Column */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px', fontWeight: '500' }}>
                    Scenario Identifier Column *
                  </label>
                  <select
                    value={scenarioColumn}
                    onChange={(e) => setScenarioColumn(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      color: '#ffffff',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      borderRadius: '6px'
                    }}
                  >
                    <option value="">-- Select Column --</option>
                    {columnBuckets['not-mapped']?.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* Variable Column */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px', fontWeight: '500' }}>
                    Variable Name Column *
                  </label>
                  <select
                    value={variableColumn}
                    onChange={(e) => setVariableColumn(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      fontSize: '14px',
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      color: '#ffffff',
                      border: '1px solid rgba(100, 116, 139, 0.3)',
                      borderRadius: '6px'
                    }}
                  >
                    <option value="">-- Select Column --</option>
                    {columnBuckets['not-mapped']?.filter(col => col !== scenarioColumn).map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Map Classification Columns with Drag & Drop */}
        {selectedTable && tableColumns.length > 0 && scenarioColumn && variableColumn && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            marginBottom: '24px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                Step 3: Map Classification Columns to Entity Hierarchy
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                Drag columns to entity levels. Columns in "Not Mapped" will be ignored.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEndClassification}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                  {/* Not Mapped Bucket */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(100, 116, 139, 0.1)',
                    border: '2px dashed rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    minHeight: '150px'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
                      Not Mapped
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {columnBuckets['not-mapped']
                        ?.filter(col => col !== scenarioColumn && col !== variableColumn)
                        .map(col => (
                          <div key={col} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', col)}>
                            <DraggableColumn column={col} />
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Entity Level Buckets */}
                  {entityLevels.map(level => (
                    <div
                      key={level}
                      style={{
                        padding: '16px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        border: '2px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        minHeight: '150px'
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault()
                        const col = e.dataTransfer.getData('text/plain')
                        handleDragEndClassification({
                          active: { id: col },
                          over: { id: level }
                        } as any)
                      }}
                    >
                      <div style={{ fontSize: '14px', fontWeight: '600', color: '#60a5fa', marginBottom: '12px', textTransform: 'capitalize' }}>
                        {level}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {columnBuckets[level]?.map(col => (
                          <div key={col} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', col)}>
                            <DraggableColumn column={col} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DndContext>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Map Variables to Drivers with Drag & Drop */}
        {uniqueVariables.length > 0 && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(168, 85, 247, 0.3)',
            marginBottom: '24px'
          }}>
            <CardContent style={{ padding: '32px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '8px' }}>
                Step 4: Map Variables to Defined Drivers
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
                Drag variable names onto drivers. Unmapped variables will be ignored.
              </p>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEndVariableMapping}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
                  {/* Unmapped Variables */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: 'rgba(100, 116, 139, 0.1)',
                    border: '2px dashed rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    height: 'fit-content',
                    maxHeight: '600px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
                      Unmapped Variables ({unmappedVariables.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {unmappedVariables.map(variable => (
                        <div key={variable} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', variable)}>
                          <DraggableVariable variable={variable} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Driver Targets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Physical Drivers */}
                    {physicalDrivers.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa', marginBottom: '12px' }}>
                          Physical Risk Drivers
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {physicalDrivers.map(driver => (
                            <div
                              key={driver.code}
                              style={{
                                padding: '16px',
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                border: '2px solid rgba(59, 130, 246, 0.3)',
                                borderRadius: '8px'
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                const variable = e.dataTransfer.getData('text/plain')
                                handleDragEndVariableMapping({
                                  active: { id: variable },
                                  over: { id: driver.code }
                                } as any)
                              }}
                            >
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                                {driver.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                {driver.description}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {variableMappings[driver.code]?.map(variable => (
                                  <div
                                    key={variable}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('text/plain', variable)}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: 'rgba(59, 130, 246, 0.3)',
                                      border: '1px solid rgba(59, 130, 246, 0.5)',
                                      borderRadius: '4px',
                                      color: '#60a5fa',
                                      fontSize: '12px',
                                      cursor: 'grab'
                                    }}
                                  >
                                    {variable}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transition Drivers */}
                    {transitionDrivers.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#a855f7', marginBottom: '12px' }}>
                          Transition Risk Drivers
                        </h4>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {transitionDrivers.map(driver => (
                            <div
                              key={driver.code}
                              style={{
                                padding: '16px',
                                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                                border: '2px solid rgba(168, 85, 247, 0.3)',
                                borderRadius: '8px'
                              }}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault()
                                const variable = e.dataTransfer.getData('text/plain')
                                handleDragEndVariableMapping({
                                  active: { id: variable },
                                  over: { id: driver.code }
                                } as any)
                              }}
                            >
                              <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                                {driver.name}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                {driver.description}
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {variableMappings[driver.code]?.map(variable => (
                                  <div
                                    key={variable}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('text/plain', variable)}
                                    style={{
                                      padding: '6px 10px',
                                      backgroundColor: 'rgba(168, 85, 247, 0.3)',
                                      border: '1px solid rgba(168, 85, 247, 0.5)',
                                      borderRadius: '4px',
                                      color: '#a855f7',
                                      fontSize: '12px',
                                      cursor: 'grab'
                                    }}
                                  >
                                    {variable}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </DndContext>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        {uniqueVariables.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving' || !scenarioColumn || !variableColumn}
              className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: saveStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px 32px',
                fontSize: '16px'
              }}
            >
              <Save className="w-5 h-5" style={{ marginRight: '8px' }} />
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error - Retry' : 'Save Configuration'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MapScenarios
