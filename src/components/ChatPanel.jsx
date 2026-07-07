import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, LockKeyhole, Plus, RotateCcw, Send, Trash2, UserRound, WifiOff } from "lucide-react";

export function ChatPanel({
  messages,
  session,
  sessions,
  persona,
  personas,
  provider,
  model,
  models,
  allModels,
  isSending,
  error,
  onPersonaChange,
  onNewPersona,
  onResetPersona,
  onDeletePersona,
  onSessionChange,
  onProviderChange,
  onModelChange,
  onSend,
  onNewSession
}) {
  const [draft, setDraft] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const listRef = useRef(null);
  const providerStatus = useMemo(() => {
    const providers = new Map();
    for (const item of allModels) {
      providers.set(item.provider, item);
    }
    return providers;
  }, [allModels]);
  const personaInitial = persona?.avatar || persona?.name?.trim()?.[0] || "P";
  const templatePersonas = useMemo(() => (personas || []).filter((item) => item.templateKey), [personas]);
  const customPersonas = useMemo(() => (personas || []).filter((item) => !item.templateKey), [personas]);
  const isTemplatePersona = Boolean(persona?.templateKey);
  const personaMeta = useMemo(() => {
    const profile = persona?.characterProfile || [];
    const age = profile.find((item) => item.key === "age")?.value;
    const occupation = profile.find((item) => item.key === "occupation")?.value;
    return [age, occupation].filter(Boolean).join(" · ");
  }, [persona]);

  function PersonaButton({ item }) {
    const isActive = item.id === persona?.id;
    const avatar = item.avatar || item.name?.trim()?.[0] || "P";
    const occupation = item.characterProfile?.find((profile) => profile.key === "occupation")?.value;
    return (
      <button
        type="button"
        className={`persona-tile ${isActive ? "is-active" : ""}`}
        style={{ "--active-persona": item.color || "#facc15" }}
        onClick={() => onPersonaChange(item.id)}
        disabled={isSending || isActive}
        title={item.description || item.name}
      >
        <span className="persona-tile-avatar">{avatar}</span>
        <span className="persona-tile-copy">
          <strong>{item.name}</strong>
          <small>{item.templateKey ? `기본${occupation ? ` · ${occupation}` : ""}` : "내 캐릭터"}</small>
        </span>
        {item.templateKey ? <LockKeyhole size={13} /> : null}
      </button>
    );
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isSending]);

  function submit(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;
    setDraft("");
    onSend(content);
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit(event);
  }

  return (
    <section className="chat-panel">
      {persona ? (
        <section className="persona-card" style={{ "--active-persona": persona.color || "#facc15" }}>
          <div className="persona-avatar">{personaInitial}</div>
          <div className="persona-card-copy" title={persona.description || persona.name}>
            <div className="persona-card-title">
              <strong>{persona.name}</strong>
              <small>{isTemplatePersona ? "기본 캐릭터" : "내 캐릭터"}</small>
            </div>
            <p>{personaMeta || persona.description || "대화 속 기억을 바탕으로 반응하는 페르소나"}</p>
          </div>
          <div className="persona-actions">
            <button className="icon-button" type="button" onClick={onNewPersona} title="캐릭터 생성" disabled={isSending}>
              <Plus size={17} />
            </button>
            <button className="icon-button danger" type="button" onClick={onResetPersona} title="기억 초기화" disabled={isSending || !persona}>
              <RotateCcw size={16} />
            </button>
            <button className="icon-button danger" type="button" onClick={onDeletePersona} title={isTemplatePersona ? "기본 캐릭터는 삭제할 수 없음" : "캐릭터 삭제"} disabled={isSending || !persona || personas.length <= 1 || isTemplatePersona}>
              {isTemplatePersona ? <LockKeyhole size={15} /> : <Trash2 size={16} />}
            </button>
          </div>
        </section>
      ) : null}

      <section className="persona-roster">
        <div className="persona-roster-group">
          {templatePersonas.map((item) => <PersonaButton key={item.id} item={item} />)}
        </div>
        {customPersonas.length ? (
          <div className="persona-roster-group custom">
            {customPersonas.map((item) => <PersonaButton key={item.id} item={item} />)}
          </div>
        ) : null}
      </section>

      <div className="model-strip">
        <div className="provider-toggle" aria-label="provider">
          {["ollama", "openai"].map((name) => {
            const status = providerStatus.get(name);
            return (
              <button
                key={name}
                type="button"
                className={provider === name ? "is-active" : ""}
                onClick={() => onProviderChange(name)}
                disabled={isSending}
                title={status?.unavailable ? status.error : `${name} provider`}
              >
                {name === "ollama" ? <Cpu size={16} /> : <Bot size={16} />}
                {name}
                {status?.unavailable ? <WifiOff size={13} /> : null}
              </button>
            );
          })}
        </div>
        <button className="icon-button" type="button" onClick={onNewSession} title="새 세션" disabled={isSending}>
          <Plus size={17} />
        </button>
      </div>

      <div className="context-controls">
        <label>
          <span>대화</span>
          <select value={session?.id || ""} onChange={(event) => onSessionChange(event.target.value)} disabled={isSending || !sessions?.length}>
            {(sessions || []).map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <label>
          <span>모델</span>
          <select value={model} onChange={(event) => onModelChange(event.target.value)} disabled={isSending}>
            {models.length === 0 ? <option value="">unavailable</option> : null}
            {models.map((item) => (
              <option key={`${item.provider}:${item.name}`} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="message-list" aria-live="polite" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>말을 걸어보세요</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar">
              {message.role === "user" ? <UserRound size={16} /> : personaInitial}
            </div>
            <div className="message-body">
              <span>{message.role === "user" ? "나" : persona?.name || "Persona"}</span>
              <p>{message.content}</p>
            </div>
          </article>
        ))}
        {isSending ? (
          <article className="message assistant pending">
            <div className="message-avatar">{personaInitial || <Bot size={16} />}</div>
            <div className="message-body">
              <span>{persona?.name || "Persona"}</span>
              <div className="loading-block">
                <div className="loader-ring" />
                <div>
                  <strong>응답 생성 중</strong>
                  <p>기억을 살피는 중 · {elapsedSeconds}s</p>
                </div>
              </div>
            </div>
          </article>
        ) : null}
      </div>

      {error ? <div className="error-line">{error}</div> : null}

      <form className="composer" onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지 입력"
          disabled={isSending}
          rows={3}
        />
        <button type="submit" disabled={isSending || !draft.trim()} title="전송">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}
