import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, Plus, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'

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

interface ValidationRule {
  rule_id?: number
  rule_code: string
  rule_name: string
  rule_type: 'equation' | 'boundary' | 'reconciliation'
  description: string
  formula: string
  required_line_items: string[]
  tolerance: number
  severity: 'error' | 'warning'
  is_active: boolean
}

const DefineValidation: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [rules, setRules] = useState<ValidationRule[]>([])
  const [selectedRule, setSelectedRule] = useState<ValidationRule | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  // Form state
  const [ruleCode, setRuleCode] = useState('')
  const [ruleName, setRuleName] = useState('')
  const [ruleType, setRuleType] = useState<'equation' | 'boundary' | 'reconciliation'>('equation')
  const [description, setDescription] = useState('')
  const [formula, setFormula] = useState('')
  const [tolerance, setTolerance] = useState('0.01')
  const [severity, setSeverity] = useState<'error' | 'warning'>('error')
  const [isActive, setIsActive] = useState(true)

  // Fetch templates on mount
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/statement-templates?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        const mappedTemplates = data.map((t: any) => ({
          template_code: t.code,
          template_name: t.code,
          statement_type: t.statement_type,
          line_items: []
        }))
        const unifiedTemplates = mappedTemplates.filter((t: any) => t.statement_type === 'unified')
        setTemplates(unifiedTemplates)
      })
      .catch(err => console.error('Error fetching templates:', err))
  }, [])

  // Fetch validation rules
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/validation-rules?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => setRules(data))
      .catch(err => console.error('Error fetching validation rules:', err))
  }, [])

  const handleTemplateSelect = async (templateCode: string) => {
    if (!templateCode) {
      setSelectedTemplate(null)
      return
    }

    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${templateCode}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()

      const mappedTemplate = {
        template_code: data.code,
        template_name: data.code,
        statement_type: data.statement_type,
        line_items: data.lineItems || []
      }

      setSelectedTemplate(mappedTemplate)
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }

  const handleRuleSelect = (rule: ValidationRule) => {
    setSelectedRule(rule)
    setIsEditing(false)
    setIsCreatingNew(false)
    loadRuleToForm(rule)
  }

  const loadRuleToForm = (rule: ValidationRule) => {
    setRuleCode(rule.rule_code)
    setRuleName(rule.rule_name)
    setRuleType(rule.rule_type)
    setDescription(rule.description)
    setFormula(rule.formula)
    setTolerance(rule.tolerance.toString())
    setSeverity(rule.severity)
    setIsActive(rule.is_active)
  }

  const handleNewRule = () => {
    setIsCreatingNew(true)
    setIsEditing(true)
    setSelectedRule(null)
    setRuleCode('')
    setRuleName('')
    setRuleType('equation')
    setDescription('')
    setFormula('')
    setTolerance('0.01')
    setSeverity('error')
    setIsActive(true)
    setValidationError(null)
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setIsCreatingNew(false)
    if (selectedRule) {
      loadRuleToForm(selectedRule)
    }
    setValidationError(null)
  }

  const handleSave = async () => {
    if (!ruleCode || !ruleName || !formula) {
      setValidationError('Rule code, name, and formula are required')
      return
    }

    setSaveStatus('saving')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      const method = isCreatingNew ? 'POST' : 'PUT'
      const url = isCreatingNew
        ? 'http://localhost:3001/api/validation-rules'
        : `http://localhost:3001/api/validation-rules/${selectedRule?.rule_id}`

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          rule_code: ruleCode,
          rule_name: ruleName,
          rule_type: ruleType,
          description,
          formula,
          tolerance: parseFloat(tolerance),
          severity,
          is_active: isActive ? 1 : 0
        })
      })

      if (!response.ok) throw new Error('Failed to save validation rule')

      // Refresh rules list
      const rulesResponse = await fetch(`http://localhost:3001/api/validation-rules?dbPath=${encodeURIComponent(dbPath)}`)
      const updatedRules = await rulesResponse.json()
      setRules(updatedRules)

      if (isCreatingNew) {
        const newRule = updatedRules.find((r: ValidationRule) => r.rule_code === ruleCode)
        if (newRule) {
          setSelectedRule(newRule)
        }
      } else {
        const updated = updatedRules.find((r: ValidationRule) => r.rule_id === selectedRule?.rule_id)
        if (updated) {
          setSelectedRule(updated)
        }
      }

      setIsEditing(false)
      setIsCreatingNew(false)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving validation rule:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleDragStart = (e: React.DragEvent, type: 'lineitem' | 'operator', value: string) => {
    e.dataTransfer.setData('text/plain', value)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedValue = e.dataTransfer.getData('text/plain')

    const textarea = e.currentTarget as HTMLTextAreaElement
    const cursorPos = textarea.selectionStart
    const newFormula = formula.slice(0, cursorPos) + draggedValue + formula.slice(cursorPos)
    setFormula(newFormula)

    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = cursorPos + draggedValue.length
      textarea.focus()
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const addToFormula = (value: string) => {
    setFormula(prev => prev + value)
  }

  const handleAiSuggestion = async () => {
    if (!selectedTemplate) return

    setAiStatus('loading')

    try {
      const availableLineItems = selectedTemplate.line_items
        .map(item => `${item.code} - ${item.display_name}`)
        .join('\n')

      const existingRules = rules
        .map(rule => `${rule.rule_code}: ${rule.formula}`)
        .join('\n')

      const context = `
I need a validation rule formula for financial statement validation.

Rule Type: ${ruleType}
${ruleName ? `Rule Name: ${ruleName}` : ''}
${description ? `Description: ${description}` : ''}

Available line items in template:
${availableLineItems}

Existing validation rules:
${existingRules || 'None defined yet'}

${formula && formula.trim() ? `User's request or partial formula:
"${formula}"

Please interpret this as instructions or a starting point for the validation formula.` : 'No existing formula or user instructions.'}

Please suggest an appropriate validation formula. ${formula && formula.trim() ? 'Take the user\'s input above into account.' : ''} Return ONLY the formula expression, with no explanation or markdown formatting.

Validation formula guidelines:
- equation: Should equal zero when valid (e.g., "TOTAL_ASSETS - TOTAL_LIABILITIES - TOTAL_EQUITY")
- boundary: Should be positive when valid (e.g., "CASH" for non-negative check)
- reconciliation: Should equal zero when reconciled (e.g., "CASH - CASH[t-1] - CASH_FLOW_NET")

Use line item codes directly and [t-1] for prior period references.
`

      const response = await fetch('http://localhost:3001/api/ai/suggest-formula', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context })
      })

      if (!response.ok) throw new Error('Failed to get AI suggestion')

      const data = await response.json()
      setFormula(data.suggestion.trim())
      setAiStatus('idle')
    } catch (err) {
      console.error('Error getting AI suggestion:', err)
      setAiStatus('error')
      setTimeout(() => setAiStatus('idle'), 3000)
    }
  }

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
            Define Validation Rules
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Create and manage validation rules to ensure statement integrity
          </p>
        </div>

        {/* Template Selection */}
        <Card className="border-2" style={{
          marginBottom: '24px',
          backgroundColor: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(16, 185, 129, 0.3)'
        }}>
          <CardContent style={{ padding: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#10b981',
              marginBottom: '12px'
            }}>
              Select Template
            </label>
            <select
              value={selectedTemplate?.template_code || ''}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '14px',
                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                color: '#ffffff',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              <option value="">Select a unified template...</option>
              {templates.map(t => (
                <option key={t.template_code} value={t.template_code}>
                  {t.template_name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>

        {selectedTemplate && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
            {/* Validation Rules Sidebar */}
            <Card className="border-2" style={{
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              height: 'fit-content',
              maxHeight: '800px',
              overflowY: 'auto'
            }}>
              <CardContent style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#10b981',
                  }}>
                    Validation Rules
                  </h3>
                  <Button
                    onClick={handleNewRule}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      background: '#10b981',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={14} />
                    New
                  </Button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {rules.map((rule) => (
                    <button
                      key={rule.rule_id}
                      onClick={() => handleRuleSelect(rule)}
                      style={{
                        padding: '12px',
                        backgroundColor: selectedRule?.rule_id === rule.rule_id
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(30, 41, 59, 0.4)',
                        border: selectedRule?.rule_id === rule.rule_id
                          ? '2px solid rgba(16, 185, 129, 0.5)'
                          : '1px solid rgba(100, 116, 139, 0.2)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        {rule.severity === 'error' ? (
                          <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                        ) : (
                          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                        )}
                        <span style={{ fontWeight: '500', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rule.rule_code}
                        </span>
                        {!rule.is_active && (
                          <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0 }}>inactive</span>
                        )}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '11px', paddingLeft: '22px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {rule.rule_name}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

          {/* Main Content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {selectedRule || isCreatingNew ? (
              <>
                {/* Rule Details */}
                <Card style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <CardContent style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ color: '#ffffff', fontSize: '20px', fontWeight: '600' }}>
                        {isCreatingNew ? 'New Validation Rule' : (isEditing ? 'Edit Validation Rule' : 'Validation Rule Details')}
                      </h2>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {!isEditing && !isCreatingNew && (
                          <Button onClick={handleEdit} style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '6px', cursor: 'pointer' }}>
                            Edit
                          </Button>
                        )}
                        {(isEditing || isCreatingNew) && (
                          <>
                            <Button onClick={handleCancel} style={{ padding: '8px 16px', background: '#6b7280', border: 'none', color: '#ffffff', borderRadius: '6px', cursor: 'pointer' }}>
                              Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saveStatus === 'saving'} style={{ padding: '8px 16px', background: '#10b981', border: 'none', color: '#ffffff', borderRadius: '6px', cursor: 'pointer' }}>
                              <Save size={16} style={{ marginRight: '6px' }} />
                              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Form Fields */}
                    <div>
                      <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                        Rule Code
                      </label>
                      <input
                        type="text"
                        value={ruleCode}
                        onChange={(e) => setRuleCode(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                        Rule Name
                      </label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        disabled={!isEditing && !isCreatingNew}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '14px'
                        }}
                      />
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
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
                          background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '14px',
                          fontFamily: 'inherit',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
                      <div>
                        <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                          Tolerance
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={tolerance}
                          onChange={(e) => setTolerance(e.target.value)}
                          disabled={!isEditing && !isCreatingNew}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '14px'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                          Severity
                        </label>
                        <select
                          value={severity}
                          onChange={(e) => setSeverity(e.target.value as 'error' | 'warning')}
                          disabled={!isEditing && !isCreatingNew}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            fontSize: '14px'
                          }}
                        >
                          <option value="error">Error</option>
                          <option value="warning">Warning</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', color: '#ffffff', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                          Active
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px', gap: '12px' }}>
                          <button
                            type="button"
                            onClick={() => (isEditing || isCreatingNew) && setIsActive(!isActive)}
                            disabled={!isEditing && !isCreatingNew}
                            style={{
                              position: 'relative',
                              width: '44px',
                              height: '24px',
                              backgroundColor: isActive ? '#10b981' : 'rgba(100, 116, 139, 0.5)',
                              borderRadius: '12px',
                              border: 'none',
                              cursor: (isEditing || isCreatingNew) ? 'pointer' : 'not-allowed',
                              transition: 'background-color 0.2s',
                              opacity: (!isEditing && !isCreatingNew) ? 0.5 : 1
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: '2px',
                                left: isActive ? '22px' : '2px',
                                width: '20px',
                                height: '20px',
                                backgroundColor: '#ffffff',
                                borderRadius: '50%',
                                transition: 'left 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            />
                          </button>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                            {isActive ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {saveStatus === 'success' && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '6px', color: '#10b981', fontSize: '13px' }}>
                        <CheckCircle2 size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        Validation rule saved successfully
                      </div>
                    )}
                    {saveStatus === 'error' && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '13px' }}>
                        <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        Failed to save validation rule
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Formula Editor */}
                <Card style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <CardContent style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>Validation Formula</h3>
                      {(isEditing || isCreatingNew) && selectedTemplate && (
                        <Button
                          onClick={handleAiSuggestion}
                          disabled={aiStatus === 'loading'}
                          style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                            border: 'none',
                            color: '#ffffff',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px'
                          }}
                        >
                          <Sparkles size={14} style={{ marginRight: '6px' }} />
                          {aiStatus === 'loading' ? 'Generating...' : 'AI Suggest'}
                        </Button>
                      )}
                    </div>
                    <textarea
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      disabled={!isEditing && !isCreatingNew}
                      rows={6}
                      placeholder="Enter validation formula (e.g., TOTAL_ASSETS - TOTAL_LIABILITIES - TOTAL_EQUITY)"
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: (isEditing || isCreatingNew) ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        resize: 'vertical'
                      }}
                    />
                    {validationError && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '13px' }}>
                        <AlertCircle size={16} style={{ display: 'inline', marginRight: '6px' }} />
                        {validationError}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Formula Builder */}
                {(isEditing || isCreatingNew) && selectedTemplate && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    {/* Current Period Line Items */}
                    <Card className="border-2" style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderColor: 'rgba(59, 130, 246, 0.3)'
                    }}>
                      <CardContent style={{ padding: '16px' }}>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#60a5fa',
                          marginBottom: '12px'
                        }}>
                          Current Period Line Items
                        </h4>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          {selectedTemplate.line_items.map(item => (
                            <div
                              key={item.code}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'row', item.code)}
                              onClick={() => addToFormula(item.code)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                borderRadius: '4px',
                                color: '#60a5fa',
                                fontSize: '12px',
                                cursor: 'grab',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.code}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Prior Period Line Items */}
                    <Card className="border-2" style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      borderColor: 'rgba(168, 85, 247, 0.3)'
                    }}>
                      <CardContent style={{ padding: '16px' }}>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#a855f7',
                          marginBottom: '12px'
                        }}>
                          Prior Period Line Items
                        </h4>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          maxHeight: '200px',
                          overflowY: 'auto'
                        }}>
                          {selectedTemplate.line_items.map(item => (
                            <div
                              key={item.code}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'prior', `${item.code}[t-1]`)}
                              onClick={() => addToFormula(`${item.code}[t-1]`)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                borderRadius: '4px',
                                color: '#a855f7',
                                fontSize: '12px',
                                cursor: 'grab',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.code}[t-1]
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Operators */}
                    <Card className="border-2" style={{
                      backgroundColor: 'rgba(249, 115, 22, 0.1)',
                      borderColor: 'rgba(249, 115, 22, 0.3)'
                    }}>
                      <CardContent style={{ padding: '16px' }}>
                        <h4 style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#f97316',
                          marginBottom: '12px'
                        }}>
                          Operators
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {['+', '-', '*', '/', '(', ')', '==', '!=', '>', '<', '>=', '<=', 'and', 'or', 'not', ' '].map(op => (
                            <div
                              key={op}
                              draggable
                              onDragStart={(e) => handleDragStart(e, 'operator', op)}
                              onClick={() => addToFormula(op)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'rgba(249, 115, 22, 0.2)',
                                border: '1px solid rgba(249, 115, 22, 0.4)',
                                borderRadius: '4px',
                                color: '#f97316',
                                fontSize: '12px',
                                cursor: 'grab',
                                fontFamily: 'monospace',
                                fontWeight: '600'
                              }}
                            >
                              {op === ' ' ? 'space' : op}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            ) : (
              <Card style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <CardContent style={{ padding: '40px', textAlign: 'center' }}>
                  <AlertCircle size={48} style={{ color: '#64748b', marginBottom: '16px', display: 'inline-block' }} />
                  <p style={{ color: '#94a3b8', fontSize: '16px' }}>
                    Select a validation rule from the list or create a new one
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DefineValidation
