import { Play, Plus, FileText } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-1">Scenario Analysis Control Center</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-750 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="bg-green-600 p-4 rounded-xl">
              <Play className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Run Scenarios</h3>
              <p className="text-xs text-slate-400 mt-0.5">Execute selected scenarios</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-750 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-4 rounded-xl">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">New Scenario</h3>
              <p className="text-xs text-slate-400 mt-0.5">Create a new scenario</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500 hover:bg-slate-750 transition-all cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="bg-purple-600 p-4 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">View Results</h3>
              <p className="text-xs text-slate-400 mt-0.5">Browse latest results</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-4xl">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="text-slate-400 text-center py-12 text-sm">
          No recent activity to display
        </div>
      </div>
    </div>
  )
}
