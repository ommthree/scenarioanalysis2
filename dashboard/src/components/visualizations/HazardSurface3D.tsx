import { useEffect, useRef, useState } from 'react'

// Declare Plotly for the reset camera button
declare const Plotly: any

interface HazardPoint {
  lat: number
  lng: number
  intensity: number
  label: string
}

interface EntityLocation {
  entity_id: number
  entity_code: string
  entity_name: string
  lat: number
  lng: number
}

interface HazardSurface3DProps {
  points: HazardPoint[]
  entityLocations?: EntityLocation[]
  height?: string
}

export default function HazardSurface3D({ points, entityLocations = [], height = '600px' }: HazardSurface3DProps) {
  const plotRef = useRef<any>(null)
  const [isClient, setIsClient] = useState(false)
  const [Plot, setPlot] = useState<any>(null)
  const [mapImageData, setMapImageData] = useState<number[][] | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    setIsClient(true)
    // Dynamically import Plot only on client side
    import('react-plotly.js').then((module) => {
      setPlot(() => module.default)
    }).catch((err) => {
      console.error('Failed to load Plotly:', err)
    })
  }, [])

  // Fetch and process map tiles when points change
  useEffect(() => {
    if (!isClient || points.length === 0) return

    const fetchMapTiles = async () => {
      try {
        const lats = points.map(p => p.lat)
        const lngs = points.map(p => p.lng)
        const minLat = Math.min(...lats)
        const maxLat = Math.max(...lats)
        const minLng = Math.min(...lngs)
        const maxLng = Math.max(...lngs)

        // Get unique lat/lng for grid dimensions
        const uniqueLats = [...new Set(lats)].sort((a, b) => b - a)
        const uniqueLngs = [...new Set(lngs)].sort((a, b) => a - b)
        const gridRows = uniqueLats.length
        const gridCols = uniqueLngs.length

        console.log('Grid dimensions:', gridRows, 'x', gridCols)
        console.log('Bounds:', minLat, maxLat, minLng, maxLng)

        // Calculate zoom level for the entire region
        // For a region spanning ~36° lat and ~50° lng, zoom 3-4 would be appropriate
        const latDiff = maxLat - minLat  // 36 degrees
        const lngDiff = maxLng - minLng  // ~50 degrees

        // Better zoom calculation: aim for ~10-20 degrees per tile at 256px
        // At zoom level z, each tile covers 360/2^z degrees
        // We want tiles to be reasonably sized, so aim for zoom 3-4
        const zoom = 3  // Fixed zoom for Europe - each tile = 45 degrees

        // Calculate tile range covering the entire bounding box
        const minTileX = Math.floor((minLng + 180) / 360 * Math.pow(2, zoom))
        const maxTileX = Math.floor((maxLng + 180) / 360 * Math.pow(2, zoom))
        const minTileY = Math.floor((1 - Math.log(Math.tan(maxLat * Math.PI / 180) + 1 / Math.cos(maxLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))
        const maxTileY = Math.floor((1 - Math.log(Math.tan(minLat * Math.PI / 180) + 1 / Math.cos(minLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))

        const tilesX = maxTileX - minTileX + 1
        const tilesY = maxTileY - minTileY + 1

        console.log(`Fetching ${tilesX}x${tilesY} tiles at zoom ${zoom}`)
        console.log(`Tile X range: ${minTileX} to ${maxTileX}`)
        console.log(`Tile Y range: ${minTileY} to ${maxTileY}`)

        // Calculate what geographic area each tile actually covers
        const tileDegreesLng = 360 / Math.pow(2, zoom)
        const tileCoverageMinLng = (minTileX * tileDegreesLng) - 180
        const tileCoverageMaxLng = ((maxTileX + 1) * tileDegreesLng) - 180
        console.log(`Tiles will cover lng: ${tileCoverageMinLng} to ${tileCoverageMaxLng} (data: ${minLng} to ${maxLng})`)

        // Create canvas for stitched map
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = tilesX * 256
        canvas.height = tilesY * 256

        // Load and stitch tiles
        let tilesLoaded = 0
        const totalTiles = tilesX * tilesY

        for (let tx = minTileX; tx <= maxTileX; tx++) {
          for (let ty = minTileY; ty <= maxTileY; ty++) {
            const img = new Image()
            img.crossOrigin = 'anonymous'

            img.onload = () => {
              const x = (tx - minTileX) * 256
              const y = (ty - minTileY) * 256
              ctx.drawImage(img, x, y)

              tilesLoaded++
              if (tilesLoaded === totalTiles) {
                // All tiles loaded, process the stitched image
                console.log('All tiles loaded, processing...')
                console.log('Grid dimensions available:', gridRows, 'x', gridCols)
                console.log('uniqueLats length:', uniqueLats.length, 'uniqueLngs length:', uniqueLngs.length)
                console.log('First 3 lats:', uniqueLats.slice(0, 3))
                console.log('First 3 lngs:', uniqueLngs.slice(0, 3))

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const data = imageData.data
                console.log('Image data loaded, length:', data.length)

                const matrix: number[][] = []

                console.log('Starting grid iteration...')
                for (let i = 0; i < gridRows; i++) {
                  const row: number[] = []
                  for (let j = 0; j < gridCols; j++) {
                    // Map data coordinates to tile coordinates
                    const dataLat = uniqueLats[i]
                    const dataLng = uniqueLngs[j]

                    // Calculate position within the tile canvas
                    const lngFraction = (dataLng - tileCoverageMinLng) / (tileCoverageMaxLng - tileCoverageMinLng)
                    const imgX = Math.floor(lngFraction * canvas.width)

                    // For latitude, use Web Mercator projection
                    // Convert lat to tile Y coordinate at the given zoom level
                    const latToTileY = (lat: number, zoom: number) => {
                      const latRad = lat * Math.PI / 180
                      return (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom)
                    }

                    const dataY = latToTileY(dataLat, zoom)
                    const minY = latToTileY(maxLat, zoom) // maxLat gives minY (inverted)
                    const maxY = latToTileY(minLat, zoom) // minLat gives maxY

                    // Map to pixel coordinates within the stitched canvas
                    const imgY = Math.floor(((dataY - minTileY) * 256))

                    // Debug first sample in detail
                    if (i === 0 && j === 0) {
                      console.log('=== First sample debug ===')
                      console.log('dataLat:', dataLat, 'dataLng:', dataLng)
                      console.log('lngFraction:', lngFraction, 'imgX:', imgX)
                      console.log('dataY:', dataY, 'minTileY:', minTileY, 'imgY:', imgY)
                      console.log('canvas:', canvas.width, 'x', canvas.height)
                      console.log('tileCoverageMinLng:', tileCoverageMinLng, 'tileCoverageMaxLng:', tileCoverageMaxLng)
                    }

                    // Clamp to canvas bounds
                    const clampedX = Math.max(0, Math.min(canvas.width - 1, imgX))
                    const clampedY = Math.max(0, Math.min(canvas.height - 1, imgY))
                    const idx = (clampedY * canvas.width + clampedX) * 4

                    const r = data[idx]
                    const g = data[idx + 1]
                    const b = data[idx + 2]
                    const grayscale = (0.299 * r + 0.587 * g + 0.114 * b) / 255

                    if (i === 0 && j === 0) {
                      console.log('r:', r, 'g:', g, 'b:', b, 'grayscale:', grayscale)
                    }

                    row.push(grayscale)
                  }
                  matrix.push(row)

                  // Debug progress every 50 rows
                  if (i % 50 === 0) {
                    console.log(`Processed ${i}/${gridRows} rows...`)
                  }
                }

                console.log('Map matrix created:', matrix.length, 'x', matrix[0]?.length)
                console.log('Sample values from first row:', matrix[0]?.slice(0, 5))
                console.log('Sample values from last row:', matrix[matrix.length - 1]?.slice(0, 5))
                setMapImageData(matrix)
                console.log('setMapImageData called')
              }
            }

            img.onerror = () => {
              console.error(`Failed to load tile ${zoom}/${tx}/${ty}`)
              tilesLoaded++
            }

            img.src = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`
          }
        }
      } catch (error) {
        console.error('Error fetching map tiles:', error)
      }
    }

    fetchMapTiles()
  }, [isClient, points])

  if (!isClient || !Plot) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <p style={{ color: '#94a3b8' }}>Loading 3D visualization...</p>
      </div>
    )
  }

  if (points.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <p style={{ color: '#94a3b8' }}>No hazard data available</p>
      </div>
    )
  }

  // Create grid for surface plot
  const createGridData = () => {
    // Extract unique lat/lng values and sort them
    const lats = [...new Set(points.map(p => p.lat))].sort((a, b) => b - a) // Descending for surface plot
    const lngs = [...new Set(points.map(p => p.lng))].sort((a, b) => a - b)

    // Create a map for quick lookup
    const dataMap = new Map<string, number>()
    points.forEach(p => {
      const key = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`
      dataMap.set(key, p.intensity)
    })

    // Build Z matrix (intensity values)
    const z: number[][] = []
    for (let i = 0; i < lats.length; i++) {
      const row: number[] = []
      for (let j = 0; j < lngs.length; j++) {
        const key = `${lats[i].toFixed(6)},${lngs[j].toFixed(6)}`
        const intensity = dataMap.get(key)
        row.push(intensity !== undefined ? intensity : NaN)
      }
      z.push(row)
    }

    return { x: lngs, y: lats, z }
  }

  let x: number[], y: number[], z: number[][]
  try {
    const gridData = createGridData()
    x = gridData.x
    y = gridData.y
    z = gridData.z
  } catch (error) {
    console.error('Error creating grid data:', error)
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <p style={{ color: '#ef4444' }}>Error processing hazard data</p>
      </div>
    )
  }

  // Calculate intensity range for color scale
  const flatZ = z.flat().filter(v => !isNaN(v))
  if (flatZ.length === 0) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: '8px',
        border: '1px solid rgba(59, 130, 246, 0.3)'
      }}>
        <p style={{ color: '#94a3b8' }}>No valid hazard intensity data</p>
      </div>
    )
  }
  const minIntensity = Math.min(...flatZ)
  const maxIntensity = Math.max(...flatZ)

  // Calculate geographic bounds for map
  const minLat = Math.min(...y)
  const maxLat = Math.max(...y)
  const minLng = Math.min(...x)
  const maxLng = Math.max(...x)

  // Create flat base surface at minimum intensity for map projection
  const intensityRange = maxIntensity - minIntensity
  const baseZ = z.map(row => row.map(() => minIntensity - intensityRange * 0.2))

  // Create second flat surface even lower for the actual map layer
  const mapZ = z.map(row => row.map(() => minIntensity - intensityRange * 0.35))

  // Create entity location markers (if any)
  const entityMarkers = entityLocations.length > 0 ? {
    type: 'scatter3d',
    mode: 'markers+text',
    x: entityLocations.map(e => e.lng),
    y: entityLocations.map(e => e.lat),
    z: entityLocations.map(e => {
      // Find z value at this location (or slightly above max intensity)
      const xIdx = x.findIndex(val => Math.abs(val - e.lng) < 0.5)
      const yIdx = y.findIndex(val => Math.abs(val - e.lat) < 0.5)
      if (xIdx >= 0 && yIdx >= 0 && !isNaN(z[yIdx][xIdx])) {
        return z[yIdx][xIdx] * 1.1 // 10% above surface
      }
      return maxIntensity * 1.1 // Default to above max
    }),
    marker: {
      size: 8,
      color: 'rgba(236, 72, 153, 0.9)',
      symbol: 'diamond',
      line: {
        color: 'rgba(255, 255, 255, 0.8)',
        width: 2
      }
    },
    text: entityLocations.map(e => e.entity_code),
    textposition: 'top center',
    textfont: {
      size: 10,
      color: '#fff',
      family: 'Arial, sans-serif'
    },
    hovertemplate: '<b>%{text}</b><br>' +
                   'Lat: %{y:.4f}<br>' +
                   'Lng: %{x:.4f}<br>' +
                   '<extra></extra>',
    showlegend: false
  } : null

  return (
    <div style={{
      height,
      width: '100%',
      backgroundColor: 'transparent',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <Plot
        ref={plotRef}
        data={[
          ...(entityMarkers ? [entityMarkers] : []),
          // Bottom layer: Geographic map base
          {
            type: 'surface',
            x: x,
            y: y,
            z: mapZ,
            opacity: 1.0,
            colorscale: [
              [0, 'rgba(34, 139, 34, 1)'],         // Forest green - land
              [0.2, 'rgba(107, 142, 35, 1)'],      // Olive green - hills
              [0.35, 'rgba(210, 180, 140, 1)'],    // Tan - plains
              [0.45, 'rgba(244, 164, 96, 1)'],     // Sandy brown - deserts
              [0.55, 'rgba(139, 69, 19, 1)'],      // Saddle brown - mountains
              [0.7, 'rgba(70, 130, 180, 1)'],      // Steel blue - coastal
              [0.85, 'rgba(30, 144, 255, 1)'],     // Dodger blue - shallow water
              [1, 'rgba(0, 0, 139, 1)']            // Dark blue - deep ocean
            ],
            showscale: false,
            hoverinfo: 'skip',
            contours: {
              x: {
                show: true,
                highlight: false,
                highlightwidth: 0,
                color: 'rgba(60, 60, 60, 0.3)',
                width: 1
              },
              y: {
                show: true,
                highlight: false,
                highlightwidth: 0,
                color: 'rgba(60, 60, 60, 0.3)',
                width: 1
              },
              z: { show: false, highlight: false, highlightwidth: 0 }
            },
            lighting: {
              ambient: 0.9,
              diffuse: 0.3,
              specular: 0.1,
              roughness: 0.8,
              fresnel: 0.2
            },
            surfacecolor: mapImageData || Array(y.length).fill(0).map((_, i) =>
              Array(x.length).fill(0).map((_, j) => {
                // Fallback: Create realistic geographic terrain pattern
                const lat = y[i]
                const lng = x[j]
                // Multiple layers of noise for realistic terrain
                const terrain = Math.sin(lat * 3) * 0.25 +
                               Math.cos(lng * 4) * 0.25 +
                               Math.sin(lat * 8 + lng * 6) * 0.15 +
                               Math.sin(lat * 15 - lng * 12) * 0.1 +
                               0.5
                return Math.max(0, Math.min(1, terrain))
              })
            )
          },
          // Middle layer: Shadow/projection surface
          {
            type: 'surface',
            x: x,
            y: y,
            z: baseZ,
            opacity: 0.3,
            colorscale: [[0, 'rgba(100, 100, 100, 0.2)'], [1, 'rgba(100, 100, 100, 0.2)']],
            showscale: false,
            hoverinfo: 'skip',
            contours: {
              x: { show: false, highlight: false, highlightwidth: 0 },
              y: { show: false, highlight: false, highlightwidth: 0 },
              z: { show: false, highlight: false, highlightwidth: 0 }
            },
            lighting: {
              ambient: 1,
              diffuse: 0,
              specular: 0,
              roughness: 1,
              fresnel: 0
            }
          },
          // Hazard intensity surface
          {
            type: 'surface',
            x: x,
            y: y,
            z: z,
            opacity: 0.5,
            colorscale: [
              [0, 'rgba(34, 197, 94, 0.7)'],      // Green - low intensity
              [0.25, 'rgba(234, 179, 8, 0.7)'],   // Yellow
              [0.5, 'rgba(249, 115, 22, 0.7)'],   // Orange
              [0.75, 'rgba(239, 68, 68, 0.7)'],   // Red
              [1, 'rgba(153, 27, 27, 0.7)']       // Dark red - high intensity
            ],
            colorbar: {
              title: {
                text: 'Intensity',
                font: {
                  color: '#fff',
                  size: 14
                }
              },
              tickfont: {
                color: '#fff'
              },
              thickness: 20,
              len: 0.7,
              x: 1.02
            },
            contours: {
              x: { show: false, highlight: false, highlightwidth: 0 },
              y: { show: false, highlight: false, highlightwidth: 0 },
              z: { show: false, highlight: false, highlightwidth: 0 }
            },
            lighting: {
              ambient: 0.8,
              diffuse: 0.5,
              specular: 0.3,
              roughness: 0.5,
              fresnel: 0.2
            },
            hovertemplate: '<b>Lat:</b> %{y:.4f}<br><b>Lng:</b> %{x:.4f}<br><b>Intensity:</b> %{z:.2f}<extra></extra>',
            hidesurface: false
          }
        ]}
        layout={{
          autosize: true,
          paper_bgcolor: 'rgba(0, 0, 0, 0)',
          plot_bgcolor: 'rgba(0, 0, 0, 0)',
          margin: { l: 0, r: 80, t: 40, b: 0 },
          scene: {
            xaxis: {
              title: {
                text: 'Longitude',
                font: { color: '#fff', size: 12 }
              },
              gridcolor: 'rgba(255, 255, 255, 0.3)',
              showbackground: true,
              backgroundcolor: 'rgba(0, 0, 0, 0)',
              tickfont: { color: '#fff' },
              showspikes: false,
              spikesides: false,
              spikecolor: 'rgba(0,0,0,0)',
              spikethickness: 0
            },
            yaxis: {
              title: {
                text: 'Latitude',
                font: { color: '#fff', size: 12 }
              },
              gridcolor: 'rgba(255, 255, 255, 0.3)',
              showbackground: true,
              backgroundcolor: 'rgba(0, 0, 0, 0)',
              tickfont: { color: '#fff' },
              showspikes: false,
              spikesides: false,
              spikecolor: 'rgba(0,0,0,0)',
              spikethickness: 0
            },
            zaxis: {
              title: {
                text: 'Hazard Intensity',
                font: { color: '#fff', size: 12 }
              },
              gridcolor: 'rgba(255, 255, 255, 0.3)',
              showbackground: true,
              backgroundcolor: 'rgba(0, 0, 0, 0)',
              tickfont: { color: '#fff' },
              showspikes: false,
              spikesides: false,
              spikecolor: 'rgba(0,0,0,0)',
              spikethickness: 0
            },
            camera: {
              eye: { x: 1.2, y: 1.2, z: 1.1 },
              center: { x: 0, y: 0, z: -0.1 },
              up: { x: 0, y: 0, z: 1 }
            },
            aspectmode: 'manual',
            aspectratio: { x: 1, y: 1, z: 0.5 }
          },
          hovermode: 'closest',
          title: {
            text: '3D Hazard Surface Visualization',
            font: {
              color: '#fff',
              size: 18
            },
            x: 0.5,
            xanchor: 'center'
          }
        }}
        config={{
          displayModeBar: true,
          modeBarButtonsToRemove: ['toImage'],
          modeBarButtonsToAdd: [
            {
              name: 'Reset Camera',
              icon: {
                width: 500,
                height: 600,
                path: 'M250,100 L400,250 L250,400 L250,300 Q150,300 150,200 Q150,100 250,100 Z',
                transform: 'matrix(1 0 0 -1 0 500)'
              },
              click: function(gd: any) {
                const update = {
                  'scene.camera': {
                    eye: { x: 1.2, y: 1.2, z: 1.1 },
                    center: { x: 0, y: 0, z: -0.1 },
                    up: { x: 0, y: 0, z: 1 }
                  }
                }
                //@ts-ignore
                Plotly.relayout(gd, update)
              }
            }
          ],
          displaylogo: false,
          responsive: true,
          staticPlot: false
        }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler={true}
      />
    </div>
  )
}
