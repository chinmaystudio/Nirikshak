import { useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { useToast } from '@/context/ToastContext'
import { Panel, Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/blocks/Page'
import { LoadingBlock } from '@/components/feedback/Feedback'
import { formatDate } from '@/utils/format'
import { insightsApi } from '@/api'
import { useApiData } from '@/hooks/useApiData'
import type { AiInsight } from '@/types'

/**
 * Project workspace — AI Insights. Everything on this page is a real
 * stored ai_insights row for this project, or the response of a live
 * "Run AI analysis" call to the backend (POST /api/ai/analyze/:id).
 * There are no in-component formulas, predicted values or default
 * confidences: fields the backend did not store render as "—".
 */

function severityTone(severity: string): 'danger' | 'warning' | 'success' | 'neutral' {
  const s = severity.toUpperCase()
  if (s === 'CRITICAL' || s === 'HIGH') return 'danger'
  if (s === 'MEDIUM') return 'warning'
  if (s === 'LOW') return 'success'
  return 'neutral'
}

function confidenceTone(band: AiInsight['confidenceBand']): 'danger' | 'warning' | 'success' | 'neutral' {
  if (band === 'high') return 'success'
  if (band === 'medium') return 'warning'
  if (band === 'low') return 'danger'
  return 'neutral'
}

/** Render one section of a stored details breakdown, defensively. */
function DetailSection({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const reasons = Array.isArray(obj.reasons) ? obj.reasons.map(String) : []
    const score = obj.score ?? obj.risk_score
    return (
      <div>
        <p className="nk-label capitalize">{label.replace(/_/g, ' ')}</p>
        {score != null && <p className="mt-1 text-fg">Risk score: {String(score)}</p>}
        {reasons.length > 0 ? (
          <ul className="mt-1 list-disc pl-5 text-fg-muted">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-fg-muted">{JSON.stringify(value, null, 2)}</p>
        )}
      </div>
    )
  }
  return (
    <div>
      <p className="nk-label capitalize">{label.replace(/_/g, ' ')}</p>
      <p className="mt-1 text-fg-muted">{String(value)}</p>
    </div>
  )
}

function InsightCard({ insight }: { insight: AiInsight }) {
  const [expanded, setExpanded] = useState(false)
  const detailEntries = insight.details ? Object.entries(insight.details) : []
  const hasMore =
    (insight.evidenceItems?.length ?? 0) > 0 || (insight.actionItems?.length ?? 0) > 0 || detailEntries.length > 0
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-2">
        {insight.severity && (
          <Badge tone={severityTone(insight.severity)} icon="priority_high">
            {insight.severity}
          </Badge>
        )}
        {insight.area && (
          <Badge tone="neutral" icon="tag">
            {insight.area}
          </Badge>
        )}
        {insight.riskScore != null && (
          <Badge tone="neutral" icon="speed">
            Risk score {insight.riskScore}
          </Badge>
        )}
        {insight.confidencePct != null && (
          <Badge tone={confidenceTone(insight.confidenceBand)} icon="percent">
            Confidence {insight.confidencePct}%
          </Badge>
        )}
        <span className="ml-auto text-caption tabular-nums text-fg-subtle">{formatDate(insight.generatedOn)}</span>
      </div>
      <h3 className="mt-2 text-heading-3 text-fg">{insight.title}</h3>
      <p className="mt-1 text-body-small text-fg-muted">{insight.insight}</p>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 text-caption text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            help
          </span>
          Why is this flagged?
        </button>
      )}
      {expanded && (
        <div className="mt-2 flex flex-col gap-3 rounded-control bg-surface-2 p-3 text-caption text-fg-muted">
          {(insight.evidenceItems?.length ?? 0) > 0 && (
            <div>
              <p className="nk-label">Evidence</p>
              <ul className="mt-1 list-disc pl-5">
                {insight.evidenceItems!.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {detailEntries.map(([key, value]) => (
            <DetailSection key={key} label={key} value={value} />
          ))}
          {(insight.actionItems?.length ?? 0) > 0 && (
            <div>
              <p className="nk-label">Recommended actions</p>
              <ul className="mt-1 list-disc pl-5">
                {insight.actionItems!.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function WorkspaceAiInsightsPage() {
  const { t } = useI18n()
  const { showToast } = useToast()
  const { project } = useProjectWorkspace()
  const [refreshKey, setRefreshKey] = useState(0)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)

  const projectDbId = project?.dbId ?? project?.id
  const {
    data: insights,
    loading,
    error,
  } = useApiData<AiInsight[]>(
    () => (projectDbId ? insightsApi.byProject(projectDbId) : Promise.resolve([])),
    [projectDbId, refreshKey],
  )

  const runAnalysis = async () => {
    if (!projectDbId || aiLoading) return
    setAiLoading(true)
    try {
      const result = await insightsApi.analyzeProject(projectDbId)
      setAiResult(result)
      setRefreshKey((k) => k + 1)
      showToast('AI analysis completed and saved to this project.', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'AI analysis could not be completed.', 'danger')
    } finally {
      setAiLoading(false)
    }
  }

  if (!project) return null

  const resultSections = aiResult
    ? (['schedule', 'finance', 'environment'] as const).filter((k) => aiResult[k])
    : []
  const resultActions: string[] = Array.isArray(aiResult?.recommended_actions)
    ? aiResult.recommended_actions.map(String)
    : []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="AI Insights"
        description={`Stored AI analyses for ${project.id}, generated by the backend analysis service from this project's records. Decision support only; officers decide.`}
        actions={
          <Button variant="primary" size="sm" icon="smart_toy" disabled={aiLoading} onClick={() => void runAnalysis()}>
            {aiLoading ? 'Running AI analysis…' : 'Run AI analysis'}
          </Button>
        }
      />

      {aiResult && (
        <Panel title="Latest AI Analysis" icon="auto_awesome" subtitle="Returned by the backend for this run and saved to the project.">
          <div className="flex flex-col gap-3 text-body-small">
            <div className="flex flex-wrap items-center gap-2">
              {aiResult.risk_level && (
                <Badge tone={severityTone(String(aiResult.risk_level))} icon="priority_high">
                  Risk level {String(aiResult.risk_level)}
                </Badge>
              )}
              {aiResult.risk_score != null && (
                <Badge tone="neutral" icon="speed">
                  Risk score {String(aiResult.risk_score)}
                </Badge>
              )}
            </div>
            {aiResult.summary && <p className="text-fg">{String(aiResult.summary)}</p>}
            {resultSections.map((key) => (
              <DetailSection key={key} label={key} value={aiResult[key]} />
            ))}
            {resultActions.length > 0 && (
              <div>
                <p className="nk-label">Recommended actions (for officer review)</p>
                <ul className="mt-1 list-disc pl-5 text-fg-muted">
                  {resultActions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel title="Stored AI Insights" icon="insights" subtitle="Rows recorded in ai_insights for this project, newest first.">
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <p className="text-body-small text-danger-strong">Failed to load AI insights: {error.message}</p>
        ) : (insights?.length ?? 0) === 0 ? (
          <p className="text-body-small text-fg-muted">
            No AI insights have been generated for this project yet. Use “Run AI analysis” to generate the first one
            from the project's live records.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {insights!.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        )}
        <p className="mt-3 border-t border-border pt-3 text-caption text-warning-strong">
          <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">
            smart_toy
          </span>
          {t('common.aiDisclaimerInsight')}
        </p>
      </Panel>
    </div>
  )
}
