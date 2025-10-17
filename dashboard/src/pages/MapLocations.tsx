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

export default function MapLocations() {
  const navigate = useNavigate()
  const [mappings, setMappings] = useState<ColumnMapping[]>([
    { csvColumn: null, dbField: 'location_name', required: true, label: 'Location Name', description: 'Unique identifier for the location' },
    { csvColumn: null, dbField: 'latitude', required: true, label: 'Latitude', description: 'Geographic latitude (decimal degrees)' },
    { csvColumn: null, dbField: 'longitude', required: true, label: 'Longitude', description: 'Geographic longitude (decimal degrees)' },
    { csvColumn: null, dbField: 'company_id', required: false, label: 'Company ID', description: 'Optional company identifier' },
  ])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileName, setFileName] = useState('')

  useEffect(() => {
    // Fetch staged location data from backend
    const fetchStagedData = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/locations/staging-preview?dbPath=/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db&limit=1')
        const result = await response.json()

        if (!response.ok || !result.success || !result.data || result.data.length === 0) {
          navigate('/load-locations')
          return
        }

        // Extract column names from the first row (excluding internal columns)
        const firstRow = result.data[0]
        const columns = Object.keys(firstRow).filter(col =>
          col !== 'staging_id' && col !== 'file_id' && col !== 'imported_at' && col !== 'is_mapped'
        )

        setAvailableColumns(columns)
        setFileName('staged_location')

        // Auto-detect mappings based on column names
        const newMappings = [...mappings]
        columns.forEach((header) => {
        const lowerHeader = header.toLowerCase()

        if (lowerHeader.includes('name') || lowerHeader.includes('location')) {
          const nameIndex = newMappings.findIndex(m => m.dbField === 'location_name')
          if (nameIndex !== -1 && !newMappings[nameIndex].csvColumn) {
            newMappings[nameIndex].csvColumn = header
          }
        } else if (lowerHeader.includes('lat') && !lowerHeader.includes('long')) {
          const latIndex = newMappings.findIndex(m => m.dbField === 'latitude')
          if (latIndex !== -1 && !newMappings[latIndex].csvColumn) {
            newMappings[latIndex].csvColumn = header
          }
        } else if (lowerHeader.includes('lon') || lowerHeader.includes('lng')) {
          const lngIndex = newMappings.findIndex(m => m.dbField === 'longitude')
          if (lngIndex !== -1 && !newMappings[lngIndex].csvColumn) {
            newMappings[lngIndex].csvColumn = header
          }
        } else if (lowerHeader.includes('company')) {
          const companyIndex = newMappings.findIndex(m => m.dbField === 'company_id')
          if (companyIndex !== -1 && !newMappings[companyIndex].csvColumn) {
            newMappings[companyIndex].csvColumn = header
          }
        }
      })

        setMappings(newMappings)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching staged data:', error)
        navigate('/load-locations')
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
      const response = await fetch('http://localhost:3001/api/locations/upload', {
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
        setUploadStatus({ success: true, message: `Successfully uploaded ${result.count} locations` })
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
          onClick={() => navigate('/load-locations')}
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
          Back to Load Locations
        </button>

        <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
          Map Location Columns
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
              {uploading ? 'Uploading...' : 'Upload Locations'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
