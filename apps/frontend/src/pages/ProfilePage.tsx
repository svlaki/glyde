import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { fetchUserProfile, updateProfileField, UserProfile, ProfileSummary } from '../lib/profileService'

const PROFILE_SECTIONS = [
  { key: 'life', label: 'Life', icon: '🌟' },
  { key: 'work', label: 'Work', icon: '💼' },
  { key: 'productivity', label: 'Productivity', icon: '⚡' },
  { key: 'health', label: 'Health', icon: '💪' },
  { key: 'relationships', label: 'Relationships', icon: '❤️' },
  { key: 'routines', label: 'Routines', icon: '🔄' },
  { key: 'decision_making', label: 'Decision Making', icon: '🎯' },
  { key: 'communication', label: 'Communication', icon: '💬' },
  { key: 'learning', label: 'Learning', icon: '📚' },
  { key: 'agent_preferences', label: 'Agent Preferences', icon: '🤖' },
  { key: 'rules', label: 'Rules & Boundaries', icon: '⚖️' }
]

export default function ProfilePage() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [summary, setSummary] = useState<ProfileSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<{ path: string; value: any } | null>(null)

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  async function loadProfile() {
    if (!user) return
    setLoading(true)
    const result = await fetchUserProfile(user)
    if (result.error) {
      setError(result.error)
    } else {
      setProfile(result.profile || null)
      setSummary(result.summary || null)
    }
    setLoading(false)
  }

  async function handleUpdateField(path: string, value: any) {
    if (!user) return
    const { error } = await updateProfileField(user, path, value)
    if (error) {
      setError(error)
    } else {
      await loadProfile()
      setEditingField(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <div className="text-lg text-foreground">Loading profile...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">🤖 AI Context Profile</h1>
          <p className="text-muted-foreground">
            Manage what your AI assistant knows about you. The more context you provide, the better it can help you.
          </p>
        </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {summary && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">Profile Completeness</h2>
            <span className="text-3xl font-bold text-primary">
              {Math.round(summary.completenessPercentage)}%
            </span>
          </div>
          <div className="w-full bg-accent rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${summary.completenessPercentage}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            {summary.filledFields} of {summary.totalFields} fields completed
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PROFILE_SECTIONS.map(section => {
          const sectionData = profile?.[section.key as keyof UserProfile]
          const sectionSummary = summary?.sections[section.key]
          const completeness = sectionSummary ? (sectionSummary.filledFields / sectionSummary.totalFields) * 100 : 0

          return (
            <div
              key={section.key}
              className="bg-card border border-border rounded-xl p-5 cursor-pointer hover:shadow-lg hover:scale-105 transition-all duration-200"
              onClick={() => setSelectedSection(section.key)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{section.icon}</span>
                  <h3 className="font-semibold text-foreground">{section.label}</h3>
                </div>
                <span className="text-sm font-semibold text-primary">{Math.round(completeness)}%</span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${completeness}%` }}
                />
              </div>
              {sectionSummary && (
                <p className="text-xs text-muted-foreground mt-2">
                  {sectionSummary.filledFields} / {sectionSummary.totalFields} fields
                </p>
              )}
            </div>
          )
        })}
      </div>

      {selectedSection && (
        <SectionDetailModal
          section={PROFILE_SECTIONS.find(s => s.key === selectedSection)!}
          data={profile?.[selectedSection as keyof UserProfile] as Record<string, any> || {}}
          onClose={() => setSelectedSection(null)}
          onUpdate={handleUpdateField}
        />
      )}
    </div>
    </div>
  )
}

function SectionDetailModal({
  section,
  data,
  onClose,
  onUpdate
}: {
  section: { key: string; label: string; icon: string }
  data: Record<string, any>
  onClose: () => void
  onUpdate: (path: string, value: any) => void
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  function handleEdit(key: string, currentValue: any) {
    setEditingKey(key)
    setEditValue(JSON.stringify(currentValue, null, 2))
  }

  function handleSave(key: string) {
    try {
      const parsed = JSON.parse(editValue)
      onUpdate(`${section.key}.${key}`, parsed)
      setEditingKey(null)
    } catch (e) {
      alert('Invalid JSON format')
    }
  }

  function handleAddField() {
    if (!newKey) return
    try {
      const parsed = JSON.parse(newValue)
      onUpdate(`${section.key}.${newKey}`, parsed)
      setNewKey('')
      setNewValue('')
    } catch (e) {
      alert('Invalid JSON format')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{section.icon}</span>
            <h2 className="text-3xl font-bold text-foreground">{section.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-2xl w-10 h-10 rounded-full hover:bg-accent transition-all flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="border border-border rounded-lg p-4 bg-background hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-semibold text-foreground">{key}</h4>
                {editingKey !== key && (
                  <button
                    onClick={() => handleEdit(key, value)}
                    className="text-primary hover:text-primary/80 text-sm font-medium px-3 py-1 rounded-md hover:bg-primary/10 transition-all"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
              {editingKey === key ? (
                <div>
                  <textarea
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="w-full border border-input bg-background rounded-lg px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    rows={6}
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleSave(key)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={() => setEditingKey(null)}
                      className="px-4 py-2 border border-border bg-background text-foreground rounded-lg text-sm font-semibold hover:bg-accent transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <pre className="text-sm bg-accent/50 p-3 rounded-lg overflow-x-auto text-foreground">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          ))}

          <div className="border-t border-border pt-6 mt-6">
            <h3 className="font-semibold text-foreground mb-4 text-lg">➕ Add New Field</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Field name"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                className="w-full border border-input bg-background rounded-lg px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <textarea
                placeholder='Value (JSON format, e.g., "text", 123, {"key": "value"})'
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-full border border-input bg-background rounded-lg px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                rows={3}
              />
              <button
                onClick={handleAddField}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-all shadow-sm"
              >
                ➕ Add Field
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 border-2 border-border bg-background text-foreground rounded-lg font-semibold hover:bg-accent transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
