import { useState, useEffect } from 'react'
import { logger } from '@/utils/logger'
import { Database as DatabaseIcon, Check, X, FolderOpen, Save, RotateCcw, Clock, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { apiUrl, getDefaultDbPath } from '@/config'

interface Backup {
  filename: string
  path: string
  size: number
  created: string
}

export default function Database() {
  const [dbPath, setDbPath] = useState(getDefaultDbPath())
  const [isSaved, setIsSaved] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [isCreatingBackup, setIsCreatingBackup] = useState(false)
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)

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

  const loadBackups = async () => {
    setIsLoadingBackups(true)
    try {
      const response = await fetch(apiUrl(`/api/database/backups?dbPath=${encodeURIComponent(dbPath)}`))
      const result = await response.json()
      if (result.success) {
        setBackups(result.backups || [])
      }
    } catch (err) {
      logger.error('Failed to load backups:', err)
    } finally {
      setIsLoadingBackups(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      checkDatabaseValidity(dbPath)
    }, 500)
    return () => clearTimeout(timer)
  }, [dbPath])

  useEffect(() => {
    if (isValid) {
      loadBackups()
    }
  }, [isValid])

  const handleBrowse = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.db,.sqlite,.sqlite3'
    // @ts-ignore - webkitdirectory is not in TypeScript types
    input.webkitdirectory = false

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) {
        // Try to get full path from various sources
        const fullPath = (file as any).path || (file as any).webkitRelativePath || file.name

        // If we only got the filename, check if it exists in the default location
        if (!fullPath.includes('/')) {
          const defaultPath = `/Users/Owen/ScenarioAnalysis2/data/database/${fullPath}`
          setDbPath(defaultPath)
        } else {
          setDbPath(fullPath)
        }
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

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true)
    try {
      const response = await fetch(apiUrl('/api/database/backup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath })
      })
      const result = await response.json()
      if (result.success) {
        alert('Backup created successfully!')
        loadBackups()
      } else {
        alert('Failed to create backup: ' + result.error)
      }
    } catch (err) {
      alert('Failed to create backup: ' + err)
    } finally {
      setIsCreatingBackup(false)
    }
  }

  const handleRestore = async (backupPath: string, filename: string) => {
    if (!confirm(`Restore from backup "${filename}"? This will replace your current database.`)) {
      return
    }

    try {
      const response = await fetch(apiUrl('/api/database/restore'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, backupPath })
      })
      const result = await response.json()
      if (result.success) {
        alert('Database restored successfully! Please refresh the page.')
        window.location.reload()
      } else {
        alert('Failed to restore: ' + result.error)
      }
    } catch (err) {
      alert('Failed to restore: ' + err)
    }
  }

  const handleDeleteBackup = async (backupPath: string, filename: string) => {
    if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(apiUrl('/api/database/backup'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupPath })
      })
      const result = await response.json()
      if (result.success) {
        alert('Backup deleted successfully!')
        loadBackups()
      } else {
        alert('Failed to delete backup: ' + result.error)
      }
    } catch (err) {
      alert('Failed to delete backup: ' + err)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="mb-12" style={{ marginLeft: '1.5rem' }}>
        <h1 className="text-4xl font-bold tracking-tight">Database</h1>
        <p className="text-muted-foreground mt-2">Manage your database location and backups</p>
      </div>

      <div className="mx-auto" style={{ maxWidth: '700px' }}>

      <div className="flex flex-col" style={{ gap: '32px', padding: '0 24px' }}>
        {/* Database Location Card */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(20, 184, 166, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <div className="flex flex-col" style={{ gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                <div style={{ marginTop: '17px' }}>
                  <DatabaseIcon className="w-8 h-8 text-teal-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Database Location</h3>
                  <p className="text-sm text-muted-foreground">Choose the SQLite database file</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ef4444' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#22c55e' }}>
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
                  width: '220px',
                  height: '44px',
                  backgroundColor: isSaved ? '#10b981' : (isValid ? '#2563eb' : '#6b7280'),
                  border: 'none',
                  boxShadow: 'none',
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                  color: '#ffffff',
                  margin: '0 auto 0 auto',
                  display: 'block'
                }}
              >
                {isSaved ? 'Saved!' : 'Save Database Path'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Backup Management Card */}
        <Card className="border-2" style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', borderColor: 'rgba(59, 130, 246, 0.3)' }}>
          <CardContent style={{ padding: '32px' }}>
            <div className="flex flex-col" style={{ gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ marginTop: '17px' }}>
                    <Save className="w-8 h-8 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Backup & Restore</h3>
                    <p className="text-sm text-muted-foreground">Create and restore database backups</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleCreateBackup}
                disabled={!isValid || isCreatingBackup}
                style={{
                  width: '100%',
                  height: '44px',
                  backgroundColor: isValid ? '#10b981' : '#6b7280',
                  border: 'none',
                  boxShadow: 'none',
                  cursor: isValid ? 'pointer' : 'not-allowed',
                  opacity: isValid ? 1 : 0.5,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Save style={{ width: '16px', height: '16px' }} />
                {isCreatingBackup ? 'Creating Backup...' : 'Create Backup Now'}
              </Button>

              {backups.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-3" style={{ color: '#94a3b8' }}>Available Backups ({backups.length})</h4>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {backups.map((backup) => (
                      <div
                        key={backup.path}
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(71, 85, 105, 0.3)',
                          borderRadius: '8px',
                          padding: '12px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '13px', color: '#fff', fontWeight: 500 }}>{backup.filename}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestore(backup.path, backup.filename)}
                              style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                borderColor: 'rgba(16, 185, 129, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <RotateCcw style={{ width: '12px', height: '12px' }} />
                              Restore
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteBackup(backup.path, backup.filename)}
                              style={{
                                padding: '4px 12px',
                                fontSize: '12px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                borderColor: 'rgba(239, 68, 68, 0.5)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Trash2 style={{ width: '12px', height: '12px' }} />
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock style={{ width: '12px', height: '12px' }} />
                            {formatDate(backup.created)}
                          </span>
                          <span>{formatSize(backup.size)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {backups.length === 0 && isValid && !isLoadingBackups && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '14px' }}>
                  No backups available. Create your first backup above.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}
