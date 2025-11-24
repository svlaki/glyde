import { useState, useEffect } from 'react'
import { useAuth } from '../lib/authContext'
import { fetchUserProfile, updateProfileField } from '../lib/profileService'
import { Loader, Text, Card, Grid, Progress, Button, Modal, Textarea, TextInput, Badge } from '@mantine/core'
import { PROFILE_SECTIONS, type ProfileData, type ProfileSection } from '@/lib/profileSections'

export default function ProfilePage() {
  const { user, session } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<ProfileSection | null>(null)

  useEffect(() => {
    if (user) {
      loadProfile()
    }
  }, [user])

  async function loadProfile() {
    if (!user || !session?.access_token) return
    setLoading(true)
    setError(null)
    const result = await fetchUserProfile(user, session.access_token)
    if (result.error) {
      setError(result.error)
    } else {
      setProfile(result.profile as ProfileData || null)
    }
    setLoading(false)
  }

  async function handleUpdateField(field: string, value: any) {
    if (!user || !session?.access_token) return
    const { error } = await updateProfileField(user, session.access_token, field, value)
    if (error) {
      setError(error)
    } else {
      await loadProfile()
      setSelectedSection(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader size="lg" />
          <Text size="lg">Loading profile...</Text>
        </div>
      </div>
    )
  }

  const completeness = calculateCompleteness(profile)

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">🤖 AI Context Profile</h1>
          <Text c="dimmed">
            Manage what your AI assistant knows about you. The more context you provide, the better it can help you.
          </Text>
        </div>

        {error && (
          <Card className="mb-6" withBorder bg="red.0">
            <Text c="red">{error}</Text>
          </Card>
        )}

        <Card withBorder className="mb-6" p="lg">
          <div className="flex items-center justify-between mb-3">
            <Text size="lg" fw={600}>Profile Completeness</Text>
            <Badge size="xl" variant="gradient" gradient={{ from: 'blue', to: 'cyan' }}>
              {Math.round(completeness.percentage)}%
            </Badge>
          </div>
          <Progress
            value={completeness.percentage}
            size="lg"
            radius="xl"
            striped
            animated={completeness.percentage < 100}
          />
          <Text size="sm" c="dimmed" mt="sm">
            {completeness.filled} of {completeness.total} sections have data
          </Text>
        </Card>

        <Grid>
          {PROFILE_SECTIONS.map(section => {
            const sectionData = profile?.[section.key as keyof ProfileData]
            const hasData = sectionData && (
              typeof sectionData === 'string' ? sectionData.length > 0 :
              Object.keys(sectionData).length > 0
            )
            const fieldCount = typeof sectionData === 'object' && sectionData !== null
              ? Object.keys(sectionData).length
              : (sectionData ? 1 : 0)

            return (
              <Grid.Col key={section.key} span={{ base: 12, sm: 6, lg: 4 }}>
                <Card
                  withBorder
                  p="lg"
                  className="cursor-pointer hover:shadow-lg transition-all duration-200"
                  onClick={() => setSelectedSection(section)}
                  style={{ height: '100%' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{section.icon}</span>
                      <Text fw={600}>{section.label}</Text>
                    </div>
                    {hasData && <Badge color="green" variant="light">✓</Badge>}
                  </div>
                  <Text size="sm" c="dimmed" mb="md">
                    {section.description}
                  </Text>
                  {hasData && (
                    <Text size="xs" c="dimmed">
                      {fieldCount} {section.isJsonb ? 'field' : 'character'}{fieldCount !== 1 ? 's' : ''}
                    </Text>
                  )}
                  {!hasData && (
                    <Text size="xs" c="dimmed" fs="italic">
                      No data yet - click to add
                    </Text>
                  )}
                </Card>
              </Grid.Col>
            )
          })}
        </Grid>

        {selectedSection && (
          <SectionEditModal
            section={selectedSection}
            data={profile?.[selectedSection.key as keyof ProfileData]}
            onClose={() => setSelectedSection(null)}
            onUpdate={handleUpdateField}
          />
        )}
      </div>
    </div>
  )
}

function calculateCompleteness(profile: ProfileData | null): { filled: number; total: number; percentage: number } {
  if (!profile) return { filled: 0, total: PROFILE_SECTIONS.length, percentage: 0 }

  let filled = 0
  PROFILE_SECTIONS.forEach(section => {
    const data = profile[section.key as keyof ProfileData]
    if (data) {
      if (typeof data === 'string' && data.length > 0) filled++
      else if (typeof data === 'object' && Object.keys(data).length > 0) filled++
    }
  })

  return {
    filled,
    total: PROFILE_SECTIONS.length,
    percentage: (filled / PROFILE_SECTIONS.length) * 100
  }
}

function SectionEditModal({
  section,
  data,
  onClose,
  onUpdate
}: {
  section: ProfileSection
  data: any
  onClose: () => void
  onUpdate: (field: string, value: any) => void
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [textValue, setTextValue] = useState(typeof data === 'string' ? data : '')

  const dataObject = typeof data === 'object' && data !== null ? data : {}

  function handleEdit(key: string, currentValue: any) {
    setEditingKey(key)
    setEditValue(typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2))
  }

  function handleSave(key: string) {
    try {
      // Try to parse as JSON, fallback to string
      let parsed: any
      try {
        parsed = JSON.parse(editValue)
      } catch {
        parsed = editValue // Keep as string if not valid JSON
      }

      const updatedData = { ...dataObject, [key]: parsed }
      onUpdate(section.key, updatedData)
      setEditingKey(null)
    } catch (e) {
      alert('Error saving field')
    }
  }

  function handleAddField() {
    if (!newKey.trim()) {
      alert('Field name is required')
      return
    }
    try {
      let parsed: any
      try {
        parsed = JSON.parse(newValue)
      } catch {
        parsed = newValue // Keep as string if not valid JSON
      }

      const updatedData = { ...dataObject, [newKey]: parsed }
      onUpdate(section.key, updatedData)
      setNewKey('')
      setNewValue('')
    } catch (e) {
      alert('Error adding field')
    }
  }

  function handleSaveText() {
    onUpdate(section.key, textValue)
  }

  function handleDeleteField(key: string) {
    if (!confirm(`Delete field "${key}"?`)) return
    const updatedData = { ...dataObject }
    delete updatedData[key]
    onUpdate(section.key, updatedData)
  }

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span className="text-2xl">{section.icon}</span>
          <Text size="xl" fw={700}>{section.label}</Text>
        </div>
      }
      size="xl"
      styles={{ title: { width: '100%' } }}
    >
      <Text size="sm" c="dimmed" mb="lg">
        {section.description}
      </Text>

      {!section.isJsonb ? (
        // Text field (goals_summary)
        <div>
          <Textarea
            label="Content"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            minRows={8}
            autosize
            placeholder="Enter your goals summary..."
          />
          <Button onClick={handleSaveText} mt="md" fullWidth>
            💾 Save
          </Button>
        </div>
      ) : (
        // JSONB fields
        <div>
          <div className="space-y-3 mb-6">
            {Object.entries(dataObject).map(([key, value]) => (
              <Card key={key} withBorder p="md">
                <div className="flex items-start justify-between mb-2">
                  <Text fw={600}>{key}</Text>
                  <div className="flex gap-2">
                    {editingKey !== key && (
                      <>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleEdit(key, value)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="red"
                          onClick={() => handleDeleteField(key)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {editingKey === key ? (
                  <div>
                    <Textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      minRows={4}
                      autosize
                      styles={{ input: { fontFamily: 'monospace' } }}
                    />
                    <div className="flex gap-2 mt-3">
                      <Button onClick={() => handleSave(key)} size="sm">
                        💾 Save
                      </Button>
                      <Button onClick={() => setEditingKey(null)} size="sm" variant="subtle">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="text-sm bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </pre>
                )}
              </Card>
            ))}
          </div>

          <Card withBorder p="md" bg="gray.0">
            <Text fw={600} mb="md">➕ Add New Field</Text>
            <div className="space-y-3">
              <TextInput
                label="Field Name"
                placeholder="e.g., coreValues, workStyle, etc."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
              />
              <Textarea
                label="Value"
                placeholder='Enter value (can be text, number, or JSON like {"key": "value"})'
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                minRows={3}
                styles={{ input: { fontFamily: 'monospace' } }}
              />
              <Button onClick={handleAddField} fullWidth>
                ➕ Add Field
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Modal>
  )
}
