import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, GitFork, Layers3, Sparkles } from "lucide-react";
import { api } from "./lib/api.js";
import { ChatPanel } from "./components/ChatPanel.jsx";
import { MemoryUniverse } from "./components/MemoryUniverse.jsx";
import { SummaryPanel } from "./components/SummaryPanel.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { NodeInspector } from "./components/NodeInspector.jsx";
import { PersonaStudio } from "./components/PersonaStudio.jsx";

const DEFAULT_PROVIDER = "ollama";

const GRAPH_SCOPES = [
  { id: "all", label: "전체" },
  { id: "user", label: "사용자" },
  { id: "persona", label: "캐릭터" },
  { id: "feeling", label: "감정" },
  { id: "work", label: "일" },
  { id: "goal", label: "목표" }
];

const CORE_TYPES = new Set(["person", "persona", "relationship"]);
const PERSONA_TYPES = new Set([
  "persona_age",
  "persona_occupation",
  "persona_background",
  "persona_trait",
  "persona_signature",
  "persona_strength",
  "persona_growth_edge",
  "persona_preference",
  "persona_aversion",
  "persona_speech",
  "persona_boundary"
]);
const FEELING_TYPES = new Set([
  "personality_trait",
  "growth_area",
  "current_concern",
  "emotional_state",
  "tension_point",
  "response_preference"
]);
const WORK_TYPES = new Set([
  "workplace_type",
  "occupation",
  "responsibility",
  "presentation",
  "key_metric",
  "metric_reason",
  "metric_driver",
  "metric_risk",
  "data_source",
  "key_message"
]);
const GOAL_TYPES = new Set(["interest", "goal", "product_capability", "memory_behavior"]);

function nodeMatchesScope(node, scope) {
  if (scope === "all") return true;
  if (CORE_TYPES.has(node.type)) return true;
  if (scope === "persona") return PERSONA_TYPES.has(node.type);
  if (scope === "feeling") return FEELING_TYPES.has(node.type);
  if (scope === "work") return WORK_TYPES.has(node.type);
  if (scope === "goal") return GOAL_TYPES.has(node.type);
  if (scope === "user") return !PERSONA_TYPES.has(node.type) && node.type !== "project";
  return true;
}

function filterGraph(graph, scope) {
  if (!graph) return { nodes: [], edges: [], events: [] };
  if (scope === "all") return graph;
  const nodes = graph.nodes.filter((node) => nodeMatchesScope(node, scope));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.source_id) && nodeIds.has(edge.target_id));
  return { ...graph, nodes, edges };
}

