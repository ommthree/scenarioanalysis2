import { useState } from 'react'
import { Database, FolderOpen, Check } from 'lucide-react'

interface DatabaseSelectorProps {
  onSelect: (path: string) => void
}

export default function DatabaseSelector({ onSelect }: DatabaseSelectorProps) {
  const [path, setPath] = useState('')
  const [isValid, setIsValid] = useState(false)

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        setPath(file.name)
        setIsValid(true)
      }
    }
    input.click()
  }

  const handleConnect = () => {
    if (path && isValid) {
      onSelect(path)
    }
  }

  // Also allow connecting with any path typed (for testing)
  const handlePathChange = (newPath: string) => {
    setPath(newPath)
    if (newPath.trim()) {
      setIsValid(true)
    } else {
      setIsValid(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-12 w-full" style={{ maxWidth: '550px' }}>
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-xl shadow-lg">
            <Database className="w-12 h-12 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2 text-white">
          Financial Modeling Dashboard
        </h1>
        <p className="text-center text-slate-400 mb-8">
          Select a database to begin scenario analysis
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Database Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder="/path/to/finmodel.db"
                className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <button
                onClick={handleBrowse}
                className="px-5 py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg flex items-center gap-2 transition-all border border-slate-600 font-medium hover:border-slate-500"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
            {isValid && (
              <div className="flex items-center gap-2 mt-2 text-green-400 text-sm">
                <Check className="w-4 h-4" />
                <span>Valid database path</span>
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={!path || !isValid}
            className="w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-blue-500/20 disabled:shadow-none"
          >
            Connect to Database
          </button>

          <div className="pt-5 border-t border-slate-700">
            <p className="text-sm text-slate-400 text-center">
              <span className="inline-block mr-1">💡</span>
              Your database is typically in the <span className="text-slate-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">data/</span> directory
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
