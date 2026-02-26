/**
 * Mock fetch for frontend service tests
 */
export function createMockFetch(responses: Array<{ ok: boolean; status?: number; json: () => Promise<any> }>) {
  let callIndex = 0
  const mockFn = vi.fn(async () => {
    const response = responses[callIndex] || responses[responses.length - 1]
    callIndex++
    return {
      ok: response.ok,
      status: response.status || (response.ok ? 200 : 500),
      json: response.json,
    }
  })
  return mockFn
}

export function mockFetchSuccess(data: any) {
  return createMockFetch([{ ok: true, json: async () => data }])
}

export function mockFetchError(error: string, status = 500) {
  return createMockFetch([{ ok: false, status, json: async () => ({ error }) }])
}

export function mockFetchThrow() {
  return vi.fn(() => Promise.reject(new Error('Network error')))
}
