import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { BootstrapResult } from "@cpp-learn/contracts";

import { getBootstrap } from "./api.js";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: BootstrapResult }
  | { readonly status: "error"; readonly message: string };

interface StatusCardProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly detail: string;
  readonly ready: boolean;
  readonly icon: ReactNode;
}

function StatusCard({ eyebrow, title, detail, ready, icon }: StatusCardProps) {
  return (
    <article className="status-card">
      <div className={`status-icon ${ready ? "is-ready" : "needs-attention"}`}>
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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span>&lt;</span>
      <span className="brand-plus">++</span>
      <span>/&gt;</span>
    </span>
  );
}

function AppIcon({ children }: { readonly children: ReactNode }) {
  return <span aria-hidden="true">{children}</span>;
}

export function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const refresh = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", data: await getBootstrap() });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "无法连接本地学习服务"
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const data = state.status === "ready" ? state.data : undefined;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <BrandMark />
          <div>
            <strong>C++ Learn</strong>
            <span>Engineering Track</span>
          </div>
        </div>

        <nav aria-label="主导航">
          <p className="nav-label">学习空间</p>
          <a className="nav-item active" href="#overview">
            <AppIcon>⌁</AppIcon>总览
          </a>
          <a className="nav-item" href="#current">
            <AppIcon>▶</AppIcon>当前课程
          </a>
          <a className="nav-item" href="#path">
            <AppIcon>◇</AppIcon>知识路径
          </a>
          <button className="nav-item" disabled>
            <AppIcon>↻</AppIcon>复习队列<span className="nav-badge">稍后</span>
          </button>
          <p className="nav-label secondary">工具</p>
          <a className="nav-item" href="#environment">
            <AppIcon>⌘</AppIcon>开发环境
          </a>
          <a className="nav-item" href="#records">
            <AppIcon>▤</AppIcon>学习记录
          </a>
        </nav>

        <div className="sidebar-footer">
          <span className="local-pulse" />
          <div><strong>本地模式</strong><span>数据保存在此设备</span></div>
        </div>
      </aside>

      <main id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">学习控制台</p>
            <h1>早上好，准备构建点什么？</h1>
          </div>
          <div className="topbar-actions">
            <span className={`overall-status ${data?.ready ? "is-ready" : ""}`}>
              <i />{data?.ready ? "环境已就绪" : "正在检查环境"}
            </span>
            <button className="avatar" aria-label="本地学习者">L</button>
          </div>
        </header>

        <section className="stage-banner" aria-labelledby="stage-title">
          <div className="stage-copy">
            <span className="stage-chip">STAGE 0 · ENGINEERING BASELINE</span>
            <h2 id="stage-title">先把地基打稳，再写第一行学习代码。</h2>
            <p>共享核心、Web、CLI、课程校验与本地记录正在组成同一个可靠的学习环境。</p>
            <div className="stage-actions">
              <button className="primary-button" onClick={() => void refresh()}>
                {state.status === "loading" ? "正在检测…" : "重新检测环境"}
              </button>
              <span>阶段进度 <strong>1 / 7</strong></span>
            </div>
          </div>
          <div className="code-window" aria-label="C++ 示例代码">
            <div className="window-bar"><i /><i /><i /><span>main.cpp</span></div>
            <pre><code><span className="code-purple">#include</span> <span className="code-green">&lt;iostream&gt;</span>{"\n\n"}<span className="code-blue">int</span> main() {"{"}{"\n"}  std::cout &lt;&lt; <span className="code-green">"Hello, future."</span>;{"\n"}  <span className="code-purple">return</span> <span className="code-orange">0</span>;{"\n"}{"}"}</code></pre>
            <div className="terminal-line"><span>$</span> clang++ -std=c++20 main.cpp <i>✓</i></div>
          </div>
        </section>

        {state.status === "error" && (
          <section className="error-panel" role="alert">
            <strong>本地服务暂时不可用</strong>
            <span>{state.message}。请先运行 `npm run dev`，然后重试。</span>
            <button onClick={() => void refresh()}>重试</button>
          </section>
        )}

        <section id="environment" className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">SYSTEM READINESS</p><h2>工程环境</h2></div>
            <span className="last-check">{data ? `检测于 ${new Date(data.generatedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : "检测中"}</span>
          </div>
          <div className="status-grid">
            <StatusCard
              eyebrow="CURRICULUM"
              title="课程目录"
              detail={data ? `${data.services.curriculum.activityCount} 个活动已通过结构校验` : "正在读取课程清单"}
              ready={data?.services.curriculum.ready ?? false}
              icon={<AppIcon>01</AppIcon>}
            />
            <StatusCard
              eyebrow="TOOLCHAIN"
              title="C++20 工具链"
              detail={data?.services.toolchain.compiler ?? "正在探测 clang++"}
              ready={data?.services.toolchain.ready ?? false}
              icon={<AppIcon>++</AppIcon>}
            />
            <StatusCard
              eyebrow="LEARNING RECORD"
              title="本地学习记录"
              detail="追加式事件日志 · 完全由你拥有"
              ready={data?.services.record.ready ?? false}
              icon={<AppIcon>↳</AppIcon>}
            />
          </div>
        </section>

        <section id="current" className="learning-grid section-block">
          <article className="current-card">
            <div className="section-heading compact">
              <div><p className="eyebrow">UP NEXT</p><h2>第一课已就绪</h2></div>
              <span className="time-pill">约 35 分钟</span>
            </div>
            <div className="lesson-row">
              <div className="lesson-number">01</div>
              <div className="lesson-copy">
                <span className="lesson-kind">基础 · 编译模型</span>
                <h3>从源代码到可执行程序</h3>
                <p>从你熟悉的 JavaScript 出发，建立 C++ 编译、链接和运行的第一套心智模型。</p>
                <div className="lesson-tags"><span>main</span><span>clang++</span><span>C++20</span></div>
              </div>
              <button className="lesson-button" disabled title="Stage 1 将开放课程工作区">Stage 1 开放 <span>→</span></button>
            </div>
          </article>

          <article id="path" className="path-card">
            <p className="eyebrow">YOUR PATH</p>
            <h2>现代 C++ 工程路线</h2>
            <div className="path-list">
              <div className="path-item active"><i>1</i><div><strong>工程基线</strong><span>进行中</span></div></div>
              <div className="path-item"><i>2</i><div><strong>语言与内存模型</strong><span>下一阶段</span></div></div>
              <div className="path-item"><i>3</i><div><strong>STL 与工程化</strong><span>尚未解锁</span></div></div>
              <div className="path-item"><i>4</i><div><strong>服务端专项</strong><span>方向待选择</span></div></div>
            </div>
          </article>
        </section>

        <footer id="records">
          <span>cpp-learn v0.1.0 · Stage 0</span>
          <span>Local-first · C++20 · React</span>
        </footer>
      </main>
    </div>
  );
}

