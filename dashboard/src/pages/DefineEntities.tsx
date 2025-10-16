import { useState, useEffect } from 'react'
import { Building2, Plus, Edit2, Trash2, ChevronRight, ChevronDown, Save, Upload, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Entity {
  entity_id?: number
  code: string
  name: string
  parent_entity_id: number | null
  granularity_level: string
  base_currency: string
  json_metadata: {
    industry?: string
    geography?: string
    [key: string]: any
  }
  children?: Entity[]
}

export default function DefineEntities() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set())
  const [saveMessage, setSaveMessage] = useState('')

  // Form state
  const [formData, setFormData] = useState<Entity>({
    code: '',
    name: '',
    parent_entity_id: null,
    granularity_level: 'company',
    base_currency: 'CHF',
    json_metadata: {}
  })

  useEffect(() => {
    loadEntities()
  }, [])

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
        setEntities(buildTree(result.entities))
      }
    } catch (error) {
      console.error('Failed to load entities:', error)
    }
  }

  const buildTree = (flatEntities: any[]): Entity[] => {
    const entityMap = new Map<number, Entity>()
    const roots: Entity[] = []

    // First pass: create all entities with children array
    flatEntities.forEach(e => {
      entityMap.set(e.entity_id, {
        ...e,
        json_metadata: typeof e.json_metadata === 'string' ? JSON.parse(e.json_metadata) : e.json_metadata,
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

  const handleSave = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch('http://localhost:3001/api/entities/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, entity: formData })
      })
      const result = await response.json()
      if (result.success) {
        setSaveMessage('Entity saved successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
        loadEntities()
        setIsEditing(false)
        resetForm()
      } else {
        setSaveMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Failed to save'}`)
    }
  }

  const handleDelete = async (entityId: number) => {
    if (!confirm('Are you sure you want to delete this entity?')) return

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch('http://localhost:3001/api/entities/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, entityId })
      })
      const result = await response.json()
      if (result.success) {
        setSaveMessage('Entity deleted successfully!')
        setTimeout(() => setSaveMessage(''), 3000)
        loadEntities()
      } else {
        setSaveMessage(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      setSaveMessage(`Error: ${error instanceof Error ? error.message : 'Failed to delete'}`)
    }
  }

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      parent_entity_id: null,
      granularity_level: 'company',
      base_currency: 'CHF',
      json_metadata: {}
    })
    setSelectedEntity(null)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const text = await file.text()
        const data = JSON.parse(text)
        setFormData(data)
      }
    }
    input.click()
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(formData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `entity_${formData.code || 'new'}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const startEdit = (entity: Entity) => {
    setFormData({ ...entity })
    setSelectedEntity(entity)
    setIsEditing(true)
  }

  const toggleNode = (entityId: number) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(entityId)) {
      newExpanded.delete(entityId)
    } else {
      newExpanded.add(entityId)
    }
    setExpandedNodes(newExpanded)
  }

  const renderTree = (entities: Entity[], level = 0): JSX.Element => {
    return (
      <div style={{ marginLeft: level > 0 ? '24px' : '8px', marginRight: '8px' }}>
        {entities.map((entity) => {
          const hasChildren = entity.children && entity.children.length > 0
          const isExpanded = entity.entity_id ? expandedNodes.has(entity.entity_id) : false

          return (
            <div key={entity.entity_id || entity.code}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: selectedEntity?.entity_id === entity.entity_id ? 'rgba(34, 197, 94, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedEntity(entity)}
              >
                {hasChildren && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (entity.entity_id) toggleNode(entity.entity_id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '8px' }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" style={{ color: '#22c55e' }} />
                    ) : (
                      <ChevronRight className="w-4 h-4" style={{ color: '#22c55e' }} />
                    )}
                  </button>
                )}
                {!hasChildren && <div style={{ width: '28px' }} />}

                <Building2 className="w-4 h-4" style={{ color: '#22c55e', marginRight: '8px', marginLeft: '-4px' }} />

                <div style={{ flex: 1 }}>
                  <div className="text-sm font-medium">{entity.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {entity.code} • {entity.granularity_level} • {entity.base_currency}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginRight: '4px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(entity)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Edit2 className="w-4 h-4" style={{ color: '#22c55e' }} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (entity.entity_id) handleDelete(entity.entity_id)
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              </div>

              {hasChildren && isExpanded && renderTree(entity.children!, level + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Define Entities</h1>
        <p className="text-muted-foreground mt-2">Create and manage your entity hierarchy</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        {/* Tree View */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.4)' }}>
          <CardContent className="p-8">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-semibold text-lg" style={{ marginLeft: '8px' }}>Entity Hierarchy</h3>
              <Button
                onClick={() => {
                  resetForm()
                  setIsEditing(true)
                }}
                size="sm"
                style={{
                  backgroundColor: '#22c55e',
                  border: 'none',
                  color: '#ffffff',
                  marginRight: '8px'
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Entity
              </Button>
            </div>

            <ScrollArea style={{ height: '600px' }}>
              {entities.length > 0 ? renderTree(entities) : (
                <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No entities defined yet</p>
                  <p className="text-sm mt-2">Click "Add Entity" to create your first entity</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {isEditing && (
          <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <CardContent className="p-8">
              <h3 className="font-semibold text-lg mb-6" style={{ marginLeft: '8px' }}>
                {formData.entity_id ? 'Edit Entity' : 'New Entity'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingLeft: '8px', paddingRight: '8px' }}>
                <div>
                  <label className="text-sm text-muted-foreground">Code</label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., ACME_CORP"
                    className="h-8"
                    style={{ marginTop: '4px', color: '#ffffff' }}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Acme Corporation"
                    className="h-8"
                    style={{ marginTop: '4px', color: '#ffffff' }}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Granularity Level</label>
                  <select
                    value={formData.granularity_level}
                    onChange={(e) => setFormData({ ...formData, granularity_level: e.target.value })}
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
                    <option value="group">Group</option>
                    <option value="company">Company</option>
                    <option value="division">Division</option>
                    <option value="region">Region</option>
                    <option value="product">Product</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Base Currency</label>
                  <Input
                    value={formData.base_currency}
                    onChange={(e) => setFormData({ ...formData, base_currency: e.target.value.toUpperCase() })}
                    placeholder="USD"
                    maxLength={3}
                    className="h-8"
                    style={{ marginTop: '4px', color: '#ffffff' }}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Parent Entity (optional)</label>
                  <select
                    value={formData.parent_entity_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_entity_id: e.target.value ? parseInt(e.target.value) : null })}
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
                    <option value="">None (Root Level)</option>
                    {/* Flatten entities for dropdown */}
                    {entities.map(e => (
                      <option key={e.entity_id} value={e.entity_id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Industry (metadata)</label>
                  <Input
                    value={formData.json_metadata.industry || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      json_metadata: { ...formData.json_metadata, industry: e.target.value }
                    })}
                    placeholder="e.g., Manufacturing"
                    className="h-8"
                    style={{ marginTop: '4px', color: '#ffffff' }}
                  />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground">Geography (metadata)</label>
                  <Input
                    value={formData.json_metadata.geography || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      json_metadata: { ...formData.json_metadata, geography: e.target.value }
                    })}
                    placeholder="e.g., Global"
                    className="h-8"
                    style={{ marginTop: '4px', color: '#ffffff' }}
                  />
                </div>

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

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
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
                    size="sm"
                    style={{
                      backgroundColor: '#22c55e',
                      border: 'none',
                      color: '#ffffff'
                    }}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save to Database
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false)
                      resetForm()
                    }}
                    size="sm"
                    style={{
                      color: '#ffffff',
                      borderColor: 'rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
