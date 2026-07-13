const OPENAI_KEY_SETTING = "openai_api_key";
const OPENAI_MODEL_SETTING = "openai_model";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

function nowIso() {
  return new Date().toISOString();
}

function keyHint(apiKey) {
  const value = String(apiKey || "");
  return value ? `••••${value.slice(-4)}` : "";
}

export class AppSettingsStore {
  constructor(db) {
    this.db = db;
    this.getStatement = db.prepare("SELECT value, updated_at FROM app_settings WHERE key = ?");
    this.setStatement = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    this.deleteStatement = db.prepare("DELETE FROM app_settings WHERE key = ?");
  }

  get(key) {
    return this.getStatement.get(key)?.value || "";
  }

  set(key, value) {
    this.setStatement.run(key, String(value), nowIso());
  }

  delete(key) {
    this.deleteStatement.run(key);
  }

  getOpenAIConfiguration() {
    const savedKey = this.get(OPENAI_KEY_SETTING);
    const environmentKey = process.env.OPENAI_API_KEY || "";
    const apiKey = savedKey || environmentKey;
    const savedModel = this.get(OPENAI_MODEL_SETTING);
    const model = savedModel || process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
    return {
      apiKey,
      model,
      source: savedKey ? "local" : environmentKey ? "environment" : "none",
      updatedAt: this.getStatement.get(OPENAI_KEY_SETTING)?.updated_at || this.getStatement.get(OPENAI_MODEL_SETTING)?.updated_at || null
    };
  }

  getPublicOpenAIConfiguration() {
    const configuration = this.getOpenAIConfiguration();
    return {
      configured: Boolean(configuration.apiKey),
      model: configuration.model,
      keyHint: keyHint(configuration.apiKey),
      source: configuration.source,
      updatedAt: configuration.updatedAt
    };
  }

  saveOpenAIConfiguration({ apiKey, model, clearApiKey = false } = {}) {
    if (clearApiKey) this.delete(OPENAI_KEY_SETTING);
    if (typeof apiKey === "string" && apiKey.trim()) this.set(OPENAI_KEY_SETTING, apiKey.trim());
    if (typeof model === "string" && model.trim()) this.set(OPENAI_MODEL_SETTING, model.trim());
    return this.getOpenAIConfiguration();
  }
}
