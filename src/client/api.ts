export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let csrfTokenCache: string | null = null;

export function setCachedCsrfToken(token: string | null) {
  csrfTokenCache = token;
}

export function getCachedCsrfToken(): string | null {
  return csrfTokenCache;
}

interface ApiResponseEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (csrfTokenCache && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = csrfTokenCache;
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin',
      signal: controller.signal,
    });

    // Check for updated CSRF token from response headers
    const newCsrf = res.headers.get('x-csrf-token') || res.headers.get('X-CSRF-Token');
    if (newCsrf) {
      csrfTokenCache = newCsrf;
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    const json = (await res.json().catch(() => ({}))) as ApiResponseEnvelope<T>;

    if (!res.ok || json.success === false) {
      const code = json.error?.code || (res.status === 409 ? 'CONFLICT' : res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : 'REQUEST_FAILED');
      const message = json.error?.message || `Request failed with status ${res.status}`;
      throw new ApiError(res.status, code, message, json.error?.details);
    }

    // If enveloped with data, return data; otherwise return raw json
    if (json && typeof json === 'object' && 'data' in json) {
      return json.data as T;
    }
    return json as unknown as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(408, 'TIMEOUT', 'The request took too long to complete. Please retry.');
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      (err as Error)?.message || 'Network error occurred. Please check connection.'
    );
  } finally {
    clearTimeout(timer);
  }
}

api.get = <T>(path: string, options?: RequestInit) =>
  api<T>(path, { ...options, method: 'GET' });

api.post = <T>(path: string, body?: unknown, options?: RequestInit) =>
  api<T>(path, {
    ...options,
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

api.patch = <T>(path: string, body?: unknown, options?: RequestInit) =>
  api<T>(path, {
    ...options,
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

api.delete = <T>(path: string, options?: RequestInit) =>
  api<T>(path, { ...options, method: 'DELETE' });
