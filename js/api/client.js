import { config } from '../config.js';
import { getToken, clearSession } from '../auth/session.js';

/**
 * Low-level HTTP client for the CARE Dadaab REST API.
 * Separates networking from page/UI logic.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, errors = [], data = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.data = data;
  }
}

function buildUrl(path, query) {
  const base = config.API_BASE_URL.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url.toString();
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : null;
}

/**
 * @param {string} path
 * @param {RequestInit & { query?: Record<string, unknown>, auth?: boolean }} options
 */
export async function apiRequest(path, options = {}) {
  const {
    method = 'GET',
    body,
    query,
    auth = true,
    headers = {},
    ...rest
  } = options;

  const requestHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      body: body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
      ...rest,
    });
  } catch {
    throw new ApiError('Unable to reach the server. Please check your connection and try again.');
  }

  const payload = await parseBody(response);

  if (response.status === 401 && auth) {
    clearSession();
    if (!window.location.pathname.includes('/admin/login')) {
      window.location.href = '/admin/login.html';
    }
    throw new ApiError(payload?.message || 'Your session has expired. Please sign in again.', {
      status: 401,
      errors: payload?.errors || [],
      data: payload?.data ?? null,
    });
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || `Request failed (${response.status}).`, {
      status: response.status,
      errors: payload?.errors || [],
      data: payload?.data ?? null,
    });
  }

  return payload;
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' }),
};
