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
      className="bg-card border-2 border-border rounded-xl p-4 shadow-lg hover:shadow-xl hover:border-primary transition-all cursor-pointer group"
      style={{ width: '220px', height: '120px' }}
      onClick={data.onClick}
    >
      <Handle type="target" position={Position.Left} />
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
      <Handle type="source" position={Position.Right} />
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
    // Column 1 - Inputs
    {
      id: 'load-statements',
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        label: 'Load Statements',
        sublabel: 'Import + Map',
        icon: FileSpreadsheet,
        bgClass: 'bg-blue-500/10',
        ringClass: 'ring-blue-500/20',
        iconClass: 'text-blue-500',
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
        bgClass: 'bg-green-500/10',
        ringClass: 'ring-green-500/20',
        iconClass: 'text-green-500',
        onClick: () => handleNodeClick('/inputs/scenarios'),
      },
    },
    {
      id: 'load-damage',
      type: 'custom',
      position: { x: 0, y: 300 },
      data: {
        label: 'Load Damage Curves',
        sublabel: 'Import + Map',
        icon: Cloud,
        bgClass: 'bg-purple-500/10',
        ringClass: 'ring-purple-500/20',
        iconClass: 'text-purple-500',
        onClick: () => handleNodeClick('/inputs/damage-curves'),
      },
    },

    // Column 2 - Database
    {
      id: 'database',
      type: 'custom',
      position: { x: 350, y: 150 },
      data: {
        label: 'Database',
        sublabel: '',
        icon: Database,
        bgClass: 'bg-slate-500/10',
        ringClass: 'ring-slate-500/20',
        iconClass: 'text-slate-400',
        onClick: () => handleNodeClick('/data/database'),
      },
    },

    // Column 3 - Definitions/Processing
    {
      id: 'stmt-defs',
      type: 'custom',
      position: { x: 700, y: 0 },
      data: {
        label: 'Statement Definitions',
        sublabel: '',
        icon: FileJson,
        bgClass: 'bg-cyan-500/10',
        ringClass: 'ring-cyan-500/20',
        iconClass: 'text-cyan-500',
        onClick: () => handleNodeClick('/definitions/statements'),
      },
    },
    {
      id: 'scenario-split',
      type: 'custom',
      position: { x: 700, y: 150 },
      data: {
        label: 'Scenario Data',
        sublabel: '(unaffected)',
        icon: TrendingUp,
        bgClass: 'bg-green-400/10',
        ringClass: 'ring-green-400/20',
        iconClass: 'text-green-400',
        onClick: () => handleNodeClick('/inputs/scenarios'),
      },
    },
    {
      id: 'pre-calc',
      type: 'custom',
      position: { x: 700, y: 300 },
      data: {
        label: 'Pre-Calc',
        sublabel: 'Apply Damage',
        icon: Calculator,
        bgClass: 'bg-amber-500/10',
        ringClass: 'ring-amber-500/20',
        iconClass: 'text-amber-500',
        onClick: () => handleNodeClick('/run'),
      },
    },
    {
      id: 'actions',
      type: 'custom',
      position: { x: 700, y: 450 },
      data: {
        label: 'Actions',
        sublabel: 'Definitions',
        icon: Zap,
        bgClass: 'bg-yellow-500/10',
        ringClass: 'ring-yellow-500/20',
        iconClass: 'text-yellow-500',
        onClick: () => handleNodeClick('/definitions/actions'),
      },
    },

    // Column 4 - Calculation
    {
      id: 'calc-engine',
      type: 'custom',
      position: { x: 1050, y: 150 },
      data: {
        label: 'Calculation Engine',
        sublabel: '',
        icon: Calculator,
        bgClass: 'bg-orange-500/10',
        ringClass: 'ring-orange-500/20',
        iconClass: 'text-orange-500',
        onClick: () => handleNodeClick('/run/execute'),
      },
    },

    // Column 5 - Results
    {
      id: 'results',
      type: 'custom',
      position: { x: 1400, y: 150 },
      data: {
        label: 'Results',
        sublabel: '+ Audit Trail',
        icon: BarChart3,
        bgClass: 'bg-pink-500/10',
        ringClass: 'ring-pink-500/20',
        iconClass: 'text-pink-500',
        onClick: () => handleNodeClick('/results'),
      },
    },

    // Column 6 - Visualization
    {
      id: 'visualize',
      type: 'custom',
      position: { x: 1750, y: 150 },
      data: {
        label: 'Visualize',
        sublabel: 'Slice & Dice',
        icon: Eye,
        bgClass: 'bg-indigo-500/10',
        ringClass: 'ring-indigo-500/20',
        iconClass: 'text-indigo-500',
        onClick: () => handleNodeClick('/visualize'),
      },
    },
  ]

  const initialEdges: Edge[] = [
    { id: 'e1', type: 'smoothstep', source: 'load-statements', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e2', source: 'load-scenarios', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e3', source: 'load-damage', target: 'database', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e4', source: 'database', target: 'stmt-defs', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e5', source: 'database', target: 'scenario-split', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e6', source: 'database', target: 'pre-calc', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e7', source: 'database', target: 'actions', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e8', source: 'stmt-defs', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e9', source: 'scenario-split', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e10', source: 'pre-calc', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e11', source: 'actions', target: 'calc-engine', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e12', source: 'calc-engine', target: 'results', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
    { id: 'e13', source: 'results', target: 'visualize', animated: true, style: { stroke: '#3b82f6', strokeWidth: 4 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 25, height: 25 } },
  ]

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  return (
    <div className="h-full bg-background">
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
          markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 30, height: 30 },
        }}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 50, y: 50, zoom: 0.75 }}
        proOptions={{ hideAttribution: true }}
      >
        <Panel position="top-left" className="bg-card/90 backdrop-blur-sm p-4 rounded-lg border border-border shadow-lg">
          <h2 className="text-xl font-bold mb-1">Data Flow</h2>
          <p className="text-sm text-muted-foreground">Click nodes to navigate • Use mouse to pan & zoom</p>
        </Panel>
        <Background className="bg-muted" gap={16} />
        <Controls className="[&_button]:!bg-card [&_button]:!border-primary [&_button]:!text-primary [&_button:hover]:!bg-primary [&_button:hover]:!text-white shadow-lg" />
      </ReactFlow>
    </div>
  )
}
