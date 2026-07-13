import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, ListFilter, MessageCircle, Orbit } from "lucide-react";
import { api } from "./lib/api.js";
import { ChatPanel } from "./components/ChatPanel.jsx";
import { MemoryUniverse } from "./components/MemoryUniverse.jsx";
import { SummaryPanel } from "./components/SummaryPanel.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { NodeInspector } from "./components/NodeInspector.jsx";
import { PersonaStudio } from "./components/PersonaStudio.jsx";

const DEFAULT_PROVIDER = "ollama";

const GRAPH_SCOPES = [
  { id: "user", label: "나와 우리", title: "나와 우리의 기억", description: "나에 대해 알게 된 것과 우리 사이에 쌓인 기억" },
  { id: "feeling", label: "마음", title: "내 마음", description: "요즘의 감정과 걱정, 힘들었던 순간" },
  { id: "work", label: "일과 생활", title: "내 일상", description: "일, 역할, 경험과 함께 이어지는 맥락" },
  { id: "goal", label: "관심과 목표", title: "나의 관심과 목표", description: "관심사와 바라는 일, 앞으로의 목표" },
  { id: "persona", label: "캐릭터", title: "캐릭터의 세계", description: "이 캐릭터를 이루는 배경과 성격, 취향" },
  { id: "all", label: "전체 기억", title: "모든 기억", description: "현재 캐릭터 안에 이어진 기억의 전체 모습" }
];

const CORE_TYPES = new Set(["person", "persona", "relationship"]);
const PERSONA_TYPES = new Set([
  "persona_age",
  "persona_mbti",
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
  const [graphScope, setGraphScope] = useState("user");
  const [mobileView, setMobileView] = useState("chat");

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
  const activeScope = GRAPH_SCOPES.find((scope) => scope.id === graphScope) || GRAPH_SCOPES[0];

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
      setState((current) => ({ ...payload, models: current?.models || [], providerSettings: current?.providerSettings }));
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
      setState((current) => ({ ...payload, models: current?.models || [], providerSettings: current?.providerSettings }));
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
      setState((current) => ({ ...payload, models: current?.models || [], providerSettings: current?.providerSettings }));
      setStudioOpen(false);
      setSelectedNode(null);
      setSelectedEdge(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  }

  async function generatePersonaDraft(concept) {
    const payload = await api.generatePersona({ concept, provider, model });
    return payload.draft;
  }

  async function saveOpenAISettings(input) {
    const payload = await api.saveOpenAISettings(input);
    setState((current) => ({
      ...current,
      models: payload.models,
      providerSettings: { ...(current?.providerSettings || {}), openai: payload.settings }
    }));

    if (!payload.settings.configured) {
      if (provider === "openai") {
        const ollamaModel = payload.models.find((item) => item.provider === "ollama" && !item.unavailable);
        setProvider("ollama");
        setModel(ollamaModel?.name || "");
      }
      return { settings: payload.settings, verified: false };
    }

    setProvider("openai");
    setModel(payload.settings.model);
    try {
      await api.testOpenAISettings();
      return { settings: payload.settings, verified: true };
    } catch (verificationError) {
      return { settings: payload.settings, verified: false, verificationError: verificationError.message };
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
      setState((current) => ({ ...payload, models: current?.models || [], providerSettings: current?.providerSettings }));
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
      setState((current) => ({ ...payload, models: current?.models || [], providerSettings: current?.providerSettings }));
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
          <h1>Persona Universe</h1>
        </div>
        <div className="mobile-view-switch" aria-label="화면 보기">
          <button type="button" className={mobileView === "chat" ? "is-active" : ""} onClick={() => setMobileView("chat")}>
            <MessageCircle size={16} /> 대화
          </button>
          <button type="button" className={mobileView === "memory" ? "is-active" : ""} onClick={() => setMobileView("memory")}>
            <Orbit size={16} /> 기억
          </button>
        </div>
      </header>

      <section className="workspace-grid" data-mobile-view={mobileView}>
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
          openAISettings={state?.providerSettings?.openai}
          isSending={isSending}
          error={error}
          onPersonaChange={selectPersona}
          onNewPersona={() => setStudioOpen(true)}
          onResetPersona={resetPersona}
          onDeletePersona={deletePersona}
          onSessionChange={loadSession}
          onProviderChange={updateProvider}
          onModelChange={setModel}
          onSaveOpenAISettings={saveOpenAISettings}
          onSend={sendMessage}
          onNewSession={createSession}
        />

        <section className="universe-column">
          <div className="universe-toolbar">
            <div className="universe-title">
              <strong>{state?.persona?.name || "캐릭터"}의 시선으로 보는 {activeScope.title}</strong>
              <span>{activeScope.description}</span>
            </div>
            <label className="memory-scope-control">
              <ListFilter size={16} />
              <span className="sr-only">기억 보기</span>
              <select value={graphScope} onChange={(event) => updateGraphScope(event.target.value)} aria-label="기억 보기">
                {GRAPH_SCOPES.map((scope) => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
              </select>
            </label>
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
        </section>

        <aside className={`insight-column ${selectedNode || selectedEdge ? "has-selection" : ""}`}>
          {selectedNode || selectedEdge ? (
            <NodeInspector
              node={selectedNode}
              edge={selectedEdge}
              graph={state?.graph}
              onClear={() => {
                setSelectedNode(null);
                setSelectedEdge(null);
              }}
            />
          ) : (
            <>
              <header className="insight-header">
                <span>기억 노트</span>
                <strong>{state?.persona?.name || "캐릭터"}에게 남은 나와의 기억</strong>
              </header>
              <SummaryPanel summaries={state?.summaries} personaName={state?.persona?.name} />
              <Timeline events={state?.graph?.events || []} nodes={state?.graph?.nodes || []} />
            </>
          )}
        </aside>
      </section>

      <PersonaStudio
        open={studioOpen}
        isSaving={isSending}
        provider={provider}
        onGenerate={generatePersonaDraft}
        onClose={() => !isSending && setStudioOpen(false)}
        onCreate={createPersona}
      />
    </main>
  );
}
