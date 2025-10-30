import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  ConnectionLineType,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
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
  Building2,
  CheckCircle2,
  Activity,
  MapPin,
  Map,
  PenTool,
  Play,
  Network,
  Shuffle,
  ArrowRightLeft,
  Save,
  LineChart,
  Menu,
} from 'lucide-react'

// Custom node component
interface FlowNodeData {
  icon: React.ComponentType
  label: string
  sublabel: string
  bgClass: string
  ringClass: string
  iconClass: string
  gradientBg: string
  onClick: () => void
}

function FlowNode({ data }: { data: FlowNodeData }) {
  const Icon = data.icon

  return (
    <div
      className="border-2 border-border rounded-xl p-4 shadow-lg hover:shadow-xl hover:border-primary transition-all cursor-pointer group"
      style={{
        width: '220px',
        height: '120px',
        background: data.gradientBg || 'var(--card)',
        backgroundColor: 'rgba(30, 41, 59, 0.9)'
      }}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} id="left" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} id="top" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
      <div className="h-full flex flex-col items-center justify-center text-center gap-3">
        <div>
          <Icon className={`w-7 h-7 ${data.iconClass}`} />
        </div>
        <div>
          <div className="text-base font-semibold leading-tight group-hover:text-primary transition-colors">
            {data.label}
          </div>
          {data.sublabel && (
            <div className="text-sm text-muted-foreground mt-0.5">{data.sublabel}</div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} id="top" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = {
  custom: FlowNode,
}

interface FlowchartNavProps {
  onNavigate?: () => void
  onMenuClick?: () => void
}

export default function FlowchartNav({ onNavigate, onMenuClick }: FlowchartNavProps = {}) {
  const navigate = useNavigate()

  const handleNodeClick = useCallback((route: string) => {
    navigate(route)
    onNavigate?.()
  }, [navigate, onNavigate])

  const onNodeClickHandler: NodeMouseHandler = useCallback((_event, node) => {
    if (node.data.onClick) {
      node.data.onClick()
    }
  }, [])

  const initialNodes: Node[] = [
    // Row 2, Column 1 - Statements (Define)
    {
      id: 'define-statements',
      type: 'custom',
      position: { x: 0, y: 140 },
      data: {
        label: 'Statements',
        sublabel: 'Define',
        icon: FileJson,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/definitions/statements'),
      },
    },
    // Row 3, Column 1 - Entities
    {
      id: 'define-entities',
      type: 'custom',
      position: { x: 0, y: 280 },
      data: {
        label: 'Entities',
        sublabel: 'Define',
        icon: Building2,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/definitions/entities'),
      },
    },
    // Row 4, Column 1 - Scenarios
    {
      id: 'define-scenarios',
      type: 'custom',
      position: { x: 0, y: 420 },
      data: {
        label: 'Scenarios',
        sublabel: 'Define',
        icon: Activity,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/definitions/scenarios'),
      },
    },

    // Row 1, Column 2 - Formulae
    {
      id: 'define-formulas',
      type: 'custom',
      position: { x: 250, y: 0 },
      data: {
        label: 'Formulae',
        sublabel: 'Define',
        icon: Calculator,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
        onClick: () => handleNodeClick('/definitions/formulas'),
      },
    },
    // Row 1, Column 2 - Validation
    {
      id: 'define-validation',
      type: 'custom',
      position: { x: 250, y: 0 },
      data: {
        label: 'Validation',
        sublabel: 'Define',
        icon: CheckCircle2,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
        onClick: () => handleNodeClick('/definitions/validation'),
      },
    },
    // Row 5, Column 2 - Actions
    {
      id: 'define-actions',
      type: 'custom',
      position: { x: 250, y: 560 },
      data: {
        label: 'Actions',
        sublabel: 'Define',
        icon: Zap,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
        onClick: () => handleNodeClick('/definitions/actions'),
      },
    },

    // Row 2, Column 3 - Load Statements
    {
      id: 'load-statements',
      type: 'custom',
      position: { x: 520, y: 140 },
      data: {
        label: 'Statements',
        sublabel: 'Load',
        icon: FileSpreadsheet,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/statements'),
      },
    },
    // Row 4, Column 3 - Load Scenarios
    {
      id: 'load-scenarios',
      type: 'custom',
      position: { x: 520, y: 420 },
      data: {
        label: 'Scenarios',
        sublabel: 'Load',
        icon: TrendingUp,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/scenarios'),
      },
    },
    // Row 5, Column 3 - Load Correlations
    {
      id: 'load-correlations',
      type: 'custom',
      position: { x: 520, y: 560 },
      data: {
        label: 'Correlations',
        sublabel: 'Load',
        icon: Network,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/correlation'),
      },
    },
    // Row 6, Column 3 - Load Conversions
    {
      id: 'load-conversions',
      type: 'custom',
      position: { x: 520, y: 700 },
      data: {
        label: 'Conversions',
        sublabel: 'Load',
        icon: Shuffle,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/conversions'),
      },
    },
    // Row 7, Column 3 - Load Hazard Maps
    {
      id: 'load-hazard-maps',
      type: 'custom',
      position: { x: 520, y: 840 },
      data: {
        label: 'Hazard Maps',
        sublabel: 'Load',
        icon: Map,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/hazard-maps'),
      },
    },
    // Row 8, Column 3 - Load Locations
    {
      id: 'load-locations',
      type: 'custom',
      position: { x: 520, y: 980 },
      data: {
        label: 'Locations',
        sublabel: 'Load',
        icon: MapPin,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/locations'),
      },
    },
    // Row 9, Column 3 - Load Damage Curves
    {
      id: 'load-damage-curves',
      type: 'custom',
      position: { x: 520, y: 1120 },
      data: {
        label: 'Damage Curves',
        sublabel: 'Load',
        icon: Cloud,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/inputs/damage-curves'),
      },
    },

    // Row 2, Column 4 - Map Statements
    {
      id: 'map-statements',
      type: 'custom',
      position: { x: 770, y: 140 },
      data: {
        label: 'Statements',
        sublabel: 'Map',
        icon: ArrowRightLeft,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/inputs/map-statements'),
      },
    },
    // Row 4, Column 4 - Map Scenarios
    {
      id: 'map-scenarios',
      type: 'custom',
      position: { x: 770, y: 420 },
      data: {
        label: 'Scenarios',
        sublabel: 'Map',
        icon: ArrowRightLeft,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/inputs/map-scenarios'),
      },
    },
    // Row 7, Column 4 - Map Hazard Maps
    {
      id: 'map-hazard-maps',
      type: 'custom',
      position: { x: 770, y: 840 },
      data: {
        label: 'Hazard Maps',
        sublabel: 'Map',
        icon: ArrowRightLeft,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/inputs/map-hazard-maps'),
      },
    },
    // Row 8, Column 4 - Map Locations
    {
      id: 'map-locations',
      type: 'custom',
      position: { x: 770, y: 980 },
      data: {
        label: 'Locations',
        sublabel: 'Map',
        icon: ArrowRightLeft,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/inputs/map-locations'),
      },
    },
    // Row 9, Column 4 - Map Damage Curves
    {
      id: 'map-damage-curves',
      type: 'custom',
      position: { x: 770, y: 1120 },
      data: {
        label: 'Damage Curves',
        sublabel: 'Map',
        icon: ArrowRightLeft,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/inputs/map-damage-curves'),
      },
    },

    // Row 5, Column 5 - Database
    {
      id: 'database',
      type: 'custom',
      position: { x: 1040, y: 560 },
      data: {
        label: 'Database',
        sublabel: '',
        icon: Database,
        bgClass: 'bg-emerald-500/10',
        ringClass: 'ring-emerald-500/20',
        iconClass: 'text-emerald-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
        onClick: () => handleNodeClick('/data/database'),
      },
    },
    // Row 7, Column 5 - Stored Runs
    {
      id: 'stored-runs',
      type: 'custom',
      position: { x: 1040, y: 840 },
      data: {
        label: 'Stored Runs',
        sublabel: '',
        icon: Save,
        bgClass: 'bg-emerald-500/10',
        ringClass: 'ring-emerald-500/20',
        iconClass: 'text-emerald-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.3))',
        onClick: () => handleNodeClick('/data/stored-calcs'),
      },
    },

    // Row 3, Column 6 - Run Definition
    {
      id: 'run-definition',
      type: 'custom',
      position: { x: 1310, y: 280 },
      data: {
        label: 'Run Definition',
        sublabel: '',
        icon: PenTool,
        bgClass: 'bg-amber-500/10',
        ringClass: 'ring-amber-500/20',
        iconClass: 'text-amber-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))',
        onClick: () => handleNodeClick('/run/definition'),
      },
    },
    // Row 5, Column 6 - Run Calc
    {
      id: 'run-calc',
      type: 'custom',
      position: { x: 1310, y: 560 },
      data: {
        label: 'Run Calc',
        sublabel: '',
        icon: Play,
        bgClass: 'bg-amber-500/10',
        ringClass: 'ring-amber-500/20',
        iconClass: 'text-amber-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))',
        onClick: () => handleNodeClick('/run/execute'),
      },
    },

    // Row 5, Column 7 - Results
    {
      id: 'results',
      type: 'custom',
      position: { x: 1580, y: 560 },
      data: {
        label: 'Results',
        sublabel: '',
        icon: BarChart3,
        bgClass: 'bg-orange-500/10',
        ringClass: 'ring-orange-500/20',
        iconClass: 'text-orange-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.3))',
        onClick: () => handleNodeClick('/visualize'),
      },
    },

    // Row 5, Column 8 - Explore
    {
      id: 'explore',
      type: 'custom',
      position: { x: 1850, y: 560 },
      data: {
        label: 'Explore',
        sublabel: '',
        icon: LineChart,
        bgClass: 'bg-pink-500/10',
        ringClass: 'ring-pink-500/20',
        iconClass: 'text-pink-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.3))',
        onClick: () => handleNodeClick('/explore'),
      },
    },
  ]

  const initialEdges: Edge[] = [
    // Col 1 Entities + Col 2 Formulas + Validation merge with Statements from Col 1, flow to Load Statements in Col 3
    { id: 'e0', source: 'define-entities', target: 'load-statements', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e1', source: 'define-formulas', target: 'load-statements', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e2', source: 'define-validation', target: 'load-statements', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e3', source: 'define-statements', target: 'load-statements', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 2 Actions merge with Scenarios from Col 1, flow to Load Scenarios in Col 3
    { id: 'e4', source: 'define-actions', target: 'load-scenarios', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e5', source: 'define-scenarios', target: 'load-scenarios', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 3 Load to Col 4 Map
    { id: 'e6', source: 'load-statements', target: 'map-statements', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e7', source: 'load-scenarios', target: 'map-scenarios', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e8', source: 'load-hazard-maps', target: 'map-hazard-maps', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e9', source: 'load-locations', target: 'map-locations', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e10', source: 'load-damage-curves', target: 'map-damage-curves', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 3 Correlations & Conversions go straight to Database (skip mapping)
    { id: 'e11', source: 'load-correlations', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e12', source: 'load-conversions', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 4 Map to Col 5 Database
    { id: 'e13', source: 'map-statements', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e14', source: 'map-scenarios', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e15', source: 'map-hazard-maps', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e16', source: 'map-locations', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
    { id: 'e17', source: 'map-damage-curves', target: 'database', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 5 Stored Runs (below) flows UP to Database (above) using top/bottom handles (straight vertical line)
    { id: 'e18', source: 'stored-runs', sourceHandle: 'top', target: 'database', targetHandle: 'bottom', type: 'smoothstep', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 5 Database to Col 6 Run Calc
    { id: 'e19', source: 'database', target: 'run-calc', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 6 Run Definition flows down to Run Calc using top/bottom handles (straight vertical line)
    { id: 'e20', source: 'run-definition', sourceHandle: 'bottom', target: 'run-calc', targetHandle: 'top', type: 'smoothstep', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 6 Run Calc to Col 7 Results
    { id: 'e21', source: 'run-calc', target: 'results', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },

    // Col 7 Results to Col 8 Explore
    { id: 'e22', source: 'results', target: 'explore', animated: true, style: { stroke: '#f97316', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' } },
  ]

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Force reset nodes on mount
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [])

  return (
    <div className="h-full" style={{ backgroundColor: 'transparent' }}>
      <style>{`
        .react-flow__edge.animated path {
          stroke: #f97316 !important;
          stroke-dasharray: 12 6;
          animation: dashdraw 2s linear infinite;
        }
        @keyframes dashdraw {
          to {
            stroke-dashoffset: -18;
          }
        }
        .react-flow__edge-path {
          stroke: #f97316 !important;
        }
        .react-flow__edge marker {
          animation: none !important;
          animation-play-state: paused !important;
        }
        .react-flow__edge marker path {
          animation: none !important;
          animation-play-state: paused !important;
          fill: #f97316 !important;
        }
      `}</style>
      <ReactFlow
        key="flowchart-v5-grid"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#f97316', strokeWidth: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f97316' },
        }}
        defaultViewport={{ x: 50, y: 50, zoom: 0.6 }}
        minZoom={0.3}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 0.8, duration: 600 }}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left" className="bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-lg" style={{ padding: '0.75rem 1.5rem' }}>
          <h2 className="text-xl font-bold mb-1">Data Flow</h2>
          <p className="text-sm text-muted-foreground">Click nodes to navigate • Use mouse to pan & zoom</p>
        </Panel>
        <Background color="transparent" gap={20} style={{ backgroundColor: 'transparent' }} />
        <Controls showInteractive={false} className="[&_button]:!bg-card [&_button]:!border-primary [&_button]:!text-primary [&_button:hover]:!bg-primary [&_button:hover]:!text-white shadow-lg" />
      </ReactFlow>
    </div>
  )
}
