import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Save, AlertCircle, Plus, Sparkles, Download, Upload, Trash2, X, Edit2, FileSpreadsheet } from 'lucide-react'

interface ManagementAction {
  action_id?: number
  action_code: string
  action_name: string
  action_category: string
  description: string
  is_active: boolean
  is_mac_relevant: boolean
  created_at?: string
}

interface LineItem {
  code: string
  display_name: string
  section: string
}

interface Template {
  template_code: string
  template_name: string
  line_items: LineItem[]
}

interface Driver {
  code: string
  display_name: string
}

interface Transformation {
  line_item: string
  type: 'formula_override' | 'carbon_formula_override'
  new_formula: string
  comment?: string
}


interface DefineActionsProps {
  dbPath: string | null
}

const DefineActions: React.FC<DefineActionsProps> = ({ dbPath }) => {
  const [actions, setActions] = useState<ManagementAction[]>([])
  const [selectedAction, setSelectedAction] = useState<ManagementAction | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [filterTemplate, setFilterTemplate] = useState<Template | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [actionTransformations, setActionTransformations] = useState<Map<string, Transformation[]>>(new Map())
  const [actionTriggers, setActionTriggers] = useState<Map<string, string>>(new Map())

  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  // Form state for action
  const [actionCode, setActionCode] = useState('')
  const [actionName, setActionName] = useState('')
  const [actionCategory, setActionCategory] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isMacRelevant, setIsMacRelevant] = useState(false)

  // Transformation states
  const [financialTransformations, setFinancialTransformations] = useState<Transformation[]>([])
  const [carbonTransformations, setCarbonTransformations] = useState<Transformation[]>([])
  const [triggerType, setTriggerType] = useState<'UNCONDITIONAL' | 'TIMED' | 'CONDITIONAL'>('UNCONDITIONAL')
  const [triggerCondition, setTriggerCondition] = useState('')
  const [triggerSticky, setTriggerSticky] = useState<boolean>(true)
  const [triggerStartPeriod, setTriggerStartPeriod] = useState<number>(1)
  const [triggerEndPeriod, setTriggerEndPeriod] = useState<number>(10)

  // Current editing transformation
  const [currentFormula, setCurrentFormula] = useState('')

  // Fetch actions on mount
  useEffect(() => {
    fetchActions()
    fetchTemplates()
    fetchDrivers()
  }, [])


  const fetchActions = async () => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/management-actions?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      setActions(data)

      // Load transformations and triggers for all actions
      const transformationsMap = new Map<string, Transformation[]>()
      const triggersMap = new Map<string, string>()

      for (const action of data) {
        try {
          // Fetch transformations
          const transResponse = await fetch(`http://localhost:3001/api/action-transformations?action_code=${action.action_code}&db_path=${encodeURIComponent(dbPath)}`)
          if (transResponse.ok) {
            const trans = await transResponse.json()
            transformationsMap.set(action.action_code, trans)
          }

          // Fetch triggers
          const triggerResponse = await fetch(`http://localhost:3001/api/action-triggers?action_code=${action.action_code}&db_path=${encodeURIComponent(dbPath)}`)
          if (triggerResponse.ok) {
            const triggers = await triggerResponse.json()
            if (triggers.length > 0 && triggers[0].condition_formula) {
              triggersMap.set(action.action_code, triggers[0].condition_formula)
            }
          }
        } catch (err) {
          console.error(`Error fetching data for ${action.action_code}:`, err)
        }
      }

      setActionTransformations(transformationsMap)
      setActionTriggers(triggersMap)
    } catch (err) {
      console.error('Error fetching actions:', err)
    }
  }

  const fetchTemplates = async () => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      const unifiedTemplates = data.filter((t: any) => t.statement_type === 'unified')
      setTemplates(unifiedTemplates.map((t: any) => ({
        template_code: t.code,
        template_name: t.code,
        line_items: []
      })))
    } catch (err) {
      console.error('Error fetching templates:', err)
    }
  }

  const fetchDrivers = async () => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      setDrivers(data)
    } catch (err) {
      console.error('Error fetching drivers:', err)
    }
  }

  const handleTemplateSelect = async (templateCode: string) => {
    if (!templateCode) {
      setSelectedTemplate(null)
      return
    }

    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${templateCode}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      setSelectedTemplate({
        template_code: data.code,
        template_name: data.code,
        line_items: data.lineItems || []
      })
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }

  const handleFilterTemplateSelect = async (templateCode: string) => {
    if (!templateCode) {
      setFilterTemplate(null)
      return
    }

    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${templateCode}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      const template = {
        template_code: data.code,
        template_name: data.code,
        line_items: data.lineItems || []
      }
      setFilterTemplate(template)

      // Auto-deactivate actions that are not relevant to this template
      await updateActionRelevance(template, dbPath)
    } catch (err) {
      console.error('Error loading filter template:', err)
    }
  }

  const updateActionRelevance = async (template: Template, dbPath: string) => {
    const templateLineItemCodes = new Set(template.line_items.map(li => li.code))

    for (const action of actions) {
      const transformations = actionTransformations.get(action.action_code) || []
      const triggerCondition = actionTriggers.get(action.action_code)

      // Collect all line items referenced in transformations and triggers
      const referencedLineItems = new Set<string>()

      transformations.forEach(t => {
        referencedLineItems.add(t.line_item)
        const formulaItems = extractLineItemsFromFormula(t.new_formula)
        formulaItems.forEach(item => referencedLineItems.add(item))
      })

      if (triggerCondition) {
        const conditionItems = extractLineItemsFromFormula(triggerCondition)
        conditionItems.forEach(item => referencedLineItems.add(item))
      }

      // Action is NOT relevant if:
      // 1. It has no transformations (incomplete/empty)
      // 2. Any referenced line item is missing from the template
      let isRelevant = true

      if (referencedLineItems.size === 0) {
        isRelevant = false
      } else {
        for (const lineItem of referencedLineItems) {
          if (!templateLineItemCodes.has(lineItem)) {
            isRelevant = false
            break
          }
        }
      }

      // If action is currently active but not relevant, deactivate it
      if (action.is_active && !isRelevant) {
        try {
          await fetch(`http://localhost:3001/api/management-actions/${action.action_code}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dbPath,
              action_code: action.action_code,
              action_name: action.action_name,
              action_category: action.action_category,
              description: action.description,
              is_active: false,
              is_mac_relevant: action.is_mac_relevant
            })
          })
          action.is_active = false
        } catch (err) {
          console.error(`Error deactivating action ${action.action_code}:`, err)
        }
      }
    }

    // Refresh actions list
    await fetchActions()
  }

  const extractLineItemsFromFormula = (formula: string): string[] => {
    if (!formula) return []

    // Match line item codes (uppercase words, excluding operators and keywords)
    const matches = formula.match(/\b[A-Z_][A-Z0-9_]*\b/g) || []

    // Filter out common operators, keywords, and formula prefixes
    const keywords = new Set(['AND', 'OR', 'NOT', 'IF', 'THEN', 'ELSE', 'TRUE', 'FALSE', 'BASE', 'driver'])

    return matches
      .filter(m => !keywords.has(m))
      .map(m => m.replace(/\[t-1\]/, '')) // Remove [t-1] suffix
  }

  const getRelevantActions = () => {
    if (!filterTemplate) {
      return actions
    }

    const templateLineItemCodes = new Set(filterTemplate.line_items.map(li => li.code))

    // Filter actions where ALL referenced line items are available in the template
    return actions.filter(action => {
      const transformations = actionTransformations.get(action.action_code) || []
      const triggerCondition = actionTriggers.get(action.action_code)

      // Collect all line items referenced in transformations
      const referencedLineItems = new Set<string>()

      transformations.forEach(t => {
        // Add the line item being transformed
        referencedLineItems.add(t.line_item)

        // Extract line items from the formula
        const formulaItems = extractLineItemsFromFormula(t.new_formula)
        formulaItems.forEach(item => referencedLineItems.add(item))
      })

      // Also check trigger conditions
      if (triggerCondition) {
        const conditionItems = extractLineItemsFromFormula(triggerCondition)
        conditionItems.forEach(item => referencedLineItems.add(item))
      }

      // Debug logging
      if (action.action_code === 'EMERG' || transformations.length > 0) {
        console.log(`[Filter] Action ${action.action_code}:`, {
          transformations: transformations.length,
          referencedLineItems: Array.from(referencedLineItems),
          templateLineItems: Array.from(templateLineItemCodes),
          triggerCondition
        })
      }

      // If no line items referenced, still show the action (it might be new/incomplete)
      // Only hide if we have transformations but they reference items not in the template
      if (referencedLineItems.size === 0) return true

      // Check if ALL referenced line items are in the template
      for (const lineItem of referencedLineItems) {
        if (!templateLineItemCodes.has(lineItem)) {
          console.log(`[Filter] Action ${action.action_code} HIDDEN: missing line item ${lineItem}`)
          return false // Missing a required line item
        }
      }

      return true // All line items are available
    })
  }

  const handleActionSelect = (action: ManagementAction) => {
    setSelectedAction(action)
    setIsEditing(false)
    setIsCreatingNew(false)
    loadActionToForm(action)
  }

  const loadActionToForm = async (action: ManagementAction) => {
    setActionCode(action.action_code)
    setActionName(action.action_name)
    setActionCategory(action.action_category)
    setDescription(action.description)
    setIsActive(action.is_active)
    setIsMacRelevant(action.is_mac_relevant)

    // Load transformations
    try {
      const transResponse = await fetch(`http://localhost:3001/api/action-transformations?action_code=${action.action_code}&db_path=${encodeURIComponent(dbPath || '')}`)
      if (transResponse.ok) {
        const transformations = await transResponse.json()
        setFinancialTransformations(transformations.filter((t: Transformation) => t.type !== 'carbon_formula_override'))
        setCarbonTransformations(transformations.filter((t: Transformation) => t.type === 'carbon_formula_override'))
      } else {
        setFinancialTransformations([])
        setCarbonTransformations([])
      }
    } catch (err) {
      console.error('Error loading transformations:', err)
      setFinancialTransformations([])
      setCarbonTransformations([])
    }

    // Load triggers
    try {
      const triggerResponse = await fetch(`http://localhost:3001/api/action-triggers?action_code=${action.action_code}&db_path=${encodeURIComponent(dbPath || '')}`)
      if (triggerResponse.ok) {
        const triggers = await triggerResponse.json()
        if (triggers.length > 0) {
          const trigger = triggers[0]
          setTriggerType(trigger.trigger_type)
          setTriggerCondition(trigger.condition_formula || '')
          setTriggerSticky(trigger.trigger_sticky === 1 || trigger.trigger_sticky === true)
          setTriggerStartPeriod(trigger.start_period || 1)
          setTriggerEndPeriod(trigger.end_period || 10)
        } else {
          setTriggerType('UNCONDITIONAL')
          setTriggerCondition('')
          setTriggerSticky(true)
          setTriggerStartPeriod(1)
          setTriggerEndPeriod(10)
        }
      } else {
        setTriggerType('UNCONDITIONAL')
        setTriggerCondition('')
        setTriggerSticky(true)
        setTriggerStartPeriod(1)
        setTriggerEndPeriod(10)
      }
    } catch (err) {
      console.error('Error loading triggers:', err)
      setTriggerType('UNCONDITIONAL')
      setTriggerCondition('')
      setTriggerSticky(true)
      setTriggerStartPeriod(1)
      setTriggerEndPeriod(10)
    }
  }

  const handleNewAction = () => {
    setIsCreatingNew(true)
    setIsEditing(true)
    setSelectedAction(null)
    setActionCode('')
    setActionName('')
    setActionCategory('')
    setDescription('')
    setIsActive(true)
    setIsMacRelevant(false)
    setFinancialTransformations([])
    setCarbonTransformations([])
    setTriggerType('UNCONDITIONAL')
    setTriggerCondition('')
    setTriggerSticky(true)
    setTriggerStartPeriod(1)
    setTriggerEndPeriod(10)
    setValidationError(null)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setIsCreatingNew(false)
    if (selectedAction) {
      loadActionToForm(selectedAction)
    }
    setValidationError(null)
  }

  const handleSave = async () => {
    if (!actionCode || !actionName || !actionCategory) {
      setValidationError('Action code, name, and category are required')
      return
    }

    setSaveStatus('saving')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      // Save action metadata
      const method = isCreatingNew ? 'POST' : 'PUT'
      const url = isCreatingNew
        ? 'http://localhost:3001/api/management-actions'
        : `http://localhost:3001/api/management-actions/${selectedAction?.action_code}`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          action_code: actionCode,
          action_name: actionName,
          action_category: actionCategory,
          description,
          is_active: isActive,
          is_mac_relevant: isMacRelevant
        })
      })

      if (!response.ok) throw new Error('Failed to save action')

      // Save transformations
      const saveTransformationsResponse = await fetch('http://localhost:3001/api/action-transformations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          action_code: actionCode,
          transformations: [...financialTransformations, ...carbonTransformations]
        })
      })

      if (!saveTransformationsResponse.ok) throw new Error('Failed to save transformations')

      // Save trigger
      const saveTriggerResponse = await fetch('http://localhost:3001/api/action-triggers/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          action_code: actionCode,
          trigger_type: triggerType,
          condition_formula: triggerType === 'CONDITIONAL' ? triggerCondition : null,
          trigger_sticky: triggerType === 'CONDITIONAL' ? (triggerSticky ? 1 : 0) : null,
          start_period: triggerType === 'TIMED' ? triggerStartPeriod : null,
          end_period: triggerType === 'TIMED' ? triggerEndPeriod : null
        })
      })

      if (!saveTriggerResponse.ok) throw new Error('Failed to save trigger')

      await fetchActions()

      if (isCreatingNew) {
        const newAction = actions.find(a => a.action_code === actionCode)
        if (newAction) {
          setSelectedAction(newAction)
        }
      }

      setIsEditing(false)
      setIsCreatingNew(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving action:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleDelete = async () => {
    if (!selectedAction || !window.confirm(`Delete action "${selectedAction.action_name}"?`)) {
      return
    }

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/management-actions/${selectedAction.action_code}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete action')

      await fetchActions()
      setSelectedAction(null)
      setIsEditing(false)
    } catch (err) {
      console.error('Error deleting action:', err)
      alert('Failed to delete action')
    }
  }

  const handleExport = async () => {
    if (!selectedAction) return

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/management-actions/${selectedAction.action_code}/export?dbPath=${encodeURIComponent(dbPath)}`)

      if (!response.ok) throw new Error('Failed to export action')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedAction.action_code}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting action:', err)
      alert('Failed to export action')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('file', file)
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      formData.append('dbPath', dbPath)

      const response = await fetch('http://localhost:3001/api/management-actions/import', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Failed to import action')

      await fetchActions()
      alert('Action imported successfully')
    } catch (err) {
      console.error('Error importing action:', err)
      alert('Failed to import action')
    }

    // Reset file input
    event.target.value = ''
  }


  const removeTransformation = (index: number, type: 'financial' | 'carbon') => {
    if (type === 'financial') {
      setFinancialTransformations(financialTransformations.filter((_, i) => i !== index))
    } else {
      setCarbonTransformations(carbonTransformations.filter((_, i) => i !== index))
    }
  }

  const handleDragStart = (e: React.DragEvent, _type: 'row' | 'prior' | 'driver' | 'operator', value: string) => {
    e.dataTransfer.setData('text/plain', value)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e: React.DragEvent, targetState: 'formula' | 'condition') => {
    e.preventDefault()
    const draggedValue = e.dataTransfer.getData('text/plain')

    const textarea = e.currentTarget as HTMLTextAreaElement
    const cursorPos = textarea.selectionStart

    if (targetState === 'formula') {
      const newFormula = currentFormula.slice(0, cursorPos) + draggedValue + currentFormula.slice(cursorPos)
      setCurrentFormula(newFormula)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPos + draggedValue.length
        textarea.focus()
      }, 0)
    } else {
      const newCondition = triggerCondition.slice(0, cursorPos) + draggedValue + triggerCondition.slice(cursorPos)
      setTriggerCondition(newCondition)

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = cursorPos + draggedValue.length
        textarea.focus()
      }, 0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleAiSuggestion = async () => {
    if (!selectedTemplate) return

    setAiStatus('loading')

    try {
      const availableLineItems = selectedTemplate.line_items
        .map(item => `${item.code} - ${item.display_name}`)
        .join('\n')

      const availableDrivers = drivers
        .map(d => `driver:${d.code} - ${d.display_name}`)
        .join('\n')

      const existingFinancial = financialTransformations
        .map(t => `${t.line_item}: ${t.new_formula}`)
        .join('\n')

      const existingCarbon = carbonTransformations
        .map(t => `${t.line_item}: ${t.new_formula}`)
        .join('\n')

      const context = `
I need help defining a management action transformation and trigger condition.

Action: ${actionName}
Category: ${actionCategory}
Description: ${description}

Available line items in template:
${availableLineItems}

Available drivers:
${availableDrivers}

Existing financial transformations:
${existingFinancial || 'None defined yet'}

Existing carbon transformations:
${existingCarbon || 'None defined yet'}

${triggerCondition && triggerCondition.trim() ? `User's request or partial condition:
"${triggerCondition}"

Please interpret this as instructions or a starting point for the condition formula.` : 'No existing condition or user instructions.'}

Please suggest:
1. A trigger condition formula (if trigger type is CONDITIONAL)
2. Financial transformation formulas (which line items to modify and how)
3. Carbon transformation formulas (which emission line items to modify)

Return your suggestions in this format:
TRIGGER_CONDITION: <formula or "N/A">
FINANCIAL_LINE_ITEM: <line_item_code>
FINANCIAL_FORMULA: <formula>
CARBON_LINE_ITEM: <line_item_code>
CARBON_FORMULA: <formula>

${triggerType === 'CONDITIONAL' ? 'IMPORTANT: This action uses a conditional trigger, so provide a trigger condition formula.' : 'This action does not use conditional triggers, so set TRIGGER_CONDITION to N/A.'}
`

      const response = await fetch('http://localhost:3001/api/ai/suggest-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
      })

      if (!response.ok) throw new Error('Failed to get AI suggestion')

      const data = await response.json()
      const suggestion = data.suggestion.trim()

      console.log('AI Suggestion received:', suggestion)

      // Parse AI response
      const lines = suggestion.split('\n')
      let pendingLineItem = ''
      let pendingFormula = ''
      let pendingType = ''

      const newFinancialTransforms: Transformation[] = []
      const newCarbonTransforms: Transformation[] = []

      lines.forEach((line: string) => {
        // Remove markdown formatting (**, ##, etc)
        const cleanLine = line.replace(/\*\*/g, '').trim()

        if (cleanLine.startsWith('TRIGGER_CONDITION:')) {
          const cond = cleanLine.substring('TRIGGER_CONDITION:'.length).trim()
          if (cond !== 'N/A') {
            setTriggerCondition(cond)
          }
        } else if (cleanLine.startsWith('FINANCIAL_LINE_ITEM:')) {
          // Save previous transformation if any
          if (pendingLineItem && pendingFormula && pendingType === 'financial') {
            newFinancialTransforms.push({
              line_item: pendingLineItem,
              type: 'formula_override',
              new_formula: pendingFormula,
              comment: ''
            })
          }
          pendingLineItem = cleanLine.substring('FINANCIAL_LINE_ITEM:'.length).trim()
          pendingFormula = ''
          pendingType = 'financial'
        } else if (cleanLine.startsWith('FINANCIAL_FORMULA:')) {
          pendingFormula = cleanLine.substring('FINANCIAL_FORMULA:'.length).trim()
        } else if (cleanLine.startsWith('CARBON_LINE_ITEM:')) {
          // Save previous transformation if any
          if (pendingLineItem && pendingFormula) {
            if (pendingType === 'financial') {
              newFinancialTransforms.push({
                line_item: pendingLineItem,
                type: 'formula_override',
                new_formula: pendingFormula,
                comment: ''
              })
            } else if (pendingType === 'carbon') {
              newCarbonTransforms.push({
                line_item: pendingLineItem,
                type: 'carbon_formula_override',
                new_formula: pendingFormula,
                comment: ''
              })
            }
          }
          pendingLineItem = cleanLine.substring('CARBON_LINE_ITEM:'.length).trim()
          pendingFormula = ''
          pendingType = 'carbon'
        } else if (cleanLine.startsWith('CARBON_FORMULA:')) {
          pendingFormula = cleanLine.substring('CARBON_FORMULA:'.length).trim()
        }
      })

      // Save last pending transformation
      if (pendingLineItem && pendingFormula) {
        if (pendingType === 'financial') {
          newFinancialTransforms.push({
            line_item: pendingLineItem,
            type: 'formula_override',
            new_formula: pendingFormula,
            comment: ''
          })
        } else if (pendingType === 'carbon') {
          newCarbonTransforms.push({
            line_item: pendingLineItem,
            type: 'carbon_formula_override',
            new_formula: pendingFormula,
            comment: ''
          })
        }
      }

      // Add new transformations to existing arrays
      console.log('Financial transforms to add:', newFinancialTransforms)
      console.log('Carbon transforms to add:', newCarbonTransforms)

      if (newFinancialTransforms.length > 0) {
        setFinancialTransformations([...financialTransformations, ...newFinancialTransforms])
      }
      if (newCarbonTransforms.length > 0) {
        setCarbonTransformations([...carbonTransformations, ...newCarbonTransforms])
      }

      setAiStatus('idle')
    } catch (err) {
      console.error('Error getting AI suggestion:', err)
      setAiStatus('error')
      setTimeout(() => setAiStatus('idle'), 3000)
    }
  }

  // Get unique categories from existing actions
  const existingCategories = Array.from(new Set(actions.map(a => a.action_category))).sort()

  const operators = ['+', '-', '*', '/', '(', ')', '<', '>', '<=', '>=', '==', '!=']

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      padding: '40px'
    }}>
      <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#fff', marginBottom: '8px' }}>
            Define Management Actions
          </h1>
          <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.7)' }}>
            Create and manage actions that modify financial statements and carbon emissions
          </p>
        </div>

        {/* Template Selector - Tile Selector */}
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
          <CardContent style={{ padding: '20px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>
                Select Template
              </h3>
              {filterTemplate && (
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: 'rgba(59, 130, 246, 0.2)',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#fff',
                  whiteSpace: 'nowrap'
                }}>
                  {getRelevantActions().length} implementable action{getRelevantActions().length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                onClick={() => handleFilterTemplateSelect('')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: !filterTemplate ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                  border: !filterTemplate ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  minWidth: '200px'
                }}
                onMouseEnter={(e) => {
                  if (filterTemplate) {
                    e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (filterTemplate) {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                  }
                }}
              >
                <FileSpreadsheet className="w-5 h-5" style={{ color: !filterTemplate ? '#10b981' : '#94a3b8' }} />
                <span style={{
                  color: !filterTemplate ? '#10b981' : '#e2e8f0',
                  fontSize: '14px',
                  fontWeight: !filterTemplate ? 600 : 500
                }}>
                  All Templates
                </span>
              </button>
              {templates.map(template => {
                const isSelected = filterTemplate?.template_code === template.template_code
                return (
                  <button
                    key={template.template_code}
                    onClick={() => handleFilterTemplateSelect(template.template_code)}
                    style={{
                      padding: '12px 20px',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                      border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
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
                    <FileSpreadsheet className="w-5 h-5" style={{ color: isSelected ? '#10b981' : '#94a3b8' }} />
                    <span style={{
                      color: isSelected ? '#10b981' : '#e2e8f0',
                      fontSize: '14px',
                      fontWeight: isSelected ? 600 : 500
                    }}>
                      {template.template_name}
                    </span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 320px', gap: '24px', height: 'calc(100vh - 280px)' }}>
          {/* Left Panel - Actions List */}
          <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <CardContent style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>Actions</h3>
                <Button
                  onClick={handleNewAction}
                  size="sm"
                  style={{ backgroundColor: '#3b82f6', border: 'none', padding: '8px' }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {getRelevantActions().map(action => (
                  <div
                    key={action.action_code}
                    onClick={() => handleActionSelect(action)}
                    style={{
                      padding: '12px',
                      backgroundColor: selectedAction?.action_code === action.action_code ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                      border: selectedAction?.action_code === action.action_code ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.2)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                      {action.action_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      {action.action_code} • {action.action_category}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                      {!!action.is_active && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', borderRadius: '4px' }}>
                          ACTIVE
                        </span>
                      )}
                      {!!action.is_mac_relevant && (
                        <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', borderRadius: '4px' }}>
                          MAC
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Center Panel - Action Editor (only shown when action selected or creating new) */}
          {(selectedAction || isCreatingNew) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Action Details Card */}
              <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <CardContent style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                    {isCreatingNew ? 'New Action' : 'Action Details'}
                  </h3>

                  {/* Buttons below title */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                    {!isEditing && !isCreatingNew && (
                      <>
                        <Button
                          onClick={handleEdit}
                          size="sm"
                          style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff' }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <label style={{ cursor: 'pointer' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: '#ffffff',
                            backgroundColor: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            Import JSON
                          </span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            style={{ display: 'none' }}
                          />
                        </label>
                        <Button
                          variant="outline"
                          onClick={handleExport}
                          size="sm"
                          style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export JSON
                        </Button>
                        <button
                          onClick={handleDelete}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px'
                          }}
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </>
                    )}
                    {(isEditing || isCreatingNew) && (
                      <>
                        <Button
                          onClick={handleSave}
                          disabled={saveStatus === 'saving'}
                          size="sm"
                          style={{ backgroundColor: '#22c55e', border: 'none', color: '#ffffff' }}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          {saveStatus === 'saving' ? 'Saving...' : 'Save to Database'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleCancel}
                          size="sm"
                          style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>

                  {validationError && (
                    <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: '#ef4444' }}>
                        <AlertCircle className="w-4 h-4" />
                        <span style={{ fontSize: '14px' }}>{validationError}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                        Action Code
                      </label>
                      <input
                        type="text"
                        value={actionCode}
                        onChange={(e) => setActionCode(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                        Category
                      </label>
                      <input
                        type="text"
                        list="categories"
                        value={actionCategory}
                        onChange={(e) => setActionCategory(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        placeholder="Enter or select category"
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                      <datalist id="categories">
                        {existingCategories.map(cat => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                        Action Name
                      </label>
                      <input
                        type="text"
                        value={actionName}
                        onChange={(e) => setActionName(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        rows={2}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#fff' }}>
                        Active
                      </label>
                      <Switch
                        checked={isActive}
                        onCheckedChange={setIsActive}
                        disabled={!isEditing && !isCreatingNew}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#fff' }}>
                        MAC Relevant
                      </label>
                      <Switch
                        checked={isMacRelevant}
                        onCheckedChange={setIsMacRelevant}
                        disabled={!isEditing && !isCreatingNew}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '12px' }}>
                        Select Template for Line Items
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                        {templates.map(template => {
                          const isSelected = selectedTemplate?.template_code === template.template_code
                          return (
                            <button
                              key={template.template_code}
                              onClick={() => handleTemplateSelect(template.template_code)}
                              style={{
                                padding: '12px 20px',
                                backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                                border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
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
                              <FileSpreadsheet className="w-5 h-5" style={{ color: isSelected ? '#10b981' : '#94a3b8' }} />
                              <span style={{
                                color: isSelected ? '#10b981' : '#e2e8f0',
                                fontSize: '14px',
                                fontWeight: isSelected ? 600 : 500
                              }}>
                                {template.template_name}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trigger Conditions Card */}
              <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <CardContent style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                    Trigger Conditions
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                        Trigger Type
                      </label>
                      <select
                        value={triggerType}
                        onChange={(e) => setTriggerType(e.target.value as any)}
                        disabled={!isEditing && !isCreatingNew}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(30, 41, 59, 0.5)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '14px'
                        }}
                      >
                        <option value="UNCONDITIONAL">Unconditional</option>
                        <option value="TIMED">Timed</option>
                        <option value="CONDITIONAL">Conditional</option>
                      </select>
                    </div>

                    {triggerType === 'TIMED' && (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                            Start Period
                          </label>
                          <input
                            type="number"
                            value={triggerStartPeriod}
                            onChange={(e) => setTriggerStartPeriod(parseInt(e.target.value))}
                            disabled={!isEditing && !isCreatingNew}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: 'rgba(30, 41, 59, 0.5)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                            End Period
                          </label>
                          <input
                            type="number"
                            value={triggerEndPeriod}
                            onChange={(e) => setTriggerEndPeriod(parseInt(e.target.value))}
                            disabled={!isEditing && !isCreatingNew}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              backgroundColor: 'rgba(30, 41, 59, 0.5)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              color: '#fff',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {triggerType === 'CONDITIONAL' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}>
                          Condition Formula
                        </label>
                        <textarea
                          value={triggerCondition}
                          onChange={(e) => setTriggerCondition(e.target.value)}
                          onDrop={(e) => handleDrop(e, 'condition')}
                          onDragOver={handleDragOver}
                          disabled={!isEditing && !isCreatingNew}
                          rows={3}
                          placeholder="e.g., NET_INCOME < 200000"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '14px',
                            fontFamily: 'monospace',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Switch
                          checked={triggerSticky}
                          onCheckedChange={setTriggerSticky}
                          disabled={!isEditing && !isCreatingNew}
                        />
                        <div>
                          <label style={{ fontSize: '14px', fontWeight: '500', color: '#fff', display: 'block' }}>
                            Sticky Trigger
                          </label>
                          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                            {triggerSticky
                              ? 'Once triggered, action stays active until end_period'
                              : 'Re-evaluate condition every period'}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Transformations Card */}
              <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <CardContent style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>
                      Transformations
                    </h3>
                    <Button
                      onClick={handleAiSuggestion}
                      disabled={aiStatus === 'loading' || !selectedTemplate || (!isEditing && !isCreatingNew)}
                      size="sm"
                      style={{ backgroundColor: '#8b5cf6', border: 'none' }}
                    >
                      <Sparkles className="w-4 h-4 mr-1" />
                      {aiStatus === 'loading' ? 'Suggesting...' : 'AI Suggest'}
                    </Button>
                  </div>


                  {/* Add Financial Transformation Button */}
                  {(isEditing || isCreatingNew) && selectedTemplate && (
                    <div style={{ marginBottom: '16px' }}>
                      <Button
                        onClick={() => {
                          const newTransform: Transformation = {
                            line_item: '',
                            type: 'formula_override',
                            new_formula: '',
                            comment: ''
                          }
                          setFinancialTransformations([...financialTransformations, newTransform])
                        }}
                        size="sm"
                        style={{ backgroundColor: '#10b981', border: 'none' }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Financial Transformation
                      </Button>
                    </div>
                  )}

                  {/* Financial Transformations List */}
                  {financialTransformations.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                        Financial Transformations
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {financialTransformations.map((t, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '12px',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '6px',
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Line Item
                                </label>
                                <input
                                  type="text"
                                  value={t.line_item}
                                  onChange={(e) => {
                                    const updated = [...financialTransformations]
                                    updated[idx] = { ...updated[idx], line_item: e.target.value }
                                    setFinancialTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Line Item"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: '600'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Formula
                                </label>
                                <input
                                  type="text"
                                  value={t.new_formula}
                                  onChange={(e) => {
                                    const updated = [...financialTransformations]
                                    updated[idx] = { ...updated[idx], new_formula: e.target.value }
                                    setFinancialTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Formula"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '12px',
                                    fontFamily: 'monospace'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Comment
                                </label>
                                <input
                                  type="text"
                                  value={t.comment || ''}
                                  onChange={(e) => {
                                    const updated = [...financialTransformations]
                                    updated[idx] = { ...updated[idx], comment: e.target.value }
                                    setFinancialTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Comment (optional)"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '11px'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                            </div>
                            {(isEditing || isCreatingNew) && (
                              <Button
                                onClick={() => removeTransformation(idx, 'financial')}
                                size="sm"
                                style={{ backgroundColor: '#ef4444', border: 'none', padding: '4px 8px', marginTop: '4px' }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Carbon Transformation Button */}
                  {(isEditing || isCreatingNew) && selectedTemplate && (
                    <div style={{ marginBottom: '16px' }}>
                      <Button
                        onClick={() => {
                          const newTransform: Transformation = {
                            line_item: '',
                            type: 'carbon_formula_override',
                            new_formula: '',
                            comment: ''
                          }
                          setCarbonTransformations([...carbonTransformations, newTransform])
                        }}
                        size="sm"
                        style={{ backgroundColor: '#22c55e', border: 'none' }}
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Carbon Transformation
                      </Button>
                    </div>
                  )}

                  {/* Carbon Transformations List */}
                  {carbonTransformations.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
                        Carbon Transformations
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {carbonTransformations.map((t, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '12px',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '6px',
                              display: 'flex',
                              gap: '8px',
                              alignItems: 'flex-start'
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Line Item
                                </label>
                                <input
                                  type="text"
                                  value={t.line_item}
                                  onChange={(e) => {
                                    const updated = [...carbonTransformations]
                                    updated[idx] = { ...updated[idx], line_item: e.target.value }
                                    setCarbonTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Line Item"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: '600'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Formula
                                </label>
                                <input
                                  type="text"
                                  value={t.new_formula}
                                  onChange={(e) => {
                                    const updated = [...carbonTransformations]
                                    updated[idx] = { ...updated[idx], new_formula: e.target.value }
                                    setCarbonTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Formula"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '12px',
                                    fontFamily: 'monospace'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                              <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
                                  Comment
                                </label>
                                <input
                                  type="text"
                                  value={t.comment || ''}
                                  onChange={(e) => {
                                    const updated = [...carbonTransformations]
                                    updated[idx] = { ...updated[idx], comment: e.target.value }
                                    setCarbonTransformations(updated)
                                  }}
                                  disabled={!isEditing && !isCreatingNew}
                                  placeholder="Comment (optional)"
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    backgroundColor: 'rgba(15, 23, 42, 0.5)',
                                    border: '1px solid rgba(34, 197, 94, 0.3)',
                                    borderRadius: '4px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '11px'
                                  }}
                                  readOnly={!isEditing && !isCreatingNew}
                                />
                              </div>
                            </div>
                            {(isEditing || isCreatingNew) && (
                              <Button
                                onClick={() => removeTransformation(idx, 'carbon')}
                                size="sm"
                                style={{ backgroundColor: '#ef4444', border: 'none', padding: '4px 8px', marginTop: '4px' }}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Right Panel - Drag Sources (only shown when action selected or creating new AND template is loaded) */}
          {(selectedAction || isCreatingNew) && selectedTemplate && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
              {/* Operators */}
              <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <CardContent style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>
                    Operators
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {operators.map(op => (
                      <div
                        key={op}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'operator', op)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          borderRadius: '4px',
                          color: '#a78bfa',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'grab',
                          userSelect: 'none'
                        }}
                      >
                        {op}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Current Period Rows */}
              <Card style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '2px solid rgba(59, 130, 246, 0.3)' }}>
                <CardContent style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(59, 130, 246, 1)', marginBottom: '8px' }}>
                    Current Period Rows
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedTemplate.line_items.map(item => (
                      <div
                        key={item.code}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'row', item.code)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '4px',
                          cursor: 'grab',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
                          {item.code}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                          {item.display_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Prior Period Rows */}
              <Card style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '2px solid rgba(168, 85, 247, 0.3)' }}>
                <CardContent style={{ padding: '16px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(168, 85, 247, 1)', marginBottom: '8px' }}>
                    Prior Period Rows
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedTemplate.line_items.map(item => (
                      <div
                        key={`${item.code}-prior`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, 'prior', `${item.code}[t-1]`)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          borderRadius: '4px',
                          cursor: 'grab',
                          userSelect: 'none',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                      >
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
                          {item.code}[t-1]
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                          {item.display_name}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Drivers */}
              {drivers.length > 0 && (
                <Card style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
                  <CardContent style={{ padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(34, 197, 94, 1)', marginBottom: '8px' }}>
                      Drivers
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {drivers.map(driver => (
                        <div
                          key={driver.code}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'driver', `driver:${driver.code}`)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '4px',
                            cursor: 'grab',
                            userSelect: 'none',
                            transition: 'background-color 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                        >
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
                            driver:{driver.code}
                          </div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>
                            {driver.display_name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DefineActions
