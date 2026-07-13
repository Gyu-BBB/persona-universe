import { OllamaProvider } from "./ollamaProvider.js";
import { OpenAIProvider } from "./openaiProvider.js";

export class LlmGateway {
  constructor({ openAIConfiguration = {} } = {}) {
    this.providers = {
      ollama: new OllamaProvider(),
      openai: new OpenAIProvider(openAIConfiguration)
    };
  }

  configureOpenAI(configuration) {
    this.providers.openai.configure(configuration);
  }

  testOpenAI(configuration) {
    return this.providers.openai.testConnection(configuration);
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
          name: providerName === "ollama" ? process.env.OLLAMA_MODEL || "gemma4:12b" : this.providers.openai.model,
          unavailable: true,
          error: error.message
        });
      }
    }
    return results;
  }

  async chat({ provider = "ollama", model, messages, temperature, maxTokens, format }) {
    const selected = this.providers[provider];
    if (!selected) {
      throw new Error(`Unknown LLM provider: ${provider}`);
    }
    return selected.chat({ model, messages, temperature, maxTokens, format });
  }
}
