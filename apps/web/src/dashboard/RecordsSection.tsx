import type { DashboardResult } from "@cpp-learn/contracts";

import { numberFormatter } from "./format.js";

export function RecordsSection({
  dashboard,
  practiced,
  dataMessage,
  onOpenWorkspace,
  onDownloadBackup,
  onRestoreFile,
}: {
  readonly dashboard: DashboardResult | undefined;
  readonly practiced: number;
  readonly dataMessage: string;
  readonly onOpenWorkspace: (activityId?: string) => void;
  readonly onDownloadBackup: () => Promise<void>;
  readonly onRestoreFile: (file: File) => Promise<void>;
}) {
  return (
    <section id="records" className="learning-grid section-block">
      <article className="current-card">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">CURRENT ACTIVITY</p>
            <h2>从源代码到可执行程序</h2>
          </div>
          <span className="time-pill">35 MIN</span>
        </div>
        <div className="lesson-row">
          <div className="lesson-number">01</div>
          <div className="lesson-copy">
            <span className="lesson-kind">LESSON + WORKSPACE</span>
            <h3>完成第一个可判定的 C++ 学习闭环</h3>
            <p>课程、代码编辑、编译运行、客观判题和学习记录已连通。</p>
            <div className="lesson-tags">
              <span>Compile</span>
              <span>Run</span>
              <span>Evidence</span>
            </div>
          </div>
          <button
            className="lesson-button enabled"
            type="button"
            onClick={() => onOpenWorkspace("source-to-program")}
          >
            进入课程 <span>→</span>
          </button>
        </div>
      </article>
      <article className="path-card">
        <p className="eyebrow">YOUR EVIDENCE</p>
        <h2>本地学习进度</h2>
        <div className="metric-row">
          <div>
            <strong>
              {numberFormatter.format(dashboard?.attempts.length ?? 0)}
            </strong>
            <span>运行与判题</span>
          </div>
          <div>
            <strong>{numberFormatter.format(practiced)}</strong>
            <span>已练习概念</span>
          </div>
        </div>
        <div className="attempt-list">
          {dashboard?.attempts
            .slice(-3)
            .reverse()
            .map((attempt) => (
              <div key={attempt.jobId}>
                <span>{attempt.mode.toUpperCase()}</span>
                <strong>{attempt.verdict}</strong>
              </div>
            ))}
          {dashboard?.attempts.length === 0 && (
            <p className="muted">尚无记录，完成一次 Grade 后会显示在这里。</p>
          )}
        </div>
        <div className="data-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={() => void onDownloadBackup()}
          >
            导出本地备份
          </button>
          <label className="secondary-button file-button">
            恢复备份
            <input
              type="file"
              name="backup"
              autoComplete="off"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void onRestoreFile(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <span aria-live="polite">{dataMessage}</span>
        </div>
      </article>
    </section>
  );
}
