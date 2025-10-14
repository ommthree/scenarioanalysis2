import { useState, useEffect } from 'react'
import { Database as DatabaseIcon, FolderOpen, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function Database() {
  const [dbPath, setDbPath] = useState(localStorage.getItem('lastDatabasePath') || '/Users/Owen/finmodel_data/production.db')
  const [isSaved, setIsSaved] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const checkDatabaseValidity = async (path: string) => {
    if (!path || path.trim() === '') {
      setIsValid(false)
      return
    }

    setIsChecking(true)
    try {
      const hasValidExtension = path.endsWith('.db') || path.endsWith('.sqlite') || path.endsWith('.sqlite3')
      const hasValidPath = path.startsWith('/') || path.match(/^[A-Za-z]:/)
      const looksLikeFile = path.includes('/') && path.split('/').pop()?.includes('.')

      if (!hasValidExtension || !hasValidPath || !looksLikeFile) {
        setIsValid(false)
        return
      }

      setIsValid(true)
    } catch (error) {
      setIsValid(false)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDatabaseValidity(dbPath)
    }, 500)
    return () => clearTimeout(timer)
  }, [dbPath])

  const handleBrowse = () => {
    // Create a hidden file input element
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db,.sqlite,.sqlite3'

    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        // In a browser, we can't get the full path due to security restrictions
        // In a real desktop app (Electron/Tauri), you'd get the full path from the file handle
        // For now, use the filename with a placeholder path
        setDbPath(`/Users/Owen/finmodel_data/${file.name}`)
        setIsSaved(false)
      }
    }

    input.click()
  }

  const handleSave = () => {
    if (isValid) {
      localStorage.setItem('lastDatabasePath', dbPath)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 2000)
    }
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Database</h1>
        <p className="text-muted-foreground mt-2">Select your database location</p>
      </div>

      <div className="flex justify-center">
        <Card className="border-2" style={{ width: '540px', backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(20, 184, 166, 0.3)' }}>
          <CardContent className="p-8">
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', marginLeft: '1.5rem' }}>
                <div style={{ marginTop: '17px' }}>
                  <DatabaseIcon className="w-8 h-8 text-teal-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Database Location</h3>
                  <p className="text-sm text-muted-foreground">Choose the SQLite database file</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
                <Input
                  value={dbPath}
                  onChange={(e) => {
                    setDbPath(e.target.value)
                    setIsSaved(false)
                  }}
                  placeholder="/path/to/database.db"
                  style={{
                    flex: 1,
                    color: '#ffffff',
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    padding: '10px 12px',
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleBrowse}
                  style={{
                    color: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '10px 16px',
                  }}
                >
                  <FolderOpen style={{ width: '16px', height: '16px', marginRight: '8px', color: '#ffffff' }} />
                  Browse
                </Button>
              </div>

              {isValid === false && !isChecking && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ef4444', marginLeft: '1.5rem' }}>
                  <div style={{
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <X style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                  </div>
                  <span>Invalid database file</span>
                </div>
              )}

              {isValid === true && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#22c55e', marginLeft: '1.5rem' }}>
                  <div style={{
                    borderRadius: '50%',
                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check style={{ width: '16px', height: '16px', color: '#22c55e' }} />
                  </div>
                  <span>Valid database file</span>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={!isValid || isChecking}
                style={{
                  width: 'auto',
                  height: '44px',
                  paddingLeft: '32px',
                  paddingRight: '32px',
                  backgroundColor: isSaved ? '#10b981' : (isValid ? '#2563eb' : '#6b7280'),
                  border: 'none',
                  boxShadow: 'none',
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                  color: '#ffffff',
                  margin: '0 auto 24px auto',
                  display: 'block'
                }}
              >
                {isSaved ? (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Saved!
                  </>
                ) : (
                  'Save Database Path'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
