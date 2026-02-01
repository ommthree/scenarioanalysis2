import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface CountryImpact {
  country: string
  impact: number
}

interface CountryChoroplethMapProps {
  countries: CountryImpact[]
  height?: string
  color: string
  onCountryClick?: (country: string) => void
  selectedCountry?: string | null
}

interface FitBoundsProps {
  geoData: any
  impactMap: Map<string, number>
}

function FitBounds({ geoData, impactMap }: FitBoundsProps) {
  const map = useMap()

  useEffect(() => {
    if (!geoData || impactMap.size === 0) {
      map.setView([20, 0], 2)
      return
    }

    // Find all features with data
    const featuresWithData = geoData.features.filter((feature: any) => {
      const countryName = (feature.properties.ADMIN || feature.properties.name || '').toLowerCase()
      return impactMap.has(countryName)
    })

    if (featuresWithData.length === 0) {
      map.setView([20, 0], 2)
      return
    }

    // Calculate bounding box
    const bounds = L.latLngBounds([])
    featuresWithData.forEach((feature: any) => {
      const layer = L.geoJSON(feature)
      bounds.extend(layer.getBounds())
    })

    // Fit map to bounds with padding
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 6 })
  }, [map, geoData, impactMap])

  return null
}

export default function CountryChoroplethMap({
  countries,
  height = '250px',
  color,
  onCountryClick,
  selectedCountry
}: CountryChoroplethMapProps) {
  const [geoData, setGeoData] = useState<any>(null)

  useEffect(() => {
    // Load world countries GeoJSON from CDN
    fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
      .then(res => res.json())
      .then(data => setGeoData(data))
      .catch(err => console.error('Failed to load country GeoJSON:', err))
  }, [])

  // Create impact lookup map
  const impactMap = new Map(countries.map(c => [c.country.toLowerCase(), c.impact]))

  // Calculate min and max for dynamic scaling (fit to data range)
  const impacts = countries.map(c => c.impact).filter(i => i !== 0)
  const minImpact = impacts.length > 0 ? Math.min(...impacts) : 0
  const maxImpact = impacts.length > 0 ? Math.max(...impacts) : 1

  // Separate positive and negative values for independent scaling
  const positiveImpacts = impacts.filter(i => i > 0)
  const negativeImpacts = impacts.filter(i => i < 0)
  const minPositive = positiveImpacts.length > 0 ? Math.min(...positiveImpacts) : 0
  const maxPositive = positiveImpacts.length > 0 ? Math.max(...positiveImpacts) : 1
  const minNegative = negativeImpacts.length > 0 ? Math.min(...negativeImpacts) : -1
  const maxNegative = negativeImpacts.length > 0 ? Math.max(...negativeImpacts) : 0

  const getColor = (impact: number) => {
    if (impact === 0) {
      return 'rgba(148, 163, 184, 0.3)' // Gray for zero
    }

    // Dynamic scale: map impact to opacity range [0.3, 0.95] based on data range
    let normalizedValue
    if (impact < 0) {
      // Negative values: scale from minNegative to maxNegative
      const range = Math.abs(minNegative - maxNegative)
      normalizedValue = range !== 0 ? (impact - maxNegative) / (minNegative - maxNegative) : 1
      const opacity = 0.3 + (normalizedValue * 0.65)
      return `rgba(239, 68, 68, ${opacity})` // Red for negative
    } else {
      // Positive values: scale from minPositive to maxPositive
      const range = maxPositive - minPositive
      normalizedValue = range !== 0 ? (impact - minPositive) / range : 1
      const opacity = 0.3 + (normalizedValue * 0.65)
      return `rgba(34, 197, 94, ${opacity})` // Green for positive
    }
  }

  const style = (feature: any) => {
    const countryName = (feature.properties.ADMIN || feature.properties.name || '').toLowerCase()
    const impact = impactMap.get(countryName) || 0
    const isSelected = selectedCountry?.toLowerCase() === countryName

    return {
      fillColor: getColor(impact),
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? color : '#fff',
      fillOpacity: impact !== 0 ? 0.7 : 0.2
    }
  }

  const onEachFeature = (feature: any, layer: any) => {
    const countryName = feature.properties.ADMIN || feature.properties.name || ''
    const impact = impactMap.get(countryName.toLowerCase())

    layer.on({
      mouseover: (e: any) => {
        const layer = e.target
        layer.setStyle({
          weight: 3,
          opacity: 1
        })
      },
      mouseout: (e: any) => {
        const layer = e.target
        const isSelected = selectedCountry?.toLowerCase() === countryName.toLowerCase()
        layer.setStyle({
          weight: isSelected ? 3 : 1
        })
      },
      click: () => {
        if (onCountryClick) {
          onCountryClick(countryName)
        }
      }
    })

    if (impact !== undefined) {
      const formattedImpact = Math.abs(impact) >= 1e9
        ? (impact / 1e9).toFixed(2) + 'B'
        : Math.abs(impact) >= 1e6
        ? (impact / 1e6).toFixed(2) + 'M'
        : Math.abs(impact) >= 1e3
        ? (impact / 1e3).toFixed(2) + 'K'
        : impact.toFixed(2)

      layer.bindPopup(`
        <div style="padding: 8px;">
          <strong>${countryName}</strong><br/>
          Impact: ${formattedImpact}
        </div>
      `)
    }
  }

  return (
    <div style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
      <MapContainer
        style={{ height: '100%', width: '100%' }}
        zoom={2}
        center={[20, 0]}
        scrollWheelZoom={false}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds geoData={geoData} impactMap={impactMap} />
        {geoData && (
          <GeoJSON
            key={JSON.stringify(countries) + selectedCountry}
            data={geoData}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  )
}
