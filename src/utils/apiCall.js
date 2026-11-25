import toast from 'react-hot-toast';
import { API_BASE, UPLOAD_API_URL } from './config';

export const handleApiError = (error, fallbackMessage = null) => {
  const message =
    fallbackMessage ||
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.detail ||
    error?.message ||
    'Network error or server unreachable';

  toast.error(typeof message === 'string' ? message : JSON.stringify(message));
};

const getSessionRefreshLock = () => window.__session_refresh_lock__ || null;
const setSessionRefreshLock = (value) => {
  window.__session_refresh_lock__ = value;
};

const getStoredSessionSnapshot = () => {
  const rawUserData = localStorage.getItem('admin_data');
  let parsed = null;

  try {
    parsed = rawUserData ? JSON.parse(rawUserData) : null;
  } catch (error) {
    console.warn('Failed to parse admin_data while refreshing session:', error);
  }

  const accessToken = localStorage.getItem('access_token') || parsed?.access_token || parsed?.token || '';
  const refreshToken = localStorage.getItem('refresh_token') || parsed?.refresh_token || '';
  const expiresInSec = Number(parsed?.expires_in ?? parsed?.expires_in_sec ?? 900) || 900;
  const expiresAt = parsed?.expires_at ? new Date(parsed.expires_at).getTime() : Date.now() + expiresInSec * 1000;

  return {
    accessToken: typeof accessToken === 'string' ? accessToken.trim() : '',
    refreshToken: typeof refreshToken === 'string' ? refreshToken.trim() : '',
    expiresAt,
    expiresInSec
  };
};

const persistSessionAfterRefresh = (nextAccessToken, nextRefreshToken, expiresInSec) => {
  const existingUserData = localStorage.getItem('admin_data');
  let parsed = null;

  try {
    parsed = existingUserData ? JSON.parse(existingUserData) : null;
  } catch (error) {
    console.warn('Failed to parse admin_data after refresh:', error);
  }

  const normalizedSession = {
    ...(parsed || {}),
    access_token: nextAccessToken,
    refresh_token: nextRefreshToken,
    token: nextAccessToken,
    token_type: parsed?.token_type || 'bearer',
    expires_in: expiresInSec,
    expires_in_sec: expiresInSec,
    expires_at: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };

  localStorage.setItem('admin_data', JSON.stringify(normalizedSession));
  localStorage.setItem('access_token', nextAccessToken);
  if (nextRefreshToken) localStorage.setItem('refresh_token', nextRefreshToken);
};

