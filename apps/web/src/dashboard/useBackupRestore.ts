import { useState } from "react";

import { exportBackup, restoreBackup } from "../api.js";

/**
 * Learner backup and restore.
 *
 * Export happens entirely in the browser: the archive is serialized to a Blob
 * and downloaded by a synthetic link, so no learner data leaves the machine.
 * Restore asks for explicit confirmation before it overwrites local files.
 */
export interface BackupRestore {
  readonly dataMessage: string;
  readonly downloadBackup: () => Promise<void>;
  readonly restoreFromFile: (file: File) => Promise<void>;
}

export function useBackupRestore(): BackupRestore {
  const [dataMessage, setDataMessage] = useState("可导出校验后的本地备份");

  const downloadBackup = async (): Promise<void> => {
    try {
      const archive = await exportBackup(`web_export_${crypto.randomUUID()}`);
      const url = URL.createObjectURL(
        new Blob([`${JSON.stringify(archive, null, 2)}\n`], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "cpp-learn-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setDataMessage("备份已导出；文件仅在你的设备上生成");
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : "导出失败");
    }
  };

  const restoreFromFile = async (file: File): Promise<void> => {
    if (!window.confirm("恢复会覆盖备份中包含的本地文件，是否继续？")) return;
    try {
      const archive = JSON.parse(await file.text()) as unknown;
      const result = await restoreBackup(
        archive,
        `web_restore_${crypto.randomUUID()}`,
      );
      setDataMessage(`已恢复 ${result.restoredFiles} 个文件，请重启本地服务`);
    } catch (cause) {
      setDataMessage(cause instanceof Error ? cause.message : "恢复失败");
    }
  };

  return { dataMessage, downloadBackup, restoreFromFile };
}
