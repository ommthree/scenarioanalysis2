import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Upload, AlertCircle, BarChart3 } from 'lucide-react'
import Papa from 'papaparse'
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

interface ChartData {
  [key: string]: string | number
}

export default function LoadDamageCurves() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [selectedXAxis, setSelectedXAxis] = useState<string>('')
  const [selectedLines, setSelectedLines] = useState<string[]>([])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setUploadStatus(null)

    // Parse CSV for preview
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const data = results.data as ChartData[]
          setChartData(data)

          const cols = Object.keys(data[0])
          setColumns(cols)

          // Auto-select X axis (first column or one containing "intensity", "return", "period")
          const xAxisCol = cols.find(col =>
            col.toLowerCase().includes('intensity') ||
            col.toLowerCase().includes('return') ||
            col.toLowerCase().includes('period')
          ) || cols[0]
          setSelectedXAxis(xAxisCol)

          // Auto-select Y axis columns (numeric columns, excluding X axis)
          const yAxisCols = cols.filter(col => {
            if (col === xAxisCol) return false
            const firstValue = data[0][col]
            return !isNaN(Number(firstValue))
          })
          setSelectedLines(yAxisCols.slice(0, 5)) // Limit to 5 lines for clarity
        }
      },
      error: (error) => {
        console.error('Parse error:', error)
        setUploadStatus({ success: false, message: 'Failed to parse CSV file' })
      }
    })
  }

  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return

    const file = fileInputRef.current.files[0]
    const formData = new FormData()
    formData.append('file', file)
    formData.append('dbPath', '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db')

    setUploading(true)
    setUploadStatus(null)

    try {
      const response = await fetch('http://localhost:3001/api/damage-curves/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok) {
        setUploadStatus({
          success: true,
          message: `Successfully staged ${result.rowCount} damage curve records from ${file.name}`
        })
        // Navigate to map damage curves page after 1 second
        setTimeout(() => navigate('/map-damage-curves'), 1000)
      } else {
        setUploadStatus({ success: false, message: result.error || 'Upload failed' })
      }
    } catch (error) {
      setUploadStatus({ success: false, message: 'Network error. Please try again.' })
    } finally {
      setUploading(false)
    }
  }

  const toggleLine = (column: string) => {
    setSelectedLines(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    )
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', padding: '32px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/dashboard')}
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
          Back to Dashboard
        </button>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: '8px' }}>
            Load Damage Curves
          </h1>
          <p style={{ fontSize: '16px', color: '#94a3b8' }}>
            Upload a CSV file containing damage curves (intensity vs. damage factor relationships)
          </p>
        </div>

        {/* Main Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
          {/* Left Column - Upload */}
          <div>
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '2px dashed rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '48px 32px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)'
                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.05)'
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                e.currentTarget.style.backgroundColor = '#1e293b'
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                e.currentTarget.style.backgroundColor = '#1e293b'
                const files = e.dataTransfer.files
                if (files.length > 0 && fileInputRef.current) {
                  fileInputRef.current.files = files
                  handleFileSelect({ target: { files } } as any)
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <BarChart3 size={48} color="#3b82f6" style={{ margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: '#e2e8f0' }}>
                {fileName || 'Choose a CSV file or drag it here'}
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
                CSV files should contain intensity values and corresponding damage factors
              </p>
              <button
                style={{
                  padding: '10px 24px',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                Select File
              </button>
            </div>

            {/* Expected Format */}
            <div
              style={{
                marginTop: '24px',
                backgroundColor: '#1e293b',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#e2e8f0' }}>
                Expected CSV Format
              </h3>
              <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
                <p style={{ marginBottom: '8px' }}>Your CSV should include:</p>
                <ul style={{ marginLeft: '20px', marginBottom: '12px' }}>
                  <li>One column for peril/hazard type (e.g., "Flood", "Hurricane")</li>
                  <li>One column for intensity/return period</li>
                  <li>One or more columns for damage factors (0-1 scale)</li>
                </ul>
                <p style={{ fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#0f172a', padding: '12px', borderRadius: '4px', marginTop: '12px' }}>
                  peril,return_period,damage_factor<br/>
                  Flood,10,0.05<br/>
                  Flood,50,0.15<br/>
                  Flood,100,0.30
                </p>
              </div>
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
                <AlertCircle size={20} color={uploadStatus.success ? '#22c55e' : '#ef4444'} />
                <span style={{ fontSize: '14px', color: uploadStatus.success ? '#22c55e' : '#ef4444' }}>
                  {uploadStatus.message}
                </span>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!fileName || uploading}
              style={{
                marginTop: '24px',
                width: '100%',
                padding: '14px 24px',
                backgroundColor: fileName && !uploading ? '#3b82f6' : '#334155',
                border: 'none',
                borderRadius: '8px',
                color: fileName && !uploading ? '#fff' : '#64748b',
                fontSize: '16px',
                fontWeight: 600,
                cursor: fileName && !uploading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (fileName && !uploading) {
                  e.currentTarget.style.backgroundColor = '#2563eb'
                }
              }}
              onMouseLeave={(e) => {
                if (fileName && !uploading) {
                  e.currentTarget.style.backgroundColor = '#3b82f6'
                }
              }}
            >
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Stage Damage Curves'}
            </button>
          </div>

          {/* Right Column - Chart Preview */}
          <div>
            <div
              style={{
                backgroundColor: '#1e293b',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '24px',
                minHeight: '500px',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#e2e8f0' }}>
                Damage Curve Preview
              </h3>

              {chartData.length > 0 ? (
                <>
                  {/* Axis Selection */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>
                      X-Axis (Intensity/Return Period):
                    </label>
                    <select
                      value={selectedXAxis}
                      onChange={(e) => setSelectedXAxis(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#0f172a',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        fontSize: '14px',
                      }}
                    >
                      {columns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  {/* Line Selection */}
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>
                      Y-Axis (Damage Factors):
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {columns.filter(col => col !== selectedXAxis).map((col, idx) => (
                        <button
                          key={col}
                          onClick={() => toggleLine(col)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: selectedLines.includes(col) ? colors[idx % colors.length] : '#334155',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            opacity: selectedLines.includes(col) ? 1 : 0.5,
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {col}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart */}
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey={selectedXAxis}
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        style={{ fontSize: '12px' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '6px',
                          color: '#e2e8f0'
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                      {selectedLines.map((line, idx) => (
                        <Line
                          key={line}
                          type="monotone"
                          dataKey={line}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '450px',
                  color: '#64748b'
                }}>
                  <BarChart3 size={64} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p style={{ fontSize: '14px' }}>Upload a CSV file to preview damage curves</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
