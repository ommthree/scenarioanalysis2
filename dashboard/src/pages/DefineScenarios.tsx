import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Plus, Trash2, Upload, Download } from 'lucide-react'

interface Driver {
  driver_id?: number
  code: string
  name: string
  description: string
  category: string  // 'physical' or 'transition'
}

const DefineScenarios: React.FC = () => {
  const [physicalDrivers, setPhysicalDrivers] = useState<Driver[]>([])
  const [transitionDrivers, setTransitionDrivers] = useState<Driver[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch drivers on mount
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        const physical = data.filter((d: Driver) => d.category === 'physical')
        const transition = data.filter((d: Driver) => d.category === 'transition')
        setPhysicalDrivers(physical)
        setTransitionDrivers(transition)
      })
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  const addDriver = (category: 'physical' | 'transition') => {
    const newDriver: Driver = {
      code: '',
      name: '',
      description: '',
      category
    }

    if (category === 'physical') {
      setPhysicalDrivers([...physicalDrivers, newDriver])
    } else {
      setTransitionDrivers([...transitionDrivers, newDriver])
    }
  }

  const updateDriver = (category: 'physical' | 'transition', index: number, field: keyof Driver, value: string) => {
    if (category === 'physical') {
      const updated = [...physicalDrivers]
      updated[index] = { ...updated[index], [field]: value }
      setPhysicalDrivers(updated)
    } else {
      const updated = [...transitionDrivers]
      updated[index] = { ...updated[index], [field]: value }
      setTransitionDrivers(updated)
    }
  }

  const removeDriver = (category: 'physical' | 'transition', index: number) => {
    if (category === 'physical') {
      setPhysicalDrivers(physicalDrivers.filter((_, i) => i !== index))
    } else {
      setTransitionDrivers(transitionDrivers.filter((_, i) => i !== index))
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    console.log('Starting save...')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const allDrivers = [...physicalDrivers, ...transitionDrivers]

      console.log('Saving drivers:', allDrivers.length, 'drivers to', dbPath)

      const response = await fetch('http://localhost:3001/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, drivers: allDrivers })
      })

      const data = await response.json()
      console.log('Save response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save drivers')
      }

      console.log('Save successful!')
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving drivers:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  const handleDownloadJSON = () => {
    const data = {
      physical_drivers: physicalDrivers,
      transition_drivers: transitionDrivers
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scenario_drivers_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleUploadJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string)

        // Validate JSON structure
        if (!json.physical_drivers || !json.transition_drivers) {
          alert('Invalid JSON format. Expected fields: physical_drivers, transition_drivers')
          return
        }

        // Load drivers
        setPhysicalDrivers(json.physical_drivers || [])
        setTransitionDrivers(json.transition_drivers || [])

        alert('Drivers loaded from JSON successfully!')
      } catch (err) {
        console.error('Error parsing JSON:', err)
        alert('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)

    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const renderDriverSection = (title: string, drivers: Driver[], category: 'physical' | 'transition', color: string) => {
    return (
      <Card className="border-2" style={{
        backgroundColor: 'rgba(30, 41, 59, 0.6)',
        backdropFilter: 'blur(10px)',
        borderColor: `rgba(${color}, 0.3)`,
        marginBottom: '24px'
      }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#ffffff' }}>{title}</h3>
            <Button
              onClick={() => addDriver(category)}
              style={{
                backgroundColor: `rgba(${color}, 0.2)`,
                color: `rgb(${color})`,
                border: `1px solid rgba(${color}, 0.3)`,
                padding: '8px 16px'
              }}
            >
              <Plus className="w-4 h-4" style={{ marginRight: '8px' }} />
              Add Driver
            </Button>
          </div>

          {drivers.length === 0 ? (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '14px'
            }}>
              No {category} drivers defined. Click "Add Driver" to create one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {drivers.map((driver, index) => (
                <div
                  key={index}
                  style={{
                    padding: '20px',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    border: `1px solid rgba(${color}, 0.2)`,
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '12px' }}>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Driver Code *
                      </label>
                      <input
                        type="text"
                        value={driver.code}
                        onChange={(e) => updateDriver(category, index, 'code', e.target.value)}
                        placeholder="e.g., REVENUE_GROWTH"
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          color: '#ffffff',
                          border: `1px solid rgba(${color}, 0.2)`,
                          borderRadius: '6px'
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={driver.name}
                        onChange={(e) => updateDriver(category, index, 'name', e.target.value)}
                        placeholder="e.g., Revenue Growth Rate"
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          color: '#ffffff',
                          border: `1px solid rgba(${color}, 0.2)`,
                          borderRadius: '6px'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
                    <div style={{ flex: 1 }}>
                      <label className="text-sm font-medium text-muted-foreground">
                        Description
                      </label>
                      <textarea
                        value={driver.description}
                        onChange={(e) => updateDriver(category, index, 'description', e.target.value)}
                        placeholder="Optional description..."
                        rows={2}
                        style={{
                          width: '100%',
                          marginTop: '8px',
                          padding: '10px 14px',
                          fontSize: '14px',
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          color: '#ffffff',
                          border: `1px solid rgba(${color}, 0.2)`,
                          borderRadius: '6px',
                          resize: 'vertical'
                        }}
                      />
                    </div>
                    <Button
                      onClick={() => removeDriver(category, index)}
                      variant="ghost"
                      size="sm"
                      style={{
                        color: '#ef4444',
                        padding: '8px'
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '40px'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{
              fontSize: '32px',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '8px'
            }}>
              Define Scenario Drivers
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '16px' }}>
              Define physical and transition risk drivers for scenario analysis
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUploadJSON}
              style={{ display: 'none' }}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '12px 24px',
                fontSize: '16px'
              }}
            >
              <Upload className="w-5 h-5" style={{ marginRight: '8px' }} />
              Upload JSON
            </Button>
            <Button
              onClick={handleDownloadJSON}
              className="transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                backgroundColor: 'rgba(168, 85, 247, 0.2)',
                color: '#a855f7',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                padding: '12px 24px',
                fontSize: '16px'
              }}
            >
              <Download className="w-5 h-5" style={{ marginRight: '8px' }} />
              Download JSON
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: saveStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '12px 24px',
                fontSize: '16px'
              }}
            >
              <Save className="w-5 h-5" style={{ marginRight: '8px' }} />
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error - Retry' : 'Save All Drivers'}
            </Button>
          </div>
        </div>

        {/* Physical Drivers Section */}
        {renderDriverSection('Physical Risk Drivers', physicalDrivers, 'physical', '59, 130, 246')}

        {/* Transition Drivers Section */}
        {renderDriverSection('Transition Risk Drivers', transitionDrivers, 'transition', '168, 85, 247')}
      </div>
    </div>
  )
}

export default DefineScenarios
