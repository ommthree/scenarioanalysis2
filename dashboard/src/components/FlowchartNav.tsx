import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  MiniMap,
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
} from 'lucide-react'

// Custom node component
function FlowNode({ data }: { data: any }) {
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
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="h-full flex flex-col items-center justify-center text-center gap-2">
        <div className={`rounded-lg ${data.bgClass} p-2 ring-1 ${data.ringClass}`}>
          <Icon className={`w-5 h-5 ${data.iconClass}`} />
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors">
            {data.label}
          </div>
          {data.sublabel && (
            <div className="text-xs text-muted-foreground mt-0.5">{data.sublabel}</div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = {
  custom: FlowNode,
}

export default function FlowchartNav() {
  const navigate = useNavigate()

  const handleNodeClick = useCallback((route: string) => {
    navigate(route)
  }, [navigate])

  const initialNodes: Node[] = [
    // Column 1 - Inputs (Import) - Blue (cool)
    {
      id: 'load-statements',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'Load Statements',
        sublabel: 'Import',
        icon: FileSpreadsheet,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/inputs/statements'),
      },
    },
    {
      id: 'load-scenarios',
      type: 'custom',
      position: { x: 0, y: 150 },
      data: {
        label: 'Load Scenarios',
        sublabel: 'Import',
        icon: TrendingUp,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/inputs/scenarios'),
      },
    },
    {
      id: 'load-damage',
      type: 'custom',
      position: { x: 0, y: 300 },
      data: {
        label: 'Load Damage Curves',
        sublabel: 'Import',
        icon: Cloud,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.3))',
        onClick: () => handleNodeClick('/inputs/damage-curves'),
      },
    },

    // Column 1.5 - Mapping - Cyan
    {
      id: 'map-statements',
      type: 'custom',
      position: { x: 270, y: 0 },
      data: {
        label: 'Map Statements',
        sublabel: 'Fields',
        icon: FileSpreadsheet,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
        onClick: () => handleNodeClick('/inputs/statements'),
      },
    },
    {
      id: 'map-damage',
      type: 'custom',
      position: { x: 270, y: 300 },
      data: {
        label: 'Map Damage Curves',
        sublabel: 'Fields',
        icon: Cloud,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(6, 182, 212, 0.2), rgba(14, 165, 233, 0.3))',
        onClick: () => handleNodeClick('/inputs/damage-curves'),
      },
    },

    // Column 2 - Database - Teal (transition)
    {
      id: 'database',
      type: 'custom',
      position: { x: 580, y: 150 },
      data: {
        label: 'Database',
        sublabel: '',
        icon: Database,
        bgClass: 'bg-teal-500/10',
        ringClass: 'ring-teal-500/20',
        iconClass: 'text-teal-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(20, 184, 166, 0.2), rgba(13, 148, 136, 0.3))',
        onClick: () => handleNodeClick('/data/database'),
      },
    },

    // Column 3 - Definitions/Processing - Green (middle)
    {
      id: 'stmt-defs',
      type: 'custom',
      position: { x: 890, y: 0 },
      data: {
        label: 'Statement Definitions',
        sublabel: '',
        icon: FileJson,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/definitions/statements'),
      },
    },
    {
      id: 'pre-calc',
      type: 'custom',
      position: { x: 890, y: 300 },
      data: {
        label: 'Pre-Calc',
        sublabel: 'Apply Damage',
        icon: Calculator,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/run'),
      },
    },
    {
      id: 'actions',
      type: 'custom',
      position: { x: 890, y: 450 },
      data: {
        label: 'Actions',
        sublabel: 'Definitions',
        icon: Zap,
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.3))',
        onClick: () => handleNodeClick('/definitions/actions'),
      },
    },

    // Column 4 - Calculation - Amber (warm)
    {
      id: 'calc-engine',
      type: 'custom',
      position: { x: 1200, y: 150 },
      data: {
        label: 'Calculation Engine',
        sublabel: '',
        icon: Calculator,
        bgClass: 'bg-amber-500/10',
        ringClass: 'ring-amber-500/20',
        iconClass: 'text-amber-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.3))',
        onClick: () => handleNodeClick('/run/execute'),
      },
    },

    // Column 5 - Results - Orange
    {
      id: 'results',
      type: 'custom',
      position: { x: 1510, y: 150 },
      data: {
        label: 'Results',
        sublabel: '+ Audit Trail',
        icon: BarChart3,
        bgClass: 'bg-orange-500/10',
        ringClass: 'ring-orange-500/20',
        iconClass: 'text-orange-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.3))',
        onClick: () => handleNodeClick('/results'),
      },
    },

    // Column 6 - Visualization - Pink (outputs)
    {
      id: 'visualize',
      type: 'custom',
      position: { x: 1820, y: 150 },
      data: {
        label: 'Visualize',
        sublabel: 'Slice & Dice',
        icon: Eye,
        bgClass: 'bg-pink-500/10',
        ringClass: 'ring-pink-500/20',
        iconClass: 'text-pink-500',
        gradientBg: 'linear-gradient(to bottom right, rgba(236, 72, 153, 0.2), rgba(219, 39, 119, 0.3))',
        onClick: () => handleNodeClick('/visualize'),
      },
    },
  ]

  const initialEdges: Edge[] = [
    // Load to Map
    { id: 'e1', type: 'smoothstep', source: 'load-statements', target: 'map-statements', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e2', type: 'smoothstep', source: 'load-damage', target: 'map-damage', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },

    // Map to Database
    { id: 'e3', source: 'map-statements', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e4', source: 'load-scenarios', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e5', source: 'map-damage', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },

    // Database to Processing
    { id: 'e6', source: 'database', target: 'stmt-defs', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e7', source: 'database', target: 'pre-calc', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e8', source: 'database', target: 'actions', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },

    // Scenarios pass through (direct line from database to calc-engine at y=150)
    { id: 'e9', source: 'database', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },

    // Processing to Calc Engine
    { id: 'e10', source: 'stmt-defs', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e11', source: 'pre-calc', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e12', source: 'actions', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },

    // Calc to Results to Visualize
    { id: 'e13', source: 'calc-engine', target: 'results', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
    { id: 'e14', source: 'results', target: 'visualize', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } },
  ]

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="h-full" style={{ backgroundColor: 'transparent' }}>
      <style>{`
        .react-flow__edge.animated path {
          stroke-dasharray: 5;
          animation: dashdraw 0.5s linear infinite;
        }
        @keyframes dashdraw {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#3b82f6', strokeWidth: 4 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
        }}
        defaultViewport={{ x: 80, y: 280, zoom: 0.65 }}
        minZoom={0.4}
        maxZoom={1.8}
        fitViewOptions={{ padding: 0.1, maxZoom: 1.2, duration: 600 }}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left" className="bg-card/90 backdrop-blur-sm rounded-lg border border-border shadow-lg" style={{ padding: '1.5rem' }}>
          <h2 className="text-xl font-bold mb-1">Data Flow</h2>
          <p className="text-sm text-muted-foreground">Click nodes to navigate • Use mouse to pan & zoom</p>
        </Panel>
        <Background color="transparent" gap={20} style={{ backgroundColor: 'transparent' }} />
        <Controls showInteractive={false} className="[&_button]:!bg-card [&_button]:!border-primary [&_button]:!text-primary [&_button:hover]:!bg-primary [&_button:hover]:!text-white shadow-lg" />
      </ReactFlow>
    </div>
  )
}
