import { useMemo, useState } from 'react'
import { useI18n } from '@/context/I18nContext'
import { useProjectWorkspace } from '@/context/ProjectWorkspaceContext'
import { Panel } from '@/components/ui/Card'
import { DataTable } from '@/components/tables/DataTable'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/modals/Modal'
import { PageHeader, KpiRow, FilterBar, DetailField, KpiCard } from '@/components/blocks/Page'
import { formatDate, formatFileSizeKb } from '@/utils/format'
import { ACCESS_LEVEL } from '@/utils/status'
import { documentFileUrl } from '@/api'
import type { DocumentItem } from '@/types'

/** Project workspace — Document Management: this project's real document
 * register. Preview/download use the record's attached file reference
 * (external URL or storage path) when one exists; records without a file
 * say so plainly. The register stores no size or version — both render
 * "—". There is no upload flow on this page. */
export function WorkspaceDocumentsPage() {
  const { t } = useI18n()
  const { documents, project } = useProjectWorkspace()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [accessFilter, setAccessFilter] = useState('')
  const [preview, setPreview] = useState<DocumentItem | null>(null)

  const categories = useMemo(() => [...new Set(documents.map((d) => d.category))], [documents])

  const rows = useMemo(
    () =>
      documents.filter(
        (d) =>
          (!categoryFilter || d.category === categoryFilter) &&
          (!accessFilter || d.accessLevel === accessFilter) &&
          (!search || d.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [documents, categoryFilter, accessFilter, search],
  )

  const restricted = documents.filter((d) => d.accessLevel === 'Restricted').length
  const publicDocs = documents.filter((d) => d.accessLevel === 'Public').length
  const withFile = documents.filter((d) => d.storagePath || d.externalUrl).length

  const exportIndex = () => {
    const rows: (string | number)[][] = [
      ['Document', 'Category', 'Access', 'Uploaded by', 'Date', 'Storage path', 'External URL'],
      ...documents.map((d) => [d.name, d.category, d.accessLevel, d.uploadedBy ?? '', d.uploadedOn ?? '', d.storagePath ?? '', d.externalUrl ?? '']),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `document-index-${project?.id ?? 'project'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Document Management"
        description="Digital repository for this project — DPR, approvals, contracts, bills, inspection and legal records with access permissions."
        actions={
          <Button variant="outline" size="sm" icon="download" onClick={exportIndex}>
            {t('common.export')}
          </Button>
        }
      />

      <KpiRow>
        <KpiCard label="Documents on Record" value={documents.length} icon="folder_shared" />
        <KpiCard label="Public (Citizen Portal)" value={publicDocs} icon="public" iconTone="success" />
        <KpiCard label="Restricted" value={restricted} icon="lock" iconTone={restricted ? 'warning' : 'neutral'} />
        <KpiCard label="With File Attached" value={withFile} icon="attach_file" iconTone="neutral" delta={`${documents.length - withFile} record(s) have no file`} />
      </KpiRow>

      <FilterBar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Search document name…"
        selects={[
          {
            label: 'Category',
            value: categoryFilter,
            onChange: setCategoryFilter,
            options: [{ value: '', label: t('common.all') }, ...categories.map((c) => ({ value: c, label: c }))],
          },
          {
            label: 'Access',
            value: accessFilter,
            onChange: setAccessFilter,
            options: [{ value: '', label: t('common.all') }, ...(['Public', 'Internal', 'Restricted'] as const).map((x) => ({ value: x, label: x }))],
          },
        ]}
        onClear={() => {
          setSearch('')
          setCategoryFilter('')
          setAccessFilter('')
        }}
      />

      <Panel title={`Repository (${rows.length})`} icon="folder_shared" bodyClassName="p-0">
        <DataTable
          minWidth={1000}
          rows={rows}
          rowKey={(d) => d.id}
          initialSort={{ key: 'date', dir: 'desc' }}
          columns={[
            { key: 'name', header: 'Document', isRowHeader: true, render: (d) => (
              <button type="button" onClick={() => setPreview(d)} className="text-left font-medium text-fg hover:text-primary-strong hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {d.name}
              </button>
            ) },
            { key: 'category', header: 'Type', render: (d) => <Badge tone="neutral">{d.category}</Badge> },
            { key: 'version', header: 'Version', cellClassName: 'tabular-nums', sortable: true, sortValue: (d) => d.version ?? 0, render: (d) => (d.version != null ? `v${d.version}` : '—') },
            { key: 'uploadedBy', header: 'Uploaded By', render: (d) => <span className="text-caption">{d.uploadedBy ?? '—'}</span> },
            { key: 'date', header: 'Date', cellClassName: 'tabular-nums', sortable: true, sortValue: (d) => d.uploadedOn ?? '', render: (d) => formatDate(d.uploadedOn) },
            { key: 'access', header: 'Access', render: (d) => <StatusBadge descriptor={ACCESS_LEVEL[d.accessLevel]} size="sm" /> },
            { key: 'size', header: 'Size', cellClassName: 'tabular-nums', render: (d) => (d.fileSizeKb != null ? formatFileSizeKb(d.fileSizeKb) : '—') },
          ]}
          rowActions={(d) => (
            <Button variant="outline" size="sm" className="!min-h-7 !px-2.5" onClick={() => setPreview(d)}>
              Preview
            </Button>
          )}
          emptyState={
            <div className="p-8 text-center">
              <p className="text-body-small text-fg-muted">No documents match the current filters, or the repository is empty for this project.</p>
            </div>
          }
        />
      </Panel>

      {/* Preview drawer — the record's real file reference, or an honest
          "no file attached" state. */}
      <Drawer open={preview !== null} onClose={() => setPreview(null)} title={preview ? 'Document Preview' : ''} titleIcon="description" width="max-w-lg">
        {preview && (
          <div className="flex flex-col gap-4 p-4">
            {documentFileUrl(preview) ? (
              <div className="nk-card flex aspect-[4/3] flex-col items-center justify-center gap-2 p-4 text-center">
                <span className="material-symbols-outlined text-[40px] text-fg-subtle" aria-hidden="true">description</span>
                <p className="text-caption text-fg-muted">{preview.name}</p>
                <Button variant="primary" size="sm" icon="open_in_new" onClick={() => window.open(documentFileUrl(preview)!, '_blank', 'noopener')}>
                  Open file
                </Button>
              </div>
            ) : (
              <div className="nk-card flex aspect-[4/3] flex-col items-center justify-center gap-2 p-4 text-center">
                <span className="material-symbols-outlined text-[40px] text-fg-subtle" aria-hidden="true">file_off</span>
                <p className="text-caption text-fg-muted">No file attached to this record.</p>
                <p className="text-caption text-fg-subtle">
                  {preview.storagePath
                    ? `The register holds a storage reference (${preview.storagePath}) but no openable file link.`
                    : 'The register holds no storage path or external link for this document.'}
                </p>
              </div>
            )}
            <Panel title="Metadata" icon="info">
              <dl className="grid grid-cols-2 gap-3 text-body-small">
                <div className="col-span-2"><dt className="text-fg-subtle">Name</dt><dd className="text-fg">{preview.name}</dd></div>
                <DetailField label="Category" value={preview.category} />
                <DetailField label="Access level" value={<StatusBadge descriptor={ACCESS_LEVEL[preview.accessLevel]} size="sm" />} />
                <DetailField label="Uploaded by" value={preview.uploadedBy ?? '—'} />
                <DetailField label="Uploaded on" value={formatDate(preview.uploadedOn)} />
                <DetailField label="Version" value={preview.version != null ? `v${preview.version}` : '—'} />
                <DetailField label="File size" value={preview.fileSizeKb != null ? formatFileSizeKb(preview.fileSizeKb) : '—'} />
                <DetailField label="Signed by" value={preview.signedBy ?? '—'} />
                <DetailField label="Expiry" value={preview.expiryDate ? formatDate(preview.expiryDate) : '—'} />
                <DetailField label="Related project" value={<span className="nk-mono-id">{preview.projectId ?? project?.id ?? '—'}</span>} />
              </dl>
            </Panel>
            <Panel title="File Reference" icon="attach_file">
              <dl className="grid grid-cols-1 gap-3 text-body-small">
                <DetailField label="Storage path" value={preview.storagePath ? <span className="nk-mono-id break-all">{preview.storagePath}</span> : '—'} />
                <DetailField label="External URL" value={preview.externalUrl ? <span className="nk-mono-id break-all">{preview.externalUrl}</span> : '—'} />
              </dl>
              <p className="mt-3 text-caption text-fg-subtle">
                The document register does not track versions, so no version history is shown.
              </p>
            </Panel>
            <div className="flex flex-wrap gap-2">
              {documentFileUrl(preview) ? (
                <Button variant="primary" size="sm" icon="download" onClick={() => window.open(documentFileUrl(preview)!, '_blank', 'noopener')}>
                  Download
                </Button>
              ) : (
                <Button variant="primary" size="sm" icon="download" disabled title="No file is attached to this record">
                  Download — no file attached
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
