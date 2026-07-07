import { OllamaProvider } from "./ollamaProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";

export class LlmGateway {
  constructor() {
    this.providers = {
      ollama: new OllamaProvider(),
      openai: new OpenAIProvider()
    };
  }

  async listModels() {
    const results = [];
    for (const [providerName, provider] of Object.entries(this.providers)) {
      try {
        const models = await provider.listModels();
        results.push(...models);
      } catch (error) {
        results.push({
          provider: providerName,
          name: providerName === "ollama" ? process.env.OLLAMA_MODEL || "gemma4:12b" : process.env.OPENAI_MODEL || "gpt-4o-mini",
          unavailable: true,
          error: error.message
        });
      }
    }
    return results;
  }

  async chat({ provider = "ollama", model, messages, temperature, maxTokens }) {
    const selected = this.providers[provider];
    if (!selected) {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }
    return selected.chat({ model, messages, temperature, maxTokens });
  }
}
