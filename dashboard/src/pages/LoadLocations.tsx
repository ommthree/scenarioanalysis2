import { useState, useEffect } from 'react'
import { MapPin, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import LocationMap from '@/components/LocationMap'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface LocationFile {
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

interface LocationPoint {
  lat: number
  lng: number
  label: string
}

export default function LoadLocations() {
  const [locationFiles, setLocationFiles] = useState<LocationFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
  const [selectedStagedFile, setSelectedStagedFile] = useState<StagedFile | null>(null)
  const [stagedFileData, setStagedFileData] = useState<CsvData | null>(null)

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/location?dbPath=${encodeURIComponent(dbPath)}`)
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch staged files:', error)
    }
  }

  const handleDeleteStagedFile = async (fileId: number) => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/${fileId}?dbPath=${encodeURIComponent(dbPath)}`, {
        method: 'DELETE'
      })
      const result = await response.json()

      if (result.success) {
        fetchStagedFiles()
      }
    } catch (error) {
      console.error('Failed to delete staged file:', error)
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

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const files = Array.from(target.files || [])

      const newLocations: LocationFile[] = []

      for (const file of files) {
        // Skip if file is already staged
        const isAlreadyStaged = stagedFiles.some(sf => sf.file_name === file.name)
        if (isAlreadyStaged) {
          continue
        }

        try {
          const text = await file.text()
          const parsed = parseCsv(text)
          newLocations.push({
            file,
            name: file.name,
            csvData: parsed,
            isValid: parsed.headers.length > 0 && parsed.rows.length > 0
          })
        } catch (error) {
          newLocations.push({
            file,
            name: file.name,
            csvData: null,
            isValid: false
          })
        }
      }

      setLocationFiles(prev => [...prev, ...newLocations])
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setLocationFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleLoad = async () => {
    if (locationFiles.length === 0) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const fileCount = locationFiles.length

      // Upload each file separately
      for (const locationFile of locationFiles) {
        if (!locationFile.isValid || !locationFile.file) continue

        const formData = new FormData()
        formData.append('dbPath', dbPath)
        formData.append('file', locationFile.file)

        const response = await fetch('http://localhost:3001/api/locations/load', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load location file')
        }
      }

      // Clear location files immediately
      setLocationFiles([])

      setLoadSuccess(true)
      setLoadMessage(`Successfully loaded ${fileCount} location file(s)`)

      // Refresh staged files list
      await fetchStagedFiles()

      setTimeout(() => {
        setLoadSuccess(false)
        setLoadMessage('')
      }, 3000)

    } catch (error) {
      console.error('Import error:', error)
      setLoadMessage(`Error: ${error instanceof Error ? error.message : 'Cannot connect to API server'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Extract location points from CSV data for map preview
  const getLocationPoints = (): LocationPoint[] => {
    const points: LocationPoint[] = []

    // Include staged file data if selected
    if (stagedFileData) {
      const headers = stagedFileData.headers
      const latIdx = headers.findIndex(h => /^lat/i.test(h))
      const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))

      if (latIdx !== -1 && lngIdx !== -1) {
        for (let i = 0; i < Math.min(stagedFileData.rows.length, 100); i++) {
          const row = stagedFileData.rows[i]
          const lat = parseFloat(row[latIdx])
          const lng = parseFloat(row[lngIdx])

          if (!isNaN(lat) && !isNaN(lng)) {
            const label = row[0] || `Point ${i + 1}`
            points.push({ lat, lng, label })
          }
        }
      }
    }

    // Include new files to be staged
    for (const file of locationFiles) {
      if (!file.isValid || !file.csvData) continue

      // Try to find lat/lng columns (case insensitive)
      const headers = file.csvData.headers
      const latIdx = headers.findIndex(h => /^lat/i.test(h))
      const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))

      if (latIdx === -1 || lngIdx === -1) continue

      // Extract first few rows for preview
      for (let i = 0; i < Math.min(file.csvData.rows.length, 100); i++) {
        const row = file.csvData.rows[i]
        const lat = parseFloat(row[latIdx])
        const lng = parseFloat(row[lngIdx])

        if (!isNaN(lat) && !isNaN(lng)) {
          // Use first column as label
          const label = row[0] || `Point ${i + 1}`
          points.push({ lat, lng, label })
        }
      }
    }

    return points
  }

  const locationPoints = getLocationPoints()

  // Calculate map bounds
  const getMapBounds = () => {
    if (locationPoints.length === 0) {
      return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180, centerLat: 0, centerLng: 0 }
    }

    const lats = locationPoints.map(p => p.lat)
    const lngs = locationPoints.map(p => p.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const centerLat = (minLat + maxLat) / 2
    const centerLng = (minLng + maxLng) / 2

    return { minLat, maxLat, minLng, maxLng, centerLat, centerLng }
  }

  const bounds = getMapBounds()

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Load Locations</h1>
        <p className="text-muted-foreground mt-2">Import location CSV files and visualize on map</p>
      </div>

      <div className="flex flex-col items-center" style={{ gap: '32px' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <MapPin className="w-8 h-8 text-blue-500" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-semibold text-lg">Location Files</h3>
                  <p className="text-sm text-muted-foreground">Select multiple CSV files</p>
                </div>
              </div>

              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
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
                  Browse Multiple Files
                </Button>
              </div>

              {/* Staged Files List */}
              {stagedFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#94a3b8' }}>
                    Staged Files ({stagedFiles.length})
                  </div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {stagedFiles.map((file) => (
                      <div
                        key={file.file_id}
                        style={{
                          display: 'flex',
                          alignItems: 'start',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '6px',
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: selectedStagedFile?.file_id === file.file_id
                            ? '2px solid rgba(34, 197, 94, 0.6)'
                            : '1px solid rgba(34, 197, 94, 0.3)',
                          cursor: 'pointer'
                        }}
                        onClick={async () => {
                          setSelectedStagedFile(file)
                          // Fetch and preview the staged file
                          try {
                            const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
                            const response = await fetch(`http://localhost:3001/api/staged-files/${file.file_id}/preview?dbPath=${encodeURIComponent(dbPath)}`)
                            const result = await response.json()

                            if (result.success && result.csvText) {
                              const parsed = parseCsv(result.csvText)
                              setStagedFileData(parsed)
                            }
                          } catch (error) {
                            console.error('Failed to fetch staged file preview:', error)
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginTop: '7px' }}>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm" style={{ color: '#ffffff' }}>{file.file_name}</span>
                          <span className="text-xs text-muted-foreground">({file.row_count} rows)</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteStagedFile(file.file_id)
                            if (selectedStagedFile?.file_id === file.file_id) {
                              setSelectedStagedFile(null)
                              setStagedFileData(null)
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            marginTop: '0px'
                          }}
                        >
                          <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File List */}
              {locationFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {locationFiles.map((location, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          backgroundColor: 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: `1px solid ${location.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {location.isValid ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm" style={{ color: '#ffffff' }}>{location.name}</span>
                          {location.csvData && (
                            <span className="text-xs text-muted-foreground">({location.csvData.rows.length} rows)</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeFile(idx)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '8px',
                            marginTop: '0px'
                          }}
                        >
                          <X className="w-4 h-4" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  color: loadSuccess ? '#22c55e' : '#ef4444',
                  marginLeft: '1.5rem',
                  marginRight: '1.5rem',
                  padding: '12px',
                  backgroundColor: loadSuccess ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px'
                }}>
                  {loadSuccess ? (
                    <DatabaseIcon className="w-4 h-4" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  <span>{loadMessage}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <Button
                  onClick={handleLoad}
                  disabled={locationFiles.length === 0 || isLoading}
                  style={{
                    width: '220px',
                    height: '44px',
                    backgroundColor: (locationFiles.length > 0 && !isLoading) ? '#2563eb' : '#6b7280',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: (locationFiles.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                    opacity: (locationFiles.length > 0 && !isLoading) ? 1 : 0.5,
                    color: '#ffffff'
                  }}
                >
                  {isLoading ? 'Loading to Staging...' : 'Load to Staging'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Map Preview */}
        {locationPoints.length > 0 && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <MapPin className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Location Preview</h3>
                <span className="text-sm text-muted-foreground">
                  {locationPoints.length} location{locationPoints.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <LocationMap locations={locationPoints} height="500px" highlightedIndex={highlightedRowIndex} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {(stagedFileData || (locationFiles.length > 0 && locationFiles.some(l => l.isValid))) && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Location Data</h3>
              </div>

              {/* Show staged file data if available */}
              {stagedFileData && selectedStagedFile && (
                <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    {selectedStagedFile.file_name} (Staged)
                  </div>
                  <ScrollArea className="w-full" style={{ height: '300px' }}>
                    <div style={{ minWidth: 'max-content' }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                            {stagedFileData.headers.map((header, idx) => (
                              <th
                                key={idx}
                                style={{
                                  padding: '12px 16px',
                                  textAlign: 'left',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  color: '#3b82f6',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stagedFileData.rows.slice(0, 100).map((row, rowIdx) => {
                            const isHighlighted = rowIdx === highlightedRowIndex
                            return (
                              <tr
                                key={rowIdx}
                                onClick={() => setHighlightedRowIndex(rowIdx === highlightedRowIndex ? null : rowIdx)}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                  backgroundColor: isHighlighted
                                    ? 'rgba(59, 130, 246, 0.2)'
                                    : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isHighlighted) {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isHighlighted) {
                                    e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
                                  }
                                }}
                              >
                                {row.map((cell, cellIdx) => (
                                  <td
                                    key={cellIdx}
                                    style={{
                                      padding: '10px 16px',
                                      fontSize: '13px',
                                      color: isHighlighted ? '#fff' : '#e2e8f0',
                                      whiteSpace: 'nowrap',
                                      fontWeight: isHighlighted ? 600 : 400
                                    }}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Show new files to be staged */}
              {locationFiles.map((location, locationIdx) => {
                if (!location.isValid || !location.csvData) return null

                return (
                  <div key={locationIdx} style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    <div style={{ color: '#3b82f6', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                      {location.name}
                    </div>
                    <ScrollArea className="w-full" style={{ height: '300px' }}>
                      <div style={{ minWidth: 'max-content' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                              {location.csvData.headers.map((header, idx) => (
                                <th
                                  key={idx}
                                  style={{
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#3b82f6',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {location.csvData.rows.slice(0, 100).map((row, rowIdx) => {
                              const isHighlighted = rowIdx === highlightedRowIndex
                              return (
                                <tr
                                  key={rowIdx}
                                  onClick={() => setHighlightedRowIndex(rowIdx === highlightedRowIndex ? null : rowIdx)}
                                  style={{
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                    backgroundColor: isHighlighted
                                      ? 'rgba(59, 130, 246, 0.2)'
                                      : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isHighlighted) {
                                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isHighlighted) {
                                      e.currentTarget.style.backgroundColor = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
                                    }
                                  }}
                                >
                                  {row.map((cell, cellIdx) => (
                                    <td
                                      key={cellIdx}
                                      style={{
                                        padding: '10px 16px',
                                        fontSize: '13px',
                                        color: isHighlighted ? '#fff' : '#e2e8f0',
                                        whiteSpace: 'nowrap',
                                        fontWeight: isHighlighted ? 600 : 400
                                      }}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
