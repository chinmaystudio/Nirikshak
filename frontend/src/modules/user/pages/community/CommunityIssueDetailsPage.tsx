import { Icon } from "@/components/common/Icon";
import { PageHeader } from "@/components/common/StatCard";
import { LoadingSkeleton } from "@/components/common/LoadingState";
import { ErrorState } from "@/components/common/ErrorState";
import { CommunityStatusBadge } from "@/components/common/StatusBadge";
import { CommunityIssueSummary, RelatedProjectMini } from "@/components/community/CommunityIssueCard";
import { useNavigate, getRouteId } from "@/app/router";
import { useAsync } from "@/hooks/useAsync";
import { getCommunityIssue } from "@/services/community/communityService";
import { shortDate } from "@/utils/formatDate";
import type { CommunityIssueView } from "@/types/community";

export function CommunityIssueDetailsPage(): JSX.Element {
  const navigate = useNavigate();
  const id = getRouteId();
  const state = useAsync(() => getCommunityIssue(id), [id]);

  if (state.loading) return <LoadingSkeleton kind="detail" />;
  if (state.error || !state.data) {
    return (
      <ErrorState
        notFound={state.notFound}
        message={state.error ?? "Issue not found."}
        onRetry={state.notFound ? undefined : state.reload}
      />
    );
  }

  const issue: CommunityIssueView = state.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={issue.title}
        sub={`${issue.category}${issue.projectName ? ` • ${issue.projectName}` : ""}`}
        back
        onBack={() => navigate("/community")}
        actions={<CommunityStatusBadge status={issue.status} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60 shadow-sm space-y-4">
            <CommunityIssueSummary issue={issue} />
            <p className="text-body-sm text-on-surface-variant leading-relaxed">
              This issue is published from the public complaints register. For privacy, the register does not publish the reporter's identity or
              the full complaint narrative — the reporting citizen and the department see those in the complaint tracker.
            </p>
          </section>

          <section className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60 shadow-sm space-y-4">
            <h2 className="text-headline-sm font-bold text-primary">Issue Timeline</h2>
            <ol className="relative">
              {issue.timeline.map((t, i) => {
                const done = t.status === "completed";
                const current = t.status === "current";
                const circle = done
                  ? "bg-primary text-on-primary"
                  : current
                    ? "bg-secondary text-on-secondary animate-pulse"
                    : "bg-surface-container-highest text-outline border-2 border-outline-variant/50";
                const tone = done ? "text-primary" : current ? "text-secondary" : "text-outline";
                return (
                  <li key={t.id} className="relative pl-10 pb-5 last:pb-0">
                    <span className={`absolute left-0 top-0 w-8 h-8 rounded-full ${circle} flex items-center justify-center text-label-sm font-bold z-10`}>
                      {done ? "✓" : current ? <Icon name="play_arrow" className="text-[16px]" /> : <Icon name="radio_button_unchecked" className="text-[15px]" />}
                    </span>
                    {t.status !== "upcoming" && i < issue.timeline.length - 1 ? (
                      <span className="absolute left-[15px] top-9 bottom-0 w-0.5 bg-outline-variant/40" aria-hidden="true" />
                    ) : null}
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className={`text-label-md font-bold ${tone}`}>{t.title}</span>
                      <span className="text-label-sm text-outline font-mono">{t.date ? shortDate(t.date) : "Current"}</span>
                    </div>
                    <p className="text-body-sm text-on-surface-variant mt-0.5">{t.description}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <div className="lg:col-span-4 space-y-5">
          {issue.projectId ? (
            <section className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60 shadow-sm space-y-2">
              <h2 className="text-headline-sm font-bold text-primary">Related Project</h2>
              <RelatedProjectMini issue={issue} />
            </section>
          ) : null}

          <section className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/60 shadow-sm space-y-2">
            <h2 className="text-headline-sm font-bold text-primary">Experiencing this too?</h2>
            <p className="text-body-sm text-on-surface-variant">
              File your own complaint so the department has your report on record — it will appear here once published to the public register.
            </p>
            <a
              href="#/report"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary text-label-md font-bold hover:bg-primary-container transition-colors"
            >
              <Icon name="report" className="text-[18px]" /> Report an Issue
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