export function App() {
  const [state, setState] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [studioOpen, setStudioOpen] = useState(false);
  const [graphScope, setGraphScope] = useState("all");

  useEffect(() => {
    let mounted = true;
    api.bootstrap()
      .then((payload) => {
        if (!mounted) return;
        setState(payload);
        const ollamaModel = payload.models?.find((item) => item.provider === "ollama" && !item.unavailable);
        const openAiModel = payload.models?.find((item) => item.provider === "openai");
        setProvider(ollamaModel ? "ollama" : "openai");
        setModel((ollamaModel || openAiModel)?.name || "");
      })
      .catch((err) => setError(err.message));
    return () => {
      mounted = false;
    };
  }, []);

  const visibleGraph = useMemo(() => {
    if (!state?.graph) return { nodes: [], edges: [], events: [] };
    return filterGraph(state.graph, graphScope);
  }, [state, graphScope]);

  const activeModels = useMemo(() => {
    const models = state?.models || [];
    return models.filter((item) => item.provider === provider);
  }, [state, provider]);

  async function sendMessage(content) {
    if (!content.trim() || !state?.session || isSending) return;
    const optimisticMessage = {
      id: `optimistic-${Date.now()}`,
      session_id: state.session.id,
      persona_id: state.persona?.id,
      role: "user",
      content,
      model_provider: provider,
      model_name: model,
      created_at: new Date().toISOString(),
      optimistic: true
    };
    setIsSending(true);
    setError("");
    setState((current) => ({
      ...current,
      messages: [...(current?.messages || []), optimisticMessage]
    }));
    try {
      const payload = await api.chat({
        personaId: state.persona?.id,
        sessionId: state.session.id,
        content,
        provider,
        model
      });
      setState((current) => ({ ...current, ...payload, models: current?.models || payload.models || [] }));
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
      setState((current) => ({
        ...current,
        messages: (current?.messages || []).filter((message) => message.id !== optimisticMessage.id)
      }));
    } finally {
      setIsSending(false);
    }
  }

  async function createSession() {
    setIsSending(true);
    setError("");
    try {
      const payload = await api.createSession({
        title: "새 페르소나 세션",
        personaId: state?.persona?.id
      });
      setState((current) => ({ ...payload, models: current?.models || [] }));
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function loadSession(sessionId) {
    if (!sessionId || sessionId === state?.session?.id || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const payload = await api.loadSession(sessionId);
      setState((current) => ({ ...payload, models: current?.models || [] }));
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function selectPersona(personaId) {
    if (!personaId || personaId === state?.persona?.id || isSending) return;
    setIsSending(true);
    setError("");
    try {
      const payload = await api.bootstrap(personaId);
      setState((current) => ({ ...payload, models: current?.models || payload.models || [] }));
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function createPersona(input) {
    setIsSending(true);
    setError("");
    try {
      const payload = await api.createPersona(input);
      setState((current) => ({ ...payload, models: current?.models || [] }));
      setStudioOpen(false);
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function resetPersona() {
    if (!state?.persona || isSending) return;
    const confirmed = window.confirm(`${state.persona.name} 기억 그래프를 초기화할까요?`);
    if (!confirmed) return;
    setIsSending(true);
    setError("");
    try {
      const payload = await api.resetPersona(state.persona.id);
      setState((current) => ({ ...payload, models: current?.models || [] }));
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function deletePersona() {
    if (!state?.persona || isSending) return;
    const confirmed = window.confirm(`${state.persona.name} 페르소나와 이 페르소나의 기억을 삭제할까요?`);
    if (!confirmed) return;
    setIsSending(true);
    setError("");
    try {
      const payload = await api.deletePersona(state.persona.id);
      setState((current) => ({ ...payload, models: current?.models || [] }));
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  function updateProvider(nextProvider) {
    setProvider(nextProvider);
    const nextModel = state?.models?.find((item) => item.provider === nextProvider && !item.unavailable);
    setModel(nextModel?.name || "");
  }

  function updateGraphScope(nextScope) {
    setGraphScope(nextScope);
    setSelectedNode(null);
    setSelectedEdge(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><BrainCircuit size={22} /></span>
          <div>
            <h1>Persona Universe</h1>
            <p>기억이 보이는 대화</p>
          </div>
        </div>
        <div className="topbar-metrics" aria-label="memory metrics">
          <span><BrainCircuit size={16} /> {state?.persona?.name || "Persona"}</span>
          <span><Layers3 size={16} /> 기억 {state?.graph?.nodes?.length || 0}</span>
          <span><GitFork size={16} /> 연결 {state?.graph?.edges?.length || 0}</span>
          <span><Sparkles size={16} /> 변화 {state?.graph?.events?.length || 0}</span>
        </div>
      </header>

      <section className="workspace-grid">
        <ChatPanel
          messages={state?.messages || []}
          session={state?.session}
          sessions={state?.sessions || []}
          persona={state?.persona}
          personas={state?.personas || []}
          provider={provider}
          model={model}
          models={activeModels}
          allModels={state?.models || []}
          isSending={isSending}
          error={error}
          onPersonaChange={selectPersona}
          onNewPersona={() => setStudioOpen(true)}
          onResetPersona={resetPersona}
          onDeletePersona={deletePersona}
          onSessionChange={loadSession}
          onProviderChange={updateProvider}
          onModelChange={setModel}
          onSend={sendMessage}
          onNewSession={createSession}
        />

        <section className="universe-column">
          <div className="universe-toolbar">
            <div className="universe-title">
              <strong>{state?.persona?.name || "Persona"}의 기억 우주</strong>
              <span>{visibleGraph.nodes.length}개의 기억 · {visibleGraph.edges.length}개의 연결</span>
            </div>
            <div className="universe-controls">
              <div className="scope-switch" aria-label="기억 보기">
                {GRAPH_SCOPES.map((scope) => (
                  <button
                    key={scope.id}
                    type="button"
                    className={graphScope === scope.id ? "is-active" : ""}
                    onClick={() => updateGraphScope(scope.id)}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
              <div className="legend">
                <span className="legend-dot core" /> 중심
                <span className="legend-dot relation" /> 관계감
                <span className="legend-dot profile" /> 프로필
                <span className="legend-dot work" /> 일
                <span className="legend-dot goal" /> 목표
              </div>
            </div>
          </div>
          <MemoryUniverse
            graph={visibleGraph}
            selectedNode={selectedNode}
            onNodeSelect={(node) => {
              setSelectedNode(node);
              setSelectedEdge(null);
            }}
            onEdgeSelect={(edge) => {
              setSelectedEdge(edge);
              setSelectedNode(null);
            }}
          />
          <Timeline events={state?.graph?.events || []} />
        </section>

        <aside className="insight-column">
          <SummaryPanel summaries={state?.summaries} />
          <NodeInspector node={selectedNode} edge={selectedEdge} graph={state?.graph} />
        </aside>
      </section>

      <PersonaStudio
        open={studioOpen}
        isSaving={isSending}
        onClose={() => !isSending && setStudioOpen(false)}
        onCreate={createPersona}
      />
    </main>
  );
}
