/**
 * Mock Express Request / Response factories for API route tests.
 *
 * Usage:
 *   const { req, res } = createMockRequest({ body: { title: 'Test' } });
 *   await myRouteHandler(req as any, res as any);
 *   expect(res.statusCode).toBe(200);
 *   expect(res.getResponseData()).toEqual({ success: true, data: ... });
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockRequestOverrides {
  authUserId?: string;
  body?: Record<string, any>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  method?: string;
  path?: string;
  url?: string;
}

interface MockResponse {
  json: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  sendStatus: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  header: ReturnType<typeof vi.fn>;
  statusCode: number;
  /** Retrieve the last value passed to res.json() */
  getResponseData: () => any;
  /** Retrieve all values passed to res.json() across calls */
  getAllResponses: () => any[];
}

// ---------------------------------------------------------------------------
// Factory: createMockRequest
// ---------------------------------------------------------------------------

export function createMockRequest(overrides: MockRequestOverrides = {}) {
  const req = {
    authUserId: overrides.authUserId ?? 'test-user-123',
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    headers: {
      'content-type': 'application/json',
      ...overrides.headers,
    },
    method: overrides.method ?? 'POST',
    path: overrides.path ?? '/',
    url: overrides.url ?? '/',
    get: vi.fn((headerName: string) => {
      const lower = headerName.toLowerCase();
      return (req.headers as Record<string, string>)[lower] ?? null;
    }),
  };

  return req;
}

// ---------------------------------------------------------------------------
// Factory: createMockResponse
// ---------------------------------------------------------------------------

export function createMockResponse(): MockResponse {
  const responseData: any[] = [];
  let currentStatusCode = 200;

  const res: MockResponse = {
    statusCode: currentStatusCode,
    json: vi.fn((data: any) => {
      responseData.push(data);
      return res;
    }),
    send: vi.fn((data?: any) => {
      if (data !== undefined) {
        responseData.push(data);
      }
      return res;
    }),
    sendStatus: vi.fn((code: number) => {
      currentStatusCode = code;
      res.statusCode = code;
      return res;
    }),
    status: vi.fn((code: number) => {
      currentStatusCode = code;
      res.statusCode = code;
      return res;
    }),
    set: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    getResponseData() {
      return responseData.length > 0
        ? responseData[responseData.length - 1]
        : undefined;
    },
    getAllResponses() {
      return [...responseData];
    },
  };

  // Make status() chainable (returns res so .json() can follow)
  res.status = vi.fn((code: number) => {
    currentStatusCode = code;
    res.statusCode = code;
    return res;
  });

  return res;
}
