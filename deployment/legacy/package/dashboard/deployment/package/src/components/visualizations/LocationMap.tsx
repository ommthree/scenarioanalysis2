import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

interface LocationPoint {
  lat: number
  lng: number
  label: string
}

interface LocationMapProps {
  locations: LocationPoint[]
  height?: string
  highlightedIndex?: number | null
}

// Component to fit map bounds to markers
function FitBounds({ locations }: { locations: LocationPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [locations, map])

  return null
}

// Component to pan to highlighted location
function PanToLocation({ location, highlightedIndex }: { location: LocationPoint | null, highlightedIndex: number | null }) {
  const map = useMap()

  useEffect(() => {
    if (location && highlightedIndex !== null) {
      map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 8), {
        duration: 0.8
      })
    }
  }, [location, highlightedIndex, map])

  return null
}

// Component to handle marker highlighting
function MarkerHighlighter({ highlightedIndex, markerRefs }: { highlightedIndex: number | null, markerRefs: React.MutableRefObject<(L.Marker | null)[]> }) {
  useEffect(() => {
    // Remove highlight from all markers
    markerRefs.current.forEach((marker) => {
      if (marker) {
        const element = marker.getElement()
        if (element) {
          element.classList.remove('highlighted-marker')
        }
      }
    })

    // Add highlight to selected marker
    if (highlightedIndex !== null && markerRefs.current[highlightedIndex]) {
      const marker = markerRefs.current[highlightedIndex]
      const element = marker?.getElement()
      if (element) {
        element.classList.add('highlighted-marker')
      }
    }
  }, [highlightedIndex, markerRefs])

  return null
}

export default function LocationMap({ locations, height = '500px', highlightedIndex = null }: LocationMapProps) {
  // Default center (world center)
  const defaultCenter: [number, number] = [20, 0]
  const defaultZoom = 2
  const markerRefs = useRef<(L.Marker | null)[]>([])

  const highlightedLocation = highlightedIndex !== null ? locations[highlightedIndex] : null

  return (
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

        {locations.map((location, idx) => (
          <Marker
            key={idx}
            position={[location.lat, location.lng]}
            ref={(ref) => {
              markerRefs.current[idx] = ref
            }}
          >
            <Popup>
              <div style={{ color: '#000' }}>
                <strong>{location.label}</strong>
                <br />
                Lat: {location.lat.toFixed(4)}°
                <br />
                Lng: {location.lng.toFixed(4)}°
              </div>
            </Popup>
          </Marker>
        ))}

        {locations.length > 0 && <FitBounds locations={locations} />}
        <PanToLocation location={highlightedLocation} highlightedIndex={highlightedIndex} />
        <MarkerHighlighter highlightedIndex={highlightedIndex} markerRefs={markerRefs} />
      </MapContainer>
    </div>
  )
}
