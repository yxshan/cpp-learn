import type { ReactNode } from "react";

export function StatusCard({
  eyebrow,
  title,
  detail,
  ready,
  icon,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly ready: boolean;
  readonly icon: ReactNode;
}) {
  return (
    <article className="status-card">
      <div
        className={`status-icon ${ready ? "is-ready" : "needs-attention"}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p className="muted">{detail}</p>
      </div>
      <span className={`status-dot ${ready ? "is-ready" : "needs-attention"}`}>
        {ready ? "正常" : "待处理"}
      </span>
    </article>
  );
}
