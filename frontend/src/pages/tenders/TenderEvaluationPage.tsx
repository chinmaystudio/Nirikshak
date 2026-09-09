import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useI18n } from '@/context/I18nContext'
import { Panel, Card } from '@/components/ui/Card'
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Progress } from '@/components/ui/Progress'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { formatCr, formatDate } from '@/utils/format'
import { TENDER_STATUS, SCORE_BAND } from '@/utils/status'
import { tendersApi, insightsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import { TENDERS, CONTRACTORS } from '@/data/modules'
import { cn } from '@/utils/cn'

/**
 * TenderEvaluationPage — AI-Assisted Contractor Risk & Capability Analysis.
 * 9 weighted factors, per-factor "Why this score?" evidence, and the required
 * disclaimer. The AI NEVER decides: a final award action stays with the officer.
 */
export function TenderEvaluationPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { data: tender, loading } = useApiData(() => tendersApi.list({ search: id }), [id])
  const record = useMemo(() => TENDERS.find((x) => x.id === decodeURIComponent(id)) ?? tender?.items[0], [id, tender])
  const [expanded, setExpanded] = useState<string | null>(null)
  const evaluation = useApiData(() => insightsApi.evaluateContractor('CTR-0001'), [])

  if (loading) return <LoadingBlock />
  if (!record) {
    return (
      <div className="nk-card p-10 text-center">
        <p className="text-heading-2 text-fg">Tender not found</p>
        <p className="nk-mono-id mt-2 text-fg-muted">{id}</p>
        <Link to="/tenders" className="mt-4 inline-block text-body-small text-primary-strong hover:underline">{t('common.back')} — {t('nav.tenders')}</Link>
      </div>
    )
  }

  const factors = evaluation.data?.factors ?? []

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: t('nav.dashboard'), to: '/dashboard' }, { label: t('nav.tenders'), to: '/tenders' }, { label: record.id }]} />

      <div className="nk-card p-4 md:p-5">
        <p className="nk-mono-id text-fg-muted">{record.id}</p>
        <h1 className="mt-1 text-heading-1 text-fg">{record.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge descriptor={TENDER_STATUS[record.status]} />
          <Badge tone="neutral" icon="payments">Est. {formatCr(record.estimatedCostCr)}</Badge>
          <Badge tone="neutral" icon="event">Opens {formatDate(record.openingDate)}</Badge>
          <Badge tone="neutral" icon="mail">Bids received: {record.bidsReceived}</Badge>
        </div>
      </div>

      <Panel title="Bid Comparison" icon="table_chart" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-body">
            <thead>
              <tr className="nk-table-header">
                <th className="px-4 text-left">Bidder</th>
                <th className="px-3 text-right">Quoted</th>
                <th className="px-3 text-right">Tech. Score</th>
                <th className="px-3 text-right">Fin. Score</th>
                <th className="px-3 text-left">Validity</th>
                <th className="px-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(record.lots ?? []).map((l) => (
                <tr key={l.bidder} className="border-t border-border hover:bg-surface-2">
                  <td className="px-4 py-2.5 font-medium text-fg">{l.bidder}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCr(l.quotedAmountCr)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.technicalScore}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.financialScore}</td>
                  <td className="px-3 py-2.5 tabular-nums">{l.bidValidityDays} days</td>
                  <td className="px-3 py-2.5"><Badge tone={l.bidStatus === 'accepted' ? 'success' : l.bidStatus === 'rejected' ? 'danger' : 'info'} dot>{l.bidStatus.replace('_', ' ')}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="AI-Assisted Contractor Risk & Capability Analysis" icon="smart_toy" subtitle="Composite capability score with per-factor evidence.">
        {record.awardedTo && (
          <p className="mb-3 rounded-control border border-success-border bg-success-tint p-2.5 text-body-small text-success-strong">
            <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">emoji_events</span>
            Awarded to {record.awardedTo} — {formatCr(record.awardedAmountCr ?? 0)} (officer decision recorded)
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {factors.map((f) => (
            <Card key={f.name} className="p-3">
              <button
                type="button"
                onClick={() => setExpanded(expanded === f.name ? null : f.name)}
                className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-expanded={expanded === f.name}
              >
                <span className="text-label text-fg">{f.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-caption text-fg-subtle">weight {f.weight}%</span>
                  <span className="tabular-nums text-label text-primary-strong">{f.score}</span>
                  <span className="material-symbols-outlined text-[18px] text-fg-subtle" aria-hidden="true">{expanded === f.name ? 'expand_less' : 'help'}</span>
                </span>
              </button>
              <Progress value={f.score} label={`${f.name} score`} size="sm" className="mt-2" showValue={false} />
              {expanded === f.name && (
                <p className="mt-2 rounded-control bg-surface-2 p-2 text-caption text-fg-muted">
                  <strong className="text-fg">Why this score?</strong> {f.evidence}
                </p>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card className="p-3">
            <p className="nk-label">Strengths</p>
            <ul className="mt-2 flex flex-col gap-1">
              {(evaluation.data?.strengths ?? []).map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-body-small text-fg">
                  <span className="material-symbols-outlined text-[16px] text-success-strong" aria-hidden="true">check_circle</span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-3">
            <p className="nk-label">Risks</p>
            <ul className="mt-2 flex flex-col gap-1">
              {(evaluation.data?.risks ?? CONTRACTORS[0].risks).map((s) => (
                <li key={s} className="flex items-start gap-1.5 text-body-small text-fg">
                  <span className="material-symbols-outlined text-[16px] text-warning-strong" aria-hidden="true">warning</span>
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <StatusBadge descriptor={SCORE_BAND[CONTRACTORS[0].scoreBand]} />
          <span className="text-display tabular-nums text-fg">{CONTRACTORS[0].aiScore}<span className="text-body-small text-fg-subtle">/100 composite</span></span>
          <Button variant="primary" icon="task_alt" className={cn('ml-auto')}>
            Recommend for Award (officer action)
          </Button>
        </div>

        <p className="mt-4 flex items-center gap-2 rounded-control border border-warning-border bg-warning-tint p-3 text-caption text-warning-strong">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">smart_toy</span>
          {t('common.aiDisclaimerEvaluation')}
        </p>
      </Panel>
    </div>
  )
}
