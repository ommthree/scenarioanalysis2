import { CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react'

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

interface ValidationPanelProps {
  result: ValidationResult | null
  onDismiss?: () => void
}

export default function ValidationPanel({ result, onDismiss }: ValidationPanelProps) {
  if (!result) return null

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
      case 'warning':
        return <AlertCircle style={{ width: '20px', height: '20px', color: '#f59e0b', flexShrink: 0 }} />
      case 'info':
        return <Info style={{ width: '20px', height: '20px', color: '#3b82f6', flexShrink: 0 }} />
      default:
        return <CheckCircle2 style={{ width: '20px', height: '20px', color: '#10b981', flexShrink: 0 }} />
    }
  }

  const getColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return '#ef4444'
      case 'warning':
        return '#f59e0b'
      case 'info':
        return '#3b82f6'
      default:
        return '#10b981'
    }
  }

  const getBgColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'rgba(239, 68, 68, 0.1)'
      case 'warning':
        return 'rgba(245, 158, 11, 0.1)'
      case 'info':
        return 'rgba(59, 130, 246, 0.1)'
      default:
        return 'rgba(16, 185, 129, 0.1)'
    }
  }

  const allMessages = [
    ...result.errors,
    ...result.warnings,
    ...result.info
  ]

  if (allMessages.length === 0) return null

  return (
    <div style={{
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      border: result.valid ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {result.valid ? (
            <>
              <CheckCircle2 style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#10b981' }}>
                Pre-Calculation Validation Passed
              </h3>
            </>
          ) : (
            <>
              <XCircle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#ef4444' }}>
                Pre-Calculation Validation Failed
              </h3>
            </>
          )}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {result.errors.length > 0 && (
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#ef4444',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <XCircle style={{ width: '16px', height: '16px' }} />
              Errors ({result.errors.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.errors.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '12px',
                    backgroundColor: getBgColor('error'),
                    borderRadius: '6px',
                    borderLeft: `4px solid ${getColor('error')}`
                  }}
                >
                  {getIcon('error')}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#ef4444', fontWeight: '500', marginBottom: '4px' }}>
                      {msg.code}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#f59e0b',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle style={{ width: '16px', height: '16px' }} />
              Warnings ({result.warnings.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {result.warnings.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '12px',
                    backgroundColor: getBgColor('warning'),
                    borderRadius: '6px',
                    borderLeft: `4px solid ${getColor('warning')}`
                  }}
                >
                  {getIcon('warning')}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f59e0b', fontWeight: '500', marginBottom: '4px' }}>
                      {msg.code}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '14px' }}>
                      {msg.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result.info.length > 0 && result.errors.length === 0 && (
          <div>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#3b82f6',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Info style={{ width: '16px', height: '16px' }} />
              System Check ({result.info.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {result.info.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '8px 12px',
                    backgroundColor: getBgColor('info'),
                    borderRadius: '4px',
                    borderLeft: `3px solid ${getColor('info')}`
                  }}
                >
                  {getIcon('info')}
                  <div style={{ color: '#cbd5e1', fontSize: '13px', flex: 1 }}>
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!result.valid && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderRadius: '6px',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
            Action Required
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '13px' }}>
            Fix all errors before proceeding with calculation. Warnings can be ignored if intentional.
          </div>
        </div>
      )}
    </div>
  )
}
