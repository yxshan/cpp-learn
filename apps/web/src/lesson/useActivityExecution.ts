import { useState } from "react";

import type { JudgeReport, WorkspaceView } from "@cpp-learn/contracts";

import { cancelJob, executeActivity, saveWorkspace } from "../api.js";
import { commandId } from "./command-id.js";

/**
 * Activity execution.
 *
 * Owns the save/run/grade lifecycle and its in-flight state. Persisting is
 * part of execution on purpose: Run and Grade must judge what is saved, so a
 * dirty buffer is flushed before the Judge is asked anything.
 */
export interface UseActivityExecutionOptions {
  readonly activityId: string;
  readonly attemptId: string;
  readonly workspace: WorkspaceView | undefined;
  readonly editablePaths: readonly string[] | undefined;
  readonly sources: Readonly<Record<string, string>>;
  readonly onSaved: (files: Record<string, string>, revision: number) => void;
  readonly markClean: () => void;
  readonly onEvidenceChanged: () => Promise<void>;
  readonly onMessage: (message: string) => void;
}

export interface ActivityExecution {
  readonly busy: "save" | "run" | "grade" | undefined;
  readonly report: JudgeReport | undefined;
  readonly activeJobId: string | undefined;
  readonly save: () => Promise<void>;
  readonly execute: (mode: "run" | "grade") => Promise<void>;
  readonly cancel: () => Promise<void>;
  /** Clears a stale report when the buffer changes. */
  readonly clearReport: () => void;
}

export function useActivityExecution({
  activityId,
  attemptId,
  workspace,
  editablePaths,
  sources,
  onSaved,
  markClean,
  onEvidenceChanged,
  onMessage,
}: UseActivityExecutionOptions): ActivityExecution {
  const [report, setReport] = useState<JudgeReport>();
  const [busy, setBusy] = useState<"save" | "run" | "grade">();
  const [activeJobId, setActiveJobId] = useState<string>();

  const persist = async (): Promise<void> => {
    if (!workspace || editablePaths === undefined) return;
    const result = await saveWorkspace(activityId, {
      commandId: commandId("save"),
      baseRevision: workspace.revision,
      changes: editablePaths.map((path) => ({
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
    onSaved({ ...sources }, result.result.revision);
    markClean();
  };

  const save = async (): Promise<void> => {
    setBusy("save");
    try {
      await persist();
      onMessage("已保存到本地工作区");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(undefined);
    }
  };

  const execute = async (mode: "run" | "grade"): Promise<void> => {
    setBusy(mode);
    setReport(undefined);
    try {
      await persist();
      onMessage(mode === "run" ? "正在编译并运行…" : "正在提交判题…");
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
      onMessage(
        result.report.verdict === "automated_pass"
          ? mode === "grade"
            ? "Grade 通过，学习证据已记录"
            : "Run 通过（不会计入掌握证据）"
          : `结果：${result.report.verdict}`,
      );
      if (mode === "grade") await onEvidenceChanged();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setActiveJobId(undefined);
      setBusy(undefined);
    }
  };

  const cancel = async (): Promise<void> => {
    if (!activeJobId) return;
    try {
      const result = await cancelJob(activeJobId, commandId("cancel"));
      onMessage(result.cancelled ? "正在取消判题…" : "任务已经结束");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "取消失败");
    }
  };

  return {
    busy,
    report,
    activeJobId,
    save,
    execute,
    cancel,
    clearReport: () => setReport(undefined),
  };
}
