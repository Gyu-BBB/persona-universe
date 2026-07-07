import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, GitFork, Layers3, Sparkles } from "lucide-react";
import { api } from "./lib/api.js";
import { ChatPanel } from "./components/ChatPanel.jsx";
import { MemoryUniverse } from "./components/MemoryUniverse.jsx";
import { SummaryPanel } from "./components/SummaryPanel.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { NodeInspector } from "./components/NodeInspector.jsx";

const DEFAULT_PROVIDER = "ollama";

export function App() {
  const [state, setState] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [model, setModel] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

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
    return state.graph;
  }, [state]);

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

  async function createPersona() {
    const name = window.prompt("새 페르소나 이름", "새 페르소나");
    if (!name?.trim()) return;
    const description = window.prompt("페르소나 설명", "사용자의 말을 차분히 기억하며 함께 대화하는 페르소나") || "";
    setIsSending(true);
    setError("");
    try {
      const payload = await api.createPersona({
        name: name.trim(),
        description: description.trim(),
        systemPrompt: `${name.trim()} 페르소나는 오래 남은 기억을 자연스럽게 참고해 답한다.`
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><BrainCircuit size={22} /></span>
          <div>
            <h1>Persona Universe</h1>
            <p>Persona Memory Companion</p>
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
          onNewPersona={createPersona}
          onResetPersona={resetPersona}
          onDeletePersona={deletePersona}
          onProviderChange={updateProvider}
          onModelChange={setModel}
          onSend={sendMessage}
          onNewSession={createSession}
        />

        <section className="universe-column">
          <div className="universe-toolbar">
            <div className="universe-title">
              <strong>{state?.persona?.name || "Persona"}의 기억 우주</strong>
              <span>페르소나가 대화 속에서 붙잡아 둔 기억만 조용히 보여줘요</span>
            </div>
            <div className="legend">
              <span className="legend-dot core" /> 중심
              <span className="legend-dot relation" /> 관계감
              <span className="legend-dot profile" /> 프로필
              <span className="legend-dot work" /> 일
              <span className="legend-dot goal" /> 목표
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
    </main>
  );
}
