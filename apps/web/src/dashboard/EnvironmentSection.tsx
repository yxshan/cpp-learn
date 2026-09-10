import type { BootstrapResult } from "@cpp-learn/contracts";

import { numberFormatter, timeFormatter } from "./format.js";
import { StatusCard } from "./StatusCard.js";

export function EnvironmentSection({
  bootstrap,
}: {
  readonly bootstrap: BootstrapResult | undefined;
}) {
  return (
    <section id="environment" className="section-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SYSTEM READINESS</p>
          <h2>工程环境</h2>
        </div>
        <span className="last-check">
          {bootstrap
            ? `检测于 ${timeFormatter.format(new Date(bootstrap.generatedAt))}`
            : "检测中"}
        </span>
      </div>
      <div className="status-grid">
        <StatusCard
          eyebrow="CURRICULUM"
          title="课程目录"
          detail={`${numberFormatter.format(
            bootstrap?.services.curriculum.activityCount ?? 0,
          )} 个活动已校验`}
          ready={bootstrap?.services.curriculum.ready ?? false}
          icon="01"
        />
        <StatusCard
          eyebrow="TOOLCHAIN"
          title="C++20 工具链"
          detail={bootstrap?.services.toolchain.compiler ?? "正在探测 clang++"}
          ready={bootstrap?.services.toolchain.ready ?? false}
          icon="++"
        />
        <StatusCard
          eyebrow="LEARNING RECORD"
          title="本地学习记录"
          detail="追加式 JSONL · SQLite 投影 · 可恢复"
          ready={bootstrap?.services.record.ready ?? false}
          icon="↳"
        />
      </div>
    </section>
  );
}
