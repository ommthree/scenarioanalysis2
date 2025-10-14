import { useNavigate } from 'react-router-dom'
import {
  Database,
  FileSpreadsheet,
  TrendingUp,
  Cloud,
  FileJson,
  Zap,
  Calculator,
  BarChart3,
  Eye,
} from 'lucide-react'

interface FlowchartNode {
  id: string
  label: string
  sublabel?: string
  route: string
  icon: any
  color: string
  x: number
  y: number
}

export default function FlowchartNav() {
  const navigate = useNavigate()

  const nodes: FlowchartNode[] = [
    // Column 1 - Inputs
    { id: 'load-statements', label: 'Load Statements', sublabel: 'Import + Map', route: '/inputs/statements', icon: FileSpreadsheet, color: 'from-blue-400 to-blue-500', x: 0, y: 0 },
    { id: 'load-scenarios', label: 'Load Scenarios', sublabel: 'Import', route: '/inputs/scenarios', icon: TrendingUp, color: 'from-green-400 to-green-500', x: 0, y: 200 },
    { id: 'load-damage', label: 'Load Damage Curves', sublabel: 'Import + Map', route: '/inputs/damage-curves', icon: Cloud, color: 'from-purple-400 to-purple-500', x: 0, y: 400 },

    // Column 2 - Database
    { id: 'database', label: 'Database', sublabel: '', route: '/data/database', icon: Database, color: 'from-slate-400 to-slate-500', x: 350, y: 200 },

    // Column 3 - Definitions/Processing
    { id: 'stmt-defs', label: 'Statement Definitions', sublabel: '', route: '/definitions/statements', icon: FileJson, color: 'from-cyan-400 to-cyan-500', x: 700, y: 0 },
    { id: 'scenario-split', label: 'Scenario Data', sublabel: '(unaffected)', route: '/inputs/scenarios', icon: TrendingUp, color: 'from-green-300 to-green-400', x: 700, y: 150 },
    { id: 'pre-calc', label: 'Pre-Calc', sublabel: 'Apply Damage', route: '/run', icon: Calculator, color: 'from-amber-400 to-amber-500', x: 700, y: 300 },
    { id: 'actions', label: 'Actions', sublabel: 'Definitions', route: '/definitions/actions', icon: Zap, color: 'from-yellow-400 to-yellow-500', x: 700, y: 450 },

    // Column 4 - Calculation
    { id: 'calc-engine', label: 'Calculation Engine', sublabel: '', route: '/run/execute', icon: Calculator, color: 'from-orange-400 to-orange-500', x: 1050, y: 225 },

    // Column 5 - Results
    { id: 'results', label: 'Results', sublabel: '+ Audit Trail', route: '/results', icon: BarChart3, color: 'from-pink-400 to-pink-500', x: 1400, y: 225 },

    // Column 6 - Visualization
    { id: 'visualize', label: 'Visualize', sublabel: 'Slice & Dice', route: '/visualize', icon: Eye, color: 'from-indigo-400 to-indigo-500', x: 1750, y: 225 },
  ]

  const connections = [
    { from: 'load-statements', to: 'database' },
    { from: 'load-scenarios', to: 'database' },
    { from: 'load-damage', to: 'database' },
    { from: 'database', to: 'stmt-defs' },
    { from: 'database', to: 'scenario-split' },
    { from: 'database', to: 'pre-calc' },
    { from: 'database', to: 'actions' },
    { from: 'stmt-defs', to: 'calc-engine' },
    { from: 'scenario-split', to: 'calc-engine' },
    { from: 'pre-calc', to: 'calc-engine' },
    { from: 'actions', to: 'calc-engine' },
    { from: 'calc-engine', to: 'results' },
    { from: 'results', to: 'visualize' },
  ]

  return (
    <div className="h-full bg-slate-900 p-12 overflow-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Data Flow</h1>
        <p className="text-slate-400 mt-2 text-lg">Click any node to navigate to that section</p>
      </div>

      <div className="relative" style={{ width: '2000px', height: '700px' }}>
        {/* SVG for connections */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '2000px', height: '700px' }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
            >
              <polygon points="0 0, 8 4, 0 8" fill="#64748b" />
            </marker>
          </defs>

          {connections.map((conn, i) => {
            const fromNode = nodes.find(n => n.id === conn.from)
            const toNode = nodes.find(n => n.id === conn.to)
            if (!fromNode || !toNode) return null

            const x1 = fromNode.x + 200
            const y1 = fromNode.y + 75
            const x2 = toNode.x
            const y2 = toNode.y + 75

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#64748b"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const Icon = node.icon
          return (
            <button
              key={node.id}
              onClick={() => navigate(node.route)}
              className="absolute bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-slate-600 rounded-xl p-6 shadow-xl hover:border-blue-400 hover:shadow-2xl transition-all cursor-pointer"
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: '200px',
                height: '150px',
              }}
            >
              <div className="flex flex-col items-center text-center gap-3 h-full justify-center">
                <div className={`bg-gradient-to-br ${node.color} p-3 rounded-xl shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">
                    {node.label}
                  </div>
                  {node.sublabel && (
                    <div className="text-xs text-slate-300 mt-2">{node.sublabel}</div>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
