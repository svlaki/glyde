import { useState } from 'react'
import { getColors } from '../styles/colors'
import { getTypography } from '../styles/typography'
import type { Friend } from '../lib/friendshipService'
import type { Aspect } from '../lib/aspectService'

interface FriendDetailPanelProps {
  friend: Friend
  isMobile?: boolean
  colors: ReturnType<typeof getColors>
  typography: ReturnType<typeof getTypography>
  aspects: Aspect[]
  onSaveNotes: (friendshipId: string, notes: string) => Promise<void>
  onAddAspect: (aspectId: string) => Promise<void>
  onRemoveAspect: (aspectId: string) => Promise<void>
  onRemoveFriend: (friendshipId: string) => void
}

export function FriendDetailPanel({
  friend,
  isMobile = false,
  colors,
  typography,
  aspects,
  onSaveNotes,
  onAddAspect,
  onRemoveAspect,
  onRemoveFriend
}: FriendDetailPanelProps) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(friend.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)

  const availableAspects = aspects.filter(
    asp => !friend.aspects.some(fc => fc.id === asp.id)
  )

  async function handleSaveNotes() {
    setSavingNotes(true)
    await onSaveNotes(friend.friendship_id, notesValue)
    setEditingNotes(false)
    setSavingNotes(false)
  }

  return (
    <div style={{ maxWidth: isMobile ? '100%' : '600px' }}>
      {/* Friend Header */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        gap: '16px',
        marginBottom: '24px',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flex: 1
        }}>
          <div style={{
            width: isMobile ? '56px' : '64px',
            height: isMobile ? '56px' : '64px',
            borderRadius: '50%',
            background: colors.bgTertiary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden'
          }}>
            {friend.friend_avatar_url ? (
              <img
                src={friend.friend_avatar_url}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{
                ...typography.headingMd,
                fontWeight: 600,
                color: colors.textSecondary
              }}>
                {friend.friend_display_name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{
              ...typography.headingMd,
              fontWeight: 600,
              color: colors.textPrimary,
              margin: 0
            }}>
              {friend.friend_display_name}
            </h2>
            <div style={{
              ...typography.bodySm,
              color: colors.textSecondary,
              marginTop: '4px'
            }}>
              {friend.friend_email}
            </div>
          </div>
        </div>
        <button
          onClick={() => onRemoveFriend(friend.friendship_id)}
          style={{
            padding: isMobile ? '10px 16px' : '8px 16px',
            ...typography.labelSm,
            fontWeight: 500,
            background: 'transparent',
            color: '#d32f2f',
            border: '1px solid #d32f2f',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s',
            minHeight: isMobile ? '44px' : 'auto',
            alignSelf: isMobile ? 'stretch' : 'auto'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#d32f2f'
            e.currentTarget.style.color = 'white'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = '#d32f2f'
          }}
        >
          Remove Friend
        </button>
      </div>

      {/* Notes Section */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px'
        }}>
          <label style={{
            ...typography.labelLg,
            fontWeight: 600,
            color: colors.textPrimary
          }}>
            Notes
          </label>
          {!editingNotes ? (
            <button
              onClick={() => setEditingNotes(true)}
              style={{
                padding: isMobile ? '8px 14px' : '4px 10px',
                ...typography.labelSm,
                fontWeight: 500,
                background: colors.bgTertiary,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                minHeight: isMobile ? '44px' : 'auto'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bgHover
                e.currentTarget.style.color = colors.textPrimary
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.bgTertiary
                e.currentTarget.style.color = colors.textSecondary
              }}
            >
              Edit
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleSaveNotes}
                disabled={savingNotes}
                style={{
                  padding: isMobile ? '8px 14px' : '4px 10px',
                  ...typography.labelSm,
                  fontWeight: 500,
                  background: '#2e7d32',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: savingNotes ? 'not-allowed' : 'pointer',
                  opacity: savingNotes ? 0.6 : 1,
                  transition: 'all 0.15s',
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                {savingNotes ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingNotes(false)
                  setNotesValue(friend.notes || '')
                }}
                style={{
                  padding: isMobile ? '8px 14px' : '4px 10px',
                  ...typography.labelSm,
                  fontWeight: 500,
                  background: colors.bgTertiary,
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        {editingNotes ? (
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            placeholder="Add notes about this friend (interests, how you know them, etc.)"
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              ...typography.bodySm,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.bgSecondary,
              color: colors.textPrimary,
              resize: 'vertical',
              outline: 'none',
              transition: 'all 0.15s',
              fontSize: isMobile ? '16px' : undefined // Prevent iOS zoom
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.textPrimary
              e.currentTarget.style.background = colors.bgPrimary
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border
              e.currentTarget.style.background = colors.bgSecondary
            }}
          />
        ) : (
          <div style={{
            padding: '12px',
            background: colors.bgSecondary,
            border: `1px solid ${colors.border}`,
            borderRadius: '6px',
            minHeight: '60px',
            ...typography.bodySm,
            color: friend.notes ? colors.textPrimary : colors.textSecondary,
            whiteSpace: 'pre-wrap'
          }}>
            {friend.notes || 'No notes yet. Click Edit to add notes about this friend.'}
          </div>
        )}
      </div>

      {/* Aspects Section */}
      <div>
        <label style={{
          ...typography.labelLg,
          fontWeight: 600,
          color: colors.textPrimary,
          display: 'block',
          marginBottom: '8px'
        }}>
          Associated Aspects
        </label>
        <p style={{
          ...typography.bodySm,
          color: colors.textSecondary,
          margin: '0 0 12px 0'
        }}>
          Tag this friend with aspects they're involved in
        </p>

        {/* Current aspects */}
        {friend.aspects.length > 0 && (
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '12px'
          }}>
            {friend.aspects.map(cat => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: isMobile ? '8px 12px' : '6px 10px',
                  borderRadius: '6px',
                  background: cat.color + '20',
                  border: `1px solid ${cat.color}40`,
                  minHeight: isMobile ? '44px' : 'auto'
                }}
              >
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: cat.color
                }} />
                <span style={{
                  ...typography.labelSm,
                  fontWeight: 500,
                  color: colors.textPrimary
                }}>
                  {cat.name}
                </span>
                <button
                  onClick={() => onRemoveAspect(cat.id)}
                  style={{
                    padding: '0',
                    width: isMobile ? '24px' : '16px',
                    height: isMobile ? '24px' : '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    borderRadius: '50%',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.bgTertiary
                    e.currentTarget.style.color = colors.textPrimary
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = colors.textSecondary
                  }}
                  title="Remove aspect"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add aspect dropdown */}
        {availableAspects.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                onAddAspect(e.target.value)
                e.target.value = ''
              }
            }}
            style={{
              padding: '8px 12px',
              ...typography.bodySm,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              background: colors.bgSecondary,
              color: colors.textPrimary,
              cursor: 'pointer',
              outline: 'none',
              minHeight: isMobile ? '44px' : 'auto',
              fontSize: isMobile ? '16px' : undefined // Prevent iOS zoom
            }}
          >
            <option value="">+ Add aspect...</option>
            {availableAspects.map(asp => (
              <option key={asp.id} value={asp.id}>
                {asp.name}
              </option>
            ))}
          </select>
        )}

        {availableAspects.length === 0 && friend.aspects.length > 0 && (
          <div style={{
            ...typography.bodySm,
            color: colors.textSecondary,
            fontStyle: 'italic'
          }}>
            All aspects have been assigned
          </div>
        )}

        {aspects.length === 0 && (
          <div style={{
            ...typography.bodySm,
            color: colors.textSecondary
          }}>
            No aspects available. Create aspects in the Aspects page to tag your friends.
          </div>
        )}
      </div>
    </div>
  )
}
