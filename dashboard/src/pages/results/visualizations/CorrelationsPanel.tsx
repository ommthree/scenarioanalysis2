import { useState, useEffect } from 'react'
import { Network } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import JointDistributionPanel from '@/components/visualizations/JointDistributionPanel'
import { apiUrl, getDefaultDbPath } from '@/config'
import { logger } from '@/utils/logger'

interface CsvData {
  headers: string[]
  rows: string[][]
}

interface StagedFile {
  file_id: number
  file_name: string
  file_type: string
  row_count: number
  uploaded_at: string
  is_valid: number
}

export default function CorrelationsPanel() {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [correlationData, setCorrelationData] = useState<CsvData | null>(null)
  const [covarianceData, setCovarianceData] = useState<CsvData | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ var1: string; var2: string; correlation: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStagedFiles()
  }, [])

  const fetchStagedFiles = async () => {
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/correlation?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success) {
        setStagedFiles(result.files || [])
        if (result.files && result.files.length > 0) {
          handleSelectStagedFile(result.files[0].file_id)
        }
      }
      setLoading(false)
    } catch (error) {
      logger.error('Failed to fetch staged files:', error)
      setLoading(false)
    }
  }

  const computeCorrelationMatrix = (covData: CsvData): CsvData => {
    // Extract variances (diagonal elements)
    const variances: number[] = []
    for (let i = 0; i < covData.rows.length; i++) {
      const diagValue = parseFloat(covData.rows[i][i + 1]) // +1 to skip label column
      variances.push(diagValue)
    }

    // Compute correlations
    const corrRows = covData.rows.map((row, i) => {
      const newRow = [row[0]] // Keep variable name
      for (let j = 1; j < row.length; j++) {
        const cov = parseFloat(row[j])
        if (isNaN(cov) || isNaN(variances[i]) || isNaN(variances[j - 1])) {
          newRow.push('N/A')
        } else {
          const stdI = Math.sqrt(variances[i])
          const stdJ = Math.sqrt(variances[j - 1])
          const corr = cov / (stdI * stdJ)
          newRow.push(corr.toFixed(4))
        }
      }
      return newRow
    })

    return {
      headers: covData.headers,
      rows: corrRows
    }
  }

  const handleSelectStagedFile = async (fileId: number) => {
    setSelectedFileId(fileId)
    try {
      const dbPath = getDefaultDbPath()
      const response = await fetch(apiUrl(`/api/staged-files/${fileId}/preview?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()

      if (result.success && result.csvText) {
        const parsed = parseCsv(result.csvText)
        // The uploaded file is covariance matrix
        setCovarianceData(parsed)
        // Compute correlation from covariance
        setCorrelationData(computeCorrelationMatrix(parsed))
      }
    } catch (error) {
      logger.error('Failed to load staged file preview:', error)
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

  const getDataRange = (data: CsvData | null): { min: number; max: number } => {
    if (!data) return { min: -1, max: 1 }

    let min = Infinity
    let max = -Infinity

    data.rows.forEach(row => {
      row.slice(1).forEach(cell => {
        const num = parseFloat(cell)
        if (!isNaN(num)) {
          min = Math.min(min, num)
          max = Math.max(max, num)
        }
      })
    })

    return { min: isFinite(min) ? min : -1, max: isFinite(max) ? max : 1 }
  }

  const getCellColor = (value: string, min: number, max: number): string => {
    const num = parseFloat(value)
    if (isNaN(num)) return 'rgba(100, 116, 139, 0.3)'

    // Normalize from [min, max] to [0, 1]
    const normalized = max !== min ? (num - min) / (max - min) : 0.5

    // Interpolate between red (min) and blue (max)
    const red = Math.round(239 - normalized * (239 - 59))
    const green = Math.round(68 + normalized * (130 - 68))
    const blue = Math.round(68 + normalized * (246 - 68))

    return `rgba(${red}, ${green}, ${blue}, 0.7)`
  }

  const handleCellClick = (rowIdx: number, cellIdx: number, cell: string) => {
    if (!correlationData || cellIdx === 0) return

    const correlation = parseFloat(cell)
    if (isNaN(correlation)) return

    // Don't allow clicking on diagonal (perfect correlation with itself)
    if (rowIdx === cellIdx - 1) return

    // Don't allow clicking on near-perfect correlations (likely duplicates)
    if (Math.abs(correlation) > 0.999) return

    const var1 = correlationData.headers[cellIdx]
    const var2 = correlationData.rows[rowIdx][0]

    setSelectedCell({ var1, var2, correlation })
  }

  const renderMatrix = (data: CsvData | null, title: string, range: { min: number; max: number }) => {
    if (!data) return null

    return (
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#3b82f6', margin: 0 }}>{title}</h4>

          {/* Color Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.2)'
          }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{range.min.toFixed(2)}</span>
            <div style={{
              width: '200px',
              height: '20px',
              background: 'linear-gradient(to right, rgba(239, 68, 68, 0.7), rgba(149, 99, 157, 0.7), rgba(59, 130, 246, 0.7))',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }} />
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{range.max.toFixed(2)}</span>
            {title === 'Correlation Matrix' && (
              <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#22c55e' }}>💡 Click any cell to view joint distribution</span>
              </div>
            )}
          </div>
        </div>

        <ScrollArea style={{ width: '100%', height: '500px', border: '1px solid rgba(71, 85, 105, 0.5)', borderRadius: '6px' }}>
          <div style={{ minWidth: 'max-content' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderBottom: '2px solid rgba(59, 130, 246, 0.3)' }}>
                  {data.headers.map((header, idx) => (
                    <th
                      key={idx}
                      style={{
                        padding: '12px 8px',
                        textAlign: idx === 0 ? 'left' : 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#3b82f6',
                        whiteSpace: 'nowrap',
                        width: idx === 0 ? '100px' : '60px',
                        maxWidth: idx === 0 ? '100px' : '60px'
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {row.map((cell, cellIdx) => (
                      <td
                        key={cellIdx}
                        onClick={() => title === 'Correlation Matrix' && handleCellClick(rowIdx, cellIdx, cell)}
                        style={{
                          padding: '0',
                          fontSize: '11px',
                          color: '#e2e8f0',
                          whiteSpace: 'nowrap',
                          backgroundColor: cellIdx === 0 ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                          fontWeight: cellIdx === 0 ? 600 : 400,
                          textAlign: 'center',
                          width: cellIdx === 0 ? '100px' : '60px',
                          height: cellIdx === 0 ? 'auto' : '60px',
                          maxWidth: cellIdx === 0 ? '100px' : '60px',
                          cursor: title === 'Correlation Matrix' && cellIdx > 0 && !isNaN(parseFloat(cell)) && rowIdx !== cellIdx - 1 && Math.abs(parseFloat(cell)) <= 0.999 ? 'pointer' : 'default'
                        }}
                      >
                        <div style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: cellIdx === 0 ? 'flex-start' : 'center',
                          padding: cellIdx === 0 ? '10px 8px' : '0',
                          minHeight: cellIdx === 0 ? 'auto' : '60px',
                          backgroundColor: cellIdx > 0 ? getCellColor(cell, range.min, range.max) : 'transparent',
                          transition: 'all 0.2s',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        onMouseEnter={(e) => {
                          if (cellIdx > 0 && !isNaN(parseFloat(cell))) {
                            e.currentTarget.style.transform = 'scale(1.05)'
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)'
                            e.currentTarget.style.zIndex = '10'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (cellIdx > 0 && !isNaN(parseFloat(cell))) {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.boxShadow = 'none'
                            e.currentTarget.style.zIndex = '0'
                          }
                        }}
                        >
                          {cellIdx === 0 ? (
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cell}>
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <p style={{ color: '#94a3b8' }}>Loading correlations...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
        <CardContent style={{ padding: '32px' }}>
          {/* File Selector */}
          {stagedFiles.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '14px', marginBottom: '8px' }}>
                Select Correlation Matrix
              </label>
              <select
                value={selectedFileId || ''}
                onChange={(e) => handleSelectStagedFile(Number(e.target.value))}
                style={{
                  width: '100%',
                  maxWidth: '400px',
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
                    {f.file_name} ({f.row_count} variables)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Render both matrices */}
          {renderMatrix(correlationData, 'Correlation Matrix', getDataRange(correlationData))}
          {renderMatrix(covarianceData, 'Covariance Matrix', getDataRange(covarianceData))}

          {stagedFiles.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
              <p>No correlation matrices loaded. Load correlation files from the "Load Correlations" page.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCell && (
        <JointDistributionPanel
          variable1={selectedCell.var1}
          variable2={selectedCell.var2}
          correlation={selectedCell.correlation}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  )
}
