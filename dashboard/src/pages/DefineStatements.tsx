import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Save, Upload, Download, GripVertical, List } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LineItem {
  code: string
  display_name: string
  level: number
  section: 'profit_and_loss' | 'balance_sheet' | 'cash_flow' | 'carbon_statement'
  formula: string | null
  base_value_source?: string
  is_computed: boolean
  sign_convention: 'positive' | 'negative'
  dependencies?: string[]
}

interface TemplateMetadata {
  code: string
  display_name: string
  description: string
  statement_type: string
}

interface Template extends TemplateMetadata {
  lineItems?: LineItem[]
}

const defaultMetadata: TemplateMetadata = {
  code: '',
  display_name: '',
  description: '',
  statement_type: 'unified'
}

export default function DefineStatements() {
  const [templates, setTemplates] = useState<TemplateMetadata[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null)
  const [templateMetadata, setTemplateMetadata] = useState<TemplateMetadata>(defaultMetadata)
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [selectedSection, setSelectedSection] = useState<'profit_and_loss' | 'balance_sheet' | 'cash_flow' | 'carbon_statement'>('profit_and_loss')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true)

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  const sections = {
    profit_and_loss: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Cash Flow',
    carbon_statement: 'Carbon Statement'
  }

  // Load all templates on mount
  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates?dbPath=${encodeURIComponent(dbPath)}`)
      if (response.ok) {
        const data = await response.json()
        setTemplates(data)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  // Load a specific template with line items
  const loadTemplate = async (code: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${code}?dbPath=${encodeURIComponent(dbPath)}`)
      if (response.ok) {
        const data = await response.json()
        setTemplateMetadata({
          code: data.code,
          display_name: data.display_name || data.code,
          description: data.description || '',
          statement_type: 'unified'  // Force all templates to be unified
        })

        // For unified templates, preserve the section field from the database
        // For specific statement types, set a default section
        const defaultSection = data.statement_type === 'pl' ? 'profit_and_loss' :
                               data.statement_type === 'bs' ? 'balance_sheet' :
                               data.statement_type === 'cf' ? 'cash_flow' :
                               data.statement_type === 'carbon' ? 'carbon_statement' : 'profit_and_loss'

        const mappedLineItems = (data.lineItems || []).map((item: any) => ({
          ...item,
          // Use item's section if it exists (unified templates), otherwise use default
          section: item.section || defaultSection,
          sign_convention: item.sign_convention || 'positive'
        }))
        setLineItems(mappedLineItems)
        setSelectedSection(defaultSection)  // Start with the default tab for the template type
        setSelectedTemplateCode(code)
        setIsEditing(true)
      }
    } catch (error) {
      console.error('Failed to load template:', error)
    }
  }

  const handleTemplateSelect = (code: string) => {
    loadTemplate(code)
  }

  const handleNewTemplate = () => {
    setTemplateMetadata(defaultMetadata)
    setLineItems([])
    setSelectedTemplateCode(null)
    setIsEditing(true)
  }

  const addLineItem = () => {
    const newItem: LineItem = {
      code: '',
      display_name: '',
      level: 1,
      section: selectedSection,
      formula: null,
      base_value_source: '',
      is_computed: false,
      sign_convention: 'positive',
      dependencies: []
    }
    setLineItems([...lineItems, newItem])
  }

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }
    setLineItems(updated)
  }

  const handleExport = () => {
    const exportData = {
      ...templateMetadata,
      lineItems
    }
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${templateMetadata.code || 'template'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        try {
          const text = await file.text()
          const imported = JSON.parse(text)

          setTemplateMetadata({
            code: imported.code || imported.template_code || '',
            display_name: imported.display_name || imported.template_name || '',
            description: imported.description || '',
            statement_type: imported.statement_type || 'unified'
          })

          setLineItems((imported.lineItems || imported.line_items || []).map((item: any) => ({
            code: item.code || '',
            display_name: item.display_name || '',
            level: typeof item.level === 'number' ? item.level : 1,
            section: item.section || 'profit_and_loss',
            formula: item.formula || null,
            base_value_source: item.base_value_source || '',
            is_computed: item.is_computed || false,
            sign_convention: item.sign_convention || 'positive',
            dependencies: item.dependencies || []
          })))

          setSaveMessage('Template imported successfully')
          setTimeout(() => setSaveMessage(''), 3000)
        } catch (error) {
          setSaveMessage(`Error importing: ${error instanceof Error ? error.message : 'Invalid JSON'}`)
        }
      }
    }
    input.click()
  }

  const handleSave = async () => {
    if (!templateMetadata.code) {
      setSaveMessage('Error: Template code is required')
      return
    }

    setIsSaving(true)
    setSaveMessage('')

    try {
      // Force statement_type to 'unified' - all templates must be unified
      const templateToSave = {
        ...templateMetadata,
        statement_type: 'unified'
      }

      const response = await fetch('http://localhost:3001/api/statement-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          template: templateToSave,
          lineItems
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSaveMessage('Template saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
        loadTemplates() // Reload the template list
      } else {
        setSaveMessage(`Error: ${result.error || 'Failed to save template'}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(`Delete template "${code}"?`)) return

    try {
      const response = await fetch(`http://localhost:3001/api/statement-templates/${code}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSaveMessage('Template deleted successfully')
        setTimeout(() => setSaveMessage(''), 3000)
        loadTemplates()
        if (selectedTemplateCode === code) {
          setTemplateMetadata(defaultMetadata)
          setLineItems([])
          setSelectedTemplateCode(null)
          setIsEditing(false)
        }
      }
    } catch (error) {
      console.error('Delete error:', error)
      setSaveMessage('Error deleting template')
    }
  }

  const filteredLineItems = lineItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.section === selectedSection)

  return (
    <div className="p-12 mx-auto" style={{ maxWidth: '1800px' }}>
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Define Statements</h1>
        <p className="text-muted-foreground mt-2">Create and manage financial statement templates</p>
      </div>

      {/* Two-panel layout at top */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '32px' }}>
        {/* Left Panel: Template List */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.4)', minWidth: 0 }}>
          <CardContent style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
              <List className="w-8 h-8 text-blue-500" style={{ flexShrink: 0, marginTop: '15px' }} />
              <div>
                <h3 className="font-semibold text-lg">Statement Templates</h3>
                <p className="text-sm text-muted-foreground">Select a template to edit</p>
              </div>
            </div>

            <Button
              onClick={handleNewTemplate}
              size="sm"
              style={{ width: '100%', marginBottom: '16px', backgroundColor: '#3b82f6', border: 'none', color: '#ffffff' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>

            <div style={{ height: '400px', overflowY: 'auto', width: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                {isLoadingTemplates ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No templates found</p>
                ) : (
                  templates.map((template) => (
                    <Card
                      key={template.code}
                      style={{
                        backgroundColor: selectedTemplateCode === template.code ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                        border: 'none',
                        cursor: 'pointer',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box'
                      }}
                      onClick={() => handleTemplateSelect(template.code)}
                    >
                      <CardContent style={{ padding: '10px 20px 10px 20px', position: 'relative', minHeight: '52px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ paddingRight: '12px', flex: 1 }}>
                            <p className="font-medium text-sm">{template.code}</p>
                            <p className="text-xs text-muted-foreground mt-1">{template.statement_type || 'unified'} | v{template.version || '1.0'}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template.code)
                            }}
                            style={{ padding: '4px', position: 'absolute', bottom: '16px', right: '8px' }}
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel: Template Edit Form */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(16, 185, 129, 0.4)', minWidth: 0 }}>
          <CardContent style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
              <FileText className="w-8 h-8 text-green-500" style={{ flexShrink: 0, marginTop: '15px' }} />
              <div>
                <h3 className="font-semibold text-lg">Template Details</h3>
                <p className="text-sm text-muted-foreground">Basic template metadata</p>
              </div>
            </div>

            {isEditing ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Template Code</label>
                    <Input
                      value={templateMetadata.code}
                      onChange={(e) => setTemplateMetadata({ ...templateMetadata, code: e.target.value })}
                      placeholder="e.g., TEST_UNIFIED_L1"
                      className="h-8"
                      style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                      disabled={!!selectedTemplateCode}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                    <Input
                      value={templateMetadata.display_name}
                      onChange={(e) => setTemplateMetadata({ ...templateMetadata, display_name: e.target.value })}
                      placeholder="e.g., Test Unified Template Level 1"
                      className="h-8"
                      style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <Input
                      value={templateMetadata.description}
                      onChange={(e) => setTemplateMetadata({ ...templateMetadata, description: e.target.value })}
                      placeholder="Template description..."
                      className="h-8"
                      style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    onClick={handleImport}
                    size="sm"
                    style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import JSON
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    size="sm"
                    style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export JSON
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    style={{ backgroundColor: '#22c55e', border: 'none', color: '#ffffff' }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : 'Save to Database'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setIsEditing(false); setTemplateMetadata(defaultMetadata); setLineItems([]) }}
                    size="sm"
                    style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    Cancel
                  </Button>
                </div>

                {saveMessage && (
                  <p className="text-sm mt-4" style={{ color: saveMessage.includes('Error') ? '#ef4444' : '#22c55e' }}>
                    {saveMessage}
                  </p>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
                <p>Select a template from the list or create a new one</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Panel: Line Items (Only shown when editing) */}
      {isEditing && (
        <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(139, 92, 246, 0.4)' }}>
            <CardContent style={{ padding: '2.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '28px', marginLeft: '1.5rem' }}>
                <FileText className="w-8 h-8 text-violet-500" style={{ flexShrink: 0, marginTop: '15px' }} />
                <div>
                  <h3 className="font-semibold text-lg">Line Items</h3>
                  <p className="text-sm text-muted-foreground">Define line items for each section</p>
                </div>
              </div>

              {/* Section Tabs */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                {Object.entries(sections).map(([key, label]) => (
                  <Button
                    key={key}
                    onClick={() => setSelectedSection(key as any)}
                    size="sm"
                    style={{
                      backgroundColor: selectedSection === key ? '#22c55e' : 'rgba(16, 185, 129, 0.2)',
                      border: 'none',
                      color: '#ffffff'
                    }}
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  onClick={addLineItem}
                  size="sm"
                  style={{ marginLeft: 'auto', backgroundColor: '#3b82f6', border: 'none', color: '#ffffff' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Line Item
                </Button>
              </div>

              {/* Line Items List */}
              <ScrollArea style={{ height: '600px' }}>
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '2rem' }}>
                  {filteredLineItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                      <p>No line items in {sections[selectedSection]}</p>
                      <p className="text-sm mt-2">Click "Add Line Item" to create one</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                      {filteredLineItems.map(({ item, index }) => (
                        <Card
                          key={index}
                          style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.8)',
                            border: 'none'
                          }}
                        >
                          <CardContent style={{ padding: '2.25rem' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                              <GripVertical className="w-5 h-5 text-gray-500 mt-2" />
                              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Code</label>
                                  <Input
                                    value={item.code}
                                    onChange={(e) => updateLineItem(index, 'code', e.target.value)}
                                    placeholder="e.g., REVENUE"
                                    className="h-8"
                                    style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                                  <Input
                                    value={item.display_name}
                                    onChange={(e) => updateLineItem(index, 'display_name', e.target.value)}
                                    placeholder="e.g., Revenue"
                                    className="h-8"
                                    style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Level</label>
                                  <Input
                                    value={item.level.toString()}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      const num = parseInt(val)
                                      if (!isNaN(num) && num > 0) {
                                        updateLineItem(index, 'level', num)
                                      } else if (val === '') {
                                        updateLineItem(index, 'level', 1)
                                      }
                                    }}
                                    placeholder="1"
                                    className="h-8"
                                    style={{ marginTop: '8px', fontSize: '14px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                  />
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Sign Convention</label>
                                  <select
                                    value={item.sign_convention}
                                    onChange={(e) => updateLineItem(index, 'sign_convention', e.target.value)}
                                    style={{
                                      width: '100%',
                                      marginTop: '8px',
                                      fontSize: '14px',
                                      padding: '8px 12px',
                                      backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                      color: '#ffffff',
                                      border: '1px solid rgba(16, 185, 129, 0.2)',
                                      borderRadius: '6px'
                                    }}
                                  >
                                    <option value="positive">Positive</option>
                                    <option value="negative">Negative</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-muted-foreground">Data Source Type</label>
                                  <select
                                    value={item.is_computed ? 'true' : 'false'}
                                    onChange={(e) => updateLineItem(index, 'is_computed', e.target.value === 'true')}
                                    style={{
                                      width: '100%',
                                      marginTop: '8px',
                                      fontSize: '14px',
                                      padding: '8px 12px',
                                      backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                      color: '#ffffff',
                                      border: '1px solid rgba(16, 185, 129, 0.2)',
                                      borderRadius: '6px'
                                    }}
                                  >
                                    <option value="false">External Data (can map CSV/scenarios)</option>
                                    <option value="true">Purely Derived (formula from other rows only)</option>
                                  </select>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeLineItem(index)}
                                style={{ padding: '8px', marginTop: '20px' }}
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
