import { useEffect, useMemo, useState } from "react";
import { Check, LockKeyhole, Plus, Search, X } from "lucide-react";

const TEMPLATE_ORDER = new Map(["serin", "haon", "ian", "miro", "noa"].map((key, index) => [key, index]));

function profileValue(persona, key) {
  return persona.characterProfile?.find((item) => item.key === key)?.value || "";
}

function matchesQuery(persona, query) {
  if (!query) return true;
  const searchable = [
    persona.name,
    persona.description,
    profileValue(persona, "occupation"),
    profileValue(persona, "mbti"),
    profileValue(persona, "trait")
  ].join(" ").toLowerCase();
  return searchable.includes(query.toLowerCase());
}

function PersonaOption({ persona, activeId, disabled, onSelect }) {
  const active = persona.id === activeId;
  const avatar = persona.avatar || persona.name?.trim()?.[0] || "P";
  const meta = [
    profileValue(persona, "age"),
    profileValue(persona, "mbti"),
    profileValue(persona, "occupation")
  ].filter(Boolean).join(" · ");

  return (
    <button
      type="button"
      className={`persona-option ${active ? "is-active" : ""}`}
      style={{ "--active-persona": persona.color || "#facc15" }}
      onClick={() => onSelect(persona.id)}
      disabled={disabled && !active}
      aria-current={active ? "true" : undefined}
    >
      <span className="persona-option-avatar">{avatar}</span>
      <span className="persona-option-copy">
        <span className="persona-option-title">
          <strong>{persona.name}</strong>
          {persona.templateKey ? <small><LockKeyhole size={11} /> 기본</small> : null}
        </span>
        <span>{meta || persona.description}</span>
        {persona.description ? <p>{persona.description}</p> : null}
      </span>
      {active ? <span className="persona-option-check"><Check size={16} /></span> : null}
    </button>
  );
}

function PersonaGroup({ title, items, activeId, disabled, onSelect }) {
  if (!items.length) return null;
  return (
    <section className="persona-library-group">
      <h3>{title}</h3>
      <div className="persona-library-grid">
        {items.map((persona) => (
          <PersonaOption
            key={persona.id}
            persona={persona}
            activeId={activeId}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function PersonaLibrary({ open, personas, activeId, disabled, onSelect, onCreate, onClose }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => (personas || []).filter((persona) => matchesQuery(persona, query.trim())),
    [personas, query]
  );
  const templates = filtered
    .filter((persona) => persona.templateKey)
    .sort((a, b) => (TEMPLATE_ORDER.get(a.templateKey) ?? 99) - (TEMPLATE_ORDER.get(b.templateKey) ?? 99));
  const custom = filtered.filter((persona) => !persona.templateKey);

  useEffect(() => {
    if (!open) return undefined;
    setQuery("");
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  function selectPersona(personaId) {
    onClose();
    if (personaId !== activeId) onSelect(personaId);
  }

  function createPersona() {
    onClose();
    onCreate();
  }

  return (
    <div className="modal-backdrop persona-library-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="persona-library" role="dialog" aria-modal="true" aria-labelledby="persona-library-title">
        <header className="persona-library-header">
          <div>
            <h2 id="persona-library-title">누구와 이야기할까요?</h2>
            <p>캐릭터마다 나를 기억하는 방식이 달라요.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="닫기">
            <X size={18} />
          </button>
        </header>

        <div className="persona-library-tools">
          <label className="persona-search">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 직업, MBTI로 찾기"
              aria-label="캐릭터 검색"
              autoFocus
            />
          </label>
          <button className="create-persona-button" type="button" onClick={createPersona} disabled={disabled}>
            <Plus size={17} /> 새 캐릭터
          </button>
        </div>

        <div className="persona-library-list">
          {filtered.length ? (
            <>
              <PersonaGroup title="기본 캐릭터" items={templates} activeId={activeId} disabled={disabled} onSelect={selectPersona} />
              <PersonaGroup title="내 캐릭터" items={custom} activeId={activeId} disabled={disabled} onSelect={selectPersona} />
            </>
          ) : (
            <div className="persona-library-empty">
              <Search size={20} />
              <p>찾는 캐릭터가 없어요.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
