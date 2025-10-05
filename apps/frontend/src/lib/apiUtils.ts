/**
 * Utility functions for API calls and error handling
 * 
 * This module provides reusable utilities for:
 * - Making API calls with consistent error handling
 * - Input validation and sanitization
 * - Error message formatting
 * - Performance optimization utilities
 */

import { supabase } from './supabase'

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Generic API call wrapper with error handling
 * 
 * @param url - The API endpoint URL
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise resolving to ApiResponse with success/error status
 * 
 * @example
 * ```typescript
 * const result = await apiCall<User[]>('/api/users');
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */

async function resolveAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Failed to retrieve session for auth headers:', error)
      return null
    }
    return data.session?.access_token ?? null
  } catch (err) {
    console.error('Unexpected error retrieving auth session:', err)
    return null
  }
}

async function withAuthHeaders(options: RequestInit = {}): Promise<RequestInit> {
  const accessToken = await resolveAccessToken()
  const headers = new Headers(options.headers ?? {})

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  return {
    ...options,
    headers,
  }
}

export async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const requestInit = await withAuthHeaders(options)
  return fetch(url, requestInit)
}

export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await authorizedFetch(url, options)

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error('API call failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Validate required fields
export function validateRequired(
  data: Record<string, any>,
  requiredFields: string[]
): string | null {
  for (const field of requiredFields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim().length === 0)) {
      return `${field} is required`;
    }
  }
  return null;
}

// Sanitize string input
export function sanitizeString(input: string, maxLength: number = 1000): string {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim()
    .substring(0, maxLength);
}

// Format error message for display
export function formatErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unexpected error occurred';
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Format date for display
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Format time for display
export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
