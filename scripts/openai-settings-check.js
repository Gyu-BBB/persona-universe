import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase } from "../server/db/database.js";
import { LlmGateway } from "../server/llm/gateway.js";
import { AppSettingsStore } from "../server/settings/appSettingsStore.js";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "persona-openai-settings-"));
process.env.PERSONA_DB_PATH = path.join(tempDir, "settings.sqlite");
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_MODEL;

const testKey = "sk-local-settings-test-1234";
let db = openDatabase();
let settings = new AppSettingsStore(db);
settings.saveOpenAIConfiguration({ apiKey: testKey, model: "gpt-test-model" });

const publicConfiguration = settings.getPublicOpenAIConfiguration();
assert.equal(publicConfiguration.configured, true);
assert.equal(publicConfiguration.model, "gpt-test-model");
assert.equal(publicConfiguration.keyHint, "••••1234");
assert.equal(JSON.stringify(publicConfiguration).includes(testKey), false);

db.close();
db = openDatabase();
settings = new AppSettingsStore(db);
const persisted = settings.getOpenAIConfiguration();
assert.equal(persisted.apiKey, testKey);
assert.equal(persisted.model, "gpt-test-model");

const gateway = new LlmGateway({ openAIConfiguration: persisted });
const openAIModel = (await gateway.listModels()).find((item) => item.provider === "openai");
assert.equal(openAIModel.configured, true);
assert.equal(openAIModel.name, "gpt-test-model");

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  assert.equal(String(url).endsWith("/models/gpt-test-model"), true);
  assert.equal(options.headers.Authorization, `Bearer ${testKey}`);
  return new Response(JSON.stringify({ id: "gpt-test-model" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};
await gateway.testOpenAI(persisted);
globalThis.fetch = originalFetch;

settings.saveOpenAIConfiguration({ clearApiKey: true });
assert.equal(settings.getPublicOpenAIConfiguration().configured, false);

db.close();
fs.rmSync(tempDir, { recursive: true, force: true });
console.log("openai settings", { persisted: true, masked: true, connectionChecked: true, cleared: true });
