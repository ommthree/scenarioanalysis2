import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  FileJson,
  Database,
  Activity,
  Cloud,
  List,
  BarChart3,
  Settings
} from 'lucide-react'
import { ReactNode } from 'react'

interface LayoutProps {
  children: ReactNode
  dbPath: string | null
  onChangeDb: () => void
}

export default function Layout({ children, dbPath, onChangeDb }: LayoutProps) {
  const location = useLocation()

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/scenarios', icon: List, label: 'Scenarios' },
    { path: '/templates', icon: FileJson, label: 'Templates' },
    { path: '/drivers', icon: Database, label: 'Drivers' },
    { path: '/actions', icon: Activity, label: 'Actions' },
    { path: '/physical-risk', icon: Cloud, label: 'Physical Risk' },
    { path: '/results', icon: BarChart3, label: 'Results' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">FinModel</h1>
          <p className="text-xs text-gray-500 mt-1 truncate" title={dbPath || ''}>
            {dbPath ? `📁 ${dbPath.split('/').pop()}` : 'No database'}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onChangeDb}
            className="flex items-center gap-3 px-3 py-2 w-full text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Change Database</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
