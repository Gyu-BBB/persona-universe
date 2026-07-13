export class OpenAIProvider {
  constructor({ apiKey = process.env.OPENAI_API_KEY, model = process.env.OPENAI_MODEL || "gpt-4o-mini" } = {}) {
    this.apiKey = apiKey;
    this.model = model;
  }

  configure({ apiKey, model } = {}) {
    this.apiKey = apiKey || "";
    this.model = model || "gpt-4o-mini";
  }

  listModels() {
    return [{
      provider: "openai",
      name: this.model,
      configured: Boolean(this.apiKey),
      unavailable: !this.apiKey,
      error: this.apiKey ? undefined : "OpenAI API 키가 설정되지 않았어요."
    }];
  }

  async testConnection({ apiKey = this.apiKey, model = this.model } = {}) {
    if (!apiKey) throw new Error("OpenAI API 키를 입력해 주세요.");
    if (!model) throw new Error("OpenAI 모델 이름을 입력해 주세요.");
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error?.message || `OpenAI 연결 확인 실패 (${response.status})`);
    }
    return { ok: true, model };
  }

  async chat({ model, messages, temperature = 0.5, maxTokens = 700, format }) {
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
        model: model || this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(format ? { response_format: { type: "json_object" } } : {})
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
