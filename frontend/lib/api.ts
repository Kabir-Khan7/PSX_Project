const API_BASE = "http://localhost:8000";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
  });
  const data = await res.json().catch(() => ({ detail: "Invalid response from server" }));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ detail: "Invalid response from server" }));
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data as T;
}