import { HeartHandshake, UserRound } from "lucide-react";

function SummaryBlock({ icon, title, items, emptyText }) {
  const visibleItems = (items || []).slice(0, 6);
  return (
    <section className="memory-note-section">
      <h2>{icon}{title}</h2>
      {visibleItems.length ? <ul>
        {visibleItems.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul> : <p>{emptyText}</p>}
    </section>
  );
}

export function SummaryPanel({ summaries, personaName }) {
  const name = personaName || "이 캐릭터";
  return (
    <div className="summary-panel">
      <SummaryBlock
        icon={<UserRound size={16} />}
        title={`${name}의 기억 속 나`}
        items={summaries?.persona}
        emptyText="아직 나에 대해 알게 된 이야기가 적어요."
      />
      <SummaryBlock
        icon={<HeartHandshake size={16} />}
        title="우리 사이"
        items={summaries?.influence}
        emptyText="조금 더 이야기하면 우리만의 맥락이 생겨요."
      />
    </div>
  );
}
