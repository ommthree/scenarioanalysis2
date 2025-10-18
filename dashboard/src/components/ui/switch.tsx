import * as React from "react"

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, disabled }, ref) => {
    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        style={{
          all: 'unset',
          width: '42px',
          height: '24px',
          backgroundColor: checked ? '#3b82f6' : 'rgba(100, 116, 139, 0.5)',
          borderRadius: '9999px',
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'background-color 0.2s',
          border: '2px solid transparent'
        }}
      >
        <span
          style={{
            display: 'block',
            width: '20px',
            height: '20px',
            backgroundColor: 'white',
            borderRadius: '9999px',
            transition: 'transform 0.2s',
            transform: checked ? 'translateX(18px)' : 'translateX(0px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </button>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
