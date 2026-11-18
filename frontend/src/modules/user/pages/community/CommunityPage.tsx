import { useState } from "react";
import { Button } from "@/components/common/Button";
import { StatCard, PageHeader } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { CommunityIssueCard } from "@/components/community/CommunityIssueCard";
import { Icon } from "@/components/common/Icon";
import { useNavigate } from "@/app/router";
import { useCommunityFeed } from "@/hooks/useCommunity";
import { ROUTES } from "@/constants/routes";
import { formatNumber } from "@/utils/formatCurrency";
import type { CommunityFeed } from "@/services/community/communityService";

const FEEDS: Array<{ id: CommunityFeed; label: string }> = [
  { id: "recent", label: "Recently Reported" },
  { id: "open", label: "Open Issues" },
  { id: "resolved", label: "Resolved" },
  { id: "all", label: "All Issues" }
];

export function CommunityPage(): JSX.Element {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<CommunityFeed>("recent");
  const state = useCommunityFeed(feed);
  const stats = state.data?.stats;
  const issues = state.data?.issues ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Community Issues"
        sub="Public complaints published from the live NIRIKSHAK register — follow what citizens have reported and how departments are responding."
        actions={
          <Button variant="accent" icon="add_circle" onClick={() => navigate(ROUTES.REPORT)}>
            Report an Issue
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open Issues" value={stats?.open ?? "—"} sub="Awaiting department action" icon="report_problem" circleClass="bg-amber-100 text-amber-900" />
        <StatCard label="Resolved" value={stats?.resolved ?? "—"} sub="Closed in the public register" icon="verified" circleClass="bg-green-100 text-green-800" />
        <StatCard label="Public Issues" value={stats ? formatNumber(stats.total) : "—"} sub="Published complaints" icon="forum" />
        <StatCard label="Linked Projects" value={stats?.linkedProjects ?? "—"} sub="Projects with public issues" icon="construction" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 border-b border-outline-variant/30">
        {FEEDS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFeed(f.id)}
            className={`px-3.5 py-1.5 rounded text-label-md font-label-md whitespace-nowrap transition-colors ${
              feed === f.id ? "bg-primary text-on-primary font-bold" : "bg-surface-container-low hover:bg-surface-container text-on-surface-variant"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {state.loading ? (
        <LoadingSkeleton kind="list" />
      ) : state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : issues.length === 0 ? (
        <EmptyState
          icon="celebration"
          title="Nothing here yet"
          text={feed === "resolved" ? "No resolved community issues in this filter yet." : "No issues match this filter right now."}
          ctaLabel="Report an Issue"
          ctaRoute={ROUTES.REPORT}
        />
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => (
            <CommunityIssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}

      <div className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/40 text-body-sm text-on-surface-variant flex items-start gap-2">
        <Icon name="shield" className="text-[20px] text-primary flex-shrink-0" />
        <span>
          <strong className="text-primary">Public register, privacy-safe.</strong> Issues shown here come from the public complaints register.
          Personal details of reporters are never published.
        </span>
      </div>
    </div>
  );
}
