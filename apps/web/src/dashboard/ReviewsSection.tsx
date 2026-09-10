import type { ReviewsResult } from "@cpp-learn/contracts";

import { dateTimeFormatter, numberFormatter } from "./format.js";

export function ReviewsSection({
  dueReviewCount,
  reviews,
  onOpenWorkspace,
}: {
  readonly dueReviewCount: number | undefined;
  readonly reviews: ReviewsResult | undefined;
  readonly onOpenWorkspace: (activityId?: string) => void;
}) {
  return (
    <article className="current-card">
      <div className="section-heading compact">
        <div>
          <p className="eyebrow">REVIEW QUEUE</p>
          <h2>延迟复习</h2>
        </div>
        <span className="time-pill">
          {numberFormatter.format(dueReviewCount ?? 0)} DUE
        </span>
      </div>
      <div className="review-list">
        {reviews?.reviews.map((review) => (
          <div key={`${review.activityId}-${review.conceptId}`}>
            <div>
              <strong>{review.conceptId}</strong>
              <span>{review.reason}</span>
              <small>{dateTimeFormatter.format(new Date(review.dueAt))}</small>
            </div>
            <button
              className={
                review.status === "due" ? "primary-button" : "secondary-button"
              }
              disabled={review.status !== "due"}
              type="button"
              onClick={() => onOpenWorkspace(review.activityId)}
            >
              {review.status === "due" ? "开始复习" : "尚未到期"}
            </button>
          </div>
        ))}
        {reviews?.reviews.length === 0 && (
          <p className="muted">形成 demonstrated 证据后会自动安排延迟复习。</p>
        )}
      </div>
    </article>
  );
}
