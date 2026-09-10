import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import type { ActivityDetail, WorkspaceView } from "@cpp-learn/contracts";

import {
  getActivity,
  getWorkspace,
  revealHint,
  submitReflection,
} from "../api.js";
import { isCppSourcePath } from "../cpp-format.js";
import { InteractiveBlock } from "./InteractiveBlock.js";
import { commandId } from "./command-id.js";
import { useActivityExecution } from "./useActivityExecution.js";
import { useEditorSession } from "./useEditorSession.js";
import {
  referenceEntryUrl,
  referenceSearchUrl,
} from "../reference-location.js";
import { useReferenceLinks } from "../reference-links.js";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

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
  const editor = useEditorSession({
    baseline: workspace?.files,
    editablePaths: activity?.workspace.editablePaths,
    starterFiles: workspace?.starterFiles,
    onDirtyChange,
    onEdited: () => execution.clearReport(),
    onMessage: setMessage,
  });
  const { sources, activePath, load, clear } = editor;
  const execution = useActivityExecution({
    activityId,
    attemptId,
    workspace,
    editablePaths: activity?.workspace.editablePaths,
    sources,
    onSaved: (files, revision) =>
      setWorkspace((current) =>
        current === undefined ? current : { ...current, revision, files },
      ),
    markClean: editor.markClean,
    onEvidenceChanged,
    onMessage: setMessage,
  });
  const { busy, report, activeJobId, save, execute, cancel } = execution;

  useEffect(() => {
    let cancelled = false;
    setActivity(undefined);
    setWorkspace(undefined);
    clear();
    execution.clearReport();
    setRevealedHints([]);
    setReflectionAnswers({});
    setAttemptId(`web_attempt_${crypto.randomUUID()}`);
    setMessage("正在加载课程工作区…");
    void Promise.all([getActivity(activityId), getWorkspace(activityId)])
      .then(([activityResult, workspaceResult]) => {
        if (cancelled) return;
        if (!activityResult.activity) throw new Error("课程不存在");
        const initialSources = load(
          workspaceResult.workspace,
          activityResult.activity.workspace.editablePaths,
        );
        setActivity(activityResult.activity);
        setWorkspace({
          ...workspaceResult.workspace,
          files: initialSources,
        });
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
  }, [activityId, clear, load, onDirtyChange]);

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
                  onClick={() => editor.setActivePath(path)}
                >
                  {path}
                </button>
              ))}
            </div>
            <div className="editor-tools">
              <button
                type="button"
                disabled={Boolean(busy) || !isCppSourcePath(activePath)}
                onClick={editor.formatActiveFile}
              >
                格式化代码
              </button>
              <button
                type="button"
                disabled={
                  Boolean(busy) ||
                  workspace?.starterFiles[activePath] === undefined
                }
                onClick={editor.resetActiveFile}
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
              editor.updateActiveSource(value ?? "");
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
