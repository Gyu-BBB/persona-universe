import { Clock3 } from "lucide-react";

function layerLabel(layer) {
  return {
    turn: "방금",
    session: "대화",
    persona: "기억"
  }[layer] || "기억";
}

function eventText(summary) {
  const text = String(summary || "")
    .replace(/node_created/g, "새 기억")
    .replace(/node_reinforced/g, "기억 강화")
    .replace(/edge_created/g, "새 연결")
    .replace(/edge_reinforced/g, "연결 강화");
  return text
    .replace(/(.+) 기억 생성$/, "$1 기억함")
    .replace(/(.+) 관계 생성$/, "$1 연결됨")
    .replace(/(.+) 기억 강화$/, "$1 다시 떠올림")
    .replace(/(.+) 관계 강화$/, "$1 연결이 또렷해짐");
}

export function Timeline({ events }) {
  return (
    <section className="timeline-strip">
      <div className="timeline-title">
        <Clock3 size={16} />
        기억이 움직인 순간
      </div>
      <div className="timeline-items">
        {(events || []).slice(0, 12).map((event) => (
          <div key={event.id} className={`timeline-item ${event.layer}`}>
            <span>{layerLabel(event.layer)}</span>
            <p>{eventText(event.summary)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
