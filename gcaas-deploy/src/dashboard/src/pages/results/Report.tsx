import { useState, useRef, useEffect } from 'react'
import { FileText, Download, GripVertical, Type, AlignLeft, Trash2, Plus, Heading2, Image } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { apiUrl } from '@/config'

interface ReportComponent {
  id: string
  type: 'title' | 'subtitle' | 'text' | 'visualization'
  content: string
  imageData?: string
  caption?: string
  aiText?: string
  width?: number
}

interface ReportSnippet {
  id: string
  type: 'visualization'
  source: string
  imageData: string
  caption: string
  aiText?: string
  timestamp: number
}

export default function Report() {
  const [reportComponents, setReportComponents] = useState<ReportComponent[]>([])
  const [snippets, setSnippets] = useState<ReportSnippet[]>([])
  const [draggedItemType, setDraggedItemType] = useState<'title' | 'subtitle' | 'text' | null>(null)
  const [draggedSnippet, setDraggedSnippet] = useState<ReportSnippet | null>(null)
  const [draggedComponentIndex, setDraggedComponentIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  // Load report components from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('reportComponents')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        console.log('Loaded report components:', parsed.length, 'components')
        setReportComponents(parsed)
      } catch (error) {
        console.error('Failed to load report components:', error)
      }
    }
  }, [])

  // Save report components to localStorage whenever they change
  useEffect(() => {
    if (reportComponents.length > 0) {
      localStorage.setItem('reportComponents', JSON.stringify(reportComponents))
      console.log('Saved report components:', reportComponents.length, 'components')
    }
  }, [reportComponents])

  // Load snippets from localStorage on mount and periodically
  useEffect(() => {
    const loadSnippets = () => {
      const stored = localStorage.getItem('reportSnippets')
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          console.log('Loaded snippets:', parsed.length, 'snippets')
          if (parsed.length > 0) {
            console.log('First snippet imageData length:', parsed[0].imageData?.length)
          }
          setSnippets(parsed)
        } catch (error) {
          console.error('Failed to load snippets:', error)
        }
      }
    }

    loadSnippets()

    // Poll for updates every 2 seconds (since storage event doesn't fire in same tab)
    const interval = setInterval(loadSnippets, 2000)

    // Listen for storage events to update when snippets are added from other pages
    window.addEventListener('storage', loadSnippets)
    return () => {
      clearInterval(interval)
      window.removeEventListener('storage', loadSnippets)
    }
  }, [])

  const componentTypes = [
    {
      type: 'title' as const,
      icon: Type,
      label: 'Title',
      color: '#3b82f6',
      defaultContent: 'Report Title'
    },
    {
      type: 'subtitle' as const,
      icon: Heading2,
      label: 'Subtitle',
      color: '#8b5cf6',
      defaultContent: 'Section Subtitle'
    },
    {
      type: 'text' as const,
      icon: AlignLeft,
      label: 'Text',
      color: '#10b981',
      defaultContent: 'Enter your text here...'
    },
  ]

  const handleDragStart = (type: 'title' | 'subtitle' | 'text') => {
    setDraggedItemType(type)
  }

  const handleSnippetDragStart = (snippet: ReportSnippet) => {
    setDraggedSnippet(snippet)
  }

  const handleComponentDragStart = (index: number) => {
    setDraggedComponentIndex(index)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()

    // Dropping a new component from palette
    if (draggedItemType) {
      const componentType = componentTypes.find(c => c.type === draggedItemType)
      if (!componentType) return

      const newComponent: ReportComponent = {
        id: `${draggedItemType}-${Date.now()}`,
        type: draggedItemType,
        content: componentType.defaultContent
      }

      setReportComponents([...reportComponents, newComponent])
      setDraggedItemType(null)
    }

    // Dropping a snippet from palette
    if (draggedSnippet) {
      const newComponent: ReportComponent = {
        id: `visualization-${Date.now()}`,
        type: 'visualization',
        content: draggedSnippet.caption,
        imageData: draggedSnippet.imageData,
        caption: draggedSnippet.caption,
        aiText: draggedSnippet.aiText,
        width: 100 // Default to 100% width
      }

      setReportComponents([...reportComponents, newComponent])

      // Remove snippet from localStorage after adding to report
      const updatedSnippets = snippets.filter(s => s.id !== draggedSnippet.id)
      setSnippets(updatedSnippets)
      localStorage.setItem('reportSnippets', JSON.stringify(updatedSnippets))

      setDraggedSnippet(null)
    }
  }

  const handleComponentDrop = (dropIndex: number) => {
    if (draggedComponentIndex === null) return

    const newComponents = [...reportComponents]
    const [draggedItem] = newComponents.splice(draggedComponentIndex, 1)

    // Adjust drop index if we're dropping after the dragged item's original position
    const adjustedDropIndex = draggedComponentIndex < dropIndex ? dropIndex - 1 : dropIndex

    newComponents.splice(adjustedDropIndex, 0, draggedItem)

    setReportComponents(newComponents)
    setDraggedComponentIndex(null)
    setDropTargetIndex(null)
  }

  const handleComponentDragEnd = () => {
    setDraggedComponentIndex(null)
    setDropTargetIndex(null)
  }

  const handlePaletteDragEnd = () => {
    setDraggedItemType(null)
  }

  const handleSnippetDragEnd = () => {
    setDraggedSnippet(null)
  }

  const handleContentChange = (id: string, newContent: string) => {
    setReportComponents(reportComponents.map(comp =>
      comp.id === id ? { ...comp, content: newContent } : comp
    ))
  }

  const handleDelete = (id: string) => {
    setReportComponents(reportComponents.filter(comp => comp.id !== id))
  }

  const handleDeleteSnippet = (id: string) => {
    const updatedSnippets = snippets.filter(snippet => snippet.id !== id)
    setSnippets(updatedSnippets)
    localStorage.setItem('reportSnippets', JSON.stringify(updatedSnippets))
  }

  const handleGenerateReport = async () => {
    setGenerating(true)
    try {
      const response = await fetch(apiUrl('/api/reports/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: reportComponents
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${new Date().toISOString().split('T')[0]}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        const errorText = await response.text()
        console.error('Server error:', errorText)
        alert('Failed to generate report: ' + errorText)
      }
    } catch (error) {
      console.error('Error generating report:', error)
      alert('Error generating report: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleClearReport = () => {
    if (reportComponents.length === 0) return

    const confirmed = confirm('Are you sure you want to clear the entire report? This cannot be undone.')
    if (confirmed) {
      setReportComponents([])
      localStorage.removeItem('reportComponents')
      console.log('Report cleared')
    }
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#0f172a'
    }}>
      {/* Left Panel - Component Palette */}
      <div style={{
        width: '280px',
        borderRight: '1px solid rgba(71, 85, 105, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(15, 23, 42, 0.95)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid rgba(71, 85, 105, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <FileText style={{ width: '28px', height: '28px', color: '#a855f7' }} />
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#fff'
            }}>
              Report Builder
            </h2>
          </div>
          <p style={{
            fontSize: '13px',
            color: '#94a3b8'
          }}>
            Drag components to the canvas
          </p>
        </div>

        {/* Component Palette */}
        <div style={{
          flex: 1,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          overflowY: 'auto'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px'
          }}>
            Components
          </div>
          {componentTypes.map((component) => {
            const Icon = component.icon
            return (
              <div
                key={component.type}
                draggable={true}
                onDragStart={(e) => {
                  e.stopPropagation()
                  handleDragStart(component.type)
                }}
                onDragEnd={handlePaletteDragEnd}
                style={{
                  padding: '16px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '2px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '8px',
                  cursor: 'grab',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'
                  e.currentTarget.style.borderColor = component.color
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)'
                  e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <Icon style={{ width: '20px', height: '20px', color: component.color }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    {component.label}
                  </div>
                </div>
                <GripVertical style={{ width: '16px', height: '16px', color: '#64748b' }} />
              </div>
            )
          })}

          {/* Snippets Section */}
          {snippets.length > 0 && (
            <>
              <div style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: '24px',
                marginBottom: '8px'
              }}>
                Snippets
              </div>
              {snippets.map((snippet) => (
                <div
                  key={snippet.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.stopPropagation()
                    handleSnippetDragStart(snippet)
                    // Create a small custom drag preview
                    const dragPreview = document.createElement('div')
                    dragPreview.style.width = '100px'
                    dragPreview.style.height = '60px'
                    dragPreview.style.backgroundColor = 'rgba(168, 85, 247, 0.9)'
                    dragPreview.style.border = '2px solid #a855f7'
                    dragPreview.style.borderRadius = '8px'
                    dragPreview.style.display = 'flex'
                    dragPreview.style.alignItems = 'center'
                    dragPreview.style.justifyContent = 'center'
                    dragPreview.style.color = '#fff'
                    dragPreview.style.fontWeight = '600'
                    dragPreview.style.fontSize = '12px'
                    dragPreview.style.position = 'absolute'
                    dragPreview.style.top = '-1000px'
                    dragPreview.textContent = 'Snippet'
                    document.body.appendChild(dragPreview)
                    e.dataTransfer.setDragImage(dragPreview, 50, 30)
                    setTimeout(() => document.body.removeChild(dragPreview), 0)
                  }}
                  onDragEnd={handleSnippetDragEnd}
                  style={{
                    padding: '12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: '2px solid rgba(71, 85, 105, 0.5)',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    cursor: 'grab',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.8)'
                    e.currentTarget.style.borderColor = '#a855f7'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)'
                    e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Snippet preview image */}
                  <div style={{
                    width: '100%',
                    height: '120px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {snippet.imageData ? (
                      <img
                        src={snippet.imageData}
                        alt={snippet.caption}
                        onError={(e) => {
                          console.error('Image failed to load:', snippet.id)
                          e.currentTarget.style.display = 'none'
                        }}
                        onLoad={() => {
                          console.log('Image loaded successfully:', snippet.id)
                        }}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                        No image data
                      </div>
                    )}
                  </div>

                  {/* Snippet info */}
                  <div style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    marginBottom: '8px',
                    lineHeight: '1.4'
                  }}>
                    {snippet.caption}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteSnippet(snippet.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '6px',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #ef4444',
                      borderRadius: '4px',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    <Trash2 style={{ width: '12px', height: '12px' }} />
                    <span>Delete</span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{
          padding: '24px',
          borderTop: '1px solid rgba(71, 85, 105, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Generate PDF Button */}
          <button
            onClick={handleGenerateReport}
            disabled={reportComponents.length === 0 || generating}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: reportComponents.length === 0 || generating
                ? 'rgba(100, 116, 139, 0.5)'
                : '#a855f7',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: reportComponents.length === 0 || generating ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: reportComponents.length === 0 || generating ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (reportComponents.length > 0 && !generating) {
                e.currentTarget.style.backgroundColor = '#9333ea'
              }
            }}
            onMouseLeave={(e) => {
              if (reportComponents.length > 0 && !generating) {
                e.currentTarget.style.backgroundColor = '#a855f7'
              }
            }}
          >
            {generating ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTop: '2px solid #fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download style={{ width: '16px', height: '16px' }} />
                <span>Generate PDF</span>
              </>
            )}
          </button>

          {/* Clear Report Button */}
          <button
            onClick={handleClearReport}
            disabled={reportComponents.length === 0}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              backgroundColor: reportComponents.length === 0
                ? 'rgba(100, 116, 139, 0.3)'
                : 'rgba(239, 68, 68, 0.2)',
              color: reportComponents.length === 0 ? '#64748b' : '#ef4444',
              border: reportComponents.length === 0
                ? '1px solid rgba(100, 116, 139, 0.3)'
                : '1px solid #ef4444',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: reportComponents.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: reportComponents.length === 0 ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (reportComponents.length > 0) {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
              }
            }}
            onMouseLeave={(e) => {
              if (reportComponents.length > 0) {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
              }
            }}
          >
            <Trash2 style={{ width: '14px', height: '14px' }} />
            <span>Clear Report</span>
          </button>
        </div>
      </div>

      {/* Right Panel - Report Canvas */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Canvas Header */}
        <div style={{
          padding: '24px 48px',
          borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '4px'
            }}>
              Report Canvas
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#94a3b8'
            }}>
              {reportComponents.length} component{reportComponents.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '48px',
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              width: '100%',
              maxWidth: '850px',
              minHeight: '1100px',
              backgroundColor: '#fff',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
              position: 'relative'
            }}>
            {reportComponents.length === 0 ? (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#94a3b8'
              }}>
                <Plus style={{
                  width: '64px',
                  height: '64px',
                  color: '#cbd5e1',
                  margin: '0 auto 16px'
                }} />
                <div style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Drag components here
                </div>
                <div style={{
                  fontSize: '14px'
                }}>
                  Start building your report by dragging components from the left panel
                </div>
              </div>
            ) : (
              <div style={{ padding: '60px' }}>
                {reportComponents.map((component, index) => (
                  <div key={component.id}>
                    {/* Drop Zone Above Component */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDropTargetIndex(index)
                      }}
                      onDragLeave={() => {
                        setDropTargetIndex(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleComponentDrop(index)
                      }}
                      style={{
                        height: dropTargetIndex === index ? '40px' : '8px',
                        marginBottom: '8px',
                        border: dropTargetIndex === index
                          ? '2px dashed #a855f7'
                          : 'none',
                        borderRadius: '4px',
                        backgroundColor: dropTargetIndex === index
                          ? 'rgba(168, 85, 247, 0.2)'
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s',
                        color: '#a855f7',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    >
                      {dropTargetIndex === index && 'Drop here'}
                    </div>

                    {/* Component */}
                    <div
                      style={{
                        marginBottom: '16px',
                        position: 'relative',
                        opacity: draggedComponentIndex === index ? 0.5 : 1,
                        borderRadius: '4px',
                        padding: '4px',
                        transition: 'opacity 0.2s'
                      }}
                    >
                    {/* Drag Handle */}
                    <div
                      draggable={true}
                      onDragStart={(e) => {
                        e.stopPropagation()
                        handleComponentDragStart(index)
                      }}
                      onDragEnd={handleComponentDragEnd}
                      style={{
                        position: 'absolute',
                        left: '-32px',
                        top: '8px',
                        cursor: 'move',
                        color: '#94a3b8'
                      }}
                    >
                      <GripVertical style={{ width: '20px', height: '20px' }} />
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(component.id)}
                      style={{
                        position: 'absolute',
                        right: '-40px',
                        top: '8px',
                        width: '32px',
                        height: '32px',
                        backgroundColor: '#ef4444',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0.7,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '0.7'
                      }}
                    >
                      <Trash2 style={{ width: '16px', height: '16px', color: '#fff' }} />
                    </button>

                    {component.type === 'title' ? (
                      <input
                        type="text"
                        value={component.content}
                        onChange={(e) => handleContentChange(component.id, e.target.value)}
                        onFocus={() => setEditingId(component.id)}
                        onBlur={() => setEditingId(null)}
                        style={{
                          width: '100%',
                          fontSize: '32px',
                          fontWeight: '700',
                          color: '#1e293b',
                          border: editingId === component.id ? '2px solid #a855f7' : '2px solid transparent',
                          borderRadius: '4px',
                          padding: '8px',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                      />
                    ) : component.type === 'subtitle' ? (
                      <input
                        type="text"
                        value={component.content}
                        onChange={(e) => handleContentChange(component.id, e.target.value)}
                        onFocus={() => setEditingId(component.id)}
                        onBlur={() => setEditingId(null)}
                        style={{
                          width: '100%',
                          fontSize: '24px',
                          fontWeight: '600',
                          color: '#334155',
                          border: editingId === component.id ? '2px solid #a855f7' : '2px solid transparent',
                          borderRadius: '4px',
                          padding: '8px',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          transition: 'border-color 0.2s'
                        }}
                      />
                    ) : component.type === 'visualization' ? (
                      <div style={{ marginBottom: '16px', position: 'relative' }}>
                        {/* Visualization Image */}
                        <div style={{
                          width: `${component.width || 100}%`,
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          marginBottom: '12px',
                          backgroundColor: '#fff',
                          position: 'relative'
                        }}>
                          {component.imageData ? (
                            <img
                              src={component.imageData}
                              alt={component.caption}
                              onError={() => console.error('Canvas image failed to load')}
                              onLoad={() => console.log('Canvas image loaded successfully')}
                              style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                              }}
                            />
                          ) : (
                            <div style={{
                              padding: '40px',
                              textAlign: 'center',
                              color: '#94a3b8'
                            }}>
                              No image data available
                            </div>
                          )}

                          {/* Resize handle */}
                          <div
                            onMouseDown={(e) => {
                              e.preventDefault()
                              const startX = e.clientX
                              const startWidth = component.width || 100
                              const containerWidth = (e.currentTarget.parentElement?.parentElement?.offsetWidth || 730)

                              const handleMouseMove = (moveEvent: MouseEvent) => {
                                const deltaX = moveEvent.clientX - startX
                                const deltaPercent = (deltaX / containerWidth) * 100
                                const newWidth = Math.max(20, Math.min(100, startWidth + deltaPercent))

                                setReportComponents(reportComponents.map(comp =>
                                  comp.id === component.id ? { ...comp, width: newWidth } : comp
                                ))
                              }

                              const handleMouseUp = () => {
                                document.removeEventListener('mousemove', handleMouseMove)
                                document.removeEventListener('mouseup', handleMouseUp)
                              }

                              document.addEventListener('mousemove', handleMouseMove)
                              document.addEventListener('mouseup', handleMouseUp)
                            }}
                            style={{
                              position: 'absolute',
                              bottom: '4px',
                              right: '4px',
                              width: '20px',
                              height: '20px',
                              cursor: 'nwse-resize',
                              background: 'linear-gradient(135deg, transparent 0%, transparent 30%, #a855f7 30%, #a855f7 35%, transparent 35%, transparent 45%, #a855f7 45%, #a855f7 50%, transparent 50%, transparent 60%, #a855f7 60%, #a855f7 65%, transparent 65%)',
                              borderRadius: '0 0 8px 0',
                              opacity: 0.6,
                              transition: 'opacity 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0.6'
                            }}
                          />
                        </div>

                        {/* Caption (editable) */}
                        {component.caption && (
                          <textarea
                            value={component.caption || ''}
                            onChange={(e) => {
                              setReportComponents(reportComponents.map(comp =>
                                comp.id === component.id ? { ...comp, caption: e.target.value } : comp
                              ))
                            }}
                            onFocus={() => setEditingId(component.id + '-caption')}
                            onBlur={() => setEditingId(null)}
                            rows={2}
                            style={{
                              width: '100%',
                              fontSize: '14px',
                              lineHeight: '1.5',
                              color: '#475569',
                              border: editingId === component.id + '-caption' ? '2px solid #a855f7' : '2px solid transparent',
                              borderRadius: '4px',
                              padding: '8px',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              transition: 'border-color 0.2s',
                              marginBottom: '8px'
                            }}
                          />
                        )}

                        {/* AI Text (editable, if present) */}
                        {component.aiText && (
                          <textarea
                            value={component.aiText}
                            onChange={(e) => {
                              setReportComponents(reportComponents.map(comp =>
                                comp.id === component.id ? { ...comp, aiText: e.target.value } : comp
                              ))
                            }}
                            onFocus={() => setEditingId(component.id + '-ai')}
                            onBlur={() => setEditingId(null)}
                            rows={3}
                            style={{
                              width: '100%',
                              fontSize: '14px',
                              lineHeight: '1.5',
                              color: '#64748b',
                              fontStyle: 'italic',
                              border: editingId === component.id + '-ai' ? '2px solid #a855f7' : '2px solid transparent',
                              borderRadius: '4px',
                              padding: '8px',
                              backgroundColor: 'transparent',
                              outline: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              transition: 'border-color 0.2s'
                            }}
                          />
                        )}
                      </div>
                    ) : (
                      <textarea
                        value={component.content}
                        onChange={(e) => handleContentChange(component.id, e.target.value)}
                        onFocus={() => setEditingId(component.id)}
                        onBlur={() => setEditingId(null)}
                        rows={4}
                        style={{
                          width: '100%',
                          fontSize: '16px',
                          lineHeight: '1.6',
                          color: '#334155',
                          border: editingId === component.id ? '2px solid #a855f7' : '2px solid transparent',
                          borderRadius: '4px',
                          padding: '8px',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          transition: 'border-color 0.2s'
                        }}
                      />
                    )}
                  </div>
                  </div>
                ))}

                {/* Drop Zone at the End */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDropTargetIndex(reportComponents.length)
                  }}
                  onDragLeave={() => {
                    setDropTargetIndex(null)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleComponentDrop(reportComponents.length)
                  }}
                  style={{
                    height: dropTargetIndex === reportComponents.length ? '40px' : '8px',
                    marginTop: '8px',
                    border: dropTargetIndex === reportComponents.length
                      ? '2px dashed #a855f7'
                      : 'none',
                    borderRadius: '4px',
                    backgroundColor: dropTargetIndex === reportComponents.length
                      ? 'rgba(168, 85, 247, 0.2)'
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    color: '#a855f7',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}
                >
                  {dropTargetIndex === reportComponents.length && 'Drop here'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
