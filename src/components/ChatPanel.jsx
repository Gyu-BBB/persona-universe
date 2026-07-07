import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Cpu, Plus, RotateCcw, Send, Trash2, UserRound, WifiOff } from "lucide-react";

export function ChatPanel({
  messages,
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
      <div className="persona-strip">
        <label className="persona-select">
          <span>대화할 캐릭터</span>
          <select value={persona?.id || ""} onChange={(event) => onPersonaChange(event.target.value)} disabled={isSending}>
            {(personas || []).map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        <button className="icon-button" type="button" onClick={onNewPersona} title="페르소나 생성" disabled={isSending}>
          <Plus size={17} />
        </button>
        <button className="icon-button danger" type="button" onClick={onResetPersona} title="선택 페르소나 초기화" disabled={isSending || !persona}>
          <RotateCcw size={16} />
        </button>
        <button className="icon-button danger" type="button" onClick={onDeletePersona} title="선택 페르소나 삭제" disabled={isSending || !persona || personas.length <= 1}>
          <Trash2 size={16} />
        </button>
      </div>

      {persona ? (
        <section className="persona-card" style={{ "--active-persona": persona.color || "#facc15" }}>
          <div className="persona-avatar">{personaInitial}</div>
          <div>
            <strong>{persona.name}</strong>
            <p>{persona.description || "대화 속 기억을 바탕으로 반응하는 페르소나"}</p>
          </div>
        </section>
      ) : null}

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

      <label className="select-row">
        <span>Model</span>
        <select value={model} onChange={(event) => onModelChange(event.target.value)} disabled={isSending}>
          {models.length === 0 ? <option value="">unavailable</option> : null}
          {models.map((item) => (
            <option key={`${item.provider}:${item.name}`} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <div className="message-list" aria-live="polite" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>새 세션 대기 중</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
              <div className="message-avatar">
                {message.role === "user" ? <UserRound size={16} /> : personaInitial}
              </div>
              <div className="message-body">
                <span>{message.role === "user" ? "User" : persona?.name || "Persona"}</span>
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
                  <p>턴 기억 추출, 관계 업데이트, 페르소나 컨텍스트 조립 · {elapsedSeconds}s</p>
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
