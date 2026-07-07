const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:5174";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const health = await request("/api/health");
  console.log("health", health.ok, health.dbPath);

  const bootstrap = await request("/api/bootstrap");
  console.log("bootstrap", `${bootstrap.graph.nodes.length} nodes`, `${bootstrap.graph.edges.length} edges`);

  const ollamaModel = bootstrap.models.find((model) => model.provider === "ollama" && !model.unavailable);
  if (!ollamaModel) {
    throw new Error("Ollama model is unavailable.");
  }
  console.log("ollama", ollamaModel.name);

  const chat = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      sessionId: bootstrap.session.id,
      provider: "ollama",
      model: ollamaModel.name,
      content: "이 앱은 온톨로지식 메모리와 3D 그래프로 페르소나를 강화해야 해. 짧게 현재 구조를 요약해줘."
    })
  });

  console.log("assistant", chat.assistantMessage.content.slice(0, 180).replace(/\s+/g, " "));
  console.log("graph", `${chat.graph.nodes.length} nodes`, `${chat.graph.edges.length} edges`, `${chat.graph.events.length} events`);

  if (chat.graph.nodes.length < bootstrap.graph.nodes.length) {
    throw new Error("Graph node count regressed after chat.");
  }
  if (!chat.assistantMessage.content.trim()) {
    throw new Error("Assistant response is empty.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
