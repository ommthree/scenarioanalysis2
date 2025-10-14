import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  FileJson,
  Database,
  Activity,
  Cloud,
  List,
  BarChart3,
  Settings,
  GitBranch,
  Menu
} from 'lucide-react'
import { ReactNode, useState } from 'react'
// import FlowchartNav from './FlowchartNav'

interface LayoutProps {
  children: ReactNode
  dbPath: string | null
  onChangeDb: () => void
}

type NavigationMode = 'sidebar' | 'flowchart'

export default function Layout({ children, dbPath, onChangeDb }: LayoutProps) {
  const location = useLocation()
  const [navMode, setNavMode] = useState<NavigationMode>('sidebar')

  const navSections = [
    {
      title: 'Data',
      items: [
        { path: '/data/database', icon: Database, label: 'Database' },
        { path: '/data/stored-calcs', icon: BarChart3, label: 'Stored Calcs' },
      ]
    },
    {
      title: 'Inputs',
      items: [
        { path: '/inputs/statements', icon: FileJson, label: 'Statements' },
        { path: '/inputs/scenarios', icon: List, label: 'Scenarios' },
        { path: '/inputs/damage-curves', icon: Cloud, label: 'Damage Curves' },
      ]
    },
    {
      title: 'Definitions',
      items: [
        { path: '/definitions/statements', icon: FileJson, label: 'Statements' },
        { path: '/definitions/actions', icon: Activity, label: 'Actions' },
      ]
    },
    {
      title: 'Run',
      items: [
        { path: '/run/definition', icon: Settings, label: 'Definition' },
        { path: '/run/execute', icon: Home, label: 'Do Run' },
        { path: '/run/open', icon: List, label: 'Open Prior Run' },
      ]
    },
    {
      title: 'Visualise',
      items: [
        { path: '/visualize', icon: BarChart3, label: 'Results' },
      ]
    },
  ]

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-2 rounded-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-white">FinModel</h1>
            </div>
            <button
              onClick={() => setNavMode(navMode === 'sidebar' ? 'flowchart' : 'sidebar')}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
              title={navMode === 'sidebar' ? 'Switch to Flowchart' : 'Switch to Sidebar'}
            >
              {navMode === 'sidebar' ? <GitBranch className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-xs text-slate-400 truncate font-mono bg-slate-900 px-2 py-1 rounded" title={dbPath || ''}>
            {dbPath ? `${dbPath.split('/').pop()}` : 'No database'}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="text-xs font-semibold text-slate-500 uppercase px-3 mb-3">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm ${
                        isActive
                          ? 'bg-blue-600 text-white font-medium'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={onChangeDb}
            className="flex items-center gap-3 px-3 py-2.5 w-full text-slate-400 hover:bg-slate-700 hover:text-white rounded-lg transition-all"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Change Database</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-900">
        {navMode === 'flowchart' ? (
          <div className="h-full p-8">
            <h1 className="text-white text-2xl">Flowchart coming soon</h1>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
