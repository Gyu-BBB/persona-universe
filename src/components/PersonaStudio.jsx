import { Palette, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const COLORS = ["#5eead4", "#facc15", "#60a5fa", "#c084fc", "#fb7185", "#8bd450"];

const PROFILE_FIELDS = [
  ["age", "나이", "29살"],
  ["occupation", "직업", "감정 기록가"],
  ["background", "배경", "상담 기록과 커뮤니티 운영 경험"],
  ["trait", "성격", "차분하고 세심함"],
  ["signature", "특징", "말 사이의 감정을 잘 읽음"],
  ["strength", "강점", "복잡한 마음을 짧게 정리함"],
  ["growth", "조심하는 점", "상대를 너무 빨리 해석하지 않기"],
  ["likes", "좋아하는 것", "새벽 산책과 조용한 음악"],
  ["avoids", "불편한 것", "재촉과 단정적인 조언"],
  ["speech", "말투", "짧고 따뜻한 존댓말"],
  ["boundary", "관계 방식", "곁에서 천천히 동행"]
];

const INITIAL_FORM = {
  name: "루미",
  avatar: "루",
  color: COLORS[0],
  description: "",
  age: "29살",
  occupation: "감정 기록가",
  background: "상담 기록과 커뮤니티 운영 경험",
  trait: "차분하고 세심함",
  signature: "말 사이의 감정을 잘 읽음",
  strength: "복잡한 마음을 짧게 정리함",
  growth: "상대를 너무 빨리 해석하지 않기",
  likes: "새벽 산책과 조용한 음악",
  avoids: "재촉과 단정적인 조언",
  speech: "짧고 따뜻한 존댓말",
  boundary: "곁에서 천천히 동행"
};

function profileFromForm(form) {
  return PROFILE_FIELDS
    .map(([key, label]) => {
      const value = String(form[key] || "").trim();
      if (!value) return null;
      return {
        key,
        value,
        category: label,
        label: `${label}: ${value}`,
        rememberedAs: `${form.name}는 ${label}을 ${value}로 가진 캐릭터입니다.`
      };
    })
    .filter(Boolean);
}

function characterDescription(form) {
  if (form.description.trim()) return form.description.trim();
  return `${form.age}의 ${form.occupation}. ${form.trait} 성격으로 사용자와 ${form.boundary}하는 페르소나.`;
}

function characterPrompt(form) {
  return [
    `${form.name}는 ${form.age}의 ${form.occupation}이다.`,
    `성격은 ${form.trait}이고, 특징은 ${form.signature}이다.`,
    `좋아하는 것은 ${form.likes}, 불편해하는 것은 ${form.avoids}이다.`,
    `말투는 ${form.speech}이며, 사용자와의 관계 방식은 ${form.boundary}이다.`,
    "사용자의 장기 기억과 현재 감정을 자연스럽게 참고하되, 기록하는 듯한 표현은 피한다."
  ].join(" ");
}

export function PersonaStudio({ open, isSaving, onClose, onCreate }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const profile = useMemo(() => profileFromForm(form), [form]);

  useEffect(() => {
    if (open) setForm(INITIAL_FORM);
  }, [open]);

  if (!open) return null;

  function update(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" && !current.avatar ? { avatar: value.trim().slice(0, 1) } : {})
    }));
  }

  function submit(event) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name || isSaving) return;
    onCreate({
      name,
      avatar: form.avatar.trim().slice(0, 2) || name.slice(0, 1),
      color: form.color,
      description: characterDescription({ ...form, name }),
      systemPrompt: characterPrompt({ ...form, name }),
      characterProfile: profile
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="persona-studio" onSubmit={submit} data-visual-target="persona-studio">
        <header className="studio-header">
          <div>
            <h2><Sparkles size={18} /> 캐릭터 스튜디오</h2>
            <p>{profile.length}개의 캐릭터 기억</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="닫기" disabled={isSaving}>
            <X size={17} />
          </button>
        </header>

        <section className="studio-body">
          <div className="studio-fields">
            <label>
              <span>이름</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} maxLength={18} required />
            </label>
            <label>
              <span>표식</span>
              <input value={form.avatar} onChange={(event) => update("avatar", event.target.value)} maxLength={2} />
            </label>
            <label className="wide-field">
              <span>한 줄 설명</span>
              <input value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="차분하게 곁을 지키는 대화 상대" />
            </label>
            {PROFILE_FIELDS.map(([key, label, placeholder]) => (
              <label key={key}>
                <span>{label}</span>
                <input value={form[key]} onChange={(event) => update(key, event.target.value)} placeholder={placeholder} />
              </label>
            ))}
          </div>

          <aside className="studio-preview" style={{ "--active-persona": form.color }}>
            <div className="studio-avatar">{form.avatar.trim().slice(0, 2) || form.name.trim().slice(0, 1) || "P"}</div>
            <strong>{form.name || "새 캐릭터"}</strong>
            <p>{characterDescription(form)}</p>
            <div className="color-row" aria-label="character color">
              <Palette size={15} />
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={form.color === color ? "is-active" : ""}
                  type="button"
                  style={{ "--swatch": color }}
                  onClick={() => update("color", color)}
                  title={color}
                />
              ))}
            </div>
            <div className="preview-memory-list">
              {profile.slice(0, 7).map((item) => <span key={item.key}>{item.label}</span>)}
            </div>
          </aside>
        </section>

        <footer className="studio-actions">
          <button type="button" onClick={onClose} disabled={isSaving}>취소</button>
          <button className="primary-action" type="submit" disabled={isSaving || !form.name.trim()}>
            생성
          </button>
        </footer>
      </form>
    </div>
  );
}
