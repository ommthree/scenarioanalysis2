import React, { useState, useEffect } from 'react'
import { Link2, ArrowRight, Check, AlertCircle, Save, GripVertical, ChevronDown, ChevronRight, Building2, Network, FileText, Upload, FileSpreadsheet, Layers } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface LineItem {
  code: string
  display_name: string
  section: string
  is_computed: boolean
}

interface Template {
  template_code: string
  template_name: string
  statement_type: string
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
  entity_path: number[]
  line_item_code: string
  csv_row_index: number
}

interface StatementMapping {
  statementType: 'pnl' | 'bs' | 'carbon' | 'cf'
  label: string
  csvData: CsvRow[]
  csvColumns: string[]
  csvFileName?: string
  selectedTemplate: Template | null
  hierarchicalMappings: HierarchicalMapping[]
  expandedNodes: Set<string>
}

export default function MapStatements() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Entity | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)

  // State for each statement type
  const [statementMappings, setStatementMappings] = useState<Record<string, StatementMapping>>({
    pnl: {
      statementType: 'pnl',
      label: 'Profit & Loss',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set()
    },
    bs: {
      statementType: 'bs',
      label: 'Balance Sheet',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set()
    },
    cf: {
      statementType: 'cf',
      label: 'Cash Flow',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set()
    },
    carbon: {
      statementType: 'carbon',
      label: 'Carbon Statement',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set()
    }
  })

  useEffect(() => {
    loadTemplates()
    loadEntities()
    loadAllStagingData()
  }, [])

  // Restore saved mappings when selectedCompany and templates are loaded
  useEffect(() => {
    if (selectedCompany && templates.length > 0) {
      restoreSavedMappings()
    }
  }, [selectedCompany?.entity_id, templates.length])

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
        setTemplates(result.templates || [])
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
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

  const loadAllStagingData = async () => {
    const types: Array<'pnl' | 'bs' | 'cf' | 'carbon'> = ['pnl', 'bs', 'cf', 'carbon']
    for (const type of types) {
      await loadStagingData(type)
    }
  }

  const loadStagingData = async (statementType: 'pnl' | 'bs' | 'cf' | 'carbon') => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch('http://localhost:3001/api/statements/staging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, statementType })
      })
      const result = await response.json()
      if (result.success) {
        setStatementMappings(prev => ({
          ...prev,
          [statementType]: {
            ...prev[statementType],
            csvData: result.rows || [],
            csvColumns: result.columns || []
          }
        }))
      }
    } catch (error) {
      console.error(`Failed to load staging data for ${statementType}:`, error)
    }
  }

  const restoreSavedMappings = async () => {
    if (!selectedCompany || templates.length === 0) return

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // First, reset template selections and mappings (but preserve csvData)
      setStatementMappings(prev => ({
        pnl: {
          ...prev.pnl,
          selectedTemplate: null,
          hierarchicalMappings: [],
          expandedNodes: new Set()
        },
        bs: {
          ...prev.bs,
          selectedTemplate: null,
          hierarchicalMappings: [],
          expandedNodes: new Set()
        },
        cf: {
          ...prev.cf,
          selectedTemplate: null,
          hierarchicalMappings: [],
          expandedNodes: new Set()
        },
        carbon: {
          ...prev.carbon,
          selectedTemplate: null,
          hierarchicalMappings: [],
          expandedNodes: new Set()
        }
      }))

      // Restore mappings for each statement type
      // Query for mappings with the exact frontend type (pnl, bs, cf, carbon)
      const types: Array<'pnl' | 'bs' | 'carbon' | 'cf'> = ['pnl', 'bs', 'cf', 'carbon']
      for (const type of types) {
        const response = await fetch(
          `http://localhost:3001/api/statements/get-all-mappings?${new URLSearchParams({
            dbPath,
            statementType: type
          })}`
        )
        const result = await response.json()

        if (result.success && result.mappings && result.mappings.length > 0) {
          // Find mapping for current company
          const companyMapping = result.mappings.find((m: any) => m.companyId === selectedCompany.entity_id)

          if (companyMapping) {
            // Find the template by code
            const template = templates.find(t => t.template_code === companyMapping.templateCode)

            if (template) {
              setStatementMappings(prev => ({
                ...prev,
                [type]: {
                  ...prev[type],
                  selectedTemplate: template,
                  hierarchicalMappings: companyMapping.hierarchicalMappings || [],
                  csvFileName: companyMapping.csvFileName || undefined
                }
              }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to restore saved mappings:', error)
    }
  }

  const buildEntityTree = (flatEntities: any[]): Entity[] => {
    const entityMap = new Map<number, Entity>()
    const roots: Entity[] = []

    flatEntities.forEach((e) => {
      entityMap.set(e.entity_id, {
        ...e,
        children: []
      })
    })

    flatEntities.forEach((e) => {
      const entity = entityMap.get(e.entity_id)!
      if (e.parent_entity_id === null) {
        roots.push(entity)
      } else {
        const parent = entityMap.get(e.parent_entity_id)
        if (parent) {
          parent.children = parent.children || []
          parent.children.push(entity)
        }
      }
    })

    return roots
  }

  const getRootCompanies = (): Entity[] => {
    return entities.filter(e => e.parent_entity_id === null)
  }

  const handleTemplateSelect = (statementType: 'pnl' | 'bs' | 'carbon', templateCode: string) => {
    const template = templates.find(t => t.template_code === templateCode)
    setStatementMappings(prev => ({
      ...prev,
      [statementType]: {
        ...prev[statementType],
        selectedTemplate: template || null,
        hierarchicalMappings: [],
        expandedNodes: new Set()
      }
    }))
  }

  const toggleNode = (statementType: string, nodeId: string) => {
    setStatementMappings(prev => {
      const mapping = prev[statementType]
      const newExpanded = new Set(mapping.expandedNodes)
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId)
      } else {
        newExpanded.add(nodeId)
      }
      return {
        ...prev,
        [statementType]: {
          ...mapping,
          expandedNodes: newExpanded
        }
      }
    })
  }

  const getRowIdentifier = (row: CsvRow, columns: string[]): string => {
    const nameColumn = columns.find(col =>
      col.toLowerCase().includes('name') ||
      col.toLowerCase().includes('description') ||
      col.toLowerCase().includes('item')
    )
    if (nameColumn && row[nameColumn]) {
      return row[nameColumn]
    }
    const firstCol = columns[0]
    return firstCol ? row[firstCol] : 'Unknown'
  }

  const handleDragStart = (rowIndex: number) => {
    setDraggedRowIndex(rowIndex)
  }

  const handleDrop = (statementType: string, entityPath: number[], lineItemCode: string) => {
    if (draggedRowIndex === null) return

    setStatementMappings(prev => {
      const mapping = prev[statementType]
      let newMappings = [...mapping.hierarchicalMappings]

      // Helper function to check if path1 is an ancestor of path2
      const isAncestor = (path1: number[], path2: number[]): boolean => {
        if (path1.length >= path2.length) return false
        return path1.every((id, i) => id === path2[i])
      }

      // Helper function to check if path1 is a descendant of path2
      const isDescendant = (path1: number[], path2: number[]): boolean => {
        return isAncestor(path2, path1)
      }

      // Remove conflicting mappings:
      // 1. Any ancestor entities with the same line item
      // 2. Any descendant entities with the same line item
      newMappings = newMappings.filter(m => {
        if (m.line_item_code !== lineItemCode) return true
        const isSamePath = JSON.stringify(m.entity_path) === JSON.stringify(entityPath)
        const isConflict = isAncestor(m.entity_path, entityPath) || isDescendant(m.entity_path, entityPath)
        return isSamePath || !isConflict
      })

      const existingIndex = newMappings.findIndex(
        m => JSON.stringify(m.entity_path) === JSON.stringify(entityPath) && m.line_item_code === lineItemCode
      )

      if (existingIndex >= 0) {
        newMappings[existingIndex] = {
          entity_path: entityPath,
          line_item_code: lineItemCode,
          csv_row_index: draggedRowIndex
        }
      } else {
        newMappings.push({
          entity_path: entityPath,
          line_item_code: lineItemCode,
          csv_row_index: draggedRowIndex
        })
      }

      return {
        ...prev,
        [statementType]: {
          ...mapping,
          hierarchicalMappings: newMappings
        }
      }
    })

    setDraggedRowIndex(null)
  }

  const getMappedRow = (statementType: string, entityPath: number[], lineItemCode: string): CsvRow | null => {
    const mapping = statementMappings[statementType]
    const found = mapping.hierarchicalMappings.find(
      m => JSON.stringify(m.entity_path) === JSON.stringify(entityPath) && m.line_item_code === lineItemCode
    )
    return found ? mapping.csvData[found.csv_row_index] : null
  }

  const filteredLineItems = (template: Template | null, statementType: string) => {
    if (!template) return []

    // Map statement type to section name
    const sectionMap: Record<string, string> = {
      'pnl': 'profit_and_loss',
      'pl': 'profit_and_loss',
      'bs': 'balance_sheet',
      'cf': 'cash_flow',
      'carbon': 'carbon_statement'
    }

    const targetSection = sectionMap[statementType]

    // Check if template has sections defined (any line item has a section)
    const hasSections = template.line_items.some(item => item.section !== undefined)

    console.log('Filtering line items:', {
      statementType,
      targetSection,
      templateType: template.statement_type,
      templateCode: template.template_code,
      totalItems: template.line_items.length,
      hasSections,
      sections: [...new Set(template.line_items.map(i => i.section))]
    })

    // For unified templates OR templates with sections, filter by section
    if (hasSections && targetSection) {
      let filtered = template.line_items.filter(item =>
        !item.is_computed && item.section === targetSection
      )

      // If no non-computed items, include computed items too
      if (filtered.length === 0) {
        filtered = template.line_items.filter(item =>
          item.section === targetSection
        )
        console.log('No non-computed items, showing all items in section:', filtered.length)
      } else {
        console.log('Filtered by section:', filtered.length, 'items')
      }
      return filtered
    }

    // For templates without sections (specific statement type templates), show all non-computed items
    const filtered = template.line_items.filter(item => !item.is_computed)
    console.log('Showing all non-computed items:', filtered.length)
    return filtered
  }

  const renderEntityLineItemTree = (
    statementType: string,
    entity: Entity,
    entityPath: number[],
    lineItemCode: string,
    depth: number
  ): JSX.Element => {
    const mapping = statementMappings[statementType]
    const nodeId = `${entityPath.join('-')}-${lineItemCode}`
    const isExpanded = mapping.expandedNodes.has(nodeId)
    const mappedRow = getMappedRow(statementType, entityPath, lineItemCode)
    const hasChildren = entity.children && entity.children.length > 0

    return (
      <div key={nodeId} style={{ marginLeft: depth * 16 }}>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.15)'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.backgroundColor = mappedRow ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.5)'
            e.currentTarget.style.borderColor = mappedRow ? 'rgba(34, 197, 94, 0.3)' : 'rgba(71, 85, 105, 0.3)'
          }}
          onDrop={(e) => {
            handleDrop(statementType, entityPath, lineItemCode)
            e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!mappedRow) {
              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)'
            }
          }}
          onMouseLeave={(e) => {
            if (!mappedRow) {
              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
            }
          }}
          style={{
            padding: '10px 12px',
            marginBottom: '6px',
            backgroundColor: mappedRow ? 'rgba(34, 197, 94, 0.1)' : 'rgba(30, 41, 59, 0.5)',
            border: mappedRow ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {hasChildren && (
            <button
              onClick={() => toggleNode(statementType, nodeId)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          <Building2 className="w-3 h-3" style={{ color: '#64748b', flexShrink: 0 }} />
          <span style={{ color: '#94a3b8', fontSize: '14px', flex: 1 }}>
            {entity.name}
          </span>
          {mappedRow && (
            <>
              <ArrowRight className="w-4 h-4 text-green-500" />
              <span style={{ color: '#22c55e', fontSize: '14px' }}>
                {getRowIdentifier(mappedRow, mapping.csvColumns)}
              </span>
            </>
          )}
        </div>

        {hasChildren && isExpanded && entity.children?.map(childEntity =>
          renderEntityLineItemTree(statementType, childEntity, [...entityPath, childEntity.entity_id], lineItemCode, depth + 1)
        )}
      </div>
    )
  }

  const renderMappingPanel = (statementType: 'pnl' | 'bs' | 'carbon') => {
    const mapping = statementMappings[statementType]
    if (!mapping.selectedTemplate || !selectedCompany || mapping.csvData.length === 0) {
      return null
    }

    const template = mapping.selectedTemplate
    const lineItems = filteredLineItems(template, statementType)

    return (
      <Card key={statementType} className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(16, 185, 129, 0.4)', marginBottom: '32px' }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Network className="w-8 h-8 text-green-500" />
                <div>
                  <h3 className="font-semibold text-lg">{mapping.label} Mapping</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag CSV rows to line items for {selectedCompany.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', paddingLeft: '32px', paddingRight: '32px' }}>
            {/* CSV Data */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">CSV Rows</h4>
              </div>
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {mapping.csvData.map((row, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
                      e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
                      e.currentTarget.style.transform = 'translateX(4px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                      e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                      e.currentTarget.style.transform = 'translateX(0)'
                    }}
                    style={{
                      padding: '6px 10px',
                      marginBottom: '4px',
                      backgroundColor: 'rgba(51, 65, 85, 0.5)',
                      border: '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '4px',
                      cursor: 'grab',
                      fontSize: '12px',
                      color: '#e2e8f0',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <GripVertical className="w-3 h-3" style={{ color: '#64748b', flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{getRowIdentifier(row, mapping.csvColumns)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hierarchical Tree */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Network className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">Template Line Items</h4>
              </div>
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {lineItems.map(lineItem => (
                  <div key={lineItem.code} style={{ marginBottom: '20px' }}>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      border: '2px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      fontWeight: 600,
                      fontSize: '14px',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}>
                      <Layers className="w-4 h-4" />
                      {lineItem.display_name}
                    </div>
                    {renderEntityLineItemTree(statementType, selectedCompany, [selectedCompany.entity_id], lineItem.code, 0)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handleSave = async () => {
    if (!selectedCompany) return

    setIsSaving(true)
    setSaveMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // Save each statement type's mappings
      for (const [statementType, mapping] of Object.entries(statementMappings)) {
        if (mapping.selectedTemplate && mapping.hierarchicalMappings.length > 0) {
          // Get the most recent staged file name for this statement type
          let csvFileName: string | undefined = undefined
          try {
            const fileTypeMap: Record<string, string> = {
              'pnl': 'pnl',
              'bs': 'balance_sheet',
              'carbon': 'carbon',
              'cf': 'cashflow'
            }
            const fileType = fileTypeMap[statementType] || statementType
            const filesResponse = await fetch(`http://localhost:3001/api/staged-files/${fileType}?dbPath=${encodeURIComponent(dbPath)}`)
            const filesResult = await filesResponse.json()
            if (filesResult.success && filesResult.files && filesResult.files.length > 0) {
              csvFileName = filesResult.files[0].file_name
            }
          } catch (err) {
            console.error(`Failed to fetch staged file for ${statementType}:`, err)
          }

          const response = await fetch('http://localhost:3001/api/statements/save-hierarchical-mapping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dbPath,
              templateCode: mapping.selectedTemplate.template_code,
              statementType: statementType, // Use frontend statement type, not template's
              companyId: selectedCompany.entity_id,
              hierarchicalMappings: mapping.hierarchicalMappings,
              csvFileName
            })
          })

          const result = await response.json()
          if (!response.ok || !result.success) {
            throw new Error(`Failed to save ${statementType} mapping: ${result.error}`)
          }

          // Also save the mapped data to result tables
          // Using default scenario_id=1 and period_id=1 for now
          try {
            const dataResponse = await fetch('http://localhost:3001/api/statements/save-mapped-data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dbPath,
                templateCode: mapping.selectedTemplate.template_code,
                statementType: statementType, // Use frontend statement type, not template's
                companyId: selectedCompany.entity_id,
                hierarchicalMappings: mapping.hierarchicalMappings,
                scenarioId: 1,  // TODO: Make this selectable by user
                periodId: 1     // TODO: Make this selectable by user
              })
            })

            const dataResult = await dataResponse.json()
            if (!dataResponse.ok || !dataResult.success) {
              console.warn(`Failed to save ${statementType} data: ${dataResult.error}`)
            }
          } catch (dataErr) {
            console.error(`Failed to save ${statementType} data:`, dataErr)
          }
        }
      }

      setSaveMessage('All mappings and data saved successfully!')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const hasAnyMappings = Object.values(statementMappings).some(m => m.hierarchicalMappings.length > 0)

  return (
    <div className="p-12">
      <div style={{ marginBottom: '32px', paddingLeft: '48px' }}>
        <h2 className="text-2xl font-bold mb-2">Map Statements</h2>
        <p className="text-muted-foreground">
          Map uploaded CSV data to statement templates for each statement type
        </p>
      </div>

      <div style={{ paddingLeft: '48px', paddingRight: '48px' }}>
        {/* Company Selection */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.4)', marginBottom: '32px' }}>
          <CardContent style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Building2 className="w-6 h-6 text-blue-500" />
              <h3 className="font-semibold text-lg">Select Company</h3>
            </div>
            <select
              value={selectedCompany?.entity_id || ''}
              onChange={(e) => {
                const company = getRootCompanies().find(c => c.entity_id === parseInt(e.target.value))
                setSelectedCompany(company || null)
              }}
              style={{
                width: '100%',
                maxWidth: '400px',
                padding: '10px 12px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                color: '#ffffff',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '6px'
              }}
            >
              <option value="">Select company...</option>
              {getRootCompanies().map(company => (
                <option key={company.entity_id} value={company.entity_id}>
                  {company.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {/* Statement Type Mapping Table */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(34, 197, 94, 0.4)', marginBottom: '32px' }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <FileText className="w-6 h-6 text-green-500" />
            <h3 className="font-semibold text-lg">Statement Templates</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '200px 300px 1fr', gap: '16px', alignItems: 'center' }}>
            {/* Headers */}
            <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '14px' }}>Statement Type</div>
            <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '14px' }}>CSV Data</div>
            <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '14px' }}>Template</div>

            {/* Rows */}
            {Object.entries(statementMappings).map(([type, mapping]) => (
              <React.Fragment key={type}>
                <div style={{ color: '#e2e8f0', fontSize: '14px' }}>{mapping.label}</div>
                <div style={{ color: mapping.csvData.length > 0 ? '#22c55e' : '#94a3b8', fontSize: '14px' }}>
                  {mapping.csvData.length > 0 ? `${mapping.csvData.length} rows` : 'No data uploaded'}
                </div>
                <select
                  value={mapping.selectedTemplate?.template_code || ''}
                  onChange={(e) => handleTemplateSelect(type as 'pnl' | 'bs' | 'carbon', e.target.value)}
                  disabled={mapping.csvData.length === 0}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px',
                    opacity: mapping.csvData.length === 0 ? 0.5 : 1
                  }}
                >
                  <option value="">Select template...</option>
                  {templates
                    .filter(t => t.statement_type === type || t.statement_type === 'unified')
                    .map(t => (
                      <option key={t.template_code} value={t.template_code}>
                        {t.template_name}
                      </option>
                    ))}
                </select>
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Mapping Panels */}
      <div style={{ paddingLeft: '48px', paddingRight: '48px' }}>
        {renderMappingPanel('pnl')}
        {renderMappingPanel('bs')}
        {renderMappingPanel('cf')}
        {renderMappingPanel('carbon')}
      </div>

      {/* Save Button */}
      {hasAnyMappings && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 50 }}>
          <Button
            onClick={handleSave}
            disabled={isSaving || !selectedCompany}
            style={{
              backgroundColor: isSaving ? '#64748b' : '#22c55e',
              padding: '12px 24px',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save All Mappings
              </>
            )}
          </Button>
          {saveMessage && (
            <div style={{
              marginTop: '8px',
              padding: '8px 16px',
              backgroundColor: saveMessage.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              border: `1px solid ${saveMessage.includes('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
              borderRadius: '6px',
              color: saveMessage.includes('Error') ? '#ef4444' : '#22c55e',
              fontSize: '14px'
            }}>
              {saveMessage}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
