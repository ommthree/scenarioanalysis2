import { LineChart, TrendingUp, BarChart3, PieChart } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export default function Explore() {
  return (
    <div style={{ padding: '48px', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <LineChart style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
            Explore
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
          Advanced visualization and data exploration tools
        </p>
      </div>

      {/* Coming Soon Card */}
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
            Coming Soon
          </h2>

          <p style={{ color: '#94a3b8', fontSize: '16px', maxWidth: '600px', margin: '0 auto' }}>
            Advanced data visualization and exploration features will be available here.
            This will include interactive charts, multi-scenario comparisons, trend analysis, and more.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
