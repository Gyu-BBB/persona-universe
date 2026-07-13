export class OllamaProvider {
  constructor({ baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434" } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async listModels() {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error(`Ollama model list failed: ${response.status}`);
    }
    const payload = await response.json();
    return (payload.models || []).map((model) => ({
      provider: "ollama",
      name: model.name,
      size: model.size,
      modifiedAt: model.modified_at,
      details: model.details || {}
    }));
  }

  async chat({ model, messages, temperature = 0.5, maxTokens = 700, format }) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || process.env.OLLAMA_MODEL || "gemma4:12b",
        messages,
        stream: false,
        think: false,
        ...(format ? { format } : {}),
        keep_alive: "10m",
        options: {
          temperature,
          num_predict: maxTokens,
          num_ctx: 4096
        }
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama chat failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    return {
      content: payload.message?.content?.trim() || "",
      raw: payload
    };
  }
}
