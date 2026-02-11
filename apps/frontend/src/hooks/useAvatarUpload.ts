import { useState, useCallback } from 'react'
import { uploadAvatar, validateAvatarFile } from '../lib/avatarService'

interface UseAvatarUploadResult {
  uploading: boolean
  error: string | null
  handleFileSelect: (file: File, userId: string) => Promise<string | null>
}

export function useAvatarUpload(): UseAvatarUploadResult {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File, userId: string): Promise<string | null> => {
    const validationError = validateAvatarFile(file)
    if (validationError) {
      setError(validationError)
      return null
    }

    setUploading(true)
    setError(null)

    const result = await uploadAvatar(userId, file)

    setUploading(false)

    if (!result.success) {
      setError(result.error || 'Upload failed')
      return null
    }

    return result.avatarUrl || null
  }, [])

  return { uploading, error, handleFileSelect }
}
