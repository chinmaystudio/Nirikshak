import { Icon } from "@/components/common/Icon";
import { CommunityStatusBadge } from "@/components/common/StatusBadge";
import { projectRoute } from "@/constants/routes";
import { relativeTime, shortDate } from "@/utils/formatDate";
import type { CommunityIssueView } from "@/types/community";

interface CommunityIssueCardProps {
  issue: CommunityIssueView;
}

export function CommunityIssueCard({ issue }: CommunityIssueCardProps): JSX.Element {
  return (
    <article className="bg-surface-container-lowest p-5 rounded-lg border border-outline-variant/60 shadow-sm hover:shadow-md transition-shadow space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap text-label-sm font-label-sm">
          <CommunityStatusBadge status={issue.status} />
          <span className="text-outline flex items-center gap-1">
            <Icon name="category" className="text-[14px]" /> {issue.category}
          </span>
          {issue.projectName ? (
            <span className="text-outline flex items-center gap-1">
              <Icon name="construction" className="text-[15px]" /> {issue.projectName}
            </span>
          ) : null}
        </div>
        <span className="text-label-sm font-mono text-outline flex-shrink-0">{issue.id}</span>
      </div>
      <h3 className="text-headline-sm font-bold text-primary">{issue.title}</h3>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-outline-variant/30">
        <div className="flex items-center gap-3 text-label-sm text-outline">
          <span>Reported {relativeTime(issue.reportedAt)}</span>
          {issue.severity ? <span className="capitalize">{issue.severity} severity</span> : null}
        </div>
        <a
          href={`#/community/${issue.id}`}
          className="px-3 py-1.5 rounded border border-primary text-primary text-label-md font-label-md hover:bg-surface-container transition-colors"
        >
          View Details
        </a>
      </div>
    </article>
  );
}

export function CommunityIssueSummary({ issue }: { issue: CommunityIssueView }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-label-sm font-label-sm text-on-surface-variant">
      <span className="flex items-center gap-1">
        <Icon name="category" className="text-[16px]" /> {issue.category}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="schedule" className="text-[16px]" /> Reported {shortDate(issue.reportedAt)}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="receipt_long" className="text-[16px]" /> Reference {issue.id}
      </span>
      <span className="flex items-center gap-1">
        <Icon name="person_off" className="text-[16px]" /> Reporter identity is not published (privacy)
      </span>
    </div>
  );
}

export function RelatedProjectMini({ issue }: { issue: CommunityIssueView }): JSX.Element | null {
  if (!issue.projectId) return null;
  return (
    <a href={projectRoute(issue.projectId)} className="block p-3 rounded-lg border border-outline-variant/40 hover:border-primary/40 transition-colors">
      <div className="text-body-md font-semibold text-primary">
        {issue.projectName ?? issue.projectId} <span className="text-label-sm text-secondary font-bold">View project dossier →</span>
      </div>
    </a>
  );
}
