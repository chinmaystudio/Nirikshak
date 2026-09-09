import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { Panel } from '@/components/ui/Card'
import { TextField, Select } from '@/components/ui/Fields'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DataTable } from '@/components/tables/DataTable'
import { Modal } from '@/components/modals/Modal'
import { Progress } from '@/components/ui/Progress'
import { formatCr, formatPct } from '@/utils/format'
import { SCORE_BAND } from '@/utils/status'
import type { Contractor } from '@/types'
import { contractorsApi, insightsApi } from '@/api'
import { useApiData, useDebounced } from '@/hooks/useApiData'

/**
 * ContractorsPage — Contractor Management register with the AI-assisted
 * composite score and "Why this score?" drill-in (demo evaluation).
 */
export function ContractorsPage() {
  const { t } = useI18n()
  const { data: contractors, loading } = useApiData(() => contractorsApi.all(), [])
  const [search, setSearch] = useState('')
  const debounced = useDebounced(search)
  const [klass, setKlass] = useState('')
  const [selected, setSelected] = useState<Contractor | null>(null)
  const evaluation = useApiData(
    () => insightsApi.evaluateContractor(selected?.id ?? 'CTR-0001'),
    [selected?.id],
  )

  const rows = useMemo(
    () =>
      (contractors ?? []).filter((c) => {
        if (klass && c.class !== klass) return false
        if (debounced && !c.name.toLowerCase().includes(debounced.toLowerCase())) return false
        return true
      }),
    [contractors, klass, debounced],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-heading-1 text-fg">{t('nav.contractors')}</h1>
        <p className="mt-1 text-body-small text-fg-muted">
          Registered contractor performance registry (mock data). AI score is advisory only.
        </p>
      </div>

      <Panel title={t('common.filters')} icon="filter_list" bodyClassName="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField label={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} startIcon="search" />
          <Select
            label="Registration class"
            value={klass}
            onChange={(e) => setKlass(e.target.value)}
            options={[
              { value: '', label: t('common.all') },
              { value: 'Class A', label: 'Class A' },
              { value: 'Class B', label: 'Class B' },
              { value: 'Class C', label: 'Class C' },
            ]}
          />
        </div>
      </Panel>

      <Panel title={`${t('common.contractor')} (${rows.length})`} icon="engineering" bodyClassName="p-0">
        {loading ? <div className="p-8 text-center text-body-small text-fg-muted">{t('common.loading')}</div> : (
          <DataTable<Contractor>
            minWidth={1100}
            rows={rows}
            rowKey={(c) => c.id}
            columns={[
              { key: 'name', header: 'Contractor', isRowHeader: true, render: (c) => <span className="block max-w-64 truncate font-medium" title={c.name}>{c.name}</span> },
              { key: 'class', header: 'Class', render: (c) => <span className="nk-mono-id">{c.class}</span> },
              { key: 'active', header: 'Active', cellClassName: 'tabular-nums', render: (c) => c.activeProjects },
              { key: 'completed', header: 'Completed', cellClassName: 'tabular-nums', render: (c) => c.completedProjects },
              { key: 'ontime', header: 'On-Time', cellClassName: 'tabular-nums', render: (c) => formatPct(c.onTimeCompletionPct, 0) },
              { key: 'quality', header: 'Quality', cellClassName: 'tabular-nums', render: (c) => `${c.qualityRating.toFixed(1)}/5` },
              { key: 'score', header: 'AI Score', render: (c) => (
                <div className="flex min-w-32 items-center gap-2">
                  <span className="tabular-nums text-label text-fg">{c.aiScore}</span>
                  <StatusBadge descriptor={SCORE_BAND[c.scoreBand]} size="sm" />
                </div>
              ) },
              { key: 'litigation', header: 'Litigation', cellClassName: 'tabular-nums', render: (c) => (c.litigationCount > 0 ? <span className="text-danger-strong">{c.litigationCount}</span> : '0') },
            ]}
            rowActions={(c) => (
              <Button variant="outline" size="sm" onClick={() => setSelected(c)}>
                Why this score?
              </Button>
            )}
          />
        )}
      </Panel>

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={`AI-Assisted Evaluation — ${selected?.name ?? ''}`}
        titleIcon="smart_toy"
        size="lg"
        footer={
          <Button variant="primary" onClick={() => setSelected(null)}>
            {t('common.close')}
          </Button>
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-display tabular-nums text-fg">{evaluation.data?.score ?? selected.aiScore}</span>
              <StatusBadge descriptor={SCORE_BAND[selected.scoreBand]} />
              <span className="text-caption text-fg-subtle">composite of 9 weighted factors</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {(evaluation.data?.factors ?? []).map((f) => (
                <li key={f.name}>
                  <div className="flex items-center justify-between text-body-small">
                    <span className="text-fg">{f.name} <span className="text-fg-subtle">({f.weight}%)</span></span>
                    <span className="tabular-nums text-fg-muted">{f.score}/100</span>
                  </div>
                  <Progress value={f.score} label={`${f.name} score`} size="sm" showValue={false} className="mt-1" />
                  <p className="mt-1 text-caption text-fg-subtle">{f.evidence}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-control border border-warning-border bg-warning-tint p-3 text-caption text-warning-strong">
              <span className="material-symbols-outlined mr-1 align-middle text-[16px]" aria-hidden="true">smart_toy</span>
              {t('common.aiDisclaimerEvaluation')}
            </p>
            <p className="text-caption text-fg-subtle">
              Total portfolio value {formatCr(selected.totalValueCr)} • empanelled since {selected.empanelledSince} •
              districts: {selected.districts.join(', ')}.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
