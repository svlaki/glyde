import { useState } from 'react'
import { useTheme } from '../../../lib/themeContext'
import { getColors } from '../../../styles/colors'
import { useOnboarding } from '../OnboardingContext'

const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona (MST)' },
  { value: 'America/Anchorage', label: 'Alaska Time' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST)' }
]

interface TimezoneConfirmProps {
  onConfirm: () => void
}

export function TimezoneConfirm({ onConfirm }: TimezoneConfirmProps) {
  const { theme, isDarkMode } = useTheme()
  const colors = getColors(theme)
  const { state, updateField } = useOnboarding()
  const [showDropdown, setShowDropdown] = useState(false)

  // Get current time in selected timezone
  const getCurrentTime = () => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: state.timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date())
    } catch {
      return 'Invalid timezone'
    }
  }

  // Get friendly timezone name
  const getTimezoneName = () => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === state.timezone)
    return found?.label || state.timezone
  }

  const handleConfirm = () => {
    updateField('timezoneConfirmed', true)
    onConfirm()
  }

  return (
    <div style={{
      padding: '24px',
      borderRadius: '12px',
      backgroundColor: colors.bgSecondary,
      border: `1px solid ${colors.border}`,
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      <h3 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: colors.textPrimary,
        marginBottom: '8px',
        textAlign: 'center'
      }}>
        Confirm your timezone
      </h3>
      <p style={{
        fontSize: '14px',
        color: colors.textSecondary,
        marginBottom: '20px',
        textAlign: 'center'
      }}>
        We detected your timezone based on your browser settings.
      </p>

      {/* Detected timezone display */}
      <div style={{
        padding: '16px',
        borderRadius: '8px',
        backgroundColor: colors.bgTertiary,
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 600,
          color: colors.textPrimary,
          marginBottom: '4px'
        }}>
          {getCurrentTime()}
        </div>
        <div style={{
          fontSize: '14px',
          color: colors.textSecondary
        }}>
          {getTimezoneName()}
        </div>
      </div>

      {/* Change timezone option */}
      {!showDropdown ? (
        <button
          type="button"
          onClick={() => setShowDropdown(true)}
          style={{
            width: '100%',
            padding: '10px',
            marginBottom: '16px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent',
            color: colors.textSecondary,
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >
          Not correct? Change timezone
        </button>
      ) : (
        <div style={{ marginBottom: '16px' }}>
          <select
            value={state.timezone}
            onChange={(e) => updateField('timezone', e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.bgSecondary,
              color: colors.textPrimary,
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {COMMON_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Confirm button */}
      <button
        type="button"
        onClick={handleConfirm}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          fontSize: '16px',
          fontWeight: 500,
          cursor: 'pointer'
        }}
      >
        Confirm & Continue
      </button>
    </div>
  )
}
