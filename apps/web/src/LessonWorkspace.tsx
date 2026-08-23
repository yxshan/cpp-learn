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

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

function InteractiveBlock({
  block,
}: {
  readonly block: InteractiveLessonBlock;
}) {
  const steps = block.fallback.split(/\s*->\s*/);
  const [step, setStep] = useState(0);
  return (
    <section className="interactive-fallback">
      <p className="eyebrow">INTERACTIVE · {block.type}</p>
      <pre>{steps.slice(0, step + 1).join(" → ")}</pre>
      {steps.length > 1 && (
        <div className="interactive-controls">
          <button
            disabled={step === 0}
            onClick={() => setStep((value) => value - 1)}
          >
            上一步
          </button>
          <button
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
  readonly onBack: () => void;
  readonly onEvidenceChanged: () => Promise<void>;
}

export function LessonWorkspace({
  activityId = "source-to-program",
  onBack,
  onEvidenceChanged,
}: LessonWorkspaceProps) {
  const [activity, setActivity] = useState<ActivityDetail>();
  const [workspace, setWorkspace] = useState<WorkspaceView>();
  const [sources, setSources] = useState<Record<string, string>>({});
  const [activePath, setActivePath] = useState("main.cpp");
  const [report, setReport] = useState<JudgeReport>();
  const [busy, setBusy] = useState<"save" | "run" | "grade">();
  const [activeJobId, setActiveJobId] = useState<string>();
  const [message, setMessage] = useState("正在加载课程工作区…");
  const [attemptId] = useState(() => `web_attempt_${crypto.randomUUID()}`);
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

  useEffect(() => {
    void Promise.all([getActivity(activityId), getWorkspace(activityId)])
      .then(([activityResult, workspaceResult]) => {
        if (!activityResult.activity) throw new Error("课程不存在");
        setActivity(activityResult.activity);
        setWorkspace(workspaceResult.workspace);
        setSources({ ...workspaceResult.workspace.files });
        setActivePath(
          activityResult.activity.workspace.editablePaths[0] ?? "main.cpp",
        );
        setMessage("工作区已加载");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "工作区加载失败"),
      );
  }, [activityId]);

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

  return (
    <div className="workspace-page">
      <header className="workspace-topbar">
        <button className="text-button" onClick={onBack}>
          ← 返回总览
        </button>
        <div>
          <span className="workspace-status">{message}</span>
          <button
            className="secondary-button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void save()}
          >
            {busy === "save" ? "保存中…" : "保存"}
          </button>
          <button
            className="secondary-button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void execute("run")}
          >
            {busy === "run" ? "运行中…" : "Run"}
          </button>
          <button
            className="primary-button"
            disabled={!workspace || Boolean(busy)}
            onClick={() => void execute("grade")}
          >
            {busy === "grade" ? "判题中…" : "Grade"}
          </button>
          {activeJobId && (
            <button className="danger-button" onClick={() => void cancel()}>
              取消任务
            </button>
          )}
        </div>
      </header>

      <div className="workspace-layout">
        <article className="lesson-panel">
          <p className="eyebrow">
            LESSON · {activity?.estimatedMinutes ?? 0} MIN
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
                <p className="eyebrow">OBJECTIVES</p>
                <ul>
                  {activity.objectives?.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </section>
              <section>
                <p className="eyebrow">VICTORY CONDITIONS</p>
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
                <p className="eyebrow">SOURCES</p>
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
            </div>
          )}
          {activity?.learning && (
            <div className="learning-assistance">
              <div className="assistance-heading">
                <div>
                  <p className="eyebrow">ORDERED ASSISTANCE</p>
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
                  onClick={() => void revealNextHint()}
                >
                  {activity.learning.hints[revealedHints.length]?.kind ===
                  "solution"
                    ? "确认查看完整答案"
                    : "显示下一条提示"}
                </button>
              )}
              <div className="reflection-box">
                <p className="eyebrow">REFLECTION</p>
                {activity.learning.reflections.map((prompt) => (
                  <label key={prompt.id}>
                    <span>{prompt.prompt}</span>
                    <textarea
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
            <div className="file-tabs" role="tablist" aria-label="源文件">
              {Object.keys(sources).map((path) => (
                <button
                  key={path}
                  role="tab"
                  aria-selected={path === activePath}
                  className={path === activePath ? "active" : ""}
                  onClick={() => setActivePath(path)}
                >
                  {path}
                </button>
              ))}
            </div>
            <span>revision {workspace?.revision ?? 0}</span>
          </div>
          <Editor
            height="440px"
            language="cpp"
            theme="vs-dark"
            value={sources[activePath] ?? ""}
            onChange={(value) =>
              setSources((current) => ({
                ...current,
                [activePath]: value ?? "",
              }))
            }
            options={{
              automaticLayout: true,
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
