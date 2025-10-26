import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Plus, Trash2, Upload, Download } from 'lucide-react'

interface Driver {
  driver_id?: number
  code: string
  name: string
  description: string
  category: string  // 'financial', 'physical', or 'fx'
}

const DefineScenarios: React.FC = () => {
  const [financialDrivers, setFinancialDrivers] = useState<Driver[]>([])
  const [physicalDrivers, setPhysicalDrivers] = useState<Driver[]>([])
  const [fxDrivers, setFxDrivers] = useState<Driver[]>([])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch drivers on mount
  useEffect(() => {
    const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
    fetch(`http://localhost:3001/api/drivers?dbPath=${encodeURIComponent(dbPath)}`)
      .then(res => res.json())
      .then(data => {
        const financial = data.filter((d: Driver) => d.category === 'financial')
        const physical = data.filter((d: Driver) => d.category === 'physical')
        const fx = data.filter((d: Driver) => d.category === 'fx')
        setFinancialDrivers(financial)
        setPhysicalDrivers(physical)
        setFxDrivers(fx)
      })
      .catch(err => console.error('Error fetching drivers:', err))
  }, [])

  const addDriver = (category: 'financial' | 'physical' | 'fx') => {
    const newDriver: Driver = {
      code: '',
      name: '',
      description: '',
      category
    }

    if (category === 'financial') {
      setFinancialDrivers([...financialDrivers, newDriver])
    } else if (category === 'physical') {
      setPhysicalDrivers([...physicalDrivers, newDriver])
    } else {
      setFxDrivers([...fxDrivers, newDriver])
    }
  }

  const updateDriver = (category: 'financial' | 'physical' | 'fx', index: number, field: keyof Driver, value: string) => {
    if (category === 'financial') {
      const updated = [...financialDrivers]
      updated[index] = { ...updated[index], [field]: value }
      setFinancialDrivers(updated)
    } else if (category === 'physical') {
      const updated = [...physicalDrivers]
      updated[index] = { ...updated[index], [field]: value }
      setPhysicalDrivers(updated)
    } else {
      const updated = [...fxDrivers]
      updated[index] = { ...updated[index], [field]: value }
      setFxDrivers(updated)
    }
  }

  const removeDriver = (category: 'financial' | 'physical' | 'fx', index: number) => {
    if (category === 'financial') {
      setFinancialDrivers(financialDrivers.filter((_, i) => i !== index))
    } else if (category === 'physical') {
      setPhysicalDrivers(physicalDrivers.filter((_, i) => i !== index))
    } else {
      setFxDrivers(fxDrivers.filter((_, i) => i !== index))
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving')
    console.log('Starting save...')

    try {
      const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'
      const allDrivers = [...financialDrivers, ...physicalDrivers, ...fxDrivers]

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
      financial_drivers: financialDrivers,
      physical_drivers: physicalDrivers,
      fx_drivers: fxDrivers
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
        if (!json.financial_drivers && !json.physical_drivers && !json.fx_drivers) {
          alert('Invalid JSON format. Expected at least one of: financial_drivers, physical_drivers, fx_drivers')
          return
        }

        // Load drivers
        setFinancialDrivers(json.financial_drivers || [])
        setPhysicalDrivers(json.physical_drivers || [])
        setFxDrivers(json.fx_drivers || [])
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

  const renderDriverSection = (title: string, drivers: Driver[], category: 'financial' | 'physical' | 'fx', color: string) => {
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
                padding: '8px 16px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${color}, 0.3)`
                e.currentTarget.style.borderColor = `rgba(${color}, 0.5)`
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = `rgba(${color}, 0.2)`
                e.currentTarget.style.borderColor = `rgba(${color}, 0.3)`
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
                        Driver Code
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
                        Display Name
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
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
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
                    <button
                      onClick={() => removeDriver(category, index)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        marginTop: '31px'
                      }}
                    >
                      <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                    </button>
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
    <div className="p-12 max-w-7xl mx-auto">
      <div style={{ maxWidth: '1400px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
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
              Define financial and physical risk drivers for scenario analysis
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '100px', position: 'relative', zIndex: 50 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUploadJSON}
              style={{ display: 'none' }}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Import JSON
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadJSON}
              size="sm"
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.2)' }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              style={{
                backgroundColor: saveStatus === 'saving' ? '#64748b' : saveStatus === 'success' ? '#10b981' : saveStatus === 'error' ? '#ef4444' : '#22c55e',
                border: 'none',
                color: '#ffffff',
                pointerEvents: 'auto',
                cursor: 'pointer',
                position: 'relative',
                zIndex: 100,
                transition: 'all 0.2s'
              }}
              disabled={saveStatus === 'saving'}
              onMouseEnter={(e) => {
                if (saveStatus === 'idle') {
                  e.currentTarget.style.backgroundColor = '#16a34a'
                }
              }}
              onMouseLeave={(e) => {
                if (saveStatus === 'idle') {
                  e.currentTarget.style.backgroundColor = '#22c55e'
                }
              }}
            >
              <Save className="w-4 h-4 mr-2" />
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error' : 'Save to Database'}
            </Button>
          </div>
        </div>

        {/* Financial Drivers Section */}
        {renderDriverSection('Financial Drivers', financialDrivers, 'financial', '59, 130, 246')}

        {/* Physical Risk Drivers Section */}
        {renderDriverSection('Physical Risk Drivers', physicalDrivers, 'physical', '239, 68, 68')}

        {/* Foreign Exchange Drivers Section */}
        {renderDriverSection('Foreign Exchange Rates', fxDrivers, 'fx', '251, 191, 36')}
      </div>
    </div>
  )
}

export default DefineScenarios
