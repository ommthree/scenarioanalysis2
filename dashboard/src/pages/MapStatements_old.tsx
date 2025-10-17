import React, { useState, useEffect } from 'react'
import { Link2, ArrowRight, Check, AlertCircle, Save, GripVertical, ChevronDown, ChevronRight, Building2, Network } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LineItem {
  code: string
  display_name: string
  section: string
  is_computed: boolean
}

interface Template {
  template_code: string
  template_name: string
  line_items: LineItem[]
}

interface CsvRow {
  [key: string]: any
}

interface Entity {
  entity_id: number
  code: string
  name: string
  parent_entity_id: number | null
  granularity_level: string
  children?: Entity[]
}

interface HierarchicalMapping {
  entity_path: number[]  // Array of entity_ids from root to leaf
  line_item_code: string
  csv_row_index: number
}

export default function MapStatements() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Entity | null>(null)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [hierarchicalMappings, setHierarchicalMappings] = useState<HierarchicalMapping[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // Load templates on mount
  useEffect(() => {
    loadTemplates()
    loadEntities()
  }, [])

  const loadTemplates = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch('http://localhost:3001/api/templates/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath })
      })
      const result = await response.json()
      if (result.success) {
        console.log('Loaded templates:', result.templates.length)
        setTemplates(result.templates || [])
      } else {
        console.error('Failed to load templates:', result.error)
        setTemplates([])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplates([])
    }
  }

  const loadEntities = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch('http://localhost:3001/api/entities/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath })
      })
      const result = await response.json()
      if (result.success) {
        setEntities(buildEntityTree(result.entities))
      }
    } catch (error) {
      console.error('Failed to load entities:', error)
    }
  }

  const buildEntityTree = (flatEntities: any[]): Entity[] => {
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

  const toggleNode = (nodeKey: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeKey)) {
      newExpanded.delete(nodeKey)
    } else {
      newExpanded.add(nodeKey)
    }
    setExpandedNodes(newExpanded)
  }

  const handleHierarchicalMapping = (entityPath: number[], lineItemCode: string, csvRowIndex: number) => {
    // Helper: Check if pathA is an ancestor of pathB
    const isAncestor = (pathA: number[], pathB: number[]): boolean => {
      if (pathA.length >= pathB.length) return false
      return pathA.every((id, idx) => id === pathB[idx])
    }

    // Helper: Check if pathA is a descendant of pathB
    const isDescendant = (pathA: number[], pathB: number[]): boolean => {
      return isAncestor(pathB, pathA)
    }

    // Filter out:
    // 1. Exact match (same entity path + line item)
    // 2. Any parent mappings for this line item (when mapping to child)
    // 3. Any child mappings for this line item (when mapping to parent)
    const filtered = hierarchicalMappings.filter(m => {
      // Different line item - keep it
      if (m.line_item_code !== lineItemCode) return true

      // Same line item - check relationships
      const isSamePath = JSON.stringify(m.entity_path) === JSON.stringify(entityPath)
      const isMappingParentOfNew = isAncestor(m.entity_path, entityPath)
      const isMappingChildOfNew = isDescendant(m.entity_path, entityPath)

      // Remove if exact match, or if it's a parent/child of the new mapping
      return !(isSamePath || isMappingParentOfNew || isMappingChildOfNew)
    })

    // Add new mapping
    setHierarchicalMappings([
      ...filtered,
      { entity_path: entityPath, line_item_code: lineItemCode, csv_row_index: csvRowIndex }
    ])
  }

  const getMappingForNode = (entityPath: number[], lineItemCode: string): number | undefined => {
    const mapping = hierarchicalMappings.find(
      m => JSON.stringify(m.entity_path) === JSON.stringify(entityPath) && m.line_item_code === lineItemCode
    )
    return mapping?.csv_row_index
  }

  const getRootCompanies = (): Entity[] => {
    return entities.filter(e => e.parent_entity_id === null)
  }

  const handleTemplateSelect = async (templateCode: string) => {
    const template = templates.find(t => t.template_code === templateCode)
    setSelectedTemplate(template || null)
    setHierarchicalMappings([])
    setSelectedCompany(null)
    setCsvRows([])
    setCsvColumns([])

    // Load CSV rows from staging table using template's statement type
    if (template?.statement_type) {
      try {
        const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
        console.log('Loading CSV data for statement type:', template.statement_type)
        const response = await fetch('http://localhost:3001/api/statements/staging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dbPath, statementType: template.statement_type })
        })
        const result = await response.json()
        console.log('CSV data result:', result)
        if (result.success) {
          console.log('Setting CSV rows:', result.rows?.length || 0, 'columns:', result.columns?.length || 0)
          setCsvRows(result.rows || [])
          setCsvColumns(result.columns || [])
        } else {
          console.error('Failed to load CSV data:', result.error)
        }
      } catch (error) {
        console.error('Failed to load CSV data:', error)
      }
    }
  }


  const handleSaveMapping = async () => {
    if (!selectedTemplate || !selectedCompany) return

    setIsSaving(true)
    setSaveMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      const response = await fetch('http://localhost:3001/api/statements/save-hierarchical-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          templateCode: selectedTemplate.template_code,
          statementType: selectedTemplate.statement_type,
          companyId: selectedCompany.entity_id,
          hierarchicalMappings
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSaveMessage('Mapping saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
      } else {
        setSaveMessage(`Error: ${result.error || 'Failed to save mapping'}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const getRowIdentifier = (row: CsvRow): string => {
    // Try to find a column that looks like a line item name
    const nameColumn = csvColumns.find(col =>
      col.toLowerCase().includes('name') ||
      col.toLowerCase().includes('description') ||
      col.toLowerCase().includes('item')
    )
    if (nameColumn && row[nameColumn]) {
      return row[nameColumn]
    }
    // Fallback to first non-internal column
    const firstCol = csvColumns[0]
    return firstCol ? row[firstCol] : 'Unknown'
  }

  const filteredLineItems = selectedTemplate?.line_items.filter(item => !item.is_computed) || []

  // Recursive function to render: Company → Line Item → Child Entity → (repeat)
  const renderEntityLineItemTree = (
    entity: Entity,
    entityPath: number[],
    lineItemCode: string,
    depth: number = 0
  ): React.ReactElement => {
    const currentPath = [...entityPath, entity.entity_id]
    const nodeKey = `${currentPath.join('-')}-${lineItemCode}`
    const isExpanded = expandedNodes.has(nodeKey)
    const mappedRowIndex = getMappingForNode(currentPath, lineItemCode)
    const isMapped = mappedRowIndex !== undefined
    const hasChildren = entity.children && entity.children.length > 0

    return (
      <div key={nodeKey} style={{ marginLeft: depth > 0 ? '24px' : '0', marginBottom: '8px' }}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggedRowIndex !== null) {
              handleHierarchicalMapping(currentPath, lineItemCode, draggedRowIndex)
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            backgroundColor: isMapped ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.8)',
            border: `2px dashed ${isMapped ? 'rgba(34, 197, 94, 0.5)' : 'rgba(100, 116, 139, 0.4)'}`,
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: '48px'
          }}
          className="hover:border-green-500/60"
        >
          {hasChildren && (
            <button
              onClick={() => toggleNode(nodeKey)}
              style={{
                padding: '2px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#22c55e'
              }}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}

          <Building2 className="w-4 h-4" style={{ color: '#22c55e' }} />

          <div style={{ flex: 1 }}>
            <div className="text-sm font-medium">{entity.name}</div>
            <div className="text-xs text-muted-foreground">
              {entity.code} • {entity.granularity_level}
            </div>
          </div>

          {isMapped ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              backgroundColor: 'rgba(34, 197, 94, 0.3)',
              borderRadius: '4px'
            }}>
              <Check className="w-3 h-3" style={{ color: '#22c55e' }} />
              <span className="text-xs" style={{ color: '#22c55e' }}>
                {getRowIdentifier(csvRows[mappedRowIndex])}
              </span>
            </div>
          ) : (
            <span className="text-xs" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
              Drop CSV row
            </span>
          )}
        </div>

        {/* Render child entities for this line item */}
        {isExpanded && hasChildren && (
          <div style={{ marginTop: '8px' }}>
            {entity.children!.map((childEntity) =>
              renderEntityLineItemTree(childEntity, currentPath, lineItemCode, depth + 1)
            )}
          </div>
        )}
      </div>
    )
  }

  const renderHierarchicalTree = (): React.ReactElement => {
    if (!selectedCompany) return <div>No company selected</div>

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filteredLineItems.map((lineItem) => (
          <div key={lineItem.code}>
            {/* Line Item Header */}
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(34, 197, 94, 0.2)',
              borderRadius: '6px',
              marginBottom: '8px',
              border: '1px solid rgba(34, 197, 94, 0.4)'
            }}>
              <div className="text-sm font-semibold" style={{ color: '#22c55e' }}>
                {lineItem.display_name}
              </div>
              <div className="text-xs text-muted-foreground">{lineItem.code}</div>
            </div>

            {/* Company level drop target for this line item */}
            {renderEntityLineItemTree(selectedCompany, [], lineItem.code, 0)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Map Statements</h1>
        <p className="text-muted-foreground mt-2">Map CSV rows to entity hierarchy + line items</p>
      </div>

      <div className="flex flex-col" style={{ gap: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        {/* Selection Card */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
          <CardContent className="p-8">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
              <Link2 className="w-8 h-8 text-blue-500" style={{ marginTop: '-30px' }} />
              <div>
                <h3 className="font-semibold text-lg">Select Template & Statement</h3>
                <p className="text-sm text-muted-foreground">Choose what to map</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '16px' }}>
              <div>
                <label className="text-sm text-muted-foreground">Template</label>
                <select
                  value={selectedTemplate?.template_code || ''}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px'
                  }}
                >
                  <option value="">Select a template...</option>
                  {templates.map(t => (
                    <option key={t.template_code} value={t.template_code}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-muted-foreground">Company</label>
                <select
                  value={selectedCompany?.entity_id || ''}
                  onChange={(e) => {
                    const company = getRootCompanies().find(c => c.entity_id === parseInt(e.target.value))
                    setSelectedCompany(company || null)
                  }}
                  disabled={!selectedTemplate}
                  style={{
                    width: '100%',
                    marginTop: '4px',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px',
                    opacity: selectedTemplate ? 1 : 0.5
                  }}
                >
                  <option value="">Select company...</option>
                  {getRootCompanies().map(company => (
                    <option key={company.entity_id} value={company.entity_id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hierarchical Tree Mapping */}
        {selectedTemplate && selectedCompany && csvRows.length > 0 && (
          <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <CardContent className="p-8">
              <div style={{ marginBottom: '24px', marginLeft: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', paddingRight: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Network className="w-8 h-8 text-green-500" style={{ marginTop: '-30px' }} />
                    <div>
                      <h3 className="font-semibold text-lg">Hierarchical Mapping</h3>
                      <p className="text-sm text-muted-foreground">
                        Drag CSV rows to any level
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    style={{
                      backgroundColor: '#22c55e',
                      border: 'none',
                      color: '#ffffff',
                      marginTop: '-20px'
                    }}
                  >
                    Map with AI
                  </Button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                {/* CSV Data Preview */}
                <div>
                  <h4 className="text-sm font-semibold mb-4" style={{ color: '#22c55e' }}>CSV Data Rows</h4>
                  <ScrollArea style={{ height: '600px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {csvRows.map((row, idx) => {
                        const rowName = getRowIdentifier(row)
                        const isMappedInHierarchy = hierarchicalMappings.some(m => m.csv_row_index === idx)
                        return (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => setDraggedRowIndex(idx)}
                            onDragEnd={() => setDraggedRowIndex(null)}
                            style={{
                              padding: '12px',
                              backgroundColor: isMappedInHierarchy ? 'rgba(34, 197, 94, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                              border: `2px solid ${isMappedInHierarchy ? 'rgba(34, 197, 94, 0.5)' : 'rgba(34, 197, 94, 0.3)'}`,
                              borderRadius: '8px',
                              cursor: 'grab',
                              opacity: draggedRowIndex === idx ? 0.5 : 1,
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <GripVertical className="w-4 h-4" style={{ color: '#22c55e' }} />
                              <div style={{ flex: 1 }}>
                                <div className="text-sm font-medium">{rowName}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {csvColumns.slice(0, 3).map(col => `${col}: ${row[col]}`).join(' | ')}
                                </div>
                              </div>
                              {isMappedInHierarchy && <Check className="w-4 h-4" style={{ color: '#22c55e' }} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Hierarchical Tree */}
                <div>
                  <h4 className="text-sm font-semibold mb-4" style={{ color: '#22c55e' }}>
                    Entity Hierarchy ({hierarchicalMappings.length} mappings)
                  </h4>
                  <ScrollArea style={{ height: '600px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {selectedCompany && renderHierarchicalTree(selectedCompany, [])}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Section */}
        {selectedTemplate && selectedCompany && hierarchicalMappings.length > 0 && (
          <>
            {saveMessage && (
              <div style={{
                padding: '12px',
                backgroundColor: saveMessage.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                color: saveMessage.includes('Error') ? '#ef4444' : '#22c55e',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                {saveMessage}
              </div>
            )}

            <Button
              onClick={handleSaveMapping}
              disabled={isSaving}
              style={{
                width: '220px',
                height: '44px',
                backgroundColor: !isSaving ? '#22c55e' : '#6b7280',
                border: 'none',
                color: '#ffffff',
                margin: '0 auto',
                display: 'block',
                opacity: !isSaving ? 1 : 0.5
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Mapping'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
