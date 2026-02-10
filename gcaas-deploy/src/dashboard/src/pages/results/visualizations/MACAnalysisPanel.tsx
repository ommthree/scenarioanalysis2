import { useEffect, useState } from 'react'
import { Leaf, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import ViewResults from '../ViewResults'

export default function MACAnalysisPanel() {
  const [lastRunMode, setLastRunMode] = useState<{ whatIfMode: boolean } | null>(null)

  useEffect(() => {
    // Load last run mode from localStorage
    const saved = localStorage.getItem('lastRunMode')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setLastRunMode(parsed)

        // Auto-enable MAC mode
        localStorage.setItem('macModeActive', 'true')
      } catch (err) {
        console.error('Failed to load last run mode:', err)
      }
    }
  }, [])

  // Show message if not in what-if mode
  if (lastRunMode !== null && !lastRunMode.whatIfMode) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', padding: '48px' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(34, 197, 94, 0.5)' }}>
          <CardContent style={{ padding: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <Leaf style={{ width: '32px', height: '32px', color: '#22c55e' }} />
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
                MAC (Marginal Abatement Cost) Analysis
              </h2>
            </div>

            <div style={{
              padding: '32px',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              border: '2px solid rgba(251, 191, 36, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '16px'
            }}>
              <AlertCircle style={{ width: '24px', height: '24px', color: '#fbbf24', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h3 style={{ color: '#fbbf24', fontSize: '18px', fontWeight: '600', marginBottom: '12px', margin: 0 }}>
                  What-If Mode Required
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '12px 0 0 0' }}>
                  MAC (Marginal Abatement Cost) analysis requires calculations to be run in <strong>What-If Mode</strong>.
                  This mode evaluates individual management actions to calculate their carbon abatement and cost-effectiveness.
                </p>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', marginTop: '12px' }}>
                  To view MAC analysis:
                </p>
                <ol style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.8', marginTop: '8px', paddingLeft: '20px' }}>
                  <li>Go to <strong>Perform Calculation</strong></li>
                  <li>Select a scenario</li>
                  <li>Enable <strong>What-If Mode</strong></li>
                  <li>Select management actions to evaluate</li>
                  <li>Run the calculation</li>
                  <li>Return here to view the MAC curve</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <div style={{ padding: '48px', paddingBottom: '24px' }}>
        <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(34, 197, 94, 0.5)' }}>
          <CardContent style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <Leaf style={{ width: '32px', height: '32px', color: '#22c55e' }} />
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
                MAC (Marginal Abatement Cost) Analysis
              </h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>
              Cost-effectiveness analysis of decarbonization actions. Shows $/tCO₂e for each management action.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Embed full ViewResults component */}
      <div style={{ padding: '0 48px 48px 48px' }}>
        <ViewResults />
      </div>
    </div>
  )
}
