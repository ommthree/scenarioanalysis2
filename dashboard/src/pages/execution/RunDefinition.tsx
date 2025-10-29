import { useState, useEffect } from 'react'
import { logger } from '@/utils/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, FileText } from 'lucide-react'

export default function RunDefinition() {
  const [runName, setRunName] = useState('')
  const [description, setDescription] = useState('')
  const [stochasticMode, setStochasticMode] = useState(false)
  const [whatIfMode, setWhatIfMode] = useState(false)
  const [numDraws, setNumDraws] = useState(1000)
  const [mcStartPeriod, setMcStartPeriod] = useState(1)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Load saved run definition on mount
  useEffect(() => {
    const saved = localStorage.getItem('runDefinition')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setRunName(data.runName || '')
        setDescription(data.description || '')
        setStochasticMode(data.stochasticMode || false)
        setWhatIfMode(data.whatIfMode || false)
        setNumDraws(data.numDraws || 1000)
        setMcStartPeriod(data.mcStartPeriod || 1)
      } catch (err) {
        logger.error('Error loading run definition:', err)
      }
    }
  }, [])

  const handleSave = () => {
    setSaveStatus('saving')

    const runDefinition = {
      runName,
      description,
      stochasticMode,
      whatIfMode,
      numDraws,
      mcStartPeriod,
      savedAt: new Date().toISOString()
    }

    try {
      localStorage.setItem('runDefinition', JSON.stringify(runDefinition))
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      logger.error('Error saving run definition:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }
  }

  return (
    <div style={{
      padding: '48px',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <FileText style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
            Run Definition
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
          Define the parameters and description for your calculation run
        </p>
      </div>

      {/* Run Definition Card */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        maxWidth: '1200px'
      }}>
        <CardContent style={{ padding: '32px' }}>
          {/* Run Name */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '8px'
            }}>
              Run Name
            </label>
            <input
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="Enter a name for this calculation run"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#fff',
              marginBottom: '8px'
            }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a detailed description of this calculation run, including any assumptions, scenarios being tested, or other relevant information..."
              rows={8}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Calculation Options */}
          <div style={{
            marginBottom: '32px',
            padding: '20px',
            backgroundColor: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
              Calculation Options
            </h3>

            {/* Stochastic Mode Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={stochasticMode}
                  onChange={(e) => {
                    setStochasticMode(e.target.checked)
                    if (e.target.checked) setWhatIfMode(false)
                  }}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: stochasticMode ? '#3b82f6' : 'rgba(71, 85, 105, 0.5)',
                  borderRadius: '24px',
                  transition: 'background-color 0.2s',
                  border: '1px solid rgba(71, 85, 105, 0.4)'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: stochasticMode ? '26px' : '3px',
                    bottom: '2px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s'
                  }} />
                </span>
              </label>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  Stochastic Mode
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Run multiple Monte Carlo simulations with scenario distributions
                </div>
              </div>
            </div>

            {/* Number of Draws (only visible when stochastic mode is on) */}
            {stochasticMode && (
              <div style={{
                marginTop: '16px',
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#fff',
                  marginBottom: '8px'
                }}>
                  Number of Monte Carlo Draws
                </label>
                <input
                  type="text"
                  value={numDraws}
                  onChange={(e) => setNumDraws(parseInt(e.target.value) || 1000)}
                  style={{
                    width: '200px',
                    padding: '8px 12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.6)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
                <div style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginTop: '6px'
                }}>
                  Typical range: 1,000 - 10,000 draws. Higher values increase accuracy but take longer to compute.
                </div>
              </div>
            )}

            {/* MC Start Period Slider (only visible when stochastic mode is on) */}
            {stochasticMode && (
              <div style={{
                marginTop: '16px',
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#fff',
                  marginBottom: '12px'
                }}>
                  Monte Carlo Start Period: {mcStartPeriod}
                </label>
                <input
                  type="range"
                  value={mcStartPeriod}
                  onChange={(e) => setMcStartPeriod(parseInt(e.target.value))}
                  min={1}
                  max={20}
                  step={1}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(71, 85, 105, 0.5)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: '#64748b',
                  marginTop: '6px'
                }}>
                  <span>Period 1</span>
                  <span>Period 20</span>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  marginTop: '8px'
                }}>
                  Calculation will be deterministic up to this period, then Monte Carlo sampling begins.
                </div>
              </div>
            )}

            {/* What-If Mode Switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{
                position: 'relative',
                display: 'inline-block',
                width: '48px',
                height: '24px',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={whatIfMode}
                  onChange={(e) => {
                    setWhatIfMode(e.target.checked)
                    if (e.target.checked) setStochasticMode(false)
                  }}
                  style={{
                    opacity: 0,
                    width: 0,
                    height: 0
                  }}
                />
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: whatIfMode ? '#10b981' : 'rgba(71, 85, 105, 0.5)',
                  borderRadius: '24px',
                  transition: 'background-color 0.2s',
                  border: '1px solid rgba(71, 85, 105, 0.4)'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '18px',
                    width: '18px',
                    left: whatIfMode ? '26px' : '3px',
                    bottom: '2px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s'
                  }} />
                </span>
              </label>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
                  What-If Mode
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Generate all possible action combinations for sensitivity analysis
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
            {saveStatus === 'success' && (
              <span style={{ color: '#10b981', fontSize: '14px' }}>
                Saved successfully
              </span>
            )}
            {saveStatus === 'error' && (
              <span style={{ color: '#ef4444', fontSize: '14px' }}>
                Error saving
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{
                backgroundColor: '#3b82f6',
                color: '#fff',
                padding: '12px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Save style={{ width: '16px', height: '16px' }} />
              {saveStatus === 'saving' ? 'Saving...' : 'Save Definition'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
