import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import type {
  ActivityDetail,
  InteractiveLessonBlock,
  JudgeReport,
  WorkspaceView,
} from "@cpp-learn/contracts";

import {
  cancelJob,
  executeActivity,
  getActivity,
  getWorkspace,
  revealHint,
  saveWorkspace,
  submitReflection,
} from "./api.js";
import { formatCppSource, isCppSourcePath } from "./cpp-format.js";
import { referenceEntryUrl, referenceSearchUrl } from "./reference-location.js";
import { useReferenceLinks } from "./reference-links.js";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

function prepareInitialSources(
  workspace: WorkspaceView,
  editablePaths: readonly string[],
): Record<string, string> {
  const files = { ...workspace.files };
  const isUntouchedStarter = editablePaths.every(
    (path) => files[path] === workspace.starterFiles[path],
  );
  if (!isUntouchedStarter) return files;

  for (const path of editablePaths) {
    if (isCppSourcePath(path)) files[path] = formatCppSource(files[path] ?? "");
  }
  return files;
}

function InteractiveBlock({
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

function commandId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export interface LessonWorkspaceProps {
  readonly activityId?: string;
  readonly currentPosition?: number | undefined;
  readonly totalActivities?: number | undefined;
  readonly previousActivity?:
    | {
        readonly id: string;
        readonly title: string;
      }
    | undefined;
  readonly nextActivity?:
    | {
        readonly id: string;
        readonly title: string;
      }
    | undefined;
  readonly onBack: () => void;
  readonly onNavigate: (activityId: string) => void;
  readonly onDirtyChange: (dirty: boolean) => void;
  readonly onEvidenceChanged: () => Promise<void>;
}

export function LessonWorkspace({
  activityId = "source-to-program",
  currentPosition,
  totalActivities,
  previousActivity,
  nextActivity,
  onBack,
  onNavigate,
  onDirtyChange,
  onEvidenceChanged,
}: LessonWorkspaceProps) {
  const [activity, setActivity] = useState<ActivityDetail>();
  const [workspace, setWorkspace] = useState<WorkspaceView>();
  const [sources, setSources] = useState<Record<string, string>>({});
  const [activePath, setActivePath] = useState("main.cpp");
  const [report, setReport] = useState<JudgeReport>();
  const [busy, setBusy] = useState<"save" | "run" | "grade">();
  const [isDirty, setIsDirty] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string>();
  const [message, setMessage] = useState("正在加载课程工作区…");
  const [attemptId, setAttemptId] = useState(
    () => `web_attempt_${crypto.randomUUID()}`,
  );
  const [revealedHints, setRevealedHints] = useState<
    readonly {
      readonly id: string;
      readonly title: string;
      readonly content: string;
    }[]
  >([]);
  const [reflectionAnswers, setReflectionAnswers] = useState<
    Record<string, string>
  >({});
  const referenceLinks = useReferenceLinks(activity?.referenceIds);

  useEffect(() => {
    let cancelled = false;
    setActivity(undefined);
    setWorkspace(undefined);
    setSources({});
    setReport(undefined);
    setRevealedHints([]);
    setReflectionAnswers({});
    setAttemptId(`web_attempt_${crypto.randomUUID()}`);
    setIsDirty(false);
    onDirtyChange(false);
    setMessage("正在加载课程工作区…");
    void Promise.all([getActivity(activityId), getWorkspace(activityId)])
      .then(([activityResult, workspaceResult]) => {
        if (cancelled) return;
        if (!activityResult.activity) throw new Error("课程不存在");
        const initialSources = prepareInitialSources(
          workspaceResult.workspace,
          activityResult.activity.workspace.editablePaths,
        );
        setActivity(activityResult.activity);
        setWorkspace({
          ...workspaceResult.workspace,
          files: initialSources,
        });
        setSources(initialSources);
        setActivePath(
          activityResult.activity.workspace.editablePaths[0] ?? "main.cpp",
        );
        setIsDirty(false);
        setMessage("工作区已加载");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "工作区加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activityId, onDirtyChange]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const persist = async (): Promise<void> => {
    if (!workspace || !activity) return;
    const result = await saveWorkspace(activityId, {
      commandId: commandId("save"),
      baseRevision: workspace.revision,
      changes: activity.workspace.editablePaths.map((path) => ({
        path,
        content: sources[path] ?? "",
      })),
    });
    if (!result.result.ok) {
      throw new Error(
        result.result.code === "revision_conflict"
          ? "文件已在别处更新，请刷新后重试"
          : "文件路径不允许编辑",
      );
    }
    setWorkspace({
      ...workspace,
      revision: result.result.revision,
      files: { ...sources },
    });
    setIsDirty(false);
    onDirtyChange(false);
  };

  const save = async (): Promise<void> => {
    setBusy("save");
    try {
      await persist();
      setMessage("已保存到本地工作区");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(undefined);
    }
  };

  const execute = async (mode: "run" | "grade"): Promise<void> => {
    setBusy(mode);
    setReport(undefined);
    try {
      await persist();
      setMessage(mode === "run" ? "正在编译并运行…" : "正在提交判题…");
      const executionCommandId = commandId(mode);
      const jobId = `job_${executionCommandId}`;
      setActiveJobId(jobId);
      const result = await executeActivity(
        activityId,
        mode,
        executionCommandId,
        attemptId,
      );
      setReport(result.report);
      setMessage(
        result.report.verdict === "automated_pass"
          ? mode === "grade"
            ? "Grade 通过，学习证据已记录"
            : "Run 通过（不会计入掌握证据）"
          : `结果：${result.report.verdict}`,
      );
      if (mode === "grade") await onEvidenceChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setActiveJobId(undefined);
      setBusy(undefined);
    }
  };

  const revealNextHint = async (): Promise<void> => {
    const hint = activity?.learning?.hints[revealedHints.length];
    if (!hint) return;
    const confirmFullSolution =
      hint.kind !== "solution" ||
      window.confirm(
        "完整答案会将本次尝试标记为 solution_exposed，不能形成 demonstrated 证据。仍要查看吗？",
      );
    if (!confirmFullSolution) return;
    try {
      const result = await revealHint(activityId, {
        commandId: commandId("hint"),
        attemptId,
        hintId: hint.id,
        confirmFullSolution: hint.kind === "solution",
      });
      setRevealedHints((current) => [...current, result.hint]);
      setMessage(
        result.assistance === "solution_exposed"
          ? "已记录完整答案暴露；本次尝试最高为 practiced"
          : "提示使用已记录",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提示加载失败");
    }
  };

  const saveReflection = async (): Promise<void> => {
    const prompts = activity?.learning?.reflections ?? [];
    try {
      await submitReflection(activityId, {
        commandId: commandId("reflection"),
        attemptId,
        answers: prompts.map((prompt) => ({
          promptId: prompt.id,
          answer: reflectionAnswers[prompt.id] ?? "",
        })),
      });
      setMessage("反思已记录；后续 Grade 会按本次尝试评估证据");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "反思保存失败");
    }
  };

  const cancel = async (): Promise<void> => {
    if (!activeJobId) return;
    try {
      const result = await cancelJob(activeJobId, commandId("cancel"));
      setMessage(result.cancelled ? "正在取消判题…" : "任务已经结束");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "取消失败");
    }
  };

  const updateActiveSource = (content: string): void => {
    if (!workspace || !activity) return;
    const nextSources = { ...sources, [activePath]: content };
    const dirty = activity.workspace.editablePaths.some(
      (path) => nextSources[path] !== workspace.files[path],
    );
    setSources(nextSources);
    setReport(undefined);
    setIsDirty(dirty);
    onDirtyChange(dirty);
  };

  const replaceActiveSource = (
    content: string,
    successMessage: string,
  ): void => {
    updateActiveSource(content);
    setMessage(successMessage);
  };

  const formatActiveFile = (): void => {
    if (!isCppSourcePath(activePath)) return;
    const currentSource = sources[activePath] ?? "";
    const formattedSource = formatCppSource(currentSource);
    if (formattedSource === currentSource) {
      setMessage(`${activePath} 已符合 C++ 格式`);
      return;
    }
    replaceActiveSource(
      formattedSource,
      `已格式化 ${activePath}；保存后写入工作区`,
    );
  };

  const resetActiveFile = (): void => {
    const starterSource = workspace?.starterFiles[activePath];
    if (starterSource === undefined) return;
    if (
      !window.confirm(
        `确定将 ${activePath} 恢复为课程初始代码吗？当前未保存修改会被替换。`,
      )
    ) {
      return;
    }
    const resetSource = isCppSourcePath(activePath)
      ? formatCppSource(starterSource)
      : starterSource;
    replaceActiveSource(resetSource, `已重置 ${activePath}；保存后写入工作区`);
  };

  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <button
          className="text-button"
          type="button"
          disabled={Boolean(busy)}
          onClick={onBack}
        >
          ← 返回总览
        </button>
        <div>
          <span className="workspace-status" aria-live="polite">
            {message}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void save()}
          >
            {busy === "save" ? "保存中…" : "保存"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void execute("run")}
          >
            {busy === "run" ? "运行中…" : "Run"}
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void execute("grade")}
          >
            {busy === "grade" ? "判题中…" : "Grade"}
          </button>
          {activeJobId && (
            <button
              className="danger-button"
              type="button"
              onClick={() => void cancel()}
            >
              取消任务
            </button>
          )}
        </div>
      </header>

      <nav className="lesson-pager" aria-label="切换课程">
        <button
          type="button"
          disabled={!previousActivity || Boolean(busy)}
          onClick={() => {
            if (previousActivity) onNavigate(previousActivity.id);
          }}
        >
          <small>← 上一节</small>
          <span>{previousActivity?.title ?? "已到课程起点"}</span>
        </button>
        <div aria-live="polite">
          <span>
            {currentPosition && totalActivities
              ? `${currentPosition} / ${totalActivities}`
              : "正在读取课程位置"}
          </span>
          <strong>{activity?.title ?? "正在加载课程"}</strong>
        </div>
        <button
          type="button"
          disabled={!nextActivity || Boolean(busy)}
          onClick={() => {
            if (nextActivity) onNavigate(nextActivity.id);
          }}
        >
          <small>下一节 →</small>
          <span>{nextActivity?.title ?? "已完成全部课程"}</span>
        </button>
      </nav>

      <div className="workspace-layout">
        <article className="lesson-panel">
          <p className="eyebrow">
            课程内容 · 预计 {activity?.estimatedMinutes ?? 0} 分钟
          </p>
          <div className="markdown-body">
            {activity ? (
              <ReactMarkdown>{activity.markdown}</ReactMarkdown>
            ) : (
              <p>{message}</p>
            )}
          </div>
          {activity && (
            <div className="activity-brief">
              <section>
                <p className="eyebrow">学习目标</p>
                <ul>
                  {activity.objectives?.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </section>
              <section>
                <p className="eyebrow">完成标准</p>
                <ul>
                  {activity.victoryConditions?.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
              </section>
              {activity.interactiveBlocks?.map((block) => (
                <InteractiveBlock block={block} key={block.id} />
              ))}
              <section>
                <p className="eyebrow">参考资料</p>
                <ul>
                  {activity.sources?.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
              {activity.referenceIds && activity.referenceIds.length > 0 && (
                <section className="activity-reference-links">
                  <p className="eyebrow">C++ API 文档</p>
                  <div>
                    {activity.referenceIds.map((referenceId) => {
                      const reference = referenceLinks[referenceId];
                      return (
                        <a
                          key={referenceId}
                          aria-label={`打开 ${reference?.title ?? referenceId} API 文档`}
                          href={
                            reference
                              ? referenceEntryUrl(
                                  new URL(window.location.href),
                                  reference.slug,
                                )
                              : referenceSearchUrl(
                                  new URL(window.location.href),
                                  referenceId,
                                )
                          }
                        >
                          <code>{reference?.title ?? referenceId}</code>
                          <span>打开 Reference →</span>
                        </a>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
          {activity?.learning && (
            <div className="learning-assistance">
              <div className="assistance-heading">
                <div>
                  <p className="eyebrow">分级辅助</p>
                  <h3>分级提示</h3>
                </div>
                <span>
                  {revealedHints.length} / {activity.learning.hints.length}
                </span>
              </div>
              {revealedHints.map((hint) => (
                <article className="revealed-hint" key={hint.id}>
                  <strong>{hint.title}</strong>
                  <p>{hint.content}</p>
                </article>
              ))}
              {revealedHints.length < activity.learning.hints.length && (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void revealNextHint()}
                >
                  {activity.learning.hints[revealedHints.length]?.kind ===
                  "solution"
                    ? "确认查看完整答案"
                    : "显示下一条提示"}
                </button>
              )}
              <div className="reflection-box">
                <p className="eyebrow">学习反思</p>
                {activity.learning.reflections.map((prompt) => (
                  <label key={prompt.id}>
                    <span>{prompt.prompt}</span>
                    <textarea
                      name={`reflection-${prompt.id}`}
                      autoComplete="off"
                      value={reflectionAnswers[prompt.id] ?? ""}
                      onChange={(event) => {
                        const answer = event.currentTarget.value;
                        setReflectionAnswers((current) => ({
                          ...current,
                          [prompt.id]: answer,
                        }));
                      }}
                    />
                  </label>
                ))}
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => void saveReflection()}
                >
                  保存反思
                </button>
              </div>
            </div>
          )}
        </article>
        <section className="coding-panel" aria-label="C++ 代码工作区">
          <div className="editor-titlebar">
            <div className="file-tabs" role="group" aria-label="源文件">
              {Object.keys(sources).map((path) => (
                <button
                  key={path}
                  type="button"
                  aria-pressed={path === activePath}
                  className={path === activePath ? "active" : ""}
                  onClick={() => setActivePath(path)}
                >
                  {path}
                </button>
              ))}
            </div>
            <div className="editor-tools">
              <button
                type="button"
                disabled={Boolean(busy) || !isCppSourcePath(activePath)}
                onClick={formatActiveFile}
              >
                格式化代码
              </button>
              <button
                type="button"
                disabled={
                  Boolean(busy) ||
                  workspace?.starterFiles[activePath] === undefined
                }
                onClick={resetActiveFile}
              >
                重置当前文件
              </button>
              <span>revision {workspace?.revision ?? 0}</span>
            </div>
          </div>
          <Editor
            height="100%"
            language="cpp"
            theme="vs-light"
            value={sources[activePath] ?? ""}
            onChange={(value) => {
              updateActiveSource(value ?? "");
            }}
            options={{
              automaticLayout: true,
              ariaLabel: `${activity?.title ?? "C++ 课程"}代码编辑器`,
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "SFMono-Regular, Consolas, monospace",
              padding: { top: 18 },
            }}
          />
          <div
            className={`judge-output ${report?.verdict === "automated_pass" ? "pass" : ""}`}
          >
            <div>
              <strong>{report ? report.verdict : "等待执行"}</strong>
              {report && (
                <span>{report.mode === "run" ? "Run 反馈" : "Grade 证据"}</span>
              )}
            </div>
            {report && (
              <pre>
                {report.toolchain.compiler} · {report.toolchain.standard}
                {report.toolchain.buildSystem
                  ? ` · ${report.toolchain.buildSystem}\n${report.toolchain.cmake ?? ""}\n${report.toolchain.ctest ?? ""}`
                  : ""}
              </pre>
            )}
            {report?.stages.map((stage, index) => (
              <pre key={`${stage.kind}-${stage.testName ?? index}`}>
                {stage.kind}
                {stage.testName ? ` · ${stage.testName}` : ""} · {stage.outcome}{" "}
                · {stage.durationMs}ms{"\n"}
                {stage.feedback ? `${stage.feedback}\n` : ""}
                {stage.seed !== undefined
                  ? `seed ${stage.seed}${stage.caseIndex !== undefined ? ` · case ${stage.caseIndex}` : ""}\n`
                  : ""}
                {stage.counterexample
                  ? `可复现反例：\n${stage.counterexample}`
                  : ""}
                {stage.ratio !== undefined
                  ? `增长比 ${stage.ratio.toFixed(2)}（${stage.baselineDurationMs ?? 0}ms → ${stage.scaledDurationMs ?? 0}ms）\n`
                  : ""}
                {stage.diagnostics
                  ?.map((diagnostic) => {
                    const location = diagnostic.file
                      ? `${diagnostic.file}:${diagnostic.line ?? "?"}:${diagnostic.column ?? "?"}: `
                      : "";
                    return `${location}${diagnostic.message}`;
                  })
                  .join("\n") ?? ""}
                {stage.diagnostics?.length ? "\n" : ""}
                {stage.kind !== "private_test" ? (stage.stdout ?? "") : ""}
                {stage.kind !== "private_test" ? (stage.stderr ?? "") : ""}
              </pre>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
