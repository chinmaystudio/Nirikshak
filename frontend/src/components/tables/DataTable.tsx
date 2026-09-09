import { cn } from '@/utils/cn'
import { useI18n } from '@/context/I18nContext'
import { Button } from '@/components/ui/Button'

/**
 * DataTable — generic themed table with the Stitch conventions: header row in
 * surface-2 with uppercase 12px labels, horizontal scroll wrapper with
 * min-width, and per-row action slot. Keyboard accessible.
 */
export interface DataColumn<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  /** Extra classes on the cell (widths, alignment). */
  cellClassName?: string
  headerClassName?: string
  /** Mark the row-identity column for screen-reader ordering. */
  isRowHeader?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowActions,
  onRowClick,
  minWidth = 900,
  emptyState,
  className,
  caption,
}: {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowActions?: (row: T) => React.ReactNode
  onRowClick?: (row: T) => void
  minWidth?: number
  emptyState?: React.ReactNode
  className?: string
  caption?: string
}) {
  const { t } = useI18n()
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-body" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="nk-table-header">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('border-b border-border px-3 text-left first:pl-4 last:pr-4', c.headerClassName)}
              >
                {c.header}
              </th>
            ))}
            {rowActions && (
              <th scope="col" className="border-b border-border px-3 text-right">
                <span className="sr-only">{t('common.actions')}</span>
                {t('common.actions')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn(
                'border-b border-border transition-colors duration-fast last:border-0 hover:bg-surface-2',
                onRowClick && 'cursor-pointer',
              )}
              {...(onRowClick ? { onClick: () => onRowClick(row) } : {})}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-3 py-2.5 align-middle first:pl-4 last:pr-4',
                    c.isRowHeader && 'font-medium text-fg',
                    c.cellClassName,
                  )}
                >
                  {c.isRowHeader ? <span className="font-medium text-fg">{c.render(row)}</span> : c.render(row)}
                </td>
              ))}
              {rowActions && <td className="px-3 py-2 text-right">{rowActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Compact "View Project" row action used across list pages (Stitch pattern). */
export function ViewRowButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const { t } = useI18n()
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="!min-h-7 !px-2.5">
      {label ?? t('common.viewProject')}
    </Button>
  )
}
