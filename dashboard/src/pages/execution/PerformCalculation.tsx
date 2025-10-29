import { useState, useRef, useEffect } from 'react'
import { logger } from '@/utils/logger'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Square, CheckCircle2, XCircle, AlertCircle, Clock, Copy, Trash2, Save } from 'lucide-react'
import { apiUrl, getDefaultDbPath } from '@/config'
import ValidationPanel from '@/components/ValidationPanel'

interface LogEntry {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

interface ValidationMessage {
  code: string
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ValidationResult {
  valid: boolean
  errors: ValidationMessage[]
  warnings: ValidationMessage[]
  info: ValidationMessage[]
}

export default function PerformCalculation() {
  const [isRunning, setIsRunning] = useState(false)
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [runName, setRunName] = useState('')
  const [verbosity, setVerbosity] = useState<'quiet' | 'verbose' | 'debug'>('verbose')
  const [isSaving, setIsSaving] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [stochasticMode, setStochasticMode] = useState(false)
  const [whatIfMode, setWhatIfMode] = useState(false)
  const [mcStartPeriod, setMcStartPeriod] = useState(1)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Load run definition, previous logs, and validation result on mount
  useEffect(() => {
    const saved = localStorage.getItem('runDefinition')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        setRunName(data.runName || 'Unnamed Run')
        setStochasticMode(data.stochasticMode || false)
        setWhatIfMode(data.whatIfMode || false)
        setMcStartPeriod(data.mcStartPeriod || 1)
      } catch (err) {
        setRunName('Unnamed Run')
      }
    }

    // Load previous calculation logs
    const savedLogs = localStorage.getItem('calculationLogs')
    if (savedLogs) {
      try {
        const parsedLogs = JSON.parse(savedLogs)
        setLogs(parsedLogs.logs || [])
        setRunStatus(parsedLogs.status || 'idle')
      } catch (err) {
        logger.error('Failed to load saved logs:', err)
      }
    }

    // Load previous validation result
    const savedValidation = localStorage.getItem('validationResult')
    if (savedValidation) {
      try {
        const parsedValidation = JSON.parse(savedValidation)
        setValidationResult(parsedValidation)
      } catch (err) {
        logger.error('Failed to load saved validation result:', err)
      }
    }
  }, [])

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Save logs to localStorage whenever they change
  useEffect(() => {
    if (logs.length > 0) {
      localStorage.setItem('calculationLogs', JSON.stringify({
        logs,
        status: runStatus
      }))
    }
  }, [logs, runStatus])

  // Save validation result to localStorage whenever it changes
  useEffect(() => {
    if (validationResult) {
      localStorage.setItem('validationResult', JSON.stringify(validationResult))
    }
  }, [validationResult])

