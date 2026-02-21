import { Link, useLocation } from 'react-router-dom'
import {
  FileJson,
  Database,
  Activity,
  BarChart3,
  Settings,
  GitBranch,
  Menu,
  ArrowRightLeft,
  Building2,
  Calculator,
  MapPin,
  CheckCircle2,
  Map,
  Play,
  PenTool,
  TrendingUp,
  Save,
  Network,
  Shuffle,
  LineChart,
  FileText,
  LogOut,
  User,
  Shield
} from 'lucide-react'
import { type ReactNode, useState, useEffect, useRef } from 'react'
import FlowchartNav from './FlowchartNav'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/context/AuthContext'

interface LayoutProps {
  children: ReactNode
  dbPath: string | null
  onChangeDb: () => void
}

type NavigationMode = 'sidebar' | 'flowchart'

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuth()
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
        { path: '/definitions/formulas', icon: Calculator, label: 'Formulae' },
        { path: '/definitions/validation', icon: CheckCircle2, label: 'Validation' },
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
        { path: '/inputs/correlation', icon: Network, label: 'Correlation' },
        { path: '/inputs/conversions', icon: Shuffle, label: 'Conversions' },
      ]
    },
    {
      title: 'Physical Risk',
      items: [
        { path: '/inputs/hazard-maps', icon: Map, label: 'Load Hazard Maps' },
        { path: '/inputs/map-hazard-maps', icon: ArrowRightLeft, label: 'Map Hazard Maps' },
        { path: '/inputs/locations', icon: MapPin, label: 'Load Locations' },
        { path: '/inputs/map-locations', icon: ArrowRightLeft, label: 'Map Locations' },
        { path: '/inputs/damage-curves', icon: TrendingUp, label: 'Load Damage Curves' },
        { path: '/inputs/map-damage-curves', icon: ArrowRightLeft, label: 'Map Damage Curves' },
      ]
    },
    {
      title: 'Data',
      items: [
        { path: '/data/database', icon: Database, label: 'Database' },
        { path: '/data/stored-calcs', icon: Save, label: 'Stored Calcs' },
      ]
    },
    {
      title: 'Run',
      items: [
        { path: '/run/definition', icon: PenTool, label: 'Definition' },
        { path: '/run/execute', icon: Play, label: 'Perform Calculation' },
        { path: '/visualize', icon: BarChart3, label: 'View Results' },
      ]
    },
    {
      title: 'Visualise',
      items: [
        { path: '/explore', icon: LineChart, label: 'Explore' },
        { path: '/report', icon: FileText, label: 'Report' },
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
            <Link
              to="/"
              style={{ textDecoration: 'none' }}
              onMouseEnter={(e) => {
                const h1 = e.currentTarget.querySelector('h1')
                if (h1) h1.style.color = '#3b82f6'
              }}
              onMouseLeave={(e) => {
                const h1 = e.currentTarget.querySelector('h1')
                if (h1) h1.style.color = ''
              }}
            >
              <h1 className="text-2xl font-bold text-foreground mb-2 whitespace-nowrap transition-colors" style={{ cursor: 'pointer' }}>
                Financial Statement Model
              </h1>
            </Link>
            {/* Button row with Flowchart View, Logout, and Admin Panel */}
            <div style={{ display: 'flex', gap: '8px', marginLeft: '0.5rem' }}>
              <Button
                variant="default"
                size="sm"
                onClick={() => setNavMode(navMode === 'sidebar' ? 'flowchart' : 'sidebar')}
                className="h-6 px-3 transition-all flex items-center whitespace-nowrap"
                style={{
                  backgroundColor: '#2563eb',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1d4ed8'
                  e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
                title="Switch to Flowchart View"
              >
                <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Flowchart View</span>
                <GitBranch className="w-3.5 h-3.5" />
              </Button>

              {user && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => logout()}
                    className="h-6 px-3 transition-all flex items-center whitespace-nowrap"
                    style={{
                      backgroundColor: '#2563eb',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1d4ed8'
                      e.currentTarget.style.transform = 'scale(1.02)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563eb'
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Logout</span>
                  </Button>

                  {user.role === 'admin' && (
                    <Link to="/admin/users">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-6 px-3 transition-all flex items-center whitespace-nowrap"
                        style={{
                          backgroundColor: '#2563eb',
                          border: 'none',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          gap: '8px'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#1d4ed8'
                          e.currentTarget.style.transform = 'scale(1.02)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#2563eb'
                          e.currentTarget.style.transform = 'scale(1)'
                        }}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>Admin</span>
                      </Button>
                    </Link>
                  )}
                </>
              )}
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
                    const isExplorer = user?.role === 'explorer'
                    const isExploreLink = item.path === '/explore'
                    const isDisabled = isExplorer && !isExploreLink

                    if (isDisabled) {
                      return (
                        <div
                          key={item.path}
                          className="group flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm opacity-30 cursor-not-allowed"
                          style={{ pointerEvents: 'none' }}
                        >
                          <div className="p-1.5 rounded-md bg-muted">
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="ml-1">{item.label}</span>
                        </div>
                      )
                    }

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
        {/* Logo - shown on all screens except home and explore */}
        {location.pathname !== '/' && location.pathname !== '/results/explore' && (
          <img
            src="./daedalus2.png"
            alt="Logo"
            className="absolute z-50"
            style={{
              top: '1.5rem',
              right: '2rem',
              height: '105px',
              width: 'auto'
            }}
          />
        )}

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
            <FlowchartNav onNavigate={() => setNavMode('sidebar')} userRole={user?.role} />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
