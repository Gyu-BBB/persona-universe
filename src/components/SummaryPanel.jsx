import { Activity, Brain, CircleDot, Route } from "lucide-react";

function SummaryBlock({ icon, title, items }) {
  return (
    <section className="summary-block">
      <h2>{icon}{title}</h2>
      <ul>
        {(items || []).slice(0, 8).map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function SummaryPanel({ summaries }) {
  return (
    <div className="summary-panel">
      <SummaryBlock icon={<CircleDot size={17} />} title="방금 떠오른 것" items={summaries?.turn} />
      <SummaryBlock icon={<Activity size={17} />} title="이 대화의 흐름" items={summaries?.session} />
      <SummaryBlock icon={<Brain size={17} />} title="오래 남은 기억" items={summaries?.persona} />
      <SummaryBlock icon={<Route size={17} />} title="응답에 스민 맥락" items={summaries?.influence} />
    </div>
  );
}
