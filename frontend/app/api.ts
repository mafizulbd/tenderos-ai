export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Merge caller-supplied headers last so they can override
  const callerHeaders = options.headers as Record<string, string> | undefined;
  if (callerHeaders) Object.assign(headers, callerHeaders);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.detail ?? data?.error ?? `Request failed with ${response.status}`);
  }

  return data as T;
}
