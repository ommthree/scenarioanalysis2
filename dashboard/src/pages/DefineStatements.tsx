import { useState, useEffect } from 'react'
import { FileText, Plus, Trash2, Save, Upload, Download, GripVertical } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface LineItem {
  code: string
  display_name: string
  level: number
  section: 'profit_and_loss' | 'balance_sheet' | 'cash_flow'
  formula: string | null
  base_value_source?: string
  is_computed: boolean
  sign_convention: 'positive' | 'negative'
  dependencies?: string[]
}

interface Template {
  template_code: string
  template_name: string
  statement_type: string
  industry: string
  version: string
  description: string
  line_items: LineItem[]
}

const defaultTemplate: Template = {
  template_code: '',
  template_name: '',
  statement_type: 'unified',
  industry: 'GENERAL',
  version: '1.0.0',
  description: '',
  line_items: []
}

export default function DefineStatements() {
  const [template, setTemplate] = useState<Template>(defaultTemplate)
  const [selectedSection, setSelectedSection] = useState<'profit_and_loss' | 'balance_sheet' | 'cash_flow'>('profit_and_loss')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  const sections = {
    profit_and_loss: 'Profit & Loss',
    balance_sheet: 'Balance Sheet',
    cash_flow: 'Cash Flow'
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
    setTemplate({
      ...template,
      line_items: [...template.line_items, newItem]
    })
  }

  const removeLineItem = (index: number) => {
    setTemplate({
      ...template,
      line_items: template.line_items.filter((_, i) => i !== index)
    })
  }

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    const updated = [...template.line_items]
    updated[index] = { ...updated[index], [field]: value }
    setTemplate({ ...template, line_items: updated })
  }

  const handleExport = () => {
    const json = JSON.stringify(template, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.template_code || 'template'}.json`
    a.click()
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

          // Ensure all required fields exist with defaults
          const normalized = {
            template_code: imported.template_code || '',
            template_name: imported.template_name || '',
            statement_type: imported.statement_type || 'unified',
            industry: imported.industry || 'GENERAL',
            version: imported.version || '1.0.0',
            description: imported.description || '',
            line_items: (imported.line_items || []).map((item: any) => ({
              code: item.code || '',
              display_name: item.display_name || '',
              level: typeof item.level === 'number' ? item.level : 1,
              section: item.section || 'profit_and_loss',
              formula: item.formula || null,
              base_value_source: item.base_value_source || '',
              is_computed: item.is_computed || false,
              sign_convention: item.sign_convention || 'positive',
              dependencies: item.dependencies || []
            }))
          }

          setTemplate(normalized)
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
    setIsSaving(true)
    setSaveMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

      const response = await fetch('http://localhost:3001/api/templates/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, dbPath })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSaveMessage('Template saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
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

  const filteredLineItems = template.line_items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.section === selectedSection)

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Define Statements</h1>
        <p className="text-muted-foreground mt-2">Create financial statement templates</p>
      </div>

      <div className="flex flex-col" style={{ gap: '32px' }}>
        {/* Template Metadata Card */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
              <FileText className="w-8 h-8 text-violet-500" />
              <div>
                <h3 className="font-semibold text-lg">Template Information</h3>
                <p className="text-sm text-muted-foreground">Basic template metadata</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
              <div>
                <label className="text-sm text-muted-foreground">Template Code</label>
                <Input
                  value={template.template_code}
                  onChange={(e) => setTemplate({ ...template, template_code: e.target.value })}
                  placeholder="e.g., TEST_UNIFIED_L1"
                  style={{ marginTop: '4px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Template Name</label>
                <Input
                  value={template.template_name}
                  onChange={(e) => setTemplate({ ...template, template_name: e.target.value })}
                  placeholder="e.g., Level 1: Simple Unified"
                  style={{ marginTop: '4px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Industry</label>
                <Input
                  value={template.industry}
                  onChange={(e) => setTemplate({ ...template, industry: e.target.value })}
                  placeholder="e.g., TEST"
                  style={{ marginTop: '4px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Version</label>
                <Input
                  value={template.version}
                  onChange={(e) => setTemplate({ ...template, version: e.target.value })}
                  placeholder="e.g., 1.0.0"
                  style={{ marginTop: '4px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="text-sm text-muted-foreground">Description</label>
                <Input
                  value={template.description}
                  onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                  placeholder="e.g., Simple P&L with static balance sheet"
                  style={{ marginTop: '4px', backgroundColor: 'rgba(15, 23, 42, 0.8)', color: '#ffffff' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingLeft: '1.5rem' }}>
              <Button
                variant="outline"
                onClick={handleImport}
                style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <Upload className="w-4 h-4 mr-2" />
                Import JSON
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={!template.template_code}
                style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(139, 92, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', marginLeft: '1.5rem', marginRight: '1.5rem' }}>
              <div>
                <h3 className="font-semibold text-lg">Line Items</h3>
                <p className="text-sm text-muted-foreground">Define financial statement line items</p>
              </div>
              <Button
                onClick={addLineItem}
                style={{ backgroundColor: '#8b5cf6', color: '#ffffff' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Line Item
              </Button>
            </div>

            {/* Section Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
              {(Object.keys(sections) as Array<keyof typeof sections>).map((section) => (
                <Button
                  key={section}
                  variant="outline"
                  onClick={() => setSelectedSection(section)}
                  style={{
                    backgroundColor: section === selectedSection ? '#8b5cf6' : 'rgba(15, 23, 42, 0.8)',
                    color: '#ffffff',
                    borderColor: section === selectedSection ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)',
                    border: 'none'
                  }}
                >
                  {sections[section]}
                </Button>
              ))}
            </div>

            {/* Line Items List */}
            <ScrollArea style={{ height: '600px' }}>
              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                {filteredLineItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                    <p>No line items in {sections[selectedSection]}</p>
                    <p className="text-sm mt-2">Click "Add Line Item" to create one</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {filteredLineItems.map(({ item, index }) => (
                      <Card
                        key={index}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderColor: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid'
                        }}
                      >
                        <CardContent className="p-6">
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <GripVertical className="w-5 h-5 text-gray-500 mt-2" />
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                              <div>
                                <label className="text-xs text-muted-foreground">Code</label>
                                <Input
                                  value={item.code}
                                  onChange={(e) => updateLineItem(index, 'code', e.target.value)}
                                  placeholder="e.g., REVENUE"
                                  style={{ marginTop: '4px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Display Name</label>
                                <Input
                                  value={item.display_name}
                                  onChange={(e) => updateLineItem(index, 'display_name', e.target.value)}
                                  placeholder="e.g., Revenue"
                                  style={{ marginTop: '4px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Level</label>
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
                                  style={{ marginTop: '4px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Sign Convention</label>
                                <select
                                  value={item.sign_convention}
                                  onChange={(e) => updateLineItem(index, 'sign_convention', e.target.value)}
                                  style={{
                                    width: '100%',
                                    marginTop: '4px',
                                    padding: '8px 12px',
                                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                    color: '#ffffff',
                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <option value="positive">Positive</option>
                                  <option value="negative">Negative</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground">Is Computed?</label>
                                <select
                                  value={item.is_computed ? 'true' : 'false'}
                                  onChange={(e) => updateLineItem(index, 'is_computed', e.target.value === 'true')}
                                  style={{
                                    width: '100%',
                                    marginTop: '4px',
                                    padding: '8px 12px',
                                    backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                    color: '#ffffff',
                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                    borderRadius: '6px'
                                  }}
                                >
                                  <option value="false">No (From Driver)</option>
                                  <option value="true">Yes (From Formula)</option>
                                </select>
                              </div>
                              <div>
                                {item.is_computed ? (
                                  <>
                                    <label className="text-xs text-muted-foreground">Formula</label>
                                    <Input
                                      value={item.formula || ''}
                                      onChange={(e) => updateLineItem(index, 'formula', e.target.value)}
                                      placeholder="e.g., REVENUE + EXPENSES"
                                      style={{ marginTop: '4px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <label className="text-xs text-muted-foreground">Driver Source</label>
                                    <Input
                                      value={item.base_value_source || ''}
                                      onChange={(e) => updateLineItem(index, 'base_value_source', e.target.value)}
                                      placeholder="e.g., driver:REVENUE"
                                      style={{ marginTop: '4px', backgroundColor: 'rgba(30, 41, 59, 0.9)', color: '#ffffff' }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                              style={{ color: '#ef4444', marginTop: '24px' }}
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Save Button */}
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
          onClick={handleSave}
          disabled={!template.template_code || isSaving}
          style={{
            width: '220px',
            height: '44px',
            backgroundColor: template.template_code && !isSaving ? '#8b5cf6' : '#6b7280',
            border: 'none',
            color: '#ffffff',
            margin: '0 auto',
            display: 'block'
          }}
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  )
}
