const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class APIError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ detail: response.statusText }));
    throw new APIError(response.status, typeof payload.detail === "string" ? payload.detail : JSON.stringify(payload.detail ?? payload));
  }
  return response.json() as Promise<T>;
}
