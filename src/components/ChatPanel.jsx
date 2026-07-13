import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Cpu,
  KeyRound,
  LoaderCircle,
  MoreHorizontal,
  MessageSquarePlus,
  RotateCcw,
  Send,
  Save,
  Settings2,
  Trash2,
  UserRound,
  WifiOff
} from "lucide-react";
import { PersonaLibrary } from "./PersonaLibrary.jsx";

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
  openAISettings,
  isSending,
  error,
  onPersonaChange,
  onNewPersona,
  onResetPersona,
  onDeletePersona,
  onSessionChange,
  onProviderChange,
  onModelChange,
  onSaveOpenAISettings,
  onSend,
  onNewSession
}) {
  const [draft, setDraft] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openAIKey, setOpenAIKey] = useState("");
  const [openAIModel, setOpenAIModel] = useState("gpt-4o-mini");
  const [isSavingOpenAI, setIsSavingOpenAI] = useState(false);
  const [openAIStatus, setOpenAIStatus] = useState(null);
  const listRef = useRef(null);
  const providerStatus = useMemo(() => {
    const providers = new Map();
    for (const item of allModels) providers.set(item.provider, item);
    return providers;
  }, [allModels]);
  const personaInitial = persona?.avatar || persona?.name?.trim()?.[0] || "P";
  const isTemplatePersona = Boolean(persona?.templateKey);
  const personaMeta = useMemo(() => {
    const profile = persona?.characterProfile || [];
    const age = profile.find((item) => item.key === "age")?.value;
    const mbti = profile.find((item) => item.key === "mbti")?.value;
    const occupation = profile.find((item) => item.key === "occupation")?.value;
    return [age, mbti, occupation].filter(Boolean).join(" · ");
  }, [persona]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    setMenuOpen(false);
    setSettingsOpen(false);
  }, [persona?.id]);

  useEffect(() => {
    setOpenAIKey("");
    setOpenAIModel(openAISettings?.model || "gpt-4o-mini");
  }, [openAISettings?.model, openAISettings?.keyHint]);

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

  function resetPersona() {
    setMenuOpen(false);
    onResetPersona();
  }

  function deletePersona() {
    setMenuOpen(false);
    onDeletePersona();
  }

  async function saveOpenAI(event) {
    event.preventDefault();
    if (!openAISettings?.configured && !openAIKey.trim()) {
      setOpenAIStatus({ type: "error", message: "API 키를 입력해 주세요." });
      return;
    }
    if (!openAIModel.trim()) {
      setOpenAIStatus({ type: "error", message: "모델 이름을 입력해 주세요." });
      return;
    }
    setIsSavingOpenAI(true);
    setOpenAIStatus(null);
    try {
      const result = await onSaveOpenAISettings({ apiKey: openAIKey, model: openAIModel });
      if (result.verified) {
        setOpenAIStatus({ type: "success", message: `${result.settings.model} 연결을 확인했어요.` });
      } else {
        setOpenAIStatus({
          type: "error",
          message: result.verificationError ? `저장됐지만 연결하지 못했어요. ${result.verificationError}` : "설정을 저장했어요."
        });
      }
      setOpenAIKey("");
    } catch (saveError) {
      setOpenAIStatus({ type: "error", message: saveError.message });
    } finally {
      setIsSavingOpenAI(false);
    }
  }

  async function clearOpenAIKey() {
    if (!window.confirm("이 기기에 저장된 OpenAI API 키를 삭제할까요?")) return;
    setIsSavingOpenAI(true);
    setOpenAIStatus(null);
    try {
      await onSaveOpenAISettings({ model: openAIModel, clearApiKey: true });
      setOpenAIKey("");
      setOpenAIStatus({ type: "success", message: "저장된 API 키를 삭제했어요." });
    } catch (clearError) {
      setOpenAIStatus({ type: "error", message: clearError.message });
    } finally {
      setIsSavingOpenAI(false);
    }
  }

  return (
    <section className="chat-panel">
      <header className="chat-identity" style={{ "--active-persona": persona?.color || "#facc15" }}>
        <button
          className="persona-switcher"
          type="button"
          onClick={() => setLibraryOpen(true)}
          disabled={!persona || isSending}
          title="캐릭터 바꾸기"
        >
          <span className="persona-avatar">{personaInitial}</span>
          <span className="persona-switcher-copy">
            <strong>{persona?.name || "캐릭터 선택"}</strong>
            <small>{personaMeta || "대화할 캐릭터를 골라주세요"}</small>
          </span>
          <ChevronDown size={17} />
        </button>

        <div className="chat-header-actions">
          <button className="icon-button" type="button" onClick={onNewSession} title="새 대화" disabled={isSending || !persona}>
            <MessageSquarePlus size={17} />
          </button>
          <div className="action-menu-wrap">
            <button
              className={`icon-button ${menuOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              title="캐릭터 관리"
              disabled={!persona || isSending}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen ? (
              <div className="action-menu">
                <button type="button" onClick={resetPersona}>
                  <RotateCcw size={15} /> 기억 비우기
                </button>
                <button type="button" className="danger" onClick={deletePersona} disabled={isTemplatePersona || personas.length <= 1}>
                  <Trash2 size={15} /> {isTemplatePersona ? "기본 캐릭터는 삭제할 수 없어요" : "캐릭터 삭제"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="conversation-bar">
        <label className="session-select">
          <span className="sr-only">대화 기록</span>
          <select value={session?.id || ""} onChange={(event) => onSessionChange(event.target.value)} disabled={isSending || !sessions?.length}>
            {(sessions || []).map((item) => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
        </label>
        <button
          className={`icon-button ${settingsOpen ? "is-active" : ""}`}
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          title="대화 설정"
          disabled={isSending}
        >
          <Settings2 size={17} />
        </button>
      </div>

      {settingsOpen ? (
        <section className="chat-settings" aria-label="대화 설정">
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
                  {name === "ollama" ? <Cpu size={15} /> : <Bot size={15} />}
                  {name === "ollama" ? "내 컴퓨터" : "OpenAI"}
                  {status?.unavailable ? <WifiOff size={12} /> : null}
                </button>
              );
            })}
          </div>
          {provider === "ollama" ? (
            <label>
              <span>사용할 모델</span>
              <select value={model} onChange={(event) => onModelChange(event.target.value)} disabled={isSending}>
                {models.length === 0 ? <option value="">사용 가능한 모델 없음</option> : null}
                {models.map((item) => (
                  <option key={`${item.provider}:${item.name}`} value={item.name}>{item.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <form className="openai-settings" onSubmit={saveOpenAI}>
              <label>
                <span>API 키</span>
                <span className="secret-field">
                  <KeyRound size={15} />
                  <input
                    type="password"
                    value={openAIKey}
                    onChange={(event) => setOpenAIKey(event.target.value)}
                    placeholder={openAISettings?.configured ? `저장됨 ${openAISettings.keyHint}` : "sk-..."}
                    autoComplete="off"
                    aria-label="OpenAI API 키"
                    disabled={isSavingOpenAI}
                  />
                </span>
              </label>
              <label>
                <span>모델 이름</span>
                <input
                  type="text"
                  value={openAIModel}
                  onChange={(event) => setOpenAIModel(event.target.value)}
                  placeholder="gpt-4o-mini"
                  aria-label="OpenAI 모델 이름"
                  disabled={isSavingOpenAI}
                />
              </label>
              <div className="openai-settings-actions">
                <small>이 기기에만 저장돼요.</small>
                {openAISettings?.source === "local" ? (
                  <button className="secondary-action" type="button" onClick={clearOpenAIKey} disabled={isSavingOpenAI}>
                    <Trash2 size={14} /> 키 삭제
                  </button>
                ) : null}
                <button className="save-provider-button" type="submit" disabled={isSavingOpenAI}>
                  {isSavingOpenAI ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />}
                  저장하고 확인
                </button>
              </div>
              {openAIStatus ? (
                <p className={`provider-status ${openAIStatus.type}`}>
                  {openAIStatus.type === "success" ? <CheckCircle2 size={14} /> : <WifiOff size={14} />}
                  {openAIStatus.message}
                </p>
              ) : null}
            </form>
          )}
        </section>
      ) : null}

      <div className="message-list" aria-live="polite" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-chat">
            <span className="empty-chat-avatar" style={{ "--active-persona": persona?.color || "#facc15" }}>{personaInitial}</span>
            <strong>{persona?.name || "캐릭터"}에게 말을 걸어보세요.</strong>
            <p>이곳에서 나눈 이야기는 이 캐릭터만의 기억으로 이어져요.</p>
          </div>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            <div className="message-avatar" style={message.role === "assistant" ? { background: persona?.color || "#facc15" } : undefined}>
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
            <div className="message-avatar" style={{ background: persona?.color || "#facc15" }}>{personaInitial || <Bot size={16} />}</div>
            <div className="message-body">
              <span>{persona?.name || "Persona"}</span>
              <div className="loading-block">
                <div className="loader-ring" style={{ "--active-persona": persona?.color || "#facc15" }} />
                <div>
                  <strong>생각을 이어가는 중</strong>
                  <p>{elapsedSeconds < 4 ? "방금 나눈 이야기를 살피고 있어요" : `${elapsedSeconds}초째 천천히 답을 고르고 있어요`}</p>
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
          placeholder={`${persona?.name || "캐릭터"}에게 이야기하기`}
          disabled={isSending}
          rows={2}
        />
        <button type="submit" disabled={isSending || !draft.trim()} title="전송">
          <Send size={18} />
        </button>
      </form>

      <PersonaLibrary
        open={libraryOpen}
        personas={personas}
        activeId={persona?.id}
        disabled={isSending}
        onSelect={onPersonaChange}
        onCreate={onNewPersona}
        onClose={() => setLibraryOpen(false)}
      />
    </section>
  );
}
