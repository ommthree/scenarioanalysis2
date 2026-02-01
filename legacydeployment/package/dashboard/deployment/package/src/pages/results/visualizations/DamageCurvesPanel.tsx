import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

interface CsvData {
  headers: string[]
  rows: string[][]
}

export default function DamageCurvesPanel() {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [previewData, setPreviewData] = useState<CsvData | null>(null)
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/damage_curve?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
        if (result.files && result.files.length > 0) {
          handleSelectFile(result.files[0].file_id)
        }
      }
      setLoading(false)
    } catch (error) {
      logger.error('Failed to fetch staged files:', error)
      setLoading(false)
    }
  }

  const handleSelectFile = async (fileId: number) => {
    setSelectedFileId(fileId)
    setSelectedRows([])
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        setPreviewData(parsed)
        // Auto-select first 3 rows
        if (parsed.rows.length > 0) {
          setSelectedRows([0, 1, 2].filter(i => i < parsed.rows.length))
        }
      }
    } catch (error) {
      logger.error('Failed to load file preview:', error)
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

  const toggleRowSelection = (rowIndex: number) => {
    setSelectedRows(prev =>
      prev.includes(rowIndex)
        ? prev.filter(i => i !== rowIndex)
        : [...prev, rowIndex]
    )
  }

  const getChartData = () => {
    if (!previewData || selectedRows.length === 0) return []

    // Assume first column is x-axis (intensity/hazard level)
    const xHeader = previewData.headers[0]
    const data: any[] = []

    // For each row in the data
    previewData.rows.forEach((row, rowIdx) => {
      const xValue = parseFloat(row[0])
      if (isNaN(xValue)) return

      // Find or create data point for this x value
      let dataPoint = data.find(d => d[xHeader] === xValue)
      if (!dataPoint) {
        dataPoint = { [xHeader]: xValue }
        data.push(dataPoint)
      }

      // If this row is selected, add its values
      if (selectedRows.includes(rowIdx)) {
        const curveLabel = row[row.length - 1] || `Curve ${rowIdx + 1}` // Use last column as label or generate one
        previewData.headers.slice(1, -1).forEach((header, colIdx) => {
          const value = parseFloat(row[colIdx + 1])
          if (!isNaN(value)) {
            dataPoint[curveLabel] = value
          }
        })
      }
    })

    return data.sort((a, b) => a[xHeader] - b[xHeader])
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>Loading damage curves...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <TrendingUp style={{ width: '32px', height: '32px', color: '#8b5cf6' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
              Damage Curves
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
            Vulnerability functions showing damage % vs hazard intensity for different perils.
          </p>

          {/* File Selector */}
          {stagedFiles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
                Select Damage Curve File
              </label>
              <select
                value={selectedFileId || ''}
                onChange={(e) => handleSelectFile(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              >
                {stagedFiles.map(f => (
                  <option key={f.file_id} value={f.file_id}>
                    {f.file_name} ({f.row_count} rows)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Data Preview Table */}
          {previewData && (
            <ScrollArea style={{ height: '300px', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px', marginBottom: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '8px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>Select</th>
                    {previewData.headers.map((header, idx) => (
                      <th key={idx} style={{ padding: '8px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', borderBottom: '1px solid rgba(71, 85, 105, 0.5)' }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.rows.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      onClick={() => toggleRowSelection(rowIdx)}
                      style={{
                        backgroundColor: selectedRows.includes(rowIdx) ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedRows.includes(rowIdx)) {
                          e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedRows.includes(rowIdx)) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <td style={{ padding: '8px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(rowIdx)}
                          onChange={() => toggleRowSelection(rowIdx)}
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      {row.map((cell, cellIdx) => (
                        <td key={cellIdx} style={{ padding: '8px', color: '#e2e8f0', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Chart */}
      {getChartData().length > 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
              Damage Curve Visualization
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(71, 85, 105, 0.5)" />
                <XAxis dataKey={previewData?.headers[0] || 'intensity'} stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '6px',
                    color: '#fff'
                  }}
                />
                <Legend />
                {selectedRows.map((rowIdx, idx) => (
                  <Line
                    key={rowIdx}
                    type="monotone"
                    dataKey={`Row ${rowIdx + 1}`}
                    stroke={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {stagedFiles.length === 0 && (
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>
              No damage curve files loaded. Upload files via the Load Damage Curves page.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
