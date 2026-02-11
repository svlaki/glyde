import { supabase } from './supabase'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const BUCKET = 'avatars'

interface UploadResult {
  success: boolean
  avatarUrl?: string
  error?: string
}

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please select a JPEG, PNG, WebP, or GIF image'
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'Image must be under 2MB'
  }
  return null
}

export async function uploadAvatar(userId: string, file: File): Promise<UploadResult> {
  try {
    const validationError = validateAvatarFile(file)
    if (validationError) {
      return { success: false, error: validationError }
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filePath = `${userId}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      return { success: false, error: uploadError.message }
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath)

    // Cache bust with timestamp so browser fetches fresh image on re-upload
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`

    const { error: updateError } = await supabase
      .from('profile')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true, avatarUrl }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}
