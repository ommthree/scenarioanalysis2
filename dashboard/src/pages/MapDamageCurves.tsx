import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ColumnMapping {
  csvColumn: string | null
  dbField: string
  required: boolean
  label: string
  description: string
}

interface DraggableColumnProps {
  column: string
  index: number
}

function DraggableColumn({ column, index }: DraggableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-move"
    >
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#1e293b',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '6px',
          marginBottom: '8px',
          fontSize: '14px',
          color: '#e2e8f0',
          fontWeight: 500,
          cursor: 'grab',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#334155'
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#1e293b'
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
        }}
      >
        {column}
      </div>
    </div>
  )
}

export default function MapDamageCurves() {
  const navigate = useNavigate()
  const [mappings, setMappings] = useState<ColumnMapping[]>([
    { csvColumn: null, dbField: 'peril_type', required: true, label: 'Peril Type', description: 'Type of hazard (e.g., Flood, Hurricane, Earthquake)' },
    { csvColumn: null, dbField: 'intensity_value', required: true, label: 'Intensity/Return Period', description: 'Intensity measure or return period value' },
    { csvColumn: null, dbField: 'damage_factor', required: true, label: 'Damage Factor', description: 'Expected damage as a proportion (0-1)' },
    { csvColumn: null, dbField: 'asset_type', required: false, label: 'Asset Type', description: 'Optional: Type of asset this curve applies to' },
  ])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    // Fetch staged damage curve data from backend
    const fetchStagedData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/damage-curves/staging-preview?dbPath=/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db&limit=1')
        const result = await response.json()

        if (!response.ok || !result.success || !result.data || result.data.length === 0) {
          navigate('/load-damage-curves')
          return
        }

        // Extract column names from the first row (excluding internal columns)
        const firstRow = result.data[0]
        const columns = Object.keys(firstRow).filter(col =>
          col !== 'staging_id' && col !== 'file_id' && col !== 'imported_at' && col !== 'is_mapped'
        )

        setAvailableColumns(columns)
        setFileName('staged_damage_curve')

        // Auto-detect mappings based on column names
        const newMappings = [...mappings]
        columns.forEach((header) => {
          const lowerHeader = header.toLowerCase()

          if (lowerHeader.includes('peril') || lowerHeader.includes('hazard') || lowerHeader.includes('type')) {
            const perilIndex = newMappings.findIndex(m => m.dbField === 'peril_type')
            if (perilIndex !== -1 && !newMappings[perilIndex].csvColumn) {
              newMappings[perilIndex].csvColumn = header
            }
          } else if (lowerHeader.includes('intensity') || lowerHeader.includes('return') || lowerHeader.includes('period')) {
            const intensityIndex = newMappings.findIndex(m => m.dbField === 'intensity_value')
            if (intensityIndex !== -1 && !newMappings[intensityIndex].csvColumn) {
              newMappings[intensityIndex].csvColumn = header
            }
          } else if (lowerHeader.includes('damage') || lowerHeader.includes('factor') || lowerHeader.includes('loss')) {
            const damageIndex = newMappings.findIndex(m => m.dbField === 'damage_factor')
            if (damageIndex !== -1 && !newMappings[damageIndex].csvColumn) {
              newMappings[damageIndex].csvColumn = header
            }
          } else if (lowerHeader.includes('asset')) {
            const assetIndex = newMappings.findIndex(m => m.dbField === 'asset_type')
            if (assetIndex !== -1 && !newMappings[assetIndex].csvColumn) {
              newMappings[assetIndex].csvColumn = header
            }
          }
        })

        setMappings(newMappings)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching staged data:', error)
        navigate('/load-damage-curves')
      }
    }

    fetchStagedData()
  }, [navigate])

  const handleDragEnd = (event: DragEndEvent, targetField: string) => {
    const { active } = event
    const draggedColumn = active.id as string

    // Update mappings
    const newMappings = mappings.map(m => {
      if (m.dbField === targetField) {
        return { ...m, csvColumn: draggedColumn }
      }
      // Remove the column from any other field it was mapped to
      if (m.csvColumn === draggedColumn && m.dbField !== targetField) {
        return { ...m, csvColumn: null }
      }
      return m
    })

    setMappings(newMappings)
  }

  const handleRemoveMapping = (dbField: string) => {
    setMappings(mappings.map(m =>
      m.dbField === dbField ? { ...m, csvColumn: null } : m
    ))
  }

  const canSubmit = () => {
    return mappings.filter(m => m.required).every(m => m.csvColumn !== null)
  }

  const handleSubmit = async () => {
    if (!canSubmit()) return

    setUploading(true)
    setUploadStatus(null)

    try {
      const response = await fetch('http://localhost:3001/api/damage-curves/upload-mapped', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dbPath: '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db',
          mappings: mappings.reduce((acc, m) => {
            if (m.csvColumn) {
              acc[m.dbField] = m.csvColumn
            }
            return acc
          }, {} as Record<string, string>),
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStatus({ success: true, message: `Successfully uploaded ${result.count} damage curve records` })
        setTimeout(() => navigate('/dashboard'), 2000)
      } else {
        setUploadStatus({ success: false, message: result.error || 'Upload failed' })
      }
    } catch (error) {
      setUploadStatus({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '32px' }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '32px' }}>
      {/* Header */}
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/load-damage-curves')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '6px',
            color: '#3b82f6',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '24px',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
          }}
        >
          <ChevronLeft size={16} />
          Back to Load Damage Curves
        </button>

        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          Map Damage Curve Columns
        </h1>
        <p style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '32px' }}>
          Drag CSV columns to map them to database fields. File: <span style={{ color: '#3b82f6', fontWeight: 500 }}>{fileName}</span>
        </p>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Available Columns */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
              Available CSV Columns
            </h2>
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '20px',
                minHeight: '400px',
              }}
            >
              <DndContext collisionDetection={closestCenter}>
                <SortableContext items={availableColumns} strategy={verticalListSortingStrategy}>
                  {availableColumns.map((column, index) => (
                    <DraggableColumn key={column} column={column} index={index} />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>

          {/* Target Fields */}
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
              Database Fields
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {mappings.map((mapping) => (
                <div key={mapping.dbField}>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
                        {mapping.label}
                      </span>
                      {mapping.required && (
                        <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: 500 }}>*Required</span>
                      )}
                    </div>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                      {mapping.description}
                    </p>
                  </div>

                  <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, mapping.dbField)}
                  >
                    <div
                      style={{
                        backgroundColor: '#1e293b',
                        border: mapping.csvColumn
                          ? '2px solid rgba(34, 197, 94, 0.5)'
                          : mapping.required
                          ? '2px dashed rgba(239, 68, 68, 0.5)'
                          : '2px dashed rgba(59, 130, 246, 0.3)',
                        borderRadius: '8px',
                        padding: '16px',
                        minHeight: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      {mapping.csvColumn ? (
                        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 500 }}>
                            {mapping.csvColumn}
                          </span>
                          <button
                            onClick={() => handleRemoveMapping(mapping.dbField)}
                            style={{
                              padding: '4px 12px',
                              backgroundColor: 'rgba(239, 68, 68, 0.2)',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                              borderRadius: '4px',
                              color: '#ef4444',
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '14px', color: '#64748b' }}>
                          Drag a column here
                        </span>
                      )}
                    </div>
                  </DndContext>
                </div>
              ))}
            </div>

            {/* Upload Status */}
            {uploadStatus && (
              <div
                style={{
                  marginTop: '24px',
                  padding: '16px',
                  backgroundColor: uploadStatus.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${uploadStatus.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {uploadStatus.success ? (
                  <CheckCircle2 size={20} color="#22c55e" />
                ) : (
                  <AlertCircle size={20} color="#ef4444" />
                )}
                <span style={{ fontSize: '14px', color: uploadStatus.success ? '#22c55e' : '#ef4444' }}>
                  {uploadStatus.message}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || uploading}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '14px 24px',
                backgroundColor: canSubmit() ? '#3b82f6' : '#334155',
                border: 'none',
                borderRadius: '8px',
                color: canSubmit() ? '#fff' : '#64748b',
                fontSize: '16px',
                fontWeight: 600,
                cursor: canSubmit() && !uploading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (canSubmit() && !uploading) {
                  e.currentTarget.style.backgroundColor = '#2563eb'
                }
              }}
              onMouseLeave={(e) => {
                if (canSubmit()) {
                  e.currentTarget.style.backgroundColor = '#3b82f6'
                }
              }}
            >
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload Damage Curves'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
