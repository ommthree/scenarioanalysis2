import { Play, Plus, FileText, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function Dashboard() {
  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Scenario Analysis Control Center</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap justify-center gap-12 mb-12" style={{ gap: '3rem', marginBottom: '3rem' }}>
        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer border-2 hover:border-primary" style={{ width: '320px', height: '256px', background: 'linear-gradient(to bottom right, rgba(34, 197, 94, 0.15), rgba(22, 163, 74, 0.25))', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardContent className="p-8 h-full flex items-center justify-center" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="shrink-0 rounded-lg bg-green-500/20 p-3 ring-1 ring-green-500/30">
                <Play className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">Run Scenarios</h3>
                <p className="text-sm text-muted-foreground">Execute and analyze selected scenarios</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer border-2 hover:border-primary" style={{ width: '320px', height: '256px', background: 'linear-gradient(to bottom right, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.25))', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardContent className="p-8 h-full flex items-center justify-center" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="shrink-0 rounded-lg bg-blue-500/20 p-3 ring-1 ring-blue-500/30">
                <Plus className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">New Scenario</h3>
                <p className="text-sm text-muted-foreground">Create and configure a new scenario</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-xl hover:scale-[1.02] transition-all duration-200 cursor-pointer border-2 hover:border-primary" style={{ width: '320px', height: '256px', background: 'linear-gradient(to bottom right, rgba(168, 85, 247, 0.15), rgba(147, 51, 234, 0.25))', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardContent className="p-8 h-full flex items-center justify-center" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="shrink-0 rounded-lg bg-purple-500/20 p-3 ring-1 ring-purple-500/30">
                <FileText className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">View Results</h3>
                <p className="text-sm text-muted-foreground">Browse and export latest results</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats Row */}
      <div className="flex flex-wrap justify-center gap-8 mb-12" style={{ gap: '2rem', marginBottom: '3rem' }}>
        <Card style={{ width: '240px', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardHeader className="pb-2" style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
            <CardDescription>Total Scenarios</CardDescription>
            <CardTitle className="text-3xl">24</CardTitle>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
              <span className="text-green-500">+12%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card style={{ width: '240px', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardHeader className="pb-2" style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
            <CardDescription>Completed Runs</CardDescription>
            <CardTitle className="text-3xl">18</CardTitle>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
            <div className="flex items-center text-xs text-muted-foreground">
              <TrendingUp className="w-3 h-3 mr-1 text-green-500" />
              <span className="text-green-500">+8%</span>
              <span className="ml-1">from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card style={{ width: '240px', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardHeader className="pb-2" style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
            <CardDescription>Active Templates</CardDescription>
            <CardTitle className="text-3xl">6</CardTitle>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>Across 3 categories</span>
            </div>
          </CardContent>
        </Card>

        <Card style={{ width: '240px', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardHeader className="pb-2" style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
            <CardDescription>Last Run</CardDescription>
            <CardTitle className="text-3xl">2h</CardTitle>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>Climate Scenario Q4</span>
            </div>
          </CardContent>
        </Card>

        <Card style={{ width: '240px', backgroundColor: 'rgba(30, 41, 59, 0.9)' }}>
          <CardHeader className="pb-2" style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
            <CardDescription>Recent Activity</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
          <CardContent style={{ padding: '1.5rem', paddingTop: '0.5rem' }}>
            <div className="flex items-center text-xs text-muted-foreground">
              <span>No recent runs</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
