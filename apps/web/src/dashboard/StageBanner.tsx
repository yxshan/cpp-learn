import type { CatalogActivity } from "./types.js";

export function StageBanner({
  firstActivity,
  activityCount,
  onOpenWorkspace,
}: {
  readonly firstActivity: CatalogActivity | undefined;
  readonly activityCount: number | undefined;
  readonly onOpenWorkspace: (activityId?: string) => void;
}) {
  return (
    <section className="stage-banner" aria-labelledby="stage-title">
      <div className="stage-copy">
        <span className="stage-chip">阶段 06 · 职业项目路径</span>
        <h2 id="stage-title">
          从可判定练习走向能解释、能复现的 C++ 工程作品。
        </h2>
        <p>
          70 个活动覆盖现代
          C++、算法、工具链、系统、网络、数据库、并发与生产就绪；5
          个渐进式项目把代码、测试、基准和事故复盘连成作品集。
        </p>
        <div className="stage-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => onOpenWorkspace(firstActivity?.id)}
            disabled={!firstActivity}
          >
            开始第一课
          </button>
          <span>
            完整路径 <strong>{activityCount ?? 0} 个学习活动</strong>
          </span>
        </div>
      </div>
      <div className="code-window" aria-hidden="true" translate="no">
        <div className="window-bar">
          <i />
          <i />
          <i />
          <span>main.cpp</span>
        </div>
        <pre>
          <code>
            <span className="code-purple">#include</span>{" "}
            <span className="code-green">&lt;iostream&gt;</span>
            {"\n\n"}
            <span className="code-blue">int</span> main() {"{"}
            {"\n"} std::cout &lt;&lt;{" "}
            <span className="code-green">"Hello, C++!"</span>;{"\n"}
            {"}"}
          </code>
        </pre>
        <div className="terminal-line">
          <span>$</span> clang++ -std=c++20 main.cpp <i>✓</i>
        </div>
      </div>
    </section>
  );
}
