import { Suspense, lazy } from "react";

import { LearningApp } from "./dashboard/LearningApp.js";

const ReferenceBrowser = lazy(async () => {
  const module = await import("./ReferenceBrowser.js");
  return { default: module.ReferenceBrowser };
});

export function App() {
  if (
    window.location.pathname === "/reference" ||
    window.location.pathname.startsWith("/reference/")
  ) {
    return (
      <Suspense
        fallback={
          <div className="workspace-loading">正在加载 C++ Reference…</div>
        }
      >
        <ReferenceBrowser />
      </Suspense>
    );
  }
  return <LearningApp />;
}
