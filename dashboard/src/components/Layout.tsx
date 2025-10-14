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
  Menu,
  ChevronDown
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import FlowchartNav from './FlowchartNav'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

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
    <div className="flex h-screen bg-background">
      {/* Enhanced Sidebar */}
      <aside className="w-72 bg-card border-r border-border flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-primary to-blue-700 p-2.5 rounded-lg shadow-md">
                <Database className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">FinModel</h1>
                <p className="text-xs text-muted-foreground">Analysis Dashboard</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNavMode(navMode === 'sidebar' ? 'flowchart' : 'sidebar')}
              className="text-muted-foreground hover:text-foreground hover:bg-accent"
              title={navMode === 'sidebar' ? 'Switch to Flowchart' : 'Switch to Sidebar'}
            >
              {navMode === 'sidebar' ? <GitBranch className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>

          {/* Database Info */}
          <div className="bg-muted/50 rounded-lg p-3 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Active Database</p>
            <p className="text-xs font-mono text-foreground truncate" title={dbPath || ''}>
              {dbPath ? dbPath.split('/').pop() : 'No database'}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-4 py-4">
          <nav className="space-y-6">
            {navSections.map((section, idx) => (
              <div key={section.title}>
                {idx > 0 && <Separator className="my-4" />}
                <div className="mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                    {section.title}
                  </h3>
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                          isActive
                            ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <div className={`p-1.5 rounded-md ${
                          isActive
                            ? 'bg-primary-foreground/10'
                            : 'bg-muted group-hover:bg-muted-foreground/10'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span>{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={onChangeDb}
            className="w-full justify-start gap-3 hover:bg-accent"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Change Database</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        {navMode === 'flowchart' ? (
          <div className="h-full">
            <FlowchartNav />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
