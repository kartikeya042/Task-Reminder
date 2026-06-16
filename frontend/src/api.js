const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Production base may include /api (e.g. https://api.example.com/api)
  if (API_BASE.endsWith('/api')) {
    const route = normalizedPath.startsWith('/api/')
      ? normalizedPath.slice(4)
      : normalizedPath;
    return `${API_BASE}${route}`;
  }

  // Local dev base is host only (e.g. http://localhost:5000)
  if (normalizedPath.startsWith('/api/')) {
    return `${API_BASE}${normalizedPath}`;
  }

  return `${API_BASE}/api${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export { API_BASE };
