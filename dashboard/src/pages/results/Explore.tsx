import { useState } from 'react'
import {
  LineChart,
  TrendingUp,
  BarChart3,
  PieChart,
  ScatterChart,
  Network,
  GitBranch,
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  AlertTriangle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import RiskDashboard from './visualizations/RiskDashboard'

export default function Explore() {
  const [selectedViz, setSelectedViz] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(true)

  const vizOptions = [
    { id: 'risk-dashboard', icon: AlertTriangle, label: 'Risk Dashboard', color: '#ef4444' },
    { id: 'timeseries', icon: LineChart, label: 'Time Series', color: '#3b82f6' },
    { id: 'trends', icon: TrendingUp, label: 'Trends', color: '#10b981' },
    { id: 'comparison', icon: BarChart3, label: 'Comparison', color: '#8b5cf6' },
    { id: 'distribution', icon: PieChart, label: 'Distribution', color: '#f59e0b' },
    { id: 'scatter', icon: ScatterChart, label: 'Scatter', color: '#ec4899' },
    { id: 'network', icon: Network, label: 'Network', color: '#06b6d4' },
    { id: 'waterfall', icon: GitBranch, label: 'Waterfall', color: '#f97316' },
    { id: 'stacked', icon: Layers, label: 'Stacked', color: '#84cc16' },
    { id: 'geospatial', icon: MapPin, label: 'Geospatial', color: '#14b8a6' },
  ]

  const handleVizSelect = (id: string) => {
    setSelectedViz(id)
    // Keep menu open after selection
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Top Menu Bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(59, 130, 246, 0.3)',
      }}>
        {/* Menu Toggle Bar */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            width: '100%',
            padding: '10px 48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <LineChart style={{ width: '24px', height: '24px', color: '#3b82f6' }} />
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#fff' }}>
              {selectedViz
                ? vizOptions.find(v => v.id === selectedViz)?.label
                : 'Select Visualization'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: '500' }}>
              Explore visualisations
            </span>
            {menuOpen ? (
              <ChevronUp style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
            ) : (
              <ChevronDown style={{ width: '20px', height: '20px', color: '#94a3b8' }} />
            )}
            <img src="/daedalus2.png" alt="Logo" style={{ height: '90px', width: 'auto', transform: 'translateY(7px)' }} />
          </div>
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div style={{
            borderTop: '1px solid rgba(71, 85, 105, 0.5)',
            padding: '24px 48px',
            backgroundColor: 'rgba(15, 23, 42, 0.98)',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              maxWidth: '1200px'
            }}>
              {vizOptions.map((option) => {
                const Icon = option.icon
                const isSelected = selectedViz === option.id
                return (
                  <button
                    key={option.id}
                    onClick={() => handleVizSelect(option.id)}
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(30, 41, 59, 0.5)',
                      border: isSelected
                        ? `2px solid ${option.color}`
                        : '2px solid rgba(71, 85, 105, 0.5)',
                      borderRadius: '8px',
                      padding: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.7)'
                        e.currentTarget.style.borderColor = option.color
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)'
                        e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.5)'
                      }
                    }}
                  >
                    <Icon
                      style={{
                        width: '32px',
                        height: '32px',
                        color: option.color
                      }}
                    />
                    <span style={{
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div style={{ padding: selectedViz === 'risk-dashboard' ? '0' : '48px' }}>
        {selectedViz === 'risk-dashboard' ? (
          <RiskDashboard />
        ) : selectedViz ? (
          <Card style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <CardContent style={{ padding: '64px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
                {(() => {
                  const selected = vizOptions.find(v => v.id === selectedViz)
                  if (!selected) return null
                  const Icon = selected.icon
                  return <Icon style={{
                    width: '64px',
                    height: '64px',
                    color: selected.color
                  }} />
                })()}
              </div>

              <h2 style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {vizOptions.find(v => v.id === selectedViz)?.label} Visualization
              </h2>

              <p style={{
                color: '#94a3b8',
                fontSize: '16px',
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'center'
              }}>
                This visualization type will display your data in an interactive {selectedViz} format.
                Configuration options and data binding will be available here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(59, 130, 246, 0.3)'
          }}>
            <CardContent style={{ padding: '64px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '32px' }}>
                <TrendingUp style={{ width: '48px', height: '48px', color: '#3b82f6', opacity: 0.5 }} />
                <BarChart3 style={{ width: '48px', height: '48px', color: '#22c55e', opacity: 0.5 }} />
                <PieChart style={{ width: '48px', height: '48px', color: '#f59e0b', opacity: 0.5 }} />
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
                Select a Visualization Type
              </h2>

              <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
                Click the menu bar above to choose a visualization type and begin exploring your data.
                Each visualization offers different perspectives on your financial and carbon data.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
