import { useState } from "react";

import type { InteractiveLessonBlock } from "@cpp-learn/contracts";

/**
 * Step-through trace for an interactive lesson block.
 *
 * Purely presentational: it owns only the "which step is showing" cursor, so a
 * lesson trace can be read and tested without the lesson workspace around it.
 */
export function InteractiveBlock({
  block,
}: {
  readonly block: InteractiveLessonBlock;
}) {
  const steps = block.fallback.split(/\s*->\s*/);
  const [step, setStep] = useState(0);
  const stateClass = (index: number): string =>
    index < step ? "complete" : index === step ? "current" : "";

  const visualization =
    block.type === "network-flow" ? (
      <ol
        className="network-trace"
        aria-label={`网络流可视化，共 ${steps.length} 个节点`}
        aria-live="polite"
      >
        {steps.map((label, index) => (
          <li className={stateClass(index)} key={`${block.id}-${index}`}>
            <span className="network-node" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <strong>{label}</strong>
            {index < steps.length - 1 && (
              <span className="network-link" aria-hidden="true">
                ↓
              </span>
            )}
          </li>
        ))}
      </ol>
    ) : block.type === "lifetime-timeline" ||
      block.type === "memory-visualization" ? (
      <ol
        className="lifetime-trace"
        aria-label={`${block.type} 可视化，共 ${steps.length} 个状态`}
        aria-live="polite"
      >
        {steps.map((label, index) => (
          <li className={stateClass(index)} key={`${block.id}-${index}`}>
            <span aria-hidden="true" />
            <div>
              <small>
                {block.type === "memory-visualization" ? "MEM" : "LIFE"}
              </small>
              <strong>{label}</strong>
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <div
        className="interactive-stepper"
        aria-label={`${block.type} 可视化，共 ${steps.length} 步`}
        aria-live="polite"
      >
        {steps.map((label, index) => (
          <div className={stateClass(index)} key={`${block.id}-${index}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{label}</strong>
            {index < steps.length - 1 && <i aria-hidden="true">→</i>}
          </div>
        ))}
      </div>
    );

  return (
    <section className="interactive-fallback" data-visualization={block.type}>
      <p className="eyebrow">INTERACTIVE · {block.type}</p>
      {visualization}
      <p className="interactive-position">
        当前步骤 {step + 1} / {steps.length}
      </p>
      {steps.length > 1 && (
        <div className="interactive-controls">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
          >
            上一步
          </button>
          <button
            type="button"
            disabled={step === steps.length - 1}
            onClick={() => setStep((value) => value + 1)}
          >
            下一步
          </button>
        </div>
      )}
    </section>
  );
}
