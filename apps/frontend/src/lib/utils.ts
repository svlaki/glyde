import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function generateEmbedding({ input, apiKey }: { input: string, apiKey?: string }): Promise<number[] | null> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined)
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.embedding || null
  } catch {
    return null
  }
}
