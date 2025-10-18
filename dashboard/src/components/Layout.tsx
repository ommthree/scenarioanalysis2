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
  ChevronDown,
  ArrowRightLeft,
  Building2,
  Calculator,
  MapPin,
  CheckCircle2
} from 'lucide-react'
import { type ReactNode, useState, useEffect, useRef } from 'react'
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
  const prevPathnameRef = useRef(location.pathname)

  // Switch back to sidebar mode when location changes (navigation occurs)
  useEffect(() => {
    if (prevPathnameRef.current !== location.pathname) {
      setNavMode((currentMode) => {
        if (currentMode === 'flowchart') {
          return 'sidebar'
        }
        return currentMode
      })
      prevPathnameRef.current = location.pathname
    }
  }, [location.pathname])

  const navSections = [
    {
      title: 'Definitions',
      items: [
        { path: '/definitions/entities', icon: Building2, label: 'Entities' },
        { path: '/definitions/statements', icon: FileJson, label: 'Statements' },
        { path: '/definitions/scenarios', icon: Activity, label: 'Scenarios' },
        { path: '/definitions/actions', icon: Settings, label: 'Actions' },
      ]
    },
    {
      title: 'Inputs',
      items: [
        { path: '/inputs/statements', icon: FileJson, label: 'Load Statements' },
        { path: '/inputs/map-statements', icon: ArrowRightLeft, label: 'Map Statements' },
        { path: '/inputs/scenarios', icon: Activity, label: 'Load Scenarios' },
        { path: '/inputs/map-scenarios', icon: ArrowRightLeft, label: 'Map Scenarios' },
        { path: '/definitions/formulas', icon: Calculator, label: 'Formulas' },
        { path: '/definitions/validation', icon: CheckCircle2, label: 'Validation' },
        { path: '/inputs/locations', icon: MapPin, label: 'Load Locations' },
        { path: '/inputs/map-locations', icon: ArrowRightLeft, label: 'Map Locations' },
        { path: '/inputs/damage-curves', icon: Cloud, label: 'Load Damage Curves' },
        { path: '/inputs/map-damage-curves', icon: ArrowRightLeft, label: 'Map Damage Curves' },
      ]
    },
    {
      title: 'Data',
      items: [
        { path: '/data/database', icon: Database, label: 'Database' },
        { path: '/data/stored-calcs', icon: BarChart3, label: 'Stored Calcs' },
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
      {/* Enhanced Sidebar - Animated hide/show when flowchart is active */}
      <aside
        className="bg-card border-r border-border flex flex-col shadow-lg transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          width: navMode === 'sidebar' ? '320px' : '0px',
          minWidth: navMode === 'sidebar' ? '320px' : '0px',
          opacity: navMode === 'sidebar' ? 1 : 0,
        }}
      >
        <div className="flex flex-col h-full" style={{ width: '320px', minWidth: '320px' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div style={{ paddingLeft: '0.5rem', paddingRight: '0.5rem' }}>
            <h1 className="text-2xl font-bold text-foreground mb-2 whitespace-nowrap">Financial Statement Model</h1>
            <div className="flex items-center whitespace-nowrap" style={{ gap: '1rem' }}>
              <p className="text-xs text-muted-foreground" style={{ marginLeft: '0.5rem' }}>Scenario Analysis Dashboard</p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setNavMode(navMode === 'sidebar' ? 'flowchart' : 'sidebar')}
                className="h-6 px-2"
                style={{
                  backgroundColor: '#2563eb',
                  border: 'none',
                  boxShadow: 'none'
                }}
                title="Switch to Flowchart"
              >
                <GitBranch className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-6 py-4">
          <nav className="space-y-6" style={{ marginLeft: '8px' }}>
            {navSections.map((section, idx) => (
              <div key={section.title}>
                {idx > 0 && <Separator className="my-4" />}
                <div style={{ marginBottom: '-12px' }}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
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
                        className={`group flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm ${
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
                        <span className="ml-1">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 overflow-auto relative"
        style={{
          backgroundImage: 'url(/waves.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#0f172a'
        }}
      >
        {/* Logo - shown on all screens */}
        <img
          src="/logo3.png"
          alt="Logo"
          className="absolute z-50"
          style={{
            top: '1.5rem',
            right: '2rem',
            height: '70px',
            width: 'auto'
          }}
        />

        {navMode === 'flowchart' ? (
          <div className="h-full">
            {/* Floating button to return to sidebar */}
            <Button
              variant="default"
              size="icon"
              onClick={() => setNavMode('sidebar')}
              className="absolute z-50"
              style={{
                top: '1.5rem',
                left: '1.5rem',
                backgroundColor: '#2563eb',
                border: 'none',
                boxShadow: 'none'
              }}
              title="Back to Sidebar"
            >
              <Menu className="w-4 h-4" />
            </Button>
            <FlowchartNav onNavigate={() => setNavMode('sidebar')} />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
