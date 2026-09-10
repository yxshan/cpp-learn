import type { ProgressResult } from "@cpp-learn/contracts";

import { numberFormatter } from "./format.js";

export function KnowledgeMap({
  progress,
}: {
  readonly progress: ProgressResult | undefined;
}) {
  return (
    <article id="knowledge-map" className="path-card">
      <p className="eyebrow">KNOWLEDGE MAP</p>
      <h2>概念证据地图</h2>
      <div className="concept-list">
        {progress?.concepts.map((concept) => (
          <div key={concept.conceptId}>
            <span className={`concept-state state-${concept.state}`}>
              {concept.state}
            </span>
            <strong>{concept.conceptId}</strong>
            <p>{concept.explanation}</p>
            <small>
              {numberFormatter.format(concept.supportingEvidenceIds.length)}{" "}
              条支持证据
            </small>
          </div>
        ))}
        {progress?.concepts.length === 0 && (
          <p className="muted">完成 Grade 后，这里会显示状态与支持证据。</p>
        )}
      </div>
    </article>
  );
}
