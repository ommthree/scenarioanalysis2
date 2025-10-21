import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, FileText } from 'lucide-react'

export default function RunDefinition() {
  const [runName, setRunName] = useState('')
  const [description, setDescription] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  // Load saved run definition on mount
  useEffect(() => {
    const saved = localStorage.getItem('runDefinition')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setRunName(data.runName || '')
        setDescription(data.description || '')
      } catch (err) {
        console.error('Error loading run definition:', err)
      }
    }
  }, [])

  const handleSave = () => {
    setSaveStatus('saving')

    const runDefinition = {
      runName,
      description,
      savedAt: new Date().toISOString()
    }

    try {
      localStorage.setItem('runDefinition', JSON.stringify(runDefinition))
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving run definition:', err)
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

          {/* Future Switches Section - Placeholder */}
          <div style={{
            marginBottom: '32px',
            padding: '20px',
            backgroundColor: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#94a3b8', marginBottom: '8px' }}>
              Calculation Options
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              Additional calculation switches and options will be added here in the future
            </p>
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
