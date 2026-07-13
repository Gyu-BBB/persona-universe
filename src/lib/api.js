const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json();
}

export const api = {
  bootstrap: (personaId) => request(`/bootstrap${personaId ? `?personaId=${encodeURIComponent(personaId)}` : ""}`),
  saveOpenAISettings: ({ apiKey, model, clearApiKey = false }) => request("/settings/openai", {
    method: "PUT",
    body: JSON.stringify({ apiKey, model, clearApiKey })
  }),
  testOpenAISettings: () => request("/settings/openai/test", {
    method: "POST",
    body: JSON.stringify({})
  }),
  createPersona: (persona) => request("/personas", {
    method: "POST",
    body: JSON.stringify(persona)
  }),
  generatePersona: ({ concept, provider, model }) => request("/personas/generate", {
    method: "POST",
    body: JSON.stringify({ concept, provider, model })
  }),
  resetPersona: (personaId) => request(`/personas/${personaId}/reset`, {
    method: "POST",
    body: JSON.stringify({})
  }),
  deletePersona: (personaId) => request(`/personas/${personaId}`, {
    method: "DELETE"
  }),
  createSession: ({ title, personaId }) => request("/sessions", {
    method: "POST",
    body: JSON.stringify({ title, personaId })
  }),
  loadSession: (sessionId) => request(`/sessions/${sessionId}`),
  chat: ({ personaId, sessionId, content, provider, model }) => request("/chat", {
    method: "POST",
    body: JSON.stringify({ personaId, sessionId, content, provider, model })
  })
};
