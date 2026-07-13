import { Clock3 } from "lucide-react";

const HIDDEN_TYPES = new Set(["person", "persona", "relationship", "turn", "session"]);

function memoryMoments(events, nodes) {
  const nodeById = new Map((nodes || []).map((node) => [node.id, node]));
  const seen = new Set();
  return (events || [])
    .map((event) => ({ event, node: nodeById.get(event.node_id) }))
    .filter(({ event, node }) => (
      node
      && !HIDDEN_TYPES.has(node.type)
      && node.properties?.ontologyRole !== "persona_profile_fact"
      && ["node_created", "node_reinforced"].includes(event.event_type)
    ))
    .filter(({ node }) => {
      if (seen.has(node.id)) return false;
      seen.add(node.id);
      return true;
    })
    .slice(0, 10);
}

function eventText(event, node) {
  if (event.event_type === "node_created") return `${node.label}을 새로 알게 됐어요`;
  return `${node.label}이 다시 떠올랐어요`;
}

export function Timeline({ events, nodes }) {
  const moments = memoryMoments(events, nodes);
  return (
    <section className="memory-journal">
      <div className="timeline-title">
        <Clock3 size={16} />
        최근에 남은 기억
      </div>
      <div className="timeline-items">
        {moments.length === 0 ? <p className="timeline-empty">아직 최근에 더해진 기억이 없어요.</p> : null}
        {moments.slice(0, 5).map(({ event, node }) => (
          <div key={event.id} className="timeline-item">
            <span className={node.properties?.ontologyRole === "relationship_fact" ? "relationship" : "memory"} />
            <p>{eventText(event, node)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
