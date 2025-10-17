import { useState, useEffect } from 'react'
import { ArrowRight, Save, GripVertical, ChevronDown, ChevronRight, Building2, Network, FileText, FileSpreadsheet, Layers, Move, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { parse } from 'csv-parse/sync'

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

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
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
  selectedFileId: number | null
  columnConfig: {
    lineItemColumn: string | null
    valueColumn: string | null
    currencyColumn: string | null
  }
  stagedFiles: StagedFile[]
}

export default function MapStatements() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedCompany, setSelectedCompany] = useState<Entity | null>(null)
  const [selectedUnifiedTemplate, setSelectedUnifiedTemplate] = useState<Template | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null)
  const [aiMappingInProgress, setAiMappingInProgress] = useState<Record<string, boolean>>({})
  const [aiMappingMessage, setAiMappingMessage] = useState<Record<string, string>>({})

  // State for each statement type
  const [statementMappings, setStatementMappings] = useState<Record<string, StatementMapping>>({
    pnl: {
      statementType: 'pnl',
      label: 'Profit & Loss',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set(),
      selectedFileId: null,
      columnConfig: {
        lineItemColumn: null,
        valueColumn: null,
        currencyColumn: null
      },
      stagedFiles: []
    },
    bs: {
      statementType: 'bs',
      label: 'Balance Sheet',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set(),
      selectedFileId: null,
      columnConfig: {
        lineItemColumn: null,
        valueColumn: null,
        currencyColumn: null
      },
      stagedFiles: []
    },
    cf: {
      statementType: 'cf',
      label: 'Cash Flow',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set(),
      selectedFileId: null,
      columnConfig: {
        lineItemColumn: null,
        valueColumn: null,
        currencyColumn: null
      },
      stagedFiles: []
    },
    carbon: {
      statementType: 'carbon',
      label: 'Carbon Statement',
      csvData: [],
      csvColumns: [],
      selectedTemplate: null,
      hierarchicalMappings: [],
      expandedNodes: new Set(),
      selectedFileId: null,
      columnConfig: {
        lineItemColumn: null,
        valueColumn: null,
        currencyColumn: null
      },
      stagedFiles: []
    }
  })

  useEffect(() => {
    loadTemplates()
    loadEntities()
    loadAllStagedFiles()
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

  const loadAllStagedFiles = async () => {
    const types: Array<{ key: 'pnl' | 'bs' | 'cf' | 'carbon', apiType: string }> = [
      { key: 'pnl', apiType: 'pnl' },
      { key: 'bs', apiType: 'balance_sheet' },
      { key: 'cf', apiType: 'cashflow' },
      { key: 'carbon', apiType: 'carbon' }
    ]
    for (const { key, apiType } of types) {
      await loadStagedFiles(key, apiType)
    }
  }

  const loadStagedFiles = async (statementType: 'pnl' | 'bs' | 'cf' | 'carbon', apiType: string) => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${apiType}?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()
      if (result.success) {
        setStatementMappings(prev => ({
          ...prev,
          [statementType]: {
            ...prev[statementType],
            stagedFiles: result.files || []
          }
        }))
      }
    } catch (error) {
      console.error(`Failed to load staged files for ${statementType}:`, error)
    }
  }

  const loadStagingData = async (statementType: 'pnl' | 'bs' | 'cf' | 'carbon', fileId: number) => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success && result.csvText) {
        // Parse CSV text
        const records = parse(result.csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }) as CsvRow[]

        const columns = records.length > 0 ? Object.keys(records[0]) : []

        setStatementMappings(prev => ({
          ...prev,
          [statementType]: {
            ...prev[statementType],
            csvData: records,
            csvColumns: columns,
            csvFileName: result.fileName
            // Note: columnConfig is preserved via ...prev[statementType]
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
              // First, update state with everything including columnConfig
              setStatementMappings(prev => {
                // Find the staged file ID if there's a saved file name
                let fileId: number | null = null
                if (companyMapping.csvFileName) {
                  const stagedFile = prev[type].stagedFiles.find(f => f.file_name === companyMapping.csvFileName)
                  if (stagedFile) {
                    fileId = stagedFile.file_id
                  }
                }

                return {
                  ...prev,
                  [type]: {
                    ...prev[type],
                    selectedTemplate: template,
                    selectedFileId: fileId,
                    hierarchicalMappings: companyMapping.hierarchicalMappings || [],
                    columnConfig: companyMapping.columnConfig || {
                      lineItemColumn: null,
                      valueColumn: null,
                      currencyColumn: null
                    },
                    csvFileName: companyMapping.csvFileName || undefined
                  }
                }
              })

              // Then, load the CSV data (which will preserve columnConfig via spread operator)
              if (companyMapping.csvFileName) {
                const fileId = statementMappings[type].stagedFiles.find(f => f.file_name === companyMapping.csvFileName)?.file_id
                if (fileId) {
                  loadStagingData(type, fileId)
                }
              }
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

  const handleTemplateSelect = (templateCode: string) => {
    const template = templates.find(t => t.template_code === templateCode)
    setSelectedUnifiedTemplate(template || null)

    // Apply the unified template to ALL statement types
    setStatementMappings(prev => ({
      pnl: {
        ...prev.pnl,
        selectedTemplate: template || null,
        hierarchicalMappings: [],
        expandedNodes: new Set()
      },
      bs: {
        ...prev.bs,
        selectedTemplate: template || null,
        hierarchicalMappings: [],
        expandedNodes: new Set()
      },
      cf: {
        ...prev.cf,
        selectedTemplate: template || null,
        hierarchicalMappings: [],
        expandedNodes: new Set()
      },
      carbon: {
        ...prev.carbon,
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

  const handleFileSelect = async (statementType: 'pnl' | 'bs' | 'cf' | 'carbon', fileId: string) => {
    const fileIdNum = parseInt(fileId)
    if (!fileIdNum) {
      // Clear selection
      setStatementMappings(prev => ({
        ...prev,
        [statementType]: {
          ...prev[statementType],
          selectedFileId: null,
          csvData: [],
          csvColumns: [],
          columnConfig: {
            lineItemColumn: null,
            valueColumn: null,
            currencyColumn: null
          }
        }
      }))
      return
    }

    // Set selected file ID
    setStatementMappings(prev => ({
      ...prev,
      [statementType]: {
        ...prev[statementType],
        selectedFileId: fileIdNum
      }
    }))

    // Load the file data
    await loadStagingData(statementType, fileIdNum)
  }

  const [draggedRole, setDraggedRole] = useState<'lineItem' | 'value' | 'currency' | null>(null)

  const handleRoleDragStart = (role: 'lineItem' | 'value' | 'currency') => {
    setDraggedRole(role)
  }

  const handleRoleDragEnd = () => {
    setDraggedRole(null)
  }

  const handleColumnDrop = (statementType: string, columnName: string) => {
    if (!draggedRole) return

    const roleMap = {
      lineItem: 'lineItemColumn',
      value: 'valueColumn',
      currency: 'currencyColumn'
    } as const

    setStatementMappings(prev => ({
      ...prev,
      [statementType]: {
        ...prev[statementType],
        columnConfig: {
          ...prev[statementType].columnConfig,
          [roleMap[draggedRole]]: columnName
        }
      }
    }))

    setDraggedRole(null)
  }

  const handleRemoveColumnAssignment = (statementType: string, role: 'lineItemColumn' | 'valueColumn' | 'currencyColumn') => {
    setStatementMappings(prev => ({
      ...prev,
      [statementType]: {
        ...prev[statementType],
        columnConfig: {
          ...prev[statementType].columnConfig,
          [role]: null
        }
      }
    }))
  }

  const handleAIMapping = async (statementType: 'pnl' | 'bs' | 'carbon' | 'cf') => {
    const mapping = statementMappings[statementType]
    const template = mapping.selectedTemplate

    if (!selectedCompany || !template || mapping.csvData.length === 0) {
      setAiMappingMessage(prev => ({ ...prev, [statementType]: 'Please select company, template, and load CSV data first' }))
      setTimeout(() => setAiMappingMessage(prev => ({ ...prev, [statementType]: '' })), 3000)
      return
    }

    const lineItems = filteredLineItems(template, statementType).filter(item => !item.is_computed)

    if (lineItems.length === 0) {
      setAiMappingMessage(prev => ({ ...prev, [statementType]: 'No mappable line items in template' }))
      setTimeout(() => setAiMappingMessage(prev => ({ ...prev, [statementType]: '' })), 3000)
      return
    }

    setAiMappingInProgress(prev => ({ ...prev, [statementType]: true }))
    setAiMappingMessage(prev => ({ ...prev, [statementType]: 'Analyzing with AI...' }))

    try {
      // Prepare data for Claude
      const csvSample = mapping.csvData.slice(0, 20).map((row, idx) => ({
        index: idx,
        data: row
      }))

      const prompt = `You are a financial data mapping assistant. Analyze the CSV data and map it to the template line items.

CSV Columns: ${mapping.csvColumns.join(', ')}
CSV Sample (first 20 rows):
${JSON.stringify(csvSample, null, 2)}

Template Line Items to map:
${lineItems.map(item => `- ${item.code}: ${item.display_name}`).join('\n')}

Company Entity: ${selectedCompany.name}

Instructions:
1. Analyze the CSV column headers and identify which columns contain the financial data values
2. Analyze ALL CSV data rows and map as many as possible to template line items
3. Return ONLY a JSON object with two arrays in this exact format:
{
  "column_mappings": [
    {
      "csv_column_name": "2023",
      "column_type": "data",
      "notes": "Year 2023 values"
    }
  ],
  "row_mappings": [
    {
      "csv_row_index": 0,
      "line_item_code": "revenue",
      "confidence": "high"
    },
    {
      "csv_row_index": 1,
      "line_item_code": "cost_of_sales",
      "confidence": "high"
    }
  ]
}

Rules for column_mappings:
- Identify ALL columns that contain financial data values vs labels/descriptions
- column_type should be "data" for value columns, "label" for description columns, "ignore" for irrelevant columns
- Include notes explaining what the column represents
- Map ALL data columns (years, periods, etc.)

Rules for row_mappings:
- Only map rows where you have reasonable confidence
- csv_row_index must match the index from the CSV sample above
- line_item_code must match one of the codes from the template
- confidence can be "high", "medium", or "low"
- If a row matches multiple line items, choose the best match
- Look for common financial statement items like revenue, expenses, assets, liabilities, etc.

Respond with ONLY the JSON object, no other text`

      // Use backend proxy to avoid CORS issues
      const response = await fetch('http://localhost:3001/api/claude/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'AI mapping failed')
      }

      const result = await response.json()
      const content = result.content[0].text

      // Extract JSON from response (match object with row_mappings and column_mappings)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Invalid response format from AI')
      }

      const aiResponse = JSON.parse(jsonMatch[0])
      const rowMappings = aiResponse.row_mappings || []
      const columnMappings = aiResponse.column_mappings || []

      // Find the first data column for value mapping
      const dataColumns = columnMappings.filter((c: any) => c.column_type === 'data')
      const valueColumn = dataColumns.length > 0 ? dataColumns[0].csv_column_name : null

      // Find label/line item column
      const labelColumn = columnMappings.find((c: any) => c.column_type === 'label')
      const lineItemColumn = labelColumn ? labelColumn.csv_column_name : null

      // Apply the AI-suggested row mappings and column config
      setStatementMappings(prev => ({
        ...prev,
        [statementType]: {
          ...prev[statementType],
          hierarchicalMappings: rowMappings.map((m: any) => ({
            entity_path: [selectedCompany.entity_id],
            line_item_code: m.line_item_code,
            csv_row_index: m.csv_row_index
          })),
          columnConfig: {
            lineItemColumn,
            valueColumn,
            currencyColumn: null
          }
        }
      }))

      // Display column mappings in the message
      setAiMappingMessage(prev => ({
        ...prev,
        [statementType]: 'AI mapping completed!'
      }))
      setTimeout(() => setAiMappingMessage(prev => ({ ...prev, [statementType]: '' })), 5000)

    } catch (error) {
      console.error('AI mapping error:', error)
      setAiMappingMessage(prev => ({
        ...prev,
        [statementType]: `Error: ${error instanceof Error ? error.message : 'AI mapping failed'}`
      }))
      setTimeout(() => setAiMappingMessage(prev => ({ ...prev, [statementType]: '' })), 5000)
    } finally {
      setAiMappingInProgress(prev => ({ ...prev, [statementType]: false }))
    }
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
    // Show ALL items (both computed and non-computed), but computed items will be visually distinct and non-droppable
    if (hasSections && targetSection) {
      const filtered = template.line_items.filter(item =>
        item.section === targetSection
      )
      console.log('Filtered by section (including computed):', filtered.length, 'items')
      return filtered
    }

    // For templates without sections (specific statement type templates), show all items
    const filtered = template.line_items
    console.log('Showing all items (including computed):', filtered.length)
    return filtered
  }

  const renderEntityLineItemTree = (
    statementType: string,
    entity: Entity,
    entityPath: number[],
    lineItemCode: string,
    depth: number
  ) => {
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

  const renderMappingPanel = (statementType: 'pnl' | 'bs' | 'carbon' | 'cf') => {
    const mapping = statementMappings[statementType]
    if (!mapping.selectedTemplate || !selectedCompany) {
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
                </div>
              </div>
              {mapping.csvData.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <Button
                    onClick={() => handleAIMapping(statementType)}
                    disabled={aiMappingInProgress[statementType]}
                    style={{
                      backgroundColor: aiMappingInProgress[statementType] ? '#64748b' : '#8b5cf6',
                      padding: '10px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      boxShadow: 'none'
                    }}
                  >
                    {aiMappingInProgress[statementType] ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        AI Mapping...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        AI Mapping
                      </>
                    )}
                  </Button>
                  {aiMappingMessage[statementType] && (
                    <div style={{
                      padding: '6px 12px',
                      backgroundColor: aiMappingMessage[statementType].includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                      border: `1px solid ${aiMappingMessage[statementType].includes('Error') ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                      borderRadius: '4px',
                      color: aiMappingMessage[statementType].includes('Error') ? '#ef4444' : '#8b5cf6',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      {aiMappingMessage[statementType]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* File Selector - Chips */}
          <div style={{ marginBottom: '24px', paddingLeft: '48px', paddingRight: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-muted-foreground">Select Staged File</h4>
            </div>
            {mapping.stagedFiles.length === 0 ? (
              <div style={{
                padding: '12px 16px',
                backgroundColor: 'rgba(100, 116, 139, 0.1)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '6px',
                color: '#94a3b8',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                No staged files available. Please upload a {mapping.label} file first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {mapping.stagedFiles.map(file => {
                  const isSelected = mapping.selectedFileId === file.file_id
                  return (
                    <button
                      key={file.file_id}
                      onClick={() => handleFileSelect(statementType, String(file.file_id))}
                      style={{
                        padding: '10px 16px',
                        backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                        border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '4px',
                        minWidth: '200px'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                          e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                        }
                      }}
                    >
                      <span style={{
                        color: isSelected ? '#10b981' : '#e2e8f0',
                        fontSize: '14px',
                        fontWeight: isSelected ? 600 : 500
                      }}>
                        {file.file_name}
                      </span>
                      <span style={{
                        color: isSelected ? '#6ee7b7' : '#94a3b8',
                        fontSize: '12px'
                      }}>
                        {file.row_count} rows · {new Date(file.uploaded_at).toLocaleDateString()}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Column Configuration UI with Drag-and-Drop */}
          {mapping.selectedFileId && mapping.csvData.length > 0 && (
            <div style={{ marginBottom: '32px', paddingLeft: '48px', paddingRight: '48px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Move className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">Configure Column Mapping</h4>
              </div>

              {/* Draggable Role Tiles */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('lineItem')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '2px solid rgba(59, 130, 246, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#60a5fa',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Line Item Name
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('value')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    border: '2px solid rgba(34, 197, 94, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#22c55e',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Value/Amount
                </div>

                <div
                  draggable
                  onDragStart={() => handleRoleDragStart('currency')}
                  onDragEnd={handleRoleDragEnd}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'rgba(168, 85, 247, 0.2)',
                    border: '2px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '8px',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#a855f7',
                    fontWeight: 600,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'}
                >
                  <GripVertical className="w-4 h-4" />
                  Currency
                </div>
              </div>

              {/* CSV Preview Table with Droppable Column Headers */}
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 10 }}>
                    <tr>
                      {mapping.csvColumns.map((col) => {
                        const isLineItemCol = mapping.columnConfig.lineItemColumn === col
                        const isValueCol = mapping.columnConfig.valueColumn === col
                        const isCurrencyCol = mapping.columnConfig.currencyColumn === col
                        const hasAssignment = isLineItemCol || isValueCol || isCurrencyCol

                        let bgColor = 'rgba(30, 41, 59, 0.9)'
                        let borderColor = 'rgba(71, 85, 105, 0.3)'
                        let textColor = '#94a3b8'
                        let badgeContent = null

                        if (isLineItemCol) {
                          bgColor = 'rgba(59, 130, 246, 0.15)'
                          borderColor = 'rgba(59, 130, 246, 0.5)'
                          textColor = '#60a5fa'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(59, 130, 246, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Line Item</span>
                        } else if (isValueCol) {
                          bgColor = 'rgba(34, 197, 94, 0.15)'
                          borderColor = 'rgba(34, 197, 94, 0.5)'
                          textColor = '#22c55e'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(34, 197, 94, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Value</span>
                        } else if (isCurrencyCol) {
                          bgColor = 'rgba(168, 85, 247, 0.15)'
                          borderColor = 'rgba(168, 85, 247, 0.5)'
                          textColor = '#a855f7'
                          badgeContent = <span style={{ fontSize: '11px', padding: '2px 8px', backgroundColor: 'rgba(168, 85, 247, 0.3)', borderRadius: '4px', marginLeft: '8px' }}>Currency</span>
                        }

                        return (
                          <th
                            key={col}
                            onDragOver={(e) => {
                              e.preventDefault()
                              if (!hasAssignment) {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.25)'
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
                              }
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.style.backgroundColor = bgColor
                              e.currentTarget.style.borderColor = borderColor
                            }}
                            onDrop={(e) => {
                              e.preventDefault()
                              handleColumnDrop(statementType, col)
                              e.currentTarget.style.backgroundColor = bgColor
                              e.currentTarget.style.borderColor = borderColor
                            }}
                            onClick={() => {
                              if (isLineItemCol) handleRemoveColumnAssignment(statementType, 'lineItemColumn')
                              else if (isValueCol) handleRemoveColumnAssignment(statementType, 'valueColumn')
                              else if (isCurrencyCol) handleRemoveColumnAssignment(statementType, 'currencyColumn')
                            }}
                            style={{
                              padding: '12px 16px',
                              textAlign: 'left',
                              fontWeight: 600,
                              backgroundColor: bgColor,
                              border: `2px solid ${borderColor}`,
                              color: textColor,
                              cursor: hasAssignment ? 'pointer' : 'default',
                              transition: 'all 0.2s ease',
                              position: 'relative'
                            }}
                            title={hasAssignment ? 'Click to remove assignment' : 'Drop role tile here'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span>{col}</span>
                              {badgeContent}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {mapping.csvData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(71, 85, 105, 0.2)' }}>
                        {mapping.csvColumns.map((col) => (
                          <td
                            key={col}
                            style={{
                              padding: '10px 16px',
                              color: '#cbd5e1',
                              backgroundColor: idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.4)'
                            }}
                          >
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {mapping.csvData.length > 10 && (
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                  Showing first 10 of {mapping.csvData.length} rows
                </p>
              )}
            </div>
          )}

          {/* Only show mapping interface if file is selected and has data */}
          {mapping.csvData.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
              <FileSpreadsheet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a staged file above to begin mapping</p>
            </div>
          )}

          {/* Hierarchical Mapping Interface - only show if we have CSV data */}
          {mapping.csvData.length > 0 && (
            <>
              {/* Configure row mapping header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingLeft: '32px' }}>
                <Network className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold text-muted-foreground">Configure row mapping</h4>
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
                      backgroundColor: lineItem.is_computed ? 'rgba(100, 116, 139, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      border: lineItem.is_computed ? '2px solid rgba(100, 116, 139, 0.3)' : '2px solid rgba(59, 130, 246, 0.4)',
                      borderRadius: '8px',
                      marginBottom: '12px',
                      fontWeight: 600,
                      fontSize: '14px',
                      color: lineItem.is_computed ? '#94a3b8' : '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      opacity: lineItem.is_computed ? 0.6 : 1
                    }}>
                      <Layers className="w-4 h-4" />
                      {lineItem.display_name}
                      {lineItem.is_computed && <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: 'auto' }}>(Calculated)</span>}
                    </div>
                    {!lineItem.is_computed && renderEntityLineItemTree(statementType, selectedCompany, [selectedCompany.entity_id], lineItem.code, 0)}
                  </div>
                ))}
              </div>
            </div>
          </div>
            </>
          )}
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
              columnConfig: mapping.columnConfig,
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
        {/* Consolidated Company & Template Selection */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(16, 185, 129, 0.4)', marginBottom: '32px' }}>
          <CardContent style={{ padding: '32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
              {/* Company Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold">Select Company</h3>
                </div>
                <select
                  value={selectedCompany?.entity_id || ''}
                  onChange={(e) => {
                    const company = getRootCompanies().find(c => c.entity_id === parseInt(e.target.value))
                    setSelectedCompany(company || null)
                  }}
                  style={{
                    width: '100%',
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
              </div>

              {/* Template Selection */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <FileText className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold">Unified Statement Template</h3>
                </div>
                <select
                  value={selectedUnifiedTemplate?.template_code || ''}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '6px'
                  }}
                >
                  <option value="">Select unified template...</option>
                  {templates.map(t => (
                    <option key={t.template_code} value={t.template_code}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
              </div>
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
