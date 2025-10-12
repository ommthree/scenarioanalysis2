import { useState } from 'react'
import { Plus, Save, Upload, Download, Eye, Code } from 'lucide-react'

interface LineItem {
  code: string
  display_name: string
  section: 'pl' | 'bs' | 'cf' | 'carbon'
  formula: string | null
  base_value_source: string | null
  sign_convention?: string
  unit?: string
}

interface Template {
  code: string
  name: string
  statement_type: 'unified' | 'pl' | 'bs' | 'cf' | 'carbon'
  version: string
  line_items: LineItem[]
}

export default function TemplateEditor() {
  const [viewMode, setViewMode] = useState<'form' | 'json'>('form')
  const [template, setTemplate] = useState<Template>({
    code: 'NEW_TEMPLATE',
    name: 'New Template',
    statement_type: 'unified',
    version: '1.0.0',
    line_items: []
  })

  const [selectedLineItem, setSelectedLineItem] = useState<number | null>(null)

  const addLineItem = () => {
    const newItem: LineItem = {
      code: 'NEW_LINE_ITEM',
      display_name: 'New Line Item',
      section: 'pl',
      formula: null,
      base_value_source: null
    }
    setTemplate({
      ...template,
      line_items: [...template.line_items, newItem]
    })
    setSelectedLineItem(template.line_items.length)
  }

  const updateLineItem = (index: number, updates: Partial<LineItem>) => {
    const newLineItems = [...template.line_items]
    newLineItems[index] = { ...newLineItems[index], ...updates }
    setTemplate({ ...template, line_items: newLineItems })
  }

  const removeLineItem = (index: number) => {
    setTemplate({
      ...template,
      line_items: template.line_items.filter((_, i) => i !== index)
    })
    setSelectedLineItem(null)
  }

  const exportJSON = () => {
    const jsonStr = JSON.stringify(template, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${template.code}.json`
    a.click()
  }

  const importJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const imported = JSON.parse(e.target?.result as string)
            setTemplate(imported)
          } catch (err) {
            alert('Invalid JSON file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Template Editor</h1>
            <p className="text-sm text-gray-600 mt-1">
              Define financial statement structures
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'form' ? 'json' : 'form')}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-2 transition-colors"
            >
              {viewMode === 'form' ? <Code className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {viewMode === 'form' ? 'View JSON' : 'View Form'}
            </button>
            <button
              onClick={importJSON}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>
            <button
              onClick={exportJSON}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save to DB
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'form' ? (
          <div className="h-full flex">
            {/* Left: Template Settings & Line Items List */}
            <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
              {/* Template Metadata */}
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-3">Template Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Template Code
                    </label>
                    <input
                      type="text"
                      value={template.code}
                      onChange={(e) => setTemplate({ ...template, code: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={template.name}
                      onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Statement Type
                    </label>
                    <select
                      value={template.statement_type}
                      onChange={(e) => setTemplate({ ...template, statement_type: e.target.value as any })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="unified">Unified (P&L + BS + CF + Carbon)</option>
                      <option value="pl">Profit & Loss</option>
                      <option value="bs">Balance Sheet</option>
                      <option value="cf">Cash Flow</option>
                      <option value="carbon">Carbon Statement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Version
                    </label>
                    <input
                      type="text"
                      value={template.version}
                      onChange={(e) => setTemplate({ ...template, version: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Line Items List */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">Line Items ({template.line_items.length})</h3>
                  <button
                    onClick={addLineItem}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {template.line_items.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedLineItem(index)}
                      className={`p-3 rounded-md cursor-pointer transition-colors ${
                        selectedLineItem === index
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'bg-gray-50 border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {item.code}
                          </div>
                          <div className="text-xs text-gray-600 truncate">
                            {item.display_name}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                              {item.section.toUpperCase()}
                            </span>
                            {item.formula && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                Formula
                              </span>
                            )}
                            {item.base_value_source && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                                Driver
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Line Item Editor */}
            <div className="flex-1 p-6 overflow-y-auto">
              {selectedLineItem !== null && template.line_items[selectedLineItem] ? (
                <div className="max-w-3xl">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Edit Line Item
                    </h3>
                    <button
                      onClick={() => removeLineItem(selectedLineItem)}
                      className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-md transition-colors"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Line Item Code *
                      </label>
                      <input
                        type="text"
                        value={template.line_items[selectedLineItem].code}
                        onChange={(e) => updateLineItem(selectedLineItem, { code: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="REVENUE"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Unique identifier (e.g., REVENUE, NET_INCOME)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={template.line_items[selectedLineItem].display_name}
                        onChange={(e) => updateLineItem(selectedLineItem, { display_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Revenue"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Section *
                      </label>
                      <select
                        value={template.line_items[selectedLineItem].section}
                        onChange={(e) => updateLineItem(selectedLineItem, { section: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pl">Profit & Loss</option>
                        <option value="bs">Balance Sheet</option>
                        <option value="cf">Cash Flow</option>
                        <option value="carbon">Carbon Statement</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Formula (optional)
                      </label>
                      <textarea
                        value={template.line_items[selectedLineItem].formula || ''}
                        onChange={(e) => updateLineItem(selectedLineItem, { formula: e.target.value || null })}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="REVENUE - COST_OF_GOODS_SOLD"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave blank to use base_value_source. Use driver: prefix for explicit driver refs.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Base Value Source (optional)
                      </label>
                      <input
                        type="text"
                        value={template.line_items[selectedLineItem].base_value_source || ''}
                        onChange={(e) => updateLineItem(selectedLineItem, { base_value_source: e.target.value || null })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="driver:REVENUE"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Maps this line item to a scenario driver (e.g., driver:REVENUE)
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit (optional)
                      </label>
                      <input
                        type="text"
                        value={template.line_items[selectedLineItem].unit || ''}
                        onChange={(e) => updateLineItem(selectedLineItem, { unit: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="CHF, tCO2e, etc."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Select a line item to edit, or add a new one
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full p-6 bg-gray-900">
            <pre className="text-green-400 text-sm font-mono overflow-auto h-full">
              {JSON.stringify(template, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
