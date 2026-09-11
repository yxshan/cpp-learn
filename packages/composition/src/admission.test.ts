import { describe, expect, it } from "vitest";

import type { JudgeReport } from "@cpp-learn/contracts";
import type { Judge, JudgeExecutionRequest } from "@cpp-learn/judge";

import {
  JudgeAdmissionRejected,
  createBoundedJudge,
  createJudgeAdmission,
} from "./admission.ts";

/** The admission layer must not inspect reports, so a placeholder is enough. */
const report = { verdict: "automated_pass" } as unknown as JudgeReport;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Let every already-resolved microtask continuation run. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

describe("[SEC-F02] shared Judge admission", () => {
  it("runs up to the budget and drains the wait queue in order", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 2 });
    const started: string[] = [];
    const first = deferred<string>();

    const runA = admission.run(async () => {
      started.push("a");
      return first.promise;
    });
    const runB = admission.run(async () => {
      started.push("b");
      return "b";
    });
    const runC = admission.run(async () => {
      started.push("c");
      return "c";
    });

    expect(started).toEqual(["a"]);
    expect(admission.activeCount).toBe(1);
    expect(admission.queuedCount).toBe(2);

    first.resolve("a");
    await expect(runA).resolves.toBe("a");
    await expect(runB).resolves.toBe("b");
    await expect(runC).resolves.toBe("c");
    expect(started).toEqual(["a", "b", "c"]);
    expect(admission.activeCount).toBe(0);
    expect(admission.queuedCount).toBe(0);
  });

  it("rejects overload from the bounded queue instead of growing without limit", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 1 });
    const held = deferred<string>();
    const running = admission.run(() => held.promise);
    const queued = admission.run(async () => "queued");

    await expect(
      admission.run(async () => "overloaded"),
    ).rejects.toBeInstanceOf(JudgeAdmissionRejected);
    await expect(
      admission.run(async () => "overloaded again"),
    ).rejects.toMatchObject({ reason: "queue_full", activeCount: 1 });

    held.resolve("released");
    await expect(running).resolves.toBe("released");
    await expect(queued).resolves.toBe("queued");

    // Overload must not poison the budget: the next caller gets a slot.
    await expect(admission.run(async () => "later")).resolves.toBe("later");
  });

  it("fails fast when a caller declines to wait", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 4 });
    const held = deferred<string>();
    const running = admission.run(() => held.promise);

    expect(admission.tryAcquire()).toBeUndefined();

    held.resolve("done");
    await expect(running).resolves.toBe("done");

    const release = admission.tryAcquire();
    expect(release).toBeTypeOf("function");
    expect(admission.activeCount).toBe(1);
    release?.();
    expect(admission.activeCount).toBe(0);
  });

  it("returns the slot when an operation rejects", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 0 });

    await expect(
      admission.run(async () => {
        throw new Error("judge crashed");
      }),
    ).rejects.toThrow("judge crashed");
    expect(admission.activeCount).toBe(0);

    await expect(admission.run(async () => "recovered")).resolves.toBe(
      "recovered",
    );
  });

  it("never admits two successors from one doubly released lease", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 1 });
    let starts = 0;
    const release = admission.tryAcquire();
    expect(release).toBeDefined();
    const queued = admission.run(async () => {
      starts += 1;
      return "queued";
    });

    release?.();
    release?.();
    expect(admission.activeCount).toBe(1);
    expect(admission.tryAcquire()).toBeUndefined();

    await expect(queued).resolves.toBe("queued");
    expect(starts).toBe(1);
    expect(admission.activeCount).toBe(0);
  });

  it("serializes every call through a bounded Judge wrapper", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 1, maxQueued: 4 });
    const order: string[] = [];
    let inFlight = 0;
    let peak = 0;
    const inner: Judge = {
      execute: async (request: JudgeExecutionRequest) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        order.push(`start:${request.jobId}`);
        await settle();
        order.push(`end:${request.jobId}`);
        inFlight -= 1;
        return report;
      },
    };
    const judge = createBoundedJudge(inner, admission);
    const request = (jobId: string) =>
      ({ jobId }) as unknown as JudgeExecutionRequest;

    await Promise.all([
      judge.execute(request("job_1")),
      judge.execute(request("job_2")),
      judge.execute(request("job_3")),
    ]);

    expect(peak).toBe(1);
    expect(order).toEqual([
      "start:job_1",
      "end:job_1",
      "start:job_2",
      "end:job_2",
      "start:job_3",
      "end:job_3",
    ]);
  });

  it("passes the request through untouched", async () => {
    const admission = createJudgeAdmission({ maxConcurrent: 2, maxQueued: 0 });
    const seen: JudgeExecutionRequest[] = [];
    const judge = createBoundedJudge(
      {
        execute: async (request) => {
          seen.push(request);
          return report;
        },
      },
      admission,
    );
    const request = {
      jobId: "job_passthrough",
    } as unknown as JudgeExecutionRequest;

    await expect(judge.execute(request)).resolves.toBe(report);
    expect(seen).toEqual([request]);
  });
});
