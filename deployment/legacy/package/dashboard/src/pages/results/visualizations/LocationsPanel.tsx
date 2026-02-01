import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import LocationMap from '@/components/visualizations/LocationMap'

export default function LocationsPanel() {
  // Sample location points for demonstration
  const sampleLocations = [
    { lat: 40.7128, lng: -74.0060, label: 'New York Office' },
    { lat: 34.0522, lng: -118.2437, label: 'Los Angeles Office' },
    { lat: 41.8781, lng: -87.6298, label: 'Chicago Office' },
    { lat: 29.7604, lng: -95.3698, label: 'Houston Office' },
    { lat: 33.4484, lng: -112.0740, label: 'Phoenix Office' },
    { lat: 39.7392, lng: -104.9903, label: 'Denver Office' }
  ]

  return (
    <div style={{ padding: '48px', minHeight: '100vh', backgroundColor: '#0f172a' }}>
      <Card style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '24px' }}>
        <CardContent style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <MapPin style={{ width: '32px', height: '32px', color: '#06b6d4' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', margin: 0 }}>
              Locations & Exposures
            </h2>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Map view of entity locations with exposure values and risk profiles.
          </p>
        </CardContent>
      </Card>

      <div style={{ padding: '0 48px 48px 48px' }}>
        <LocationMap locations={sampleLocations} height="600px" />
      </div>
    </div>
  )
}
