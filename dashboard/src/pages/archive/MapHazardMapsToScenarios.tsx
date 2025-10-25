import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, Map, Activity, CheckCircle2, Circle } from 'lucide-react'

interface HazardMap {
  mapping_id: number
  file_name: string
  peril_type: string
  peril_code: string
}

interface Scenario {
  scenario_id: number
  code: string
  name: string
}

export default function MapHazardMapsToScenarios() {
  const [hazardMaps, setHazardMaps] = useState<HazardMap[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [selectedMappings, setSelectedMappings] = useState<Map<number, Set<string>>>(new Map())
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const dbPath = localStorage.getItem('lastDatabasePath') || '/Users/Owen/ScenarioAnalysis2/data/database/finmodel.db'

  useEffect(() => {
    loadHazardMaps()
    loadScenarios()
  }, [])

  const loadHazardMaps = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/hazard-maps/list-mappings?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      if (data.success) {
        setHazardMaps(data.mappings || [])

        // Load existing scenario mappings
        const mappingsMap = new Map<number, Set<string>>()
        for (const map of data.mappings || []) {
          const scenarioResponse = await fetch(
            `http://localhost:3001/api/hazard-maps/get-scenarios?dbPath=${encodeURIComponent(dbPath)}&mappingId=${map.mapping_id}`
          )
          const scenarioData = await scenarioResponse.json()
          if (scenarioData.success && scenarioData.scenarios) {
            mappingsMap.set(map.mapping_id, new Set(scenarioData.scenarios.map((s: any) => s.code)))
          }
        }
        setSelectedMappings(mappingsMap)
      }
    } catch (error) {
      console.error('Error loading hazard maps:', error)
    }
  }

  const loadScenarios = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`)
      const data = await response.json()
      if (data.success) {
        setScenarios(data.scenarios || [])
      }
    } catch (error) {
      console.error('Error loading scenarios:', error)
    }
  }

  const toggleScenarioForMap = (mappingId: number, scenarioCode: string) => {
    const newMappings = new Map(selectedMappings)
    const scenarios = newMappings.get(mappingId) || new Set()

    if (scenarios.has(scenarioCode)) {
      scenarios.delete(scenarioCode)
    } else {
      scenarios.add(scenarioCode)
    }

    newMappings.set(mappingId, scenarios)
    setSelectedMappings(newMappings)
  }

  const handleSave = async () => {
    setSaveStatus('saving')

    try {
      // Save all mappings
      for (const [mappingId, scenarioCodes] of selectedMappings.entries()) {
        const response = await fetch('http://localhost:3001/api/hazard-maps/save-scenario-mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dbPath,
            mappingId,
            scenarioCodes: Array.from(scenarioCodes)
          })
        })

        const result = await response.json()
        if (!response.ok) {
          throw new Error(result.error || 'Failed to save mapping')
        }
      }

      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Error saving:', err)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div style={{ maxWidth: '1600px', margin: '0 auto', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '8px'
          }}>
            Map Hazard Maps to Scenarios
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '16px' }}>
            Link hazard maps to the scenarios that use them (many-to-many mapping)
          </p>
        </div>

        {/* Mapping Grid */}
        {hazardMaps.length === 0 ? (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}>
            <CardContent style={{ padding: '48px', textAlign: 'center' }}>
              <Map style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto 16px' }} />
              <p style={{ color: '#fca5a5', fontSize: '16px' }}>
                No hazard maps configured yet. Please configure hazard maps in "Map Hazard Maps" first.
              </p>
            </CardContent>
          </Card>
        ) : scenarios.length === 0 ? (
          <Card className="border-2" style={{
            backgroundColor: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(239, 68, 68, 0.3)'
          }}>
            <CardContent style={{ padding: '48px', textAlign: 'center' }}>
              <Activity style={{ width: '48px', height: '48px', color: '#ef4444', margin: '0 auto 16px' }} />
              <p style={{ color: '#fca5a5', fontSize: '16px' }}>
                No scenarios found. Please define scenarios first.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {hazardMaps.map((map) => (
              <Card key={map.mapping_id} className="border-2" style={{
                backgroundColor: 'rgba(30, 41, 59, 0.6)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(100, 116, 139, 0.3)',
                marginBottom: '24px'
              }}>
                <CardContent style={{ padding: '24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ffffff', marginBottom: '4px' }}>
                      {map.file_name}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                      Peril: {map.peril_type} ({map.peril_code})
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                    {scenarios.map((scenario) => {
                      const isSelected = selectedMappings.get(map.mapping_id)?.has(scenario.code) || false

                      return (
                        <button
                          key={scenario.code}
                          onClick={() => toggleScenarioForMap(map.mapping_id, scenario.code)}
                          style={{
                            padding: '16px',
                            backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(51, 65, 85, 0.5)',
                            border: isSelected ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(71, 85, 105, 0.3)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'rgba(71, 85, 105, 0.5)'
                              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.5)'
                              e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'
                            }
                          }}
                        >
                          {isSelected ? (
                            <CheckCircle2 style={{ width: '20px', height: '20px', color: '#10b981', flexShrink: 0 }} />
                          ) : (
                            <Circle style={{ width: '20px', height: '20px', color: '#64748b', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#10b981' : '#e2e8f0' }}>
                              {scenario.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {scenario.code}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '32px' }}>
              <Button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                style={{
                  backgroundColor: saveStatus === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '12px 32px',
                  fontSize: '16px'
                }}
              >
                <Save className="w-5 h-5" style={{ marginRight: '8px' }} />
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Error - Retry' : 'Save Mappings'}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
