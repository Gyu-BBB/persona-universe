export class OpenAIProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY } = {}) {
    this.apiKey = apiKey;
  }

  listModels() {
    const fallback = process.env.OPENAI_MODEL || "gpt-4o-mini";
    return [{ provider: "openai", name: fallback, configured: Boolean(this.apiKey) }];
  }

  async chat({ model, messages, temperature = 0.5, maxTokens = 700 }) {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: model || process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI chat failed: ${response.status} ${body}`);
    }

    const payload = await response.json();
    return {
      content: payload.choices?.[0]?.message?.content?.trim() || "",
      raw: payload
    };
  }
}
