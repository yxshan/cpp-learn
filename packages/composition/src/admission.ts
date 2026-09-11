import type { Judge } from "@cpp-learn/judge";

/**
 * Shared admission control for every host-level Judge entry point.
 *
 * Native compilation is the only operation in this application that consumes an
 * unbounded amount of host CPU, memory and process slots, and every entry point
 * funnels through a `Judge` (Activity Run/Grade from the local HTTP server and
 * the CLI) or through the Reference Playground. Bounding those entry points
 * separately would let a caller exhaust the host twice over, so one admission
 * instance is created per host process and shared by all of them.
 *
 * Two back-pressure policies are offered because the callers differ:
 *
 * - `run` waits in a bounded FIFO queue. Activity Run/Grade is a user-initiated
 *   request whose result the learner is waiting for, so a short wait is better
 *   than a failure.
 * - `tryAcquire` never waits. The Reference Playground is an interactive editor
 *   whose requests are cheap to retry, so it reports busy immediately instead of
 *   holding the request open.
 *
 * Cancellation is deliberately outside this contract. A cancelled job keeps its
 * queue position and, once admitted, reaches the Judge with an already aborted
 * signal, which fails closed without compiling. That keeps the concurrency limit
 * strict and keeps slot release in exactly one place: the release returned by an
 * admission decision.
 */
export interface JudgeAdmissionOptions {
  /** Maximum number of Judge operations allowed to hold the host budget. */
  readonly maxConcurrent: number;
  /** Maximum number of callers allowed to wait for a slot; further callers are rejected. */
  readonly maxQueued: number;
}

/**
 * Raised when a caller declines to wait and no slot is free, or when the bounded
 * wait queue is full. Transport code maps this to `429` with `Retry-After`.
 */
export class JudgeAdmissionRejected extends Error {
  override readonly name = "JudgeAdmissionRejected";

  constructor(
    readonly reason: "busy" | "queue_full",
    readonly activeCount: number,
    readonly queuedCount: number,
  ) {
    super(
      reason === "busy"
        ? "Judge concurrency budget is fully in use"
        : "Judge wait queue is full",
    );
  }
}

export interface JudgeAdmission {
  /** Reserve a slot without waiting, or return `undefined` when none is free. */
  tryAcquire(): (() => void) | undefined;
  /**
   * Wait for a slot in a bounded FIFO queue, then run `operation`, releasing the
   * slot whether it resolves or rejects.
   */
  run<T>(operation: () => Promise<T>): Promise<T>;
  readonly activeCount: number;
  readonly queuedCount: number;
}

export const DEFAULT_JUDGE_MAX_CONCURRENT = 1;
export const DEFAULT_JUDGE_MAX_QUEUED = 4;

function bound(value: number, minimum: number): number {
  return Number.isFinite(value)
    ? Math.max(minimum, Math.trunc(value))
    : minimum;
}

export function createJudgeAdmission(
  options: JudgeAdmissionOptions,
): JudgeAdmission {
  const maxConcurrent = bound(options.maxConcurrent, 1);
  const maxQueued = bound(options.maxQueued, 0);
  const waiting: (() => void)[] = [];
  let activeCount = 0;

  /**
   * Take the slot and return its release. The release is idempotent, so a lease
   * that is released twice cannot admit two successors, and it hands the slot
   * directly to the next waiter instead of passing through the free pool.
   */
  const startOperation = (): (() => void) => {
    activeCount += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      activeCount -= 1;
      waiting.shift()?.();
    };
  };

  const acquire = (): (() => void) | undefined =>
    activeCount < maxConcurrent ? startOperation() : undefined;

  const waitForSlot = (): Promise<() => void> =>
    new Promise<() => void>((resolve, reject) => {
      if (waiting.length >= maxQueued) {
        reject(
          new JudgeAdmissionRejected("queue_full", activeCount, waiting.length),
        );
        return;
      }
      waiting.push(() => resolve(startOperation()));
    });

  return {
    tryAcquire: acquire,
    async run<T>(operation: () => Promise<T>): Promise<T> {
      const release = acquire() ?? (await waitForSlot());
      try {
        return await operation();
      } finally {
        release();
      }
    },
    get activeCount() {
      return activeCount;
    },
    get queuedCount() {
      return waiting.length;
    },
  };
}

/**
 * Bound a Judge with a shared admission budget.
 *
 * The wrapper is the composition-level answer to "every Judge entry point":
 * callers keep depending on the plain `Judge` interface, and the budget is
 * applied once, where the host process is assembled.
 */
export function createBoundedJudge(
  inner: Judge,
  admission: JudgeAdmission,
): Judge {
  return {
    execute: (request) => admission.run(() => inner.execute(request)),
  };
}
