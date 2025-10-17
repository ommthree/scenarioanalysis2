import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, AlertCircle, Plus } from 'lucide-react'

interface LineItem {
  code: string
  display_name: string
  section: string
  is_computed: boolean
  formula?: string
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

const DefineFormulas: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedLineItem, setSelectedLineItem] = useState<LineItem | null>(null)
  const [formula, setFormula] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Fetch templates on mount
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/statement-templates?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        console.log('Templates received:', data)
        // Map field names from API response
        const mappedTemplates = data.map((t: any) => ({
          template_code: t.code,
          template_name: t.code, // Use code as name for now
          statement_type: t.statement_type,
          line_items: []
        }))
        const unifiedTemplates = mappedTemplates.filter((t: any) => t.statement_type === 'unified')
        console.log('Unified templates:', unifiedTemplates)
        setTemplates(unifiedTemplates)
      })
      .catch(err => console.error('Error fetching templates:', err))
  }, [])

  // Fetch drivers on mount
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => setDrivers(data))
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  // Load formula when line item is selected
  useEffect(() => {
    if (selectedLineItem) {
      setFormula(selectedLineItem.formula || '')
      setValidationError(null)
    }
  }, [selectedLineItem])

  const handleTemplateSelect = async (templateCode: string) => {
    if (!templateCode) {
      setSelectedTemplate(null)
      setSelectedLineItem(null)
      setFormula('')
      setValidationError(null)
      return
    }

    // Fetch full template with line items
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${templateCode}?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      console.log('Full template loaded:', data)

      // Map API response to component format
      const mappedTemplate = {
        template_code: data.code,
        template_name: data.code,
        statement_type: data.statement_type,
        line_items: data.lineItems || [] // API returns lineItems (camelCase)
      }

      setSelectedTemplate(mappedTemplate)
      setSelectedLineItem(null)
      setFormula('')
      setValidationError(null)
    } catch (err) {
      console.error('Error loading template:', err)
    }
  }

  const handleLineItemSelect = (lineItem: LineItem) => {
    setSelectedLineItem(lineItem)
  }

  const handleDragStart = (e: React.DragEvent, type: 'row' | 'prior' | 'driver' | 'operator', value: string) => {
    e.dataTransfer.setData('text/plain', value)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const draggedValue = e.dataTransfer.getData('text/plain')

    // Insert at cursor position or append
    const textarea = e.currentTarget as HTMLTextAreaElement
    const cursorPos = textarea.selectionStart
    const newFormula = formula.slice(0, cursorPos) + draggedValue + formula.slice(cursorPos)
    setFormula(newFormula)

    // Move cursor after inserted text
    setTimeout(() => {
      textarea.selectionStart = textarea.selectionEnd = cursorPos + draggedValue.length
      textarea.focus()
    }, 0)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const validateFormula = () => {
    if (!selectedLineItem || !selectedTemplate) return false

    setValidationError(null)

    // Check if purely derived rows only use current period rows
    if (selectedLineItem.is_computed) {
      if (formula.includes('[t-1]')) {
        setValidationError('Purely Derived rows cannot reference prior periods')
        return false
      }
      if (formula.includes('driver:')) {
        setValidationError('Purely Derived rows cannot reference drivers')
        return false
      }
    }

    // Basic syntax validation
    const openParens = (formula.match(/\(/g) || []).length
    const closeParens = (formula.match(/\)/g) || []).length
    if (openParens !== closeParens) {
      setValidationError('Mismatched parentheses')
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!selectedLineItem || !selectedTemplate) return

    if (!validateFormula()) {
      return
    }

    setSaveStatus('saving')

    try {
      // Update the line item formula in the template
      const updatedLineItems = selectedTemplate.line_items.map(item =>
        item.code === selectedLineItem.code
          ? { ...item, formula: formula || null }
          : item
      )

      const updatedTemplate = {
        ...selectedTemplate,
        line_items: updatedLineItems
      }

      const response = await fetch(`http://localhost:3001/api/statement-templates/${selectedTemplate.template_code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTemplate)
      })

      if (!response.ok) throw new Error('Failed to save formula')

      // Update local state
      setTemplates(prev => prev.map(t =>
        t.template_code === selectedTemplate.template_code ? updatedTemplate : t
      ))
      setSelectedTemplate(updatedTemplate)
      setSelectedLineItem({ ...selectedLineItem, formula: formula || undefined })

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving formula:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const addToFormula = (value: string) => {
    setFormula(prev => prev + value)
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
            Define Formulas
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Build formulas for statement line items using drag-and-drop or manual entry
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
            {/* Line Items Sidebar */}
            <Card className="border-2" style={{
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(16, 185, 129, 0.3)',
              height: 'fit-content',
              maxHeight: '800px',
              overflowY: 'auto'
            }}>
              <CardContent style={{ padding: '20px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color: '#10b981',
                  marginBottom: '16px'
                }}>
                  Line Items
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTemplate.line_items.map(item => (
                    <button
                      key={item.code}
                      onClick={() => handleLineItemSelect(item)}
                      style={{
                        padding: '12px',
                        backgroundColor: selectedLineItem?.code === item.code
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(30, 41, 59, 0.4)',
                        border: selectedLineItem?.code === item.code
                          ? '2px solid rgba(16, 185, 129, 0.5)'
                          : '1px solid rgba(100, 116, 139, 0.2)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                        {item.display_name}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>{item.section}</span>
                        <span>{item.is_computed ? 'Derived' : 'External'}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Formula Builder */}
            {selectedLineItem && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Line Item Info */}
                <Card className="border-2" style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.6)',
                  backdropFilter: 'blur(10px)',
                  borderColor: 'rgba(16, 185, 129, 0.3)'
                }}>
                  <CardContent style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#ffffff', marginBottom: '8px' }}>
                          {selectedLineItem.display_name}
                        </h2>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#94a3b8' }}>
                          <span>Code: {selectedLineItem.code}</span>
                          <span>Section: {selectedLineItem.section}</span>
                          <span>
                            Type: {selectedLineItem.is_computed ? 'Purely Derived' : 'External Data'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedLineItem.is_computed && (
                      <div style={{
                        marginTop: '12px',
                        padding: '12px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#60a5fa'
                      }}>
                        <AlertCircle className="w-4 h-4" style={{ display: 'inline', marginRight: '8px' }} />
                        Purely Derived rows can only use current period rows (no [t-1] or driver: references)
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Formula Editor */}
                <Card className="border-2" style={{
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
                      Formula
                    </label>
                    <textarea
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      placeholder="Drag elements here or type manually..."
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '16px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        backgroundColor: 'rgba(15, 23, 42, 0.8)',
                        color: '#ffffff',
                        border: validationError
                          ? '2px solid rgba(239, 68, 68, 0.5)'
                          : '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '6px',
                        resize: 'vertical'
                      }}
                    />
                    {validationError && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#ef4444'
                      }}>
                        {validationError}
                      </div>
                    )}
                    <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                      <Button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '8px 16px',
                          fontSize: '14px'
                        }}
                      >
                        <Save className="w-4 h-4" style={{ marginRight: '8px' }} />
                        {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Formula'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Drag and Drop Buckets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  {/* Current Period Rows */}
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
                        Current Period Rows
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

                  {/* Prior Period Rows */}
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
                        Prior Period Rows
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

                  {/* Drivers */}
                  <Card className="border-2" style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderColor: 'rgba(16, 185, 129, 0.3)'
                  }}>
                    <CardContent style={{ padding: '16px' }}>
                      <h4 style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#10b981',
                        marginBottom: '12px'
                      }}>
                        Drivers
                      </h4>
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        maxHeight: '200px',
                        overflowY: 'auto'
                      }}>
                        {drivers.map(driver => (
                          <div
                            key={driver.code}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'driver', `driver:${driver.code}`)}
                            onClick={() => addToFormula(`driver:${driver.code}`)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              borderRadius: '4px',
                              color: '#10b981',
                              fontSize: '12px',
                              cursor: 'grab',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            driver:{driver.code}
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
                        {['+', '-', '*', '/', '(', ')', ' '].map(op => (
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
              </div>
            )}
          </div>
        )}

        {!selectedTemplate && (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(100, 116, 139, 0.3)',
            padding: '60px',
            textAlign: 'center'
          }}>
            <div style={{ color: '#64748b', fontSize: '16px' }}>
              Select a template to begin defining formulas
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default DefineFormulas