const refreshAccessTokenSilently = async (signal) => {
  const { refreshToken } = getStoredSessionSnapshot();
  if (!refreshToken) return null;

  if (getSessionRefreshLock()) {
    return getSessionRefreshLock();
  }

  const promise = (async () => {
    const response = await fetch(`${API_BASE}/api/v1/sessions/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken || '' }),
      signal,
    });

    const payload = await response.json().catch(() => ({}));
    const data = payload?.data && typeof payload.data === 'object' ? payload.data : payload;

    if (!response.ok || !(data?.access_token || data?.token)) {
      throw new Error(payload?.message || payload?.detail || data?.message || data?.detail || 'Refresh token failed');
    }

    const nextAccessToken = data.access_token || data.token;
    const nextRefreshToken = data.refresh_token || payload?.refresh_token || refreshToken;
    const expiresInSec = Number(data?.expires_in ?? data?.expires_in_sec ?? payload?.expires_in ?? payload?.expires_in_sec ?? 900) || 900;

    persistSessionAfterRefresh(nextAccessToken, nextRefreshToken, expiresInSec);
    return nextAccessToken;
  })();

  setSessionRefreshLock(promise);

  try {
    return await promise;
  } finally {
    setSessionRefreshLock(null);
  }
};

// Endpoints that should not include Authorization header
const PUBLIC_AUTH_ENDPOINTS = [
  '/api/v1/admin/auth/otp/request',
  '/api/v1/admin/auth/otp/verify',
  '/api/v1/admin/auth/google',
  '/api/v1/sessions/refresh',
  '/sessions/refresh',
  '/api/v1/sessions/logout',
  '/sessions/logout',
];

/**
 * Unified API calling utility
 * @param {string} endpoint - The API endpoint (e.g. '/api/v1/admin/auth/me') or full URL
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {Object|null} body - Request payload
 * @param {Object} customHeaders - Additional request headers
 * @param {Object} requestOptions - Additional fetch options
 * @returns {Promise<Response>} - The fetch response object
 */
export const apiCall = async (endpoint, method = 'GET', body = null, customHeaders = {}, requestOptions = {}) => {
  const isPublicAuth = 
    PUBLIC_AUTH_ENDPOINTS.some(p => endpoint.includes(p)) ||
    endpoint.includes('/auth/otp/request') ||
    endpoint.includes('/auth/otp/verify') ||
    endpoint.includes('/auth/google') ||
    customHeaders.Authorization === false ||
    customHeaders.Authorization === null;

  let token = null;

  if (!isPublicAuth) {
    // Retrieve token from user_data or access_token in localStorage
    const userDataStr = localStorage.getItem('admin_data');
    if (userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        token = userData.access_token || userData.token;
      } catch (e) {
        console.error('Failed to parse admin_data from local storage', e);
      }
    }

    if (!token) {
      token = localStorage.getItem('access_token');
    }
  }

  const headers = { ...customHeaders };

  // Remove explicit false/null Authorization if passed in customHeaders
  if (headers['Authorization'] === false || headers['Authorization'] === null) {
    delete headers['Authorization'];
  }

  if (body != null && !(body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Send token as Authorization Bearer header if available and not a public auth route
  if (!isPublicAuth && token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    ...requestOptions,
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE')) {
    if (body instanceof FormData) {
      options.body = body;
    } else if (typeof body === 'string') {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  // Handle absolute vs relative URLs cleanly
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${formattedEndpoint}`;

  try {
    const response = await fetch(url, options);

    // Global 401 Unauthorized handler (only for protected endpoints, not public auth)
    if (response.status === 401 && !isPublicAuth && !formattedEndpoint.includes('/api/v1/sessions/refresh') && !formattedEndpoint.includes('/api/v1/sessions/logout')) {
      try {
        const refreshedToken = await refreshAccessTokenSilently(options.signal);
        if (refreshedToken) {
          const retryHeaders = {
            ...headers,
            Authorization: `Bearer ${refreshedToken}`,
          };

          const retryResponse = await fetch(url, {
            ...options,
            headers: retryHeaders,
          });

          return retryResponse;
        }
      } catch (refreshError) {
        console.warn('Silent token refresh failed:', refreshError);
      }

      localStorage.removeItem('admin_data');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return response;
  } catch (error) {
    console.error(`API Call Error (${url}):`, error);
    throw error;
  }
};

/**
 * Common file upload utility
 * @param {File} file - The file to upload
 * @returns {Promise<string>} - The URL of the uploaded file
 */
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const userDataStr = localStorage.getItem('admin_data');
  const accessToken = localStorage.getItem('access_token') || (
    userDataStr ? JSON.parse(userDataStr)?.access_token || JSON.parse(userDataStr)?.token : null
  );

  const headers = {};
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(UPLOAD_API_URL, {
    method: 'POST',
    headers,
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  const payload = result?.data && typeof result.data === 'object' ? result.data : result;
  const uploadedUrl = payload?.url || payload?.public_url || payload?.file_url || null;

  if (response.ok && uploadedUrl) {
    return {
      url: uploadedUrl,
      public_id: payload?.public_id || null,
      folder: payload?.folder || null,
      resource_type: payload?.resource_type || null,
      format: payload?.format || null,
      bytes: payload?.bytes || null,
      raw: result,
    };
  }

  throw new Error(result?.message || result?.detail || 'Upload failed');
};

export default apiCall;
