import Plot from 'react-plotly.js'
import { Card, CardContent } from '@/components/ui/card'

interface JointDistributionPanelProps {
  variable1: string
  variable2: string
  correlation: number
  onClose: () => void
}

// Generate bivariate normal distribution PDF
function bivariateNormalPDF(x: number, y: number, rho: number): number {
  const coefficient = 1 / (2 * Math.PI * Math.sqrt(1 - rho * rho))
  const exponent = -1 / (2 * (1 - rho * rho)) * (x * x - 2 * rho * x * y + y * y)
  return coefficient * Math.exp(exponent)
}

export default function JointDistributionPanel({
  variable1,
  variable2,
  correlation,
  onClose: _onClose
}: JointDistributionPanelProps) {
  // Generate mesh grid for surface plot
  const generateSurfaceData = () => {
    const gridSize = 50
    const range = 3 // +/- 3 standard deviations
    const step = (2 * range) / (gridSize - 1)

    const x: number[] = []
    const y: number[] = []
    const z: number[][] = []

    // Generate x and y arrays
    for (let i = 0; i < gridSize; i++) {
      x.push(-range + i * step)
      y.push(-range + i * step)
    }

    // Generate z values (PDF heights)
    for (let i = 0; i < gridSize; i++) {
      const row: number[] = []
      for (let j = 0; j < gridSize; j++) {
        row.push(bivariateNormalPDF(x[j], y[i], correlation))
      }
      z.push(row)
    }

    return { x, y, z }
  }

  const { x, y, z } = generateSurfaceData()

  return (
    <Card className="border-2" style={{ width: '90%', maxWidth: '1200px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
      <CardContent className="p-8">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', marginLeft: '1.5rem', marginRight: '1.5rem' }}>
          <div>
            <h3 className="text-xl font-semibold" style={{ color: '#ffffff' }}>
              Joint Distribution: {variable1} × {variable2}
            </h3>
            <p className="text-sm text-muted-foreground" style={{ marginTop: '8px' }}>
              Correlation: {correlation.toFixed(3)} | Bivariate Normal Distribution
            </p>
          </div>
        </div>

        <div style={{
          height: '600px',
          width: '100%',
          marginTop: '16px'
        }}>
          <Plot
            data={[
              {
                type: 'surface',
                x: x,
                y: y,
                z: z,
                colorscale: 'Jet',
                showscale: true,
                hovertemplate:
                  '<b>%{xaxis.title.text}</b>: %{x:.2f}<br>' +
                  '<b>%{yaxis.title.text}</b>: %{y:.2f}<br>' +
                  '<b>Density</b>: %{z:.4f}<extra></extra>',
                contours: {
                  z: {
                    show: true,
                    usecolormap: true,
                    project: { z: true },
                    width: 2
                  }
                }
              } as any
            ]}
            layout={{
              width: undefined,
              height: undefined,
              autosize: true,
              scene: {
                xaxis: {
                  title: { text: variable1 },
                  gridcolor: 'rgba(255, 255, 255, 0.2)',
                  showbackground: true,
                  backgroundcolor: 'rgba(15, 23, 42, 0.5)'
                },
                yaxis: {
                  title: { text: variable2 },
                  gridcolor: 'rgba(255, 255, 255, 0.2)',
                  showbackground: true,
                  backgroundcolor: 'rgba(15, 23, 42, 0.5)'
                },
                zaxis: {
                  title: { text: 'Probability Density' },
                  gridcolor: 'rgba(255, 255, 255, 0.2)',
                  showbackground: true,
                  backgroundcolor: 'rgba(15, 23, 42, 0.5)'
                },
                camera: {
                  eye: { x: 1.5, y: 1.5, z: 1.3 }
                },
                bgcolor: 'rgba(15, 23, 42, 0.8)'
              },
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              font: {
                color: '#ffffff',
                size: 12
              },
              margin: { l: 0, r: 0, t: 0, b: 0 }
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'lasso2d', 'select2d']
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler={true}
          />
        </div>

        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          marginTop: '12px'
        }}>
          <p className="text-xs text-muted-foreground">
            💡 <strong>Tip:</strong> Click and drag to rotate the 3D surface. Scroll to zoom.
            The surface height represents the joint probability density for each combination of {variable1} and {variable2} values.
            {correlation > 0 && ' Positive correlation creates an elongated ridge along the diagonal.'}
            {correlation < 0 && ' Negative correlation creates an elongated ridge along the anti-diagonal.'}
            {correlation === 0 && ' Zero correlation creates a symmetric, circular distribution.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
