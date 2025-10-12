import { useState } from 'react'
import { Database, FolderOpen, Check } from 'lucide-react'

interface DatabaseSelectorProps {
  onSelect: (path: string) => void
}

export default function DatabaseSelector({ onSelect }: DatabaseSelectorProps) {
  const [path, setPath] = useState('')
  const [isValid, setIsValid] = useState(false)

  const handleBrowse = () => {
    // In a real implementation, this would open a file dialog
    // For now, we'll use a simple input
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full">
            <Database className="w-12 h-12 text-blue-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">
          Financial Modeling Dashboard
        </h1>
        <p className="text-center text-gray-600 mb-6">
          Select a database to begin
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Path
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/finmodel.db"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md flex items-center gap-2 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
            {isValid && (
              <div className="flex items-center gap-2 mt-2 text-green-600 text-sm">
                <Check className="w-4 h-4" />
                Valid database file
              </div>
            )}
          </div>

          <button
            onClick={handleConnect}
            disabled={!path || !isValid}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
          >
            Connect to Database
          </button>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Tip: Your database is typically located in the project data/ directory
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
