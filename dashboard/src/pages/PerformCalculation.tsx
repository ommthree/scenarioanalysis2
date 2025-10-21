import { useState, useRef, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Square, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

export default function PerformCalculation() {
  const [isRunning, setIsRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [runName, setRunName] = useState('')
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Load run definition on mount
  useEffect(() => {
    const saved = localStorage.getItem('runDefinition')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setRunName(data.runName || 'Unnamed Run')
      } catch (err) {
        setRunName('Unnamed Run')
      }
    }
  }, [])

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    }
    setLogs(prev => [...prev, entry])
  }

  const handleStartCalculation = async () => {
    setIsRunning(true)
    setRunStatus('running')
    setLogs([])

    addLog('info', `Starting calculation run: ${runName}`)
    addLog('info', 'Initializing calculation engine...')

    // Simulate calculation steps
    // TODO: Replace with actual API calls to C++ calculation engine
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('info', 'Loading templates and entities...')

      await new Promise(resolve => setTimeout(resolve, 800))
      addLog('success', 'Templates loaded successfully')

      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('info', 'Loading scenario drivers and values...')

      await new Promise(resolve => setTimeout(resolve, 800))
      addLog('success', 'Scenario data loaded')

      await new Promise(resolve => setTimeout(resolve, 1200))
      addLog('info', 'Processing line item formulas...')

      await new Promise(resolve => setTimeout(resolve, 1500))
      addLog('success', 'Formula calculations completed')

      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('info', 'Running validation rules...')

      await new Promise(resolve => setTimeout(resolve, 800))
      addLog('success', 'All validation rules passed')

      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('info', 'Applying management actions...')

      await new Promise(resolve => setTimeout(resolve, 1200))
      addLog('success', 'Management actions applied')

      await new Promise(resolve => setTimeout(resolve, 800))
      addLog('info', 'Saving results to database...')

      await new Promise(resolve => setTimeout(resolve, 1000))
      addLog('success', 'Results saved successfully')

      addLog('success', '✓ Calculation completed successfully!')
      setRunStatus('success')
      setIsRunning(false)

    } catch (err) {
      addLog('error', `Calculation failed: ${err}`)
      setRunStatus('error')
      setIsRunning(false)
    }
  }

  const handleStopCalculation = () => {
    addLog('warning', 'Calculation stopped by user')
    setIsRunning(false)
    setRunStatus('idle')
  }

  const getStatusIcon = () => {
    switch (runStatus) {
      case 'running':
        return <Clock style={{ width: '24px', height: '24px', color: '#3b82f6' }} className="animate-spin" />
      case 'success':
        return <CheckCircle2 style={{ width: '24px', height: '24px', color: '#10b981' }} />
      case 'error':
        return <XCircle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
      default:
        return <AlertCircle style={{ width: '24px', height: '24px', color: '#64748b' }} />
    }
  }

  const getStatusText = () => {
    switch (runStatus) {
      case 'running':
        return 'Calculation in progress...'
      case 'success':
        return 'Calculation completed successfully'
      case 'error':
        return 'Calculation failed'
      default:
        return 'Ready to start calculation'
    }
  }

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle2 style={{ width: '16px', height: '16px', color: '#10b981', flexShrink: 0 }} />
      case 'error':
        return <XCircle style={{ width: '16px', height: '16px', color: '#ef4444', flexShrink: 0 }} />
      case 'warning':
        return <AlertCircle style={{ width: '16px', height: '16px', color: '#f59e0b', flexShrink: 0 }} />
      default:
        return <AlertCircle style={{ width: '16px', height: '16px', color: '#3b82f6', flexShrink: 0 }} />
    }
  }

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return '#10b981'
      case 'error':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      default:
        return '#94a3b8'
    }
  }

  return (
    <div style={{
      padding: '48px',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Play style={{ width: '32px', height: '32px', color: '#3b82f6' }} />
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#ffffff' }}>
            Perform Calculation
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
          Execute the calculation run and monitor progress
        </p>
      </div>

      {/* Run Info Card */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        marginBottom: '24px'
      }}>
        <CardContent style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                {runName}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {getStatusIcon()}
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                  {getStatusText()}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isRunning ? (
                <Button
                  onClick={handleStartCalculation}
                  disabled={isRunning}
                  style={{
                    backgroundColor: '#10b981',
                    color: '#fff',
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Play style={{ width: '16px', height: '16px' }} />
                  Start Calculation
                </Button>
              ) : (
                <Button
                  onClick={handleStopCalculation}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Square style={{ width: '16px', height: '16px' }} />
                  Stop
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Panel */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        height: 'calc(100vh - 400px)',
        minHeight: '400px'
      }}>
        <CardContent style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>
            Calculation Log
          </h3>
          <div style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '16px',
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '13px'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', paddingTop: '40px' }}>
                No log entries yet. Click "Start Calculation" to begin.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      padding: '8px',
                      backgroundColor: 'rgba(30, 41, 59, 0.3)',
                      borderRadius: '4px',
                      borderLeft: `3px solid ${getLogColor(log.level)}`
                    }}
                  >
                    {getLogIcon(log.level)}
                    <span style={{ color: '#64748b', minWidth: '80px' }}>
                      {log.timestamp}
                    </span>
                    <span style={{ color: getLogColor(log.level), flex: 1 }}>
                      {log.message}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
