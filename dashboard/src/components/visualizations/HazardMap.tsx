import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface HazardPoint {
  lat: number
  lng: number
  intensity: number
  label: string
}

interface HazardMapProps {
  points: HazardPoint[]
  pinnedPoints?: HazardPoint[]
  height?: string
}

// Create custom pin icon
const pinIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Color interpolation function
function getColorForValue(value: number, min: number, max: number): string {
  const normalized = (value - min) / (max - min)

  if (normalized < 0.25) {
    const t = normalized / 0.25
    return `rgba(${Math.round(34 + (234 - 34) * t)}, ${Math.round(197 + (171 - 197) * t)}, ${Math.round(94 + (8 - 94) * t)}, 0.7)`
  } else if (normalized < 0.5) {
    const t = (normalized - 0.25) / 0.25
    return `rgba(${Math.round(234 + (249 - 234) * t)}, ${Math.round(171 + (115 - 171) * t)}, ${Math.round(8 + (22 - 8) * t)}, 0.7)`
  } else if (normalized < 0.75) {
    const t = (normalized - 0.5) / 0.25
    return `rgba(${Math.round(249 + (239 - 249) * t)}, ${Math.round(115 + (68 - 115) * t)}, ${Math.round(22 + (68 - 22) * t)}, 0.7)`
  } else {
    const t = (normalized - 0.75) / 0.25
    return `rgba(${Math.round(239 + (185 - 239) * t)}, ${Math.round(68 - 68 * t)}, ${Math.round(68 - 68 * t)}, 0.7)`
  }
}

// Component to render continuous grid overlay
function GridHeatmapLayer({ points }: { points: HazardPoint[] }) {
  const map = useMap()
  const overlayRef = useRef<L.ImageOverlay | null>(null)
  const hasInitializedRef = useRef(false)

  useEffect(() => {
    console.log('GridHeatmapLayer: starting with', points.length, 'points')

    if (points.length === 0) {
      console.log('GridHeatmapLayer: no points')
      return
    }

    // Find data bounds
    const lats = points.map(p => p.lat)
    const lngs = points.map(p => p.lng)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const intensities = points.map(p => p.intensity)
    const minIntensity = Math.min(...intensities)
    const maxIntensity = Math.max(...intensities)

    console.log('GridHeatmap: bounds', { minLat, maxLat, minLng, maxLng })
    console.log('GridHeatmap: intensity', { minIntensity, maxIntensity })
    console.log('GridHeatmap: first 5 points', points.slice(0, 5))

    // Create a grid lookup map - use actual coordinates as keys
    const gridMap = new Map<string, number>()

    points.forEach(p => {
      // Round to 2 decimal places to match our grid
      const key = `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`
      gridMap.set(key, p.intensity)
    })

    console.log('GridHeatmap: gridMap size', gridMap.size)
    console.log('GridHeatmap: sample keys', Array.from(gridMap.keys()).slice(0, 10))

    // Create canvas
    const canvas = document.createElement('canvas')
    const latRange = maxLat - minLat
    const lngRange = maxLng - minLng
    const gridSize = 0.09 // Match actual data resolution

    // Canvas resolution: one pixel per grid cell
    canvas.width = Math.ceil(lngRange / gridSize) + 1
    canvas.height = Math.ceil(latRange / gridSize) + 1

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    console.log('GridHeatmap: canvas size', canvas.width, canvas.height)

    // Draw grid cells
    let cellsDrawn = 0
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const lat = maxLat - (y * gridSize)
        const lng = minLng + (x * gridSize)
        const key = `${lat.toFixed(2)},${lng.toFixed(2)}`

        const intensity = gridMap.get(key)
        if (intensity !== undefined) {
          ctx.fillStyle = getColorForValue(intensity, minIntensity, maxIntensity)
          ctx.fillRect(x, y, 1, 1)
          cellsDrawn++
        }
      }
    }

    console.log('GridHeatmap: cells drawn', cellsDrawn, 'out of', canvas.width * canvas.height)
    console.log('GridHeatmap: sample lookup attempts:', [
      `${maxLat.toFixed(2)},${minLng.toFixed(2)}`,
      gridMap.get(`${maxLat.toFixed(2)},${minLng.toFixed(2)}`),
      `${(maxLat - gridSize).toFixed(2)},${minLng.toFixed(2)}`,
      gridMap.get(`${(maxLat - gridSize).toFixed(2)},${minLng.toFixed(2)}`)
    ])

    console.log('GridHeatmap: cells drawn', cellsDrawn, 'out of', canvas.width * canvas.height)

    // Create image overlay
    const imageUrl = canvas.toDataURL()
    const bounds: L.LatLngBoundsExpression = [[minLat, minLng], [maxLat, maxLng]]

    console.log('GridHeatmap: creating overlay with bounds', bounds)
    console.log('GridHeatmap: image URL length', imageUrl.length)

    const overlay = L.imageOverlay(imageUrl, bounds, {
      opacity: 0.7,
      interactive: false
    })

    console.log('GridHeatmap: adding overlay to map')
    overlay.addTo(map)
    overlayRef.current = overlay

    console.log('GridHeatmap: overlay added successfully')

    // Only fit bounds on initial load, not on subsequent updates
    if (!hasInitializedRef.current) {
      map.fitBounds(bounds, { padding: [50, 50] })
      hasInitializedRef.current = true
    }

    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current)
      }
    }
  }, [points, map])

  return null
}

export default function HazardMap({ points, pinnedPoints = [], height = '500px' }: HazardMapProps) {
  const defaultCenter: [number, number] = [50, 10] // Center on Europe
  const defaultZoom = 4

  // Calculate min/max intensity for legend
  const intensities = points.map(p => p.intensity)
  const minIntensity = Math.min(...intensities, 0)
  const maxIntensity = Math.max(...intensities, 1)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {points.length > 0 && <GridHeatmapLayer points={points} />}

          {/* Render pinned points as markers */}
          {pinnedPoints.map((point, idx) => (
            <Marker
              key={idx}
              position={[point.lat, point.lng]}
              icon={pinIcon}
            >
              <Popup>
                <div style={{ color: '#000' }}>
                  <strong>{point.label}</strong>
                  <br />
                  Lat: {point.lat.toFixed(4)}, Lng: {point.lng.toFixed(4)}
                  <br />
                  Intensity: {point.intensity.toFixed(2)}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        padding: '12px 16px',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#000' }}>
          Intensity
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#22c55e', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '11px', color: '#000' }}>Low ({minIntensity.toFixed(1)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#f97316', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '11px', color: '#000' }}>Medium ({((minIntensity + maxIntensity) / 2).toFixed(1)})</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '20px', height: '12px', backgroundColor: '#b91c1c', borderRadius: '2px' }}></div>
            <span style={{ fontSize: '11px', color: '#000' }}>High ({maxIntensity.toFixed(1)})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
