import { useState, useEffect } from 'react'
import { Map, FolderOpen, Check, X, FileText, Database as DatabaseIcon, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import HazardMap from '@/components/HazardMap'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface HazardMapFile {
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

interface HazardPoint {
  lat: number
  lng: number
  intensity: number
  label: string
}

export default function LoadHazardMaps() {
  const [hazardMapFiles, setHazardMapFiles] = useState<HazardMapFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [loadMessage, setLoadMessage] = useState('')
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null)
  const [selectedStagedFile, setSelectedStagedFile] = useState<StagedFile | null>(null)
  const [stagedFileData, setStagedFileData] = useState<CsvData | null>(null)
  const [selectedIntensityColumn, setSelectedIntensityColumn] = useState<string>('')
  const [pinnedRows, setPinnedRows] = useState<Set<number>>(new Set())
  const [selectedUnstagedFileIndex, setSelectedUnstagedFileIndex] = useState<number | null>(null)

  // Auto-select first unstaged file when files are loaded
  useEffect(() => {
    if (!stagedFileData && hazardMapFiles.length > 0 && selectedUnstagedFileIndex === null) {
      const firstValidIdx = hazardMapFiles.findIndex(f => f.isValid && f.csvData)
      if (firstValidIdx !== -1) {
        console.log('Auto-selecting first unstaged file at index:', firstValidIdx)
        setSelectedUnstagedFileIndex(firstValidIdx)
      }
    }
  }, [stagedFileData, hazardMapFiles, selectedUnstagedFileIndex])

  // Auto-select first intensity column when data is loaded
  useEffect(() => {
    // For staged file data
    if (stagedFileData && !selectedIntensityColumn) {
      const firstIntensityCol = stagedFileData.headers.find(h =>
        h.toLowerCase().includes('intensity') || h.toLowerCase().includes('variance')
      )
      if (firstIntensityCol) {
        console.log('Auto-selecting column for staged file:', firstIntensityCol)
        setSelectedIntensityColumn(firstIntensityCol)
      }
    }

    // For unstaged files
    if (!stagedFileData && hazardMapFiles.length > 0 && selectedUnstagedFileIndex !== null && !selectedIntensityColumn) {
      const selectedFile = hazardMapFiles[selectedUnstagedFileIndex]
      if (selectedFile?.isValid && selectedFile.csvData) {
        const firstIntensityCol = selectedFile.csvData.headers.find(h =>
          h.toLowerCase().includes('intensity') || h.toLowerCase().includes('variance')
        )
        if (firstIntensityCol) {
          console.log('Auto-selecting column for unstaged file:', firstIntensityCol)
          setSelectedIntensityColumn(firstIntensityCol)
        }
      }
    }
  }, [stagedFileData, hazardMapFiles, selectedIntensityColumn, selectedUnstagedFileIndex])

  // Load staged files when component mounts
  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const response = await fetch(`http://localhost:3001/api/staged-files/hazard_map?dbPath=${encodeURIComponent(dbPath)}`)
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

      const newHazardMaps: HazardMapFile[] = []

      for (const file of files) {
        // Skip if file is already staged
        const isAlreadyStaged = stagedFiles.some(sf => sf.file_name === file.name)
        if (isAlreadyStaged) {
          continue
        }

        newHazardMaps.push({
          file,
          name: file.name,
          csvData: null,
          isValid: true
        })
      }

      // Parse CSV data for the newly added files
      for (let i = 0; i < newHazardMaps.length; i++) {
        try {
          const text = await newHazardMaps[i].file.text()
          const parsed = parseCsv(text)
          newHazardMaps[i].csvData = parsed
          newHazardMaps[i].isValid = parsed.headers.length > 0 && parsed.rows.length > 0
        } catch (error) {
          newHazardMaps[i].isValid = false
        }
      }

      setHazardMapFiles(prev => [...prev, ...newHazardMaps])
    }

    input.click()
  }

  const removeFile = (index: number) => {
    setHazardMapFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleLoad = async () => {
    if (hazardMapFiles.length === 0) return

    setIsLoading(true)
    setLoadSuccess(false)
    setLoadMessage('')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const fileCount = hazardMapFiles.length

      // Upload each file separately
      for (const hazardMapFile of hazardMapFiles) {
        if (!hazardMapFile.isValid || !hazardMapFile.file) continue

        console.log('Uploading file:', hazardMapFile.name)
        console.log('File object:', hazardMapFile.file)
        console.log('File type:', hazardMapFile.file.type)
        console.log('File size:', hazardMapFile.file.size)

        const formData = new FormData()
        formData.append('dbPath', dbPath)
        formData.append('file', hazardMapFile.file)

        console.log('FormData created, sending request...')

        const response = await fetch('http://localhost:3001/api/hazard-maps/load', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to load hazard map file')
        }
      }

      // Clear hazard map files immediately
      setHazardMapFiles([])

      setLoadSuccess(true)
      setLoadMessage(`Successfully loaded ${fileCount} hazard map file(s)`)

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

  // Extract pinned points for map markers
  const getPinnedPoints = (): HazardPoint[] => {
    const points: HazardPoint[] = []

    // Check staged file data first
    if (stagedFileData) {
      const headers = stagedFileData.headers
      const latIdx = headers.findIndex(h => /^lat/i.test(h))
      const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))
      const intensityIdx = headers.findIndex(h => h === selectedIntensityColumn)

      if (latIdx !== -1 && lngIdx !== -1 && intensityIdx !== -1) {
        pinnedRows.forEach(rowIdx => {
          if (rowIdx < stagedFileData.rows.length) {
            const row = stagedFileData.rows[rowIdx]
            const lat = parseFloat(row[latIdx])
            const lng = parseFloat(row[lngIdx])
            const intensity = parseFloat(row[intensityIdx])

            if (!isNaN(lat) && !isNaN(lng) && !isNaN(intensity)) {
              const label = row[0] || `Point ${rowIdx + 1}`
              points.push({ lat, lng, intensity, label })
            }
          }
        })
      }
    }

    // Check selected unstaged file if no staged file is selected
    if (!stagedFileData && selectedUnstagedFileIndex !== null && selectedUnstagedFileIndex < hazardMapFiles.length) {
      const file = hazardMapFiles[selectedUnstagedFileIndex]
      if (file.isValid && file.csvData) {
        const headers = file.csvData.headers
        const latIdx = headers.findIndex(h => /^lat/i.test(h))
        const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))
        const intensityIdx = headers.findIndex(h => h === selectedIntensityColumn)

        if (latIdx !== -1 && lngIdx !== -1 && intensityIdx !== -1) {
          pinnedRows.forEach(rowIdx => {
            if (rowIdx < file.csvData!.rows.length) {
              const row = file.csvData!.rows[rowIdx]
              const lat = parseFloat(row[latIdx])
              const lng = parseFloat(row[lngIdx])
              const intensity = parseFloat(row[intensityIdx])

              if (!isNaN(lat) && !isNaN(lng) && !isNaN(intensity)) {
                const label = row[0] || `Point ${rowIdx + 1}`
                points.push({ lat, lng, intensity, label })
              }
            }
          })
        }
      }
    }

    return points
  }

  // Extract hazard points from CSV data for map preview
  const getHazardPoints = (): HazardPoint[] => {
    const points: HazardPoint[] = []

    // Include staged file data if selected - USE ALL POINTS for continuous heatmap
    if (stagedFileData) {
      const headers = stagedFileData.headers
      const latIdx = headers.findIndex(h => /^lat/i.test(h))
      const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))

      // Find intensity column based on selected column (exact match)
      const intensityIdx = headers.findIndex(h => h === selectedIntensityColumn)

      if (latIdx !== -1 && lngIdx !== -1 && intensityIdx !== -1) {
        // Use ALL rows for continuous heatmap coverage
        for (let i = 0; i < stagedFileData.rows.length; i++) {
          const row = stagedFileData.rows[i]
          const lat = parseFloat(row[latIdx])
          const lng = parseFloat(row[lngIdx])
          const intensity = parseFloat(row[intensityIdx])

          if (!isNaN(lat) && !isNaN(lng) && !isNaN(intensity)) {
            const label = row[0] || `Point ${i + 1}`
            points.push({ lat, lng, intensity, label })
          }
        }
      }
    }

    // Include selected unstaged file if any
    if (selectedUnstagedFileIndex !== null && selectedUnstagedFileIndex < hazardMapFiles.length) {
      const file = hazardMapFiles[selectedUnstagedFileIndex]
      if (file.isValid && file.csvData) {
        // Try to find lat/lng/intensity columns
        const headers = file.csvData.headers
        const latIdx = headers.findIndex(h => /^lat/i.test(h))
        const lngIdx = headers.findIndex(h => /^lon|^lng/i.test(h))
        const intensityIdx = headers.findIndex(h => h === selectedIntensityColumn)

        if (latIdx !== -1 && lngIdx !== -1 && intensityIdx !== -1) {
          // Use ALL rows for continuous heatmap coverage
          console.log(`Loading ${file.csvData.rows.length} points from ${file.name}`)

          for (let i = 0; i < file.csvData.rows.length; i++) {
            const row = file.csvData.rows[i]
            const lat = parseFloat(row[latIdx])
            const lng = parseFloat(row[lngIdx])
            const intensity = parseFloat(row[intensityIdx])

            if (!isNaN(lat) && !isNaN(lng) && !isNaN(intensity)) {
              // Use first column as label
              const label = row[0] || `Point ${i + 1}`
              points.push({ lat, lng, intensity, label })
            }
          }
          console.log(`Loaded ${points.length} valid points from ${file.name}`)
        }
      }
    }

    return points
  }

  const hazardPoints = getHazardPoints()
  const pinnedPoints = getPinnedPoints()


  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Load Hazard Maps</h1>
        <p className="text-muted-foreground mt-2">Import hazard map CSV files and visualize on map</p>
      </div>

      <div className="flex flex-col items-center" style={{ gap: '32px' }}>
        {/* File Selection Card */}
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <Map className="w-8 h-8 text-blue-500" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 className="font-semibold text-lg">Hazard Map Files</h3>
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
                    {stagedFiles.map((file) => {
                      const isSelected = selectedStagedFile?.file_id === file.file_id
                      return (
                      <div
                        key={file.file_id}
                        style={{
                          display: 'flex',
                          alignItems: 'start',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '6px',
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: isSelected
                            ? '2px solid rgba(34, 197, 94, 0.6)'
                            : '1px solid rgba(34, 197, 94, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onClick={async () => {
                          setSelectedStagedFile(file)
                          setPinnedRows(new Set()) // Clear pins when switching files
                          setSelectedIntensityColumn('') // Reset column selection
                          // Fetch and preview the staged file
                          try {
                            const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
                            const response = await fetch(`http://localhost:3001/api/staged-files/${file.file_id}/preview?dbPath=${encodeURIComponent(dbPath)}`)
                            const result = await response.json()

                            if (result.success && result.csvText) {
                              const parsed = parseCsv(result.csvText)
                              setStagedFileData(parsed)

                              // Auto-select first intensity column after data is loaded
                              const firstIntensityCol = parsed.headers.find(h =>
                                h.toLowerCase().includes('intensity') || h.toLowerCase().includes('variance')
                              )
                              if (firstIntensityCol) {
                                console.log('Auto-selecting column for newly loaded staged file:', firstIntensityCol)
                                setSelectedIntensityColumn(firstIntensityCol)
                              }
                            }
                          } catch (error) {
                            console.error('Failed to fetch staged file preview:', error)
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, marginTop: '7px' }}>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-sm" style={{ color: '#ffffff', fontWeight: isSelected ? 600 : 400 }}>
                            {isSelected && '► '}{file.file_name}
                          </span>
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
                    )})}
                  </div>
                </div>
              )}

              {/* File List */}
              {hazardMapFiles.length > 0 && (
                <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {hazardMapFiles.map((hazardMap, idx) => {
                      const isSelected = selectedUnstagedFileIndex === idx
                      return (
                      <div
                        key={idx}
                        onClick={() => {
                          if (hazardMap.isValid) {
                            console.log('Selecting file from list:', idx)
                            setSelectedUnstagedFileIndex(idx)
                            setPinnedRows(new Set())
                            setSelectedIntensityColumn('')
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          marginBottom: '8px',
                          backgroundColor: isSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          borderRadius: '6px',
                          border: isSelected
                            ? '2px solid rgba(34, 197, 94, 0.6)'
                            : `1px solid ${hazardMap.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                          cursor: hazardMap.isValid ? 'pointer' : 'default',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          {hazardMap.isValid ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <X className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm" style={{ color: '#ffffff', fontWeight: isSelected ? 600 : 400 }}>
                            {isSelected && '► '}{hazardMap.name}
                          </span>
                          {hazardMap.csvData && (
                            <span className="text-xs text-muted-foreground">({hazardMap.csvData.rows.length} rows)</span>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation() // Prevent selecting the file when clicking remove
                            removeFile(idx)
                          }}
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
                    )})}
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
                  disabled={hazardMapFiles.length === 0 || isLoading}
                  style={{
                    width: '220px',
                    height: '44px',
                    backgroundColor: (hazardMapFiles.length > 0 && !isLoading) ? '#2563eb' : '#6b7280',
                    border: 'none',
                    boxShadow: 'none',
                    cursor: (hazardMapFiles.length > 0 && !isLoading) ? 'pointer' : 'not-allowed',
                    opacity: (hazardMapFiles.length > 0 && !isLoading) ? 1 : 0.5,
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
        {hazardPoints.length > 0 && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <Map className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Hazard Map Preview</h3>
                <span className="text-sm text-muted-foreground">
                  {hazardPoints.length} location{hazardPoints.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem', paddingBottom: '2rem' }}>
                <HazardMap points={hazardPoints} pinnedPoints={pinnedPoints} height="500px" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {(stagedFileData || (hazardMapFiles.length > 0 && hazardMapFiles.some(l => l.isValid))) && (
          <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
            <CardContent className="p-8">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', marginLeft: '1.5rem' }}>
                <FileText className="w-6 h-6 text-blue-500" />
                <h3 className="font-semibold text-lg">Hazard Map Data</h3>
              </div>

              {/* Show staged file data if available */}
              {stagedFileData && selectedStagedFile && (
                <div style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                  <div style={{ color: '#22c55e', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>
                    {selectedStagedFile.file_name} (Staged)
                  </div>
                  <ScrollArea className="w-full" style={{ height: '300px' }}>
                    <div style={{ minWidth: 'max-content', pointerEvents: 'auto' }}>
                      <table className="w-full" style={{ borderCollapse: 'collapse', pointerEvents: 'auto' }}>
                        <thead style={{ pointerEvents: 'auto' }}>
                          <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)', pointerEvents: 'auto' }}>
                            {stagedFileData.headers.map((header, idx) => {
                              const isSelectedColumn = header === selectedIntensityColumn
                              return (
                                <th
                                  key={idx}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Only allow selecting numeric columns (intensity, variance, etc.)
                                    if (header.toLowerCase().includes('intensity') ||
                                        header.toLowerCase().includes('variance')) {
                                      setSelectedIntensityColumn(header)
                                    }
                                  }}
                                  style={{
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    fontSize: '14px',
                                    fontWeight: isSelectedColumn ? 700 : 600,
                                    color: isSelectedColumn ? '#22c55e' : '#3b82f6',
                                    whiteSpace: 'nowrap',
                                    cursor: (header.toLowerCase().includes('intensity') ||
                                            header.toLowerCase().includes('variance')) ? 'pointer' : 'default',
                                    userSelect: 'none',
                                    position: 'relative',
                                    zIndex: 10
                                  }}
                                >
                                  {header}
                                  {isSelectedColumn && ' ✓'}
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {stagedFileData.rows.slice(0, 100).map((row, rowIdx) => {
                            const isPinned = pinnedRows.has(rowIdx)
                            return (
                              <tr
                                key={rowIdx}
                                onClick={() => {
                                  // Toggle pin on this row
                                  setPinnedRows(prev => {
                                    const newSet = new Set(prev)
                                    if (newSet.has(rowIdx)) {
                                      newSet.delete(rowIdx)
                                    } else {
                                      newSet.add(rowIdx)
                                    }
                                    return newSet
                                  })
                                }}
                                style={{
                                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                  backgroundColor: isPinned
                                    ? 'rgba(239, 68, 68, 0.2)'
                                    : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                  borderLeft: isPinned ? '3px solid #ef4444' : 'none'
                                }}
                                onMouseEnter={(e) => {
                                  if (!isPinned) {
                                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isPinned) {
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
                                      color: isPinned ? '#fff' : '#e2e8f0',
                                      whiteSpace: 'nowrap',
                                      fontWeight: isPinned ? 600 : 400
                                    }}
                                  >
                                    {cellIdx === 0 && isPinned && '📍 '}
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
              {hazardMapFiles.map((hazardMap, hazardMapIdx) => {
                if (!hazardMap.isValid || !hazardMap.csvData) return null
                const isSelected = selectedUnstagedFileIndex === hazardMapIdx

                return (
                  <div key={hazardMapIdx} style={{ marginBottom: '32px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                    {isSelected && (
                    <ScrollArea className="w-full" style={{ height: '300px' }}>
                      <div style={{ minWidth: 'max-content', pointerEvents: 'auto' }}>
                        <table className="w-full" style={{ borderCollapse: 'collapse', pointerEvents: 'auto' }}>
                          <thead style={{ pointerEvents: 'auto' }}>
                            <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)', pointerEvents: 'auto' }}>
                              {hazardMap.csvData.headers.map((header, idx) => {
                                const isSelectedColumn = header === selectedIntensityColumn
                                return (
                                  <th
                                    key={idx}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      // Only allow selecting numeric columns (intensity, variance, etc.)
                                      if (header.toLowerCase().includes('intensity') ||
                                          header.toLowerCase().includes('variance')) {
                                        setSelectedIntensityColumn(header)
                                      }
                                    }}
                                    style={{
                                      padding: '12px 16px',
                                      textAlign: 'left',
                                      fontSize: '14px',
                                      fontWeight: isSelectedColumn ? 700 : 600,
                                      color: isSelectedColumn ? '#22c55e' : '#3b82f6',
                                      whiteSpace: 'nowrap',
                                      cursor: (header.toLowerCase().includes('intensity') ||
                                              header.toLowerCase().includes('variance')) ? 'pointer' : 'default',
                                      userSelect: 'none',
                                      position: 'relative',
                                      zIndex: 10
                                    }}
                                  >
                                    {header}
                                    {isSelectedColumn && ' ✓'}
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {hazardMap.csvData.rows.slice(0, 100).map((row, rowIdx) => {
                              const isPinned = pinnedRows.has(rowIdx)
                              return (
                                <tr
                                  key={rowIdx}
                                  onClick={() => {
                                    // Toggle pin on this row
                                    setPinnedRows(prev => {
                                      const newSet = new Set(prev)
                                      if (newSet.has(rowIdx)) {
                                        newSet.delete(rowIdx)
                                      } else {
                                        newSet.add(rowIdx)
                                      }
                                      return newSet
                                    })
                                  }}
                                  style={{
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                                    backgroundColor: isPinned
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : rowIdx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.15s ease',
                                    borderLeft: isPinned ? '3px solid #ef4444' : 'none'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isPinned) {
                                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)'
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isPinned) {
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
                                        color: isPinned ? '#fff' : '#e2e8f0',
                                        whiteSpace: 'nowrap',
                                        fontWeight: isPinned ? 600 : 400
                                      }}
                                    >
                                      {cellIdx === 0 && isPinned && '📍 '}
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
                    )}
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
