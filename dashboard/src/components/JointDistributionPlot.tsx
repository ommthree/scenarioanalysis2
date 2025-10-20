import { useEffect, useRef } from 'react'
import Plot from 'react-plotly.js'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { X } from 'lucide-react'

interface JointDistributionPlotProps {
  isOpen: boolean
  onClose: () => void
  variable1: string
  variable2: string
  correlation: number
}

// Generate bivariate normal distribution PDF
function bivariateNormalPDF(x: number, y: number, rho: number): number {
  const coefficient = 1 / (2 * Math.PI * Math.sqrt(1 - rho * rho))
  const exponent = -1 / (2 * (1 - rho * rho)) * (x * x - 2 * rho * x * y + y * y)
  return coefficient * Math.exp(exponent)
}

export default function JointDistributionPlot({
  isOpen,
  onClose,
  variable1,
  variable2,
  correlation
}: JointDistributionPlotProps) {
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-6xl h-[90vh]"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.98)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px'
        }}
      >
        <DialogHeader>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <DialogTitle className="text-xl font-semibold" style={{ color: '#ffffff' }}>
              Joint Distribution: {variable1} × {variable2}
            </DialogTitle>
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                borderRadius: '6px',
                border: 'none',
                background: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = '#ef4444'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#94a3b8'
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground" style={{ marginTop: '8px' }}>
            Correlation: {correlation.toFixed(3)} | Bivariate Normal Distribution
          </p>
        </DialogHeader>

        <div style={{
          height: 'calc(100% - 80px)',
          width: '100%',
          marginTop: '16px'
        }}>
          <Plot
            data={[
              {
                type: 'surface',
                x,
                y,
                z,
                colorscale: [
                  [0, 'rgb(5, 10, 172)'],
                  [0.35, 'rgb(106, 137, 247)'],
                  [0.5, 'rgb(190, 190, 190)'],
                  [0.6, 'rgb(220, 170, 132)'],
                  [0.7, 'rgb(230, 145, 90)'],
                  [1, 'rgb(178, 10, 28)']
                ],
                contours: {
                  z: {
                    show: true,
                    usecolormap: true,
                    highlightcolor: 'limegreen',
                    project: { z: true }
                  }
                },
                opacity: 0.95
              }
            ]}
            layout={{
              autosize: true,
              scene: {
                xaxis: {
                  title: variable1,
                  gridcolor: 'rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8'
                },
                yaxis: {
                  title: variable2,
                  gridcolor: 'rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8'
                },
                zaxis: {
                  title: 'Probability Density',
                  gridcolor: 'rgba(255, 255, 255, 0.1)',
                  color: '#94a3b8'
                },
                camera: {
                  eye: { x: 1.5, y: 1.5, z: 1.3 }
                },
                bgcolor: 'rgba(15, 23, 42, 0.5)'
              },
              paper_bgcolor: 'rgba(15, 23, 42, 0)',
              plot_bgcolor: 'rgba(15, 23, 42, 0)',
              font: {
                color: '#ffffff',
                size: 12
              },
              margin: { l: 0, r: 0, t: 20, b: 0 },
              showlegend: false
            }}
            config={{
              responsive: true,
              displayModeBar: true,
              displaylogo: false,
              modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'lasso2d', 'select2d']
            }}
            style={{ width: '100%', height: '100%' }}
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
      </DialogContent>
    </Dialog>
  )
}
