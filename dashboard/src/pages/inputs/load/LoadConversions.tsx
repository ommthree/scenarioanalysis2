import { useState, useEffect } from 'react'
import { Shuffle, FolderOpen, Check, X, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiUrl, getDefaultDbPath } from '@/config'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface ConversionFile {
  file: File
  name: string
  csvData: CsvData | null
  isValid: boolean
}

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

export default function LoadConversions() {
  const [conversionFiles, setConversionFiles] = useState<ConversionFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<CsvData | null>(null)
  const [selectedPendingFileIndex, setSelectedPendingFileIndex] = useState<number | null>(null)

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/conversion?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch staged files:', error)
    }
  }

  const handleDeleteStagedFile = async (fileId: number, event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/${fileId}?dbPath=${encodeURIComponent(dbPath)}`), {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        if (selectedFileId === fileId) {
          setSelectedFileId(null)
          setPreviewData(null)
        }
        fetchStagedFiles()
      }
    } catch (error) {
      console.error('Failed to delete staged file:', error)
    }
  }

  const handleSelectStagedFile = async (fileId: number) => {
    setSelectedFileId(fileId)
    setSelectedPendingFileIndex(null)
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setPreviewData(parsed)
      }
    } catch (error) {
      console.error('Failed to load staged file preview:', error)
    }
  }

  const parseCsv = (text: string): CsvData => {
    const lines = text.split('\n').filter(line => line.trim() !== '')
    if (lines.length === 0) {
      return { headers: [], rows: [] }
    }

    const headers = lines[0].split(',').map(h => h.trim())
    const rows = lines.slice(1).map(line =>
      line.split(',').map(cell => cell.trim())
    )

    return { headers, rows }
  }

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.multiple = true
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      handleFileSelect(target.files)
    }
    input.click()
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles: ConversionFile[] = []

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string
          const csvData = parseCsv(text)

          // Validate that it's a conversion table (at least 2 columns)
          const isValid = csvData.headers.length >= 2 && csvData.rows.length > 0

          newFiles.push({
            file,
            name: file.name,
            csvData,
            isValid
          })

          if (newFiles.length === files.length) {
            setConversionFiles(prev => {
              const allFiles = [...prev, ...newFiles]
              // Auto-select the last added file for preview
              const lastIndex = allFiles.length - 1
              setSelectedPendingFileIndex(lastIndex)
              setSelectedFileId(null)
              setPreviewData(allFiles[lastIndex].csvData)
              return allFiles
            })
          }
        } catch (error) {
          console.error('Error parsing CSV:', error)
        }
      }
      reader.readAsText(file)
    })
  }

  const handleRemoveFile = (index: number) => {
    setConversionFiles(prev => prev.filter((_, i) => i !== index))
    if (selectedPendingFileIndex === index) {
      setSelectedPendingFileIndex(null)
    }
  }

  const handleLoadFiles = async () => {
    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = getDefaultDbPath()

      for (const fileData of conversionFiles) {
        const formData = new FormData()
        formData.append('file', fileData.file)
        formData.append('dbPath', dbPath)

        const response = await fetch(apiUrl('/api/conversion/load'), {
          method: 'POST',
          body: formData
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Failed to load conversion file')
        }
      }

      setLoadSuccess(true)
      setLoadMessage(`Successfully loaded ${conversionFiles.length} file(s)`)
      setConversionFiles([])
      fetchStagedFiles()

      setTimeout(() => {
        setLoadSuccess(false)
        setLoadMessage('')
      }, 5000)
    } catch (error) {
      console.error('Error loading files:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Failed to load files'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectPendingFile = (index: number) => {
    setSelectedPendingFileIndex(index)
    setSelectedFileId(null)
    setPreviewData(conversionFiles[index].csvData)
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div className="p-12 max-w-7xl mx-auto">
        <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
          <h1 className="text-4xl font-bold tracking-tight">Load Unit Conversions</h1>
          <p className="text-muted-foreground mt-2">Import unit conversion lookup table CSV files</p>
        </div>

        <div className="flex flex-col items-center" style={{ gap: '32px' }}>
          {/* File Selection Card */}
          <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent style={{ paddingTop: '32px', paddingBottom: '56px', paddingLeft: '56px', paddingRight: '56px' }}>
              <div className="flex flex-col" style={{ gap: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                  <div style={{ marginTop: '17px' }}>
                    <Shuffle className="w-8 h-8 text-blue-500" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 className="font-semibold text-lg">Unit Conversions</h3>
                    <p className="text-sm text-muted-foreground">Select a CSV file containing unit conversion mappings</p>
                  </div>
                </div>

                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', marginBottom: '16px' }}>
                  <Button
                    variant="outline"
                    onClick={handleBrowse}
                    style={{
                      width: '100%',
                      height: '44px',
                      color: '#ffffff',
                      borderColor: 'rgba(59, 130, 246, 0.3)',
                      padding: '10px 16px',
                    }}
                  >
                    <FolderOpen style={{ width: '16px', height: '16px', marginRight: '8px', color: '#ffffff' }} />
                    Browse File
                  </Button>
                </div>

                {/* Staged Files List */}
                {stagedFiles.length > 0 && (
                  <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#94a3b8' }}>
                      Staged Files ({stagedFiles.length})
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {stagedFiles.map((file) => {
                        const isSelected = selectedFileId === file.file_id
                        return (
                          <div
                            key={file.file_id}
                            onClick={() => handleSelectStagedFile(file.file_id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              marginBottom: '8px',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                              borderRadius: '6px',
                              border: `2px solid ${isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(34, 197, 94, 0.3)'}`,
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) {
                                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)'
                                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.3)'
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="text-sm font-medium" style={{ color: '#ffffff' }}>{file.file_name}</span>
                              <span className="text-xs text-muted-foreground">({file.row_count} rows)</span>
                            </div>
                            <button
                              onClick={(e) => handleDeleteStagedFile(file.file_id, e)}
                              style={{
                                color: '#ef4444',
                                padding: '4px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '4px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Pending Files */}
                {conversionFiles.length > 0 && (
                  <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', color: '#94a3b8' }}>
                      Pending Files ({conversionFiles.length})
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {conversionFiles.map((file, index) => (
                        <div
                          key={index}
                          onClick={() => handleSelectPendingFile(index)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            marginBottom: '6px',
                            backgroundColor: selectedPendingFileIndex === index ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                            borderRadius: '4px',
                            border: `1px solid ${file.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm" style={{ color: '#ffffff' }}>{file.name}</span>
                            {file.isValid ? (
                              <Check className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <X className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFile(index)
                            }}
                            style={{
                              color: '#ef4444',
                              padding: '2px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '3px'
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: '12px', marginBottom: '16px' }}>
                      <Button
                        onClick={handleLoadFiles}
                        disabled={isLoading || conversionFiles.some(f => !f.isValid)}
                        style={{
                          width: '100%',
                          backgroundColor: isLoading ? '#64748b' : '#3b82f6',
                          color: '#ffffff',
                          height: '40px'
                        }}
                      >
                        {isLoading ? 'Loading...' : 'Load to Database'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Load Message */}
                {loadMessage && (
                  <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        backgroundColor: loadSuccess ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${loadSuccess ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        color: loadSuccess ? '#22c55e' : '#ef4444',
                        fontSize: '14px',
                        animation: 'fadeIn 0.3s'
                      }}
                    >
                      {loadMessage}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Preview Table - Only show when a file is selected */}
          {previewData && previewData.headers.length > 0 && (
            <Card className="border-2" style={{ width: '100%', maxWidth: '900px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <CardContent style={{ paddingTop: '32px', paddingBottom: '56px', paddingLeft: '56px', paddingRight: '56px' }}>
                <h3 className="font-semibold text-lg mb-6" style={{ marginLeft: '1.5rem' }}>Table Preview</h3>
                <div style={{ maxHeight: '500px', overflowY: 'auto', marginLeft: '1.5rem', marginRight: '1.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', zIndex: 1 }}>
                      <tr>
                        {previewData.headers.map((header, i) => (
                          <th
                            key={i}
                            style={{
                              padding: '12px',
                              textAlign: 'left',
                              borderBottom: '2px solid rgba(59, 130, 246, 0.3)',
                              color: '#ffffff',
                              fontWeight: 600,
                              fontSize: '14px'
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows.slice(0, 100).map((row, i) => (
                        <tr
                          key={i}
                          style={{
                            backgroundColor: i % 2 === 0 ? 'rgba(15, 23, 42, 0.5)' : 'rgba(30, 41, 59, 0.5)'
                          }}
                        >
                          {row.map((cell, j) => (
                            <td
                              key={j}
                              style={{
                                padding: '10px 12px',
                                borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
                                color: '#e2e8f0',
                                fontSize: '13px'
                              }}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {previewData.rows.length > 100 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Showing 100 of {previewData.rows.length} rows
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