  const addLog = (level: LogEntry['level'], message: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message
    }
    setLogs(prev => [...prev, entry])
  }

  const runValidation = async (): Promise<boolean> => {
    setIsValidating(true)
    const dbPath = getDefaultDbPath()

    addLog('info', 'Running pre-calculation validation...')

    try {
      // Get all scenarios from database
      const scenariosResponse = await fetch(apiUrl(`/api/scenarios/list?dbPath=${encodeURIComponent(dbPath)}`), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!scenariosResponse.ok) {
        addLog('error', 'Failed to fetch scenarios')
        setIsValidating(false)
        return false
      }

      const scenariosData = await scenariosResponse.json()
      const scenarioIds = scenariosData.scenarios?.map((s: { scenario_id: number }) => s.scenario_id) || []

      if (scenarioIds.length === 0) {
        addLog('warning', 'No scenarios defined in database. Validation skipped.')
        setIsValidating(false)
        return true
      }

      // Run validation for each scenario
      let allValid = true
      const allResults: ValidationResult = { valid: true, errors: [], warnings: [], info: [] }

      for (const scenarioId of scenarioIds) {
        const response = await fetch(apiUrl('/api/validate-scenario'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dbPath, scenarioId })
        })

        if (!response.ok) {
          addLog('error', `Validation API failed: ${response.statusText}`)
          setIsValidating(false)
          return false
        }

        const result = await response.json()

        // Aggregate results
        allResults.errors.push(...result.errors)
        allResults.warnings.push(...result.warnings)
        allResults.info.push(...result.info)

        if (!result.valid) {
          allValid = false
        }
      }

      allResults.valid = allValid
      setValidationResult(allResults)

      if (allValid) {
        addLog('success', '✓ Pre-calculation validation passed')
      } else {
        addLog('error', `✗ Pre-calculation validation failed: ${allResults.errors.length} error(s)`)
      }

      setIsValidating(false)
      return allValid

    } catch (err) {
      addLog('error', `Validation error: ${err}`)
      setIsValidating(false)
      return false
    }
  }

  const handleStartCalculation = async () => {
    setIsRunning(true)
    setRunStatus('running')
    setLogs([])

    const dbPath = getDefaultDbPath()

    addLog('info', `Starting calculation run: ${runName} (${verbosity} mode)`)

    // Run pre-calculation validation first
    const validationPassed = await runValidation()
    if (!validationPassed) {
      addLog('error', 'Cannot proceed with calculation due to validation errors')
      setRunStatus('error')
      setIsRunning(false)
      return
    }

    if (verbosity !== 'quiet') {
      addLog('info', 'Step 1: Ingesting scenario data from staged files...')
    }

    try {
      // Step 1: Ingest scenarios (this also cleans up old data)
      const scenResponse = await fetch(apiUrl('/api/ingest/scenarios'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, verbosity })
      })

      if (!scenResponse.ok) {
        const errorText = await scenResponse.text()
        throw new Error(`Scenario ingestion failed: ${errorText}`)
      }

      const scenResult = await scenResponse.json()

      // Display logs from backend if verbosity is not quiet
      if (scenResult.logs && verbosity !== 'quiet') {
        scenResult.logs.forEach((log: { level: string, message: string }) => {
          if (verbosity === 'debug' || (verbosity === 'verbose' && log.level === 'verbose')) {
            addLog('info', log.message)
          }
        })
      }

      if (scenResult.success) {
        if (verbosity === 'quiet') {
          addLog('success', `Scenarios ingested: ${scenResult.scenarios} scenarios`)
        }
      } else {
        throw new Error(scenResult.error || 'Scenario ingestion failed')
      }

      // Step 2: Ingest statements (now that scenarios exist)
      if (verbosity !== 'quiet') {
        addLog('info', 'Step 2: Ingesting statement data from staged files...')
      }

      const stmtResponse = await fetch(apiUrl('/api/ingest/statements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dbPath, verbosity })
      })

      if (!stmtResponse.ok) {
        const errorText = await stmtResponse.text()
        throw new Error(`Statement ingestion failed: ${errorText}`)
      }

      const stmtResult = await stmtResponse.json()

      // Display logs from backend if verbosity is not quiet
      if (stmtResult.logs && verbosity !== 'quiet') {
        stmtResult.logs.forEach((log: { level: string, message: string }) => {
          if (verbosity === 'debug' || (verbosity === 'verbose' && log.level === 'verbose')) {
            addLog('info', log.message)
          }
        })
      }

      if (stmtResult.success) {
        if (verbosity === 'quiet') {
          addLog('success', `Statements ingested: ${stmtResult.inserted} values`)
        }
      } else {
        throw new Error(stmtResult.error || 'Statement ingestion failed')
      }

      // Step 3: Run calculation engine
      if (verbosity !== 'quiet') {
        addLog('info', 'Step 3: Running multi-period scenario calculations...')
      }

      // If Monte Carlo mode, prepare Cholesky matrix and run calculation up to MC start period
      if (stochasticMode) {
        if (verbosity !== 'quiet') {
          addLog('info', `Monte Carlo Mode: Preparing correlation matrix and running deterministic calculation up to period ${mcStartPeriod}`)
        }

        // Step 3a: Prepare Monte Carlo (load correlation matrix and perform Cholesky decomposition)
        if (verbosity !== 'quiet') {
          addLog('info', 'Loading correlation matrix and performing Cholesky decomposition...')
        }

        const correlationCsvPath = '/Users/Owen/ScenarioAnalysis2/data/inputs/correlations/level2_correlation_matrix.csv'
        const prepareResponse = await fetch(apiUrl('/api/montecarlo/prepare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correlationCsvPath })
        })

        if (!prepareResponse.ok) {
          const errorText = await prepareResponse.text()
          if (verbosity !== 'quiet') {
            addLog('error', `Failed to prepare Monte Carlo: ${prepareResponse.status}`)
            addLog('error', errorText)
          }
          throw new Error('Monte Carlo preparation failed')
        }

        const prepareResult = await prepareResponse.json()

        if (!prepareResult.success) {
          if (verbosity !== 'quiet') {
            addLog('error', 'Cholesky decomposition failed')
          }
          throw new Error('Cholesky decomposition failed')
        }

        if (verbosity === 'verbose' || verbosity === 'debug') {
          addLog('success', `✓ Cholesky matrix prepared (${prepareResult.dimension}x${prepareResult.dimension})`)
          addLog('info', `Drivers: ${prepareResult.driverNames.join(', ')}`)
        }

        // Step 3b: Run deterministic calculation up to MC start period
        if (verbosity === 'debug') {
          addLog('info', 'Processing line item formulas and dependencies...')
          addLog('info', 'Applying validation rules...')
          addLog('info', 'Executing management actions...')
        }

        // Call actual C++ calculation engine with MC start period
        const calcResponse = await fetch(apiUrl('/api/calculate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dbPath,
            mcStartPeriod: mcStartPeriod
          })
        })

        if (!calcResponse.ok) {
          const errorText = await calcResponse.text()
          if (verbosity !== 'quiet') {
            addLog('error', `API request failed: ${calcResponse.status} ${calcResponse.statusText}`)
            addLog('error', errorText)
          }
          throw new Error(`API request failed: ${calcResponse.status}`)
        }

        const calcResult = await calcResponse.json()

        if (!calcResult.success) {
          if (verbosity !== 'quiet') {
            addLog('error', 'Calculation engine failed')
            if (calcResult.stderr) {
              const errorLines = calcResult.stderr.split('\n').filter((line: string) => line.trim())
              errorLines.forEach((line: string) => addLog('error', line))
            }
            if (calcResult.error) {
              addLog('error', calcResult.error)
            }
          }
          throw new Error(calcResult.error || 'Calculation failed')
        }

        if ((verbosity === 'debug' || verbosity === 'verbose') && calcResult.output) {
          const outputLines = calcResult.output.split('\n').filter((line: string) => line.trim())
          outputLines.forEach((line: string) => addLog('info', line))
        }

        if (verbosity === 'debug' || verbosity === 'verbose') {
          addLog('success', '✓ Calculation engine completed successfully')
          addLog('info', 'Results stored in database')
        }
      } else if (whatIfMode) {
        const combosResponse = await fetch(apiUrl('/api/whatif/combinations'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dbPath })
        })

        if (!combosResponse.ok) {
          throw new Error('Failed to generate what-if combinations')
        }

        const combosResult = await combosResponse.json()

        if (combosResult.success && combosResult.combinations) {
          const combos = combosResult.combinations
          const numRuns = combos.length

          if (verbosity !== 'quiet') {
            addLog('info', `What-If Mode: Running ${numRuns} combinations (2^${Math.log2(numRuns)} action permutations)`)
          }

          if (verbosity === 'verbose' || verbosity === 'debug') {
            combos.forEach((combo: any, idx: number) => {
              if (combo.action_codes.length === 0) {
                addLog('info', `  Run ${idx + 1}/${numRuns}: BASE (no actions)`)
              } else {
                addLog('info', `  Run ${idx + 1}/${numRuns}: ${combo.action_codes.join(' + ')}`)
              }
            })
          }

          // Loop over all combinations
          for (let i = 0; i < combos.length; i++) {
            const combo = combos[i]

            if (verbosity !== 'quiet') {
              if (combo.action_codes.length === 0) {
                addLog('info', `Running combination ${i + 1}/${numRuns}: BASE (no actions)`)
              } else {
                addLog('info', `Running combination ${i + 1}/${numRuns}: ${combo.action_codes.join(' + ')}`)
              }
            }

            if (verbosity === 'debug') {
              addLog('info', 'Processing line item formulas and dependencies...')
              addLog('info', 'Applying validation rules...')
              addLog('info', 'Executing management actions...')
            }

            // Call actual C++ calculation engine for this combination
            const calcResponse = await fetch(apiUrl('/api/calculate'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                dbPath,
                whatIfCombination: combo.combination
              })
            })

            if (!calcResponse.ok) {
              const errorText = await calcResponse.text()
              if (verbosity !== 'quiet') {
                addLog('error', `API request failed: ${calcResponse.status} ${calcResponse.statusText}`)
                addLog('error', errorText)
              }
              throw new Error(`API request failed: ${calcResponse.status}`)
            }

            const calcResult = await calcResponse.json()

            if (!calcResult.success) {
              if (verbosity !== 'quiet') {
                addLog('error', 'Calculation engine failed')
                if (calcResult.stderr) {
                  const errorLines = calcResult.stderr.split('\n').filter((line: string) => line.trim())
                  errorLines.forEach((line: string) => addLog('error', line))
                }
                if (calcResult.error) {
                  addLog('error', calcResult.error)
                }
              }
              throw new Error(calcResult.error || 'Calculation failed')
            }

            if ((verbosity === 'debug' || verbosity === 'verbose') && calcResult.output) {
              const outputLines = calcResult.output.split('\n').filter((line: string) => line.trim())
              outputLines.forEach((line: string) => addLog('info', line))
            }

            if (verbosity === 'debug' || verbosity === 'verbose') {
              addLog('success', `✓ Combination ${i + 1}/${numRuns} completed successfully`)
            }
          }

          if (verbosity !== 'quiet') {
            addLog('success', `✓ All ${numRuns} what-if combinations completed`)
          }
        }
      } else {
        // Normal mode - single calculation run
        if (verbosity === 'debug') {
          addLog('info', 'Processing line item formulas and dependencies...')
          addLog('info', 'Applying validation rules...')
          addLog('info', 'Executing management actions...')
        }

        // Call actual C++ calculation engine
        const calcResponse = await fetch(apiUrl('/api/calculate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dbPath })
        })

        if (!calcResponse.ok) {
          const errorText = await calcResponse.text()
          if (verbosity !== 'quiet') {
            addLog('error', `API request failed: ${calcResponse.status} ${calcResponse.statusText}`)
            addLog('error', errorText)
          }
          throw new Error(`API request failed: ${calcResponse.status}`)
        }

        const calcResult = await calcResponse.json()

        if (!calcResult.success) {
          if (verbosity !== 'quiet') {
            addLog('error', 'Calculation engine failed')
            if (calcResult.stderr) {
              const errorLines = calcResult.stderr.split('\n').filter((line: string) => line.trim())
              errorLines.forEach((line: string) => addLog('error', line))
            }
            if (calcResult.error) {
              addLog('error', calcResult.error)
            }
          }
          throw new Error(calcResult.error || 'Calculation failed')
        }

        if ((verbosity === 'debug' || verbosity === 'verbose') && calcResult.output) {
          const outputLines = calcResult.output.split('\n').filter((line: string) => line.trim())
          outputLines.forEach((line: string) => addLog('info', line))
        }

        if (verbosity === 'debug' || verbosity === 'verbose') {
          addLog('success', '✓ Calculation engine completed successfully')
          addLog('info', 'Results stored in database')
        }
      }

      addLog('success', '✓ All steps completed successfully!')
      setRunStatus('success')
      setIsRunning(false)

      // Save post-run flags
      localStorage.setItem('lastRunMode', JSON.stringify({
        stochasticMode,
        whatIfMode
      }))

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

  const handleCopyLog = async () => {
    const logText = logs.map(log => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`).join('\n')
    try {
      await navigator.clipboard.writeText(logText)
      addLog('success', 'Log copied to clipboard')
    } catch (err) {
      addLog('error', 'Failed to copy log to clipboard')
    }
  }

  const handleClearLog = () => {
    setLogs([])
    setRunStatus('idle')
    localStorage.removeItem('calculationLogs')
  }

  const handleSaveRun = async () => {
    setIsSaving(true)
    const dbPath = getDefaultDbPath()

    try {
      // Get the current run config
      const saved = localStorage.getItem('runDefinition')
      const config = saved ? JSON.parse(saved) : { runName }

      // Use run name from config or fallback to state
      const actualRunName = config.runName || runName || 'Unnamed Run'

      // Generate timestamp-based unique ID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const uniqueRunName = `${actualRunName}_${timestamp}`

      // Get description from config or use empty string
      const description = config.description || config.runDescription || ''

      const response = await fetch(apiUrl('/api/runs/save'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbPath,
          runName: uniqueRunName,
          runDescription: description,
          config
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save run')
      }

      await response.json()
      addLog('success', `Run saved successfully as "${uniqueRunName}"`)
    } catch (err) {
      addLog('error', `Failed to save run: ${err}`)
      alert(err instanceof Error ? err.message : 'Failed to save run')
    } finally {
      setIsSaving(false)
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>
                  {runName}
                </h3>
                {stochasticMode && (
                  <span style={{
                    padding: '4px 10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '12px',
                    color: '#3b82f6',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    STOCHASTIC
                  </span>
                )}
                {whatIfMode && (
                  <span style={{
                    padding: '4px 10px',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '12px',
                    color: '#10b981',
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    WHAT-IF
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {getStatusIcon()}
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                  {getStatusText()}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {/* Verbosity Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                  Verbosity
                </label>
                <select
                  value={verbosity}
                  onChange={(e) => setVerbosity(e.target.value as 'quiet' | 'verbose' | 'debug')}
                  disabled={isRunning}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(71, 85, 105, 0.4)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '14px',
                    cursor: isRunning ? 'not-allowed' : 'pointer',
                    opacity: isRunning ? 0.5 : 1
                  }}
                >
                  <option value="quiet">Quiet</option>
                  <option value="verbose">Verbose</option>
                  <option value="debug">Debug</option>
                </select>
              </div>

              {/* Save Run Button - only show when calculation succeeded */}
              {runStatus === 'success' && (
                <Button
                  onClick={handleSaveRun}
                  disabled={isSaving}
                  style={{
                    backgroundColor: '#8b5cf6',
                    color: '#fff',
                    padding: '12px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '20px',
                    opacity: isSaving ? 0.5 : 1,
                    cursor: isSaving ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Save style={{ width: '16px', height: '16px' }} />
                  {isSaving ? 'Saving...' : 'Save Run'}
                </Button>
              )}

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
                    gap: '8px',
                    marginTop: '20px'
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
                    marginTop: '20px',
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

      {/* Validation Panel */}
      {validationResult && (
        <div style={{ marginBottom: '24px' }}>
          <ValidationPanel
            result={validationResult}
            onDismiss={() => {
              setValidationResult(null)
              localStorage.removeItem('validationResult')
            }}
          />
        </div>
      )}

      {/* Log Panel */}
      <Card style={{
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        height: 'calc(100vh - 400px)',
        minHeight: '400px'
      }}>
        <CardContent style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>
              Calculation Log
            </h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                onClick={handleCopyLog}
                disabled={logs.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: logs.length === 0 ? 'rgba(71, 85, 105, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                  border: logs.length === 0 ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(59, 130, 246, 0.5)',
                  color: logs.length === 0 ? '#64748b' : '#3b82f6',
                  cursor: logs.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Copy style={{ width: '16px', height: '16px' }} />
                <span>Copy Log</span>
              </Button>
              <Button
                onClick={handleClearLog}
                disabled={logs.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: logs.length === 0 ? 'rgba(71, 85, 105, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                  border: logs.length === 0 ? '1px solid rgba(71, 85, 105, 0.3)' : '1px solid rgba(239, 68, 68, 0.5)',
                  color: logs.length === 0 ? '#64748b' : '#ef4444',
                  cursor: logs.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
                <span>Clear Log</span>
              </Button>
            </div>
          </div>
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
