/**
 * Standard API response format for all endpoints
 */
export interface ApiResponse<T = void> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
}
