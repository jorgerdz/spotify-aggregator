const SESSION_KEY = "spotify_agg_session";

export function getSessionToken(): string | null {
  return sessionStorage.getItem(SESSION_KEY);
}

export function setSessionToken(token: string) {
  sessionStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken() {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8787";
  const url = path.startsWith("http") ? path : `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearSessionToken();
    window.location.href = "/";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    try {
      const errorData = await res.json();
      let errorMessage = errorData.error || `API error: ${res.status}`;

      if (errorData.logs && Array.isArray(errorData.logs)) {
        console.error("Backend execution logs:", errorData.logs.join("\n"));
        errorMessage += "\n\nServer Logs:\n" + errorData.logs.join("\n");
      }

      throw new Error(errorMessage);
    } catch (e: any) {
      if (e.message.includes("API error:") || e.message.includes("Server Logs:")) {
        throw e;
      }
      throw new Error(`API error: ${res.status}`);
    }
  }

  return res.json();
}
