import { Icon } from "@/components/common/Icon";
import { projectRoute } from "@/constants/routes";
import type { ReportReview } from "@/types/report";

interface ReportReviewProps {
  review: ReportReview;
  /** Name of the project the citizen selected, resolved by the caller from the real project list. */
  projectName: string | null;
}

/**
 * Step 4 of the report flow: an honest review of the citizen's own
 * entries (U3 fix). This replaces the former simulated verification
 * step — there is no AI analysis, no fake sequencing, no confidence
 * score, no duplicate check, and no guessed project link.
 */
export function ReportReview({ review, projectName }: ReportReviewProps): JSX.Element {
  const sevTone =
    review.severity === "critical" || review.severity === "high"
      ? "text-red-700"
      : review.severity === "medium"
        ? "text-amber-700"
        : "text-green-700";
  return (
    <div className="space-y-4" data-report-review>
      <div className="flex items-start gap-3 bg-surface-container-low p-4 rounded-lg border border-outline-variant/40">
        <span className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center flex-shrink-0">
          <Icon name="fact_check" className="text-[22px]" />
        </span>
        <div>
          <div className="text-label-md font-bold text-primary">Review your report</div>
          <p className="text-body-sm text-on-surface-variant">
            Check the details below — they are exactly what you entered. If anything looks wrong, go back and edit it
            before continuing. The final decision on your report always rests with department officials.
          </p>
        </div>
      </div>

      <dl className="divide-y divide-outline-variant/30 border border-outline-variant/40 rounded-lg overflow-hidden text-body-sm">
        <ReviewRow label="Title" value={review.title || "—"} />
        <ReviewRow label="Description" value={review.description || "—"} />
        <ReviewRow label="Category" value={review.category} />
        <div className="px-4 py-2.5 flex gap-4">
          <dt className="w-40 flex-shrink-0 text-on-surface-variant">Severity</dt>
          <dd className="flex-1 break-words">
            <span className={`font-semibold capitalize ${sevTone}`}>{review.severity}</span>
            <span className="text-on-surface-variant"> — from your selected priority ({review.priority})</span>
          </dd>
        </div>
        <ReviewRow label="Department" value={review.department} />
        <div className="px-4 py-2.5 flex gap-4">
          <dt className="w-40 flex-shrink-0 text-on-surface-variant">Linked project</dt>
          <dd className="text-primary font-medium flex-1 break-words">
            {review.projectId && projectName ? (
              <a href={projectRoute(review.projectId)} className="underline font-semibold">
                {projectName}
              </a>
            ) : (
              "No project linked"
            )}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] leading-relaxed text-on-surface-variant">
        <Icon name="info" className="text-[14px] align-[-3px]" /> A department officer reviews your report after
        submission and makes the final determination under the citizen grievance framework.
      </p>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="px-4 py-2.5 flex gap-4">
      <dt className="w-40 flex-shrink-0 text-on-surface-variant">{label}</dt>
      <dd className="text-primary font-medium flex-1 break-words">{value}</dd>
    </div>
  );
}
