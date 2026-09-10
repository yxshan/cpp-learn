import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkspaceView } from "@cpp-learn/contracts";

import { formatCppSource, isCppSourcePath } from "../cpp-format.js";

/**
 * Editor session.
 *
 * Owns the learner's in-browser buffer: which file is active, what has been
 * typed, and whether the buffer differs from the saved Workspace. Formatting and
 * reset only ever touch this buffer; nothing reaches the server until `save`,
 * `run`, or `grade`.
 */

/**
 * A freshly scaffolded starter is normalized once on load so the learner starts
 * from formatted code, but an already-edited Workspace is never rewritten.
 */
export function prepareInitialSources(
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

export interface UseEditorSessionOptions {
  /** Saved Workspace files; the baseline a dirty buffer is compared against. */
  readonly baseline: Readonly<Record<string, string>> | undefined;
  readonly editablePaths: readonly string[] | undefined;
  readonly starterFiles: Readonly<Record<string, string>> | undefined;
  readonly onDirtyChange: (dirty: boolean) => void;
  /** Called when the buffer changes so a stale Judge report can be cleared. */
  readonly onEdited: () => void;
  readonly onMessage: (message: string) => void;
}

export interface EditorSession {
  readonly sources: Record<string, string>;
  readonly activePath: string;
  readonly isDirty: boolean;
  readonly setActivePath: (path: string) => void;
  /** Loads a Workspace and returns the prepared buffers the caller should adopt. */
  readonly load: (
    workspace: WorkspaceView,
    editablePaths: readonly string[],
  ) => Record<string, string>;
  readonly clear: () => void;
  readonly markClean: () => void;
  readonly updateActiveSource: (content: string) => void;
  readonly replaceActiveSource: (
    content: string,
    successMessage: string,
  ) => void;
  readonly formatActiveFile: () => void;
  readonly resetActiveFile: () => void;
}

export function useEditorSession({
  baseline,
  editablePaths,
  starterFiles,
  onDirtyChange,
  onEdited,
  onMessage,
}: UseEditorSessionOptions): EditorSession {
  const [sources, setSources] = useState<Record<string, string>>({});
  const [activePath, setActivePath] = useState("main.cpp");
  const [isDirty, setIsDirty] = useState(false);

  // `load`, `clear`, and `markClean` are used from the workspace-loading effect,
  // so they must stay referentially stable: the effect's dependency list must
  // not grow, or every render would restart the fetch.
  const onDirtyChangeRef = useRef(onDirtyChange);
  onDirtyChangeRef.current = onDirtyChange;

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);

  const markClean = useCallback((): void => {
    setIsDirty(false);
    onDirtyChangeRef.current(false);
  }, []);

  const clear = useCallback((): void => {
    setSources({});
    markClean();
  }, [markClean]);

  const load = useCallback(
    (
      workspace: WorkspaceView,
      paths: readonly string[],
    ): Record<string, string> => {
      const initialSources = prepareInitialSources(workspace, paths);
      setSources(initialSources);
      setActivePath(paths[0] ?? "main.cpp");
      markClean();
      return initialSources;
    },
    [markClean],
  );

  const updateActiveSource = (content: string): void => {
    if (baseline === undefined || editablePaths === undefined) return;
    const nextSources = { ...sources, [activePath]: content };
    const dirty = editablePaths.some(
      (path) => nextSources[path] !== baseline[path],
    );
    setSources(nextSources);
    onEdited();
    setIsDirty(dirty);
    onDirtyChange(dirty);
  };

  const replaceActiveSource = (
    content: string,
    successMessage: string,
  ): void => {
    updateActiveSource(content);
    onMessage(successMessage);
  };

  const formatActiveFile = (): void => {
    if (!isCppSourcePath(activePath)) return;
    const currentSource = sources[activePath] ?? "";
    const formattedSource = formatCppSource(currentSource);
    if (formattedSource === currentSource) {
      onMessage(`${activePath} 已符合 C++ 格式`);
      return;
    }
    replaceActiveSource(
      formattedSource,
      `已格式化 ${activePath}；保存后写入工作区`,
    );
  };

  const resetActiveFile = (): void => {
    const starterSource = starterFiles?.[activePath];
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

  return {
    sources,
    activePath,
    isDirty,
    setActivePath,
    load,
    clear,
    markClean,
    updateActiveSource,
    replaceActiveSource,
    formatActiveFile,
    resetActiveFile,
  };
}
