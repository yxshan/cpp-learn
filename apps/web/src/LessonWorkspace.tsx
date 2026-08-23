import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import EditorWorker from "monaco-editor/editor/editor.worker.js?worker";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import type {
  ActivityDetail,
  JudgeReport,
  WorkspaceView,
} from "@cpp-learn/contracts";

import {
  executeActivity,
  getActivity,
  getWorkspace,
  saveWorkspace,
} from "./api.js";

const ACTIVITY_ID = "source-to-program";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

function commandId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export interface LessonWorkspaceProps {
  readonly onBack: () => void;
  readonly onEvidenceChanged: () => Promise<void>;
}

export function LessonWorkspace({
  onBack,
  onEvidenceChanged,
}: LessonWorkspaceProps) {
  const [activity, setActivity] = useState<ActivityDetail>();
  const [workspace, setWorkspace] = useState<WorkspaceView>();
  const [source, setSource] = useState("");
  const [report, setReport] = useState<JudgeReport>();
  const [busy, setBusy] = useState<"save" | "run" | "grade">();
  const [message, setMessage] = useState("正在加载课程工作区…");

  useEffect(() => {
    void Promise.all([getActivity(ACTIVITY_ID), getWorkspace(ACTIVITY_ID)])
      .then(([activityResult, workspaceResult]) => {
        if (!activityResult.activity) throw new Error("课程不存在");
        setActivity(activityResult.activity);
        setWorkspace(workspaceResult.workspace);
        setSource(workspaceResult.workspace.files["main.cpp"] ?? "");
        setMessage("工作区已加载");
      })
      .catch((error: unknown) =>
        setMessage(error instanceof Error ? error.message : "工作区加载失败"),
      );
  }, []);

  const persist = async (): Promise<void> => {
    if (!workspace) return;
    const result = await saveWorkspace(ACTIVITY_ID, {
      commandId: commandId("save"),
      baseRevision: workspace.revision,
      changes: [{ path: "main.cpp", content: source }],
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
      files: { "main.cpp": source },
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
      const result = await executeActivity(ACTIVITY_ID, mode, commandId(mode));
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
      setBusy(undefined);
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
        </article>
        <section className="coding-panel" aria-label="C++ 代码工作区">
          <div className="editor-titlebar">
            <span>main.cpp</span>
            <span>revision {workspace?.revision ?? 0}</span>
          </div>
          <Editor
            height="440px"
            language="cpp"
            theme="vs-dark"
            value={source}
            onChange={(value) => setSource(value ?? "")}
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
            {report?.stages.map((stage) => (
              <pre key={stage.kind}>
                {stage.kind} · {stage.outcome} · {stage.durationMs}ms{"\n"}
                {stage.stdout ?? ""}
                {stage.stderr ?? ""}
              </pre>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
