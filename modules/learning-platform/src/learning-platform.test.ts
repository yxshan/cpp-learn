import { describe, expect, it } from "vitest";

import { createLearningPlatform } from "./index.js";

describe("[T-MODULE-001] LearningPlatform bootstrap query", () => {
  it("reports one shared readiness result to every presentation adapter", async () => {
    const platform = createLearningPlatform({
      clock: () => new Date("2026-08-23T08:00:00.000Z"),
      probes: {
        curriculum: async () => ({ ready: true, activityCount: 1 }),
        toolchain: async () => ({ ready: true, compiler: "Apple Clang 15" }),
        record: async () => ({ ready: true }),
      },
    });

    await expect(platform.query({ type: "bootstrap.get" })).resolves.toEqual({
      schemaVersion: 1,
      generatedAt: "2026-08-23T08:00:00.000Z",
      ready: true,
      services: {
        curriculum: { ready: true, activityCount: 1 },
        toolchain: { ready: true, compiler: "Apple Clang 15" },
        record: { ready: true },
      },
    });
    expect(typeof platform.dispatch).toBe("function");
    expect(typeof platform.events).toBe("function");
    const events = [];
    for await (const event of platform.events("job_missing"))
      events.push(event);
    expect(events).toEqual([]);
  });
});
