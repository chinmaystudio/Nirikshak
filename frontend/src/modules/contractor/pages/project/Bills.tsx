import { useMemo, useState } from 'react';
import { Receipt, Plus, Send, Eye, Pencil, Trash2 } from 'lucide-react';
import { Card, SectionTitle, StatusBadge, Tabs, Field, Select, Modal, ConfirmModal } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import { StepFlow } from '../../components/charts';
import { useStore } from '../../lib/store';
import type { Invoice, InvoiceStatus, Project } from '../../lib/types';
import { fmtDate, money } from '../../lib/utils';

const GROUPS: { key: string; label: string; statuses: InvoiceStatus[] }[] = [
  { key: 'all', label: 'All', statuses: ['Draft', 'Submitted', 'Under Verification', 'Approved', 'Rejected', 'Paid'] },
  { key: 'draft', label: 'Draft', statuses: ['Draft'] },
  { key: 'submitted', label: 'Submitted / Verification', statuses: ['Submitted', 'Under Verification'] },
  { key: 'approved', label: 'Approved', statuses: ['Approved'] },
  { key: 'paid', label: 'Paid', statuses: ['Paid'] },
  { key: 'rejected', label: 'Rejected', statuses: ['Rejected'] },
];

export default function Bills({ project }: { project: Project }) {
  const { invoices, addInvoice, submitInvoice, updateInvoiceNote, removeInvoice, toast, projects } = useStore();
  const [group, setGroup] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [noteTarget, setNoteTarget] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  const mine = useMemo(() => invoices.filter((i) => i.projectId === project.id), [invoices, project.id]);
  const rows = useMemo(() => mine.filter((i) => GROUPS.find((g) => g.key === group)!.statuses.includes(i.status)), [mine, group]);

  const totals = useMemo(
    () => ({
      billed: mine.reduce((s, i) => s + (i.status === 'Draft' || i.status === 'Rejected' ? 0 : i.amount), 0),
      paid: mine.filter((i) => i.status === 'Paid').reduce((s, i) => s + i.amount, 0),
      outstanding: mine.filter((i) => ['Submitted', 'Under Verification', 'Approved'].includes(i.status)).reduce((s, i) => s + i.amount, 0),
    }),
    [mine]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
        Contractor invoices — bills are saved to the project record (contractor_invoices) under <strong>your own invoice numbers</strong>. Drafts stay editable here; once submitted, the department verifies, approves and pays on the same record, and only the note remains editable from this portal.
      </div>
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Billed (excl. drafts)', value: money(totals.billed), cls: 'text-slate-800 dark:text-slate-100' },
          { label: 'Paid', value: money(totals.paid), cls: 'text-green-700 dark:text-green-400' },
          { label: 'Outstanding', value: money(totals.outstanding), cls: 'text-amber-700 dark:text-amber-400' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{s.label}</p>
            <p className={`font-display font-bold text-2xl tracking-tight mt-1.5 ${s.cls}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <SectionTitle icon={Receipt} title="Bill Lifecycle" />
        <StepFlow
          steps={[
            { label: 'Draft', state: 'done', note: `${mine.filter((i) => i.status === 'Draft').length} draft` },
            { label: 'Submitted', state: 'done', note: `${mine.filter((i) => i.status === 'Submitted').length} in queue` },
            { label: 'Under Verification', state: mine.some((i) => i.status === 'Under Verification') ? 'current' : 'done' },
            { label: 'Approved', state: mine.some((i) => i.status === 'Approved') ? 'done' : 'pending' },
            { label: 'Paid', state: mine.some((i) => i.status === 'Paid') ? 'done' : 'pending' },
          ]}
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="p-5 pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <SectionTitle icon={Receipt} title={`Bills & Invoices — ${project.name}`} className="mb-0" />
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" />
              Create Invoice
            </button>
          </div>
          <div className="mt-4 -mx-5">
            <Tabs tabs={GROUPS.map((g) => ({ key: g.key, label: g.label, count: mine.filter((i) => g.statuses.includes(i.status)).length }))} active={group} onChange={setGroup} />
          </div>
        </div>

        <DataTable
          
          columns={[
            { key: 'no', label: 'Invoice No.', sortVal: (i: Invoice) => i.no, render: (i: Invoice) => <span className="text-xs font-bold font-mono">{i.no}</span> },
            { key: 'milestone', label: 'Bill / Milestone', render: (i: Invoice) => <span className="text-xs font-semibold">{i.milestone}</span> },
            { key: 'amount', label: 'Amount', sortVal: (i: Invoice) => i.amount, render: (i: Invoice) => <span className="text-xs font-bold tabular-nums">{money(i.amount)}</span> },
            { key: 'date', label: 'Date', sortVal: (i: Invoice) => i.date, render: (i: Invoice) => <span className="text-xs">{fmtDate(i.date)}</span> },
            { key: 'status', label: 'Status', sortVal: (i: Invoice) => i.status, render: (i: Invoice) => <StatusBadge status={i.status} /> },
            { key: 'note', label: 'Note', render: (i: Invoice) => <span className="text-xs">{i.note ? (i.note.length > 60 ? `${i.note.slice(0, 60)}…` : i.note) : '—'}</span> },
            { key: 'updated', label: 'Last Updated', sortVal: (i: Invoice) => i.updatedAt, render: (i: Invoice) => <span className="text-xs">{i.updatedAt ? fmtDate(i.updatedAt) : '—'}</span> },
            {
              key: 'action',
              label: 'Action',
              render: (i: Invoice) => (
                <div className="flex gap-1.5">
                  {i.status === 'Draft' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={async () => {
                        try {
                          await submitInvoice(i.id);
                          toast('success', 'Invoice submitted', `${i.no} is now with the department for verification. Its status here will follow the department's actions on the record.`);
                        } catch (err) {
                          toast('error', 'Invoice not submitted', err instanceof Error ? err.message : 'The invoice could not be submitted.');
                        }
                      }}
                    >
                      <Send className="w-3 h-3" />
                      Submit
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setNoteTarget(i)}
                    aria-label={`Edit note for ${i.no}`}
                  >
                    <Pencil className="w-3 h-3" />
                    Note
                  </button>
                  {i.status === 'Draft' && (
                    <button
                      className="btn btn-ghost btn-sm text-red-600"
                      onClick={() => setDeleteTarget(i)}
                      aria-label={`Delete draft ${i.no}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      toast('info', `Bill ${i.no}`, `${i.milestone || 'Invoice'} — ${money(i.amount)} — Status: ${i.status}. Invoice date ${fmtDate(i.date)}${i.updatedAt ? `; last updated ${fmtDate(i.updatedAt)}` : ''}.${i.note ? ` Note: ${i.note}` : ''}`);
                    }}
                  >
                    <Eye className="w-3 h-3" />
                    Details
                  </button>
                </div>
              ),
            },
          ]}
          rows={rows}
          empty={<p className="text-sm text-slate-500 py-10 text-center font-medium">No bills in this stage.</p>}
        />
      </Card>

      <CreateInvoiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        defaultProject={project.id}
        projects={projects}
        onSubmit={async (inv) => {
          try {
            await addInvoice(inv);
            toast('success', 'Invoice draft saved', `${inv.no} saved to the project record as a draft. Submit it when it is ready for department verification.`);
            setCreateOpen(false);
          } catch (err) {
            toast('error', 'Invoice not saved', err instanceof Error ? err.message : 'The invoice could not be saved.');
          }
        }}
      />

      {/* Note editing — the one field that stays editable after submission */}
      <NoteModal
        invoice={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSave={async (note) => {
          if (!noteTarget) return;
          try {
            await updateInvoiceNote(noteTarget.id, note);
            toast('success', 'Note saved', `The note on ${noteTarget.no} was updated on the project record.`);
            setNoteTarget(null);
          } catch (err) {
            toast('error', 'Note not saved', err instanceof Error ? err.message : 'The note could not be saved.');
          }
        }}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await removeInvoice(deleteTarget.id);
            toast('success', 'Draft deleted', `${deleteTarget.no} was removed from the project record.`);
          } catch (err) {
            toast('error', 'Draft not deleted', err instanceof Error ? err.message : 'The draft could not be deleted.');
          }
        }}
        title="Delete this draft invoice?"
        message={`${deleteTarget?.no} has not been submitted yet and will be permanently removed from the project record.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function CreateInvoiceModal({
  open,
  onClose,
  defaultProject,
  onSubmit,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  defaultProject: string;
  onSubmit: (inv: Omit<Invoice, 'id' | 'updatedAt'>) => void;
  projects: Project[];
}) {
  const [projectId, setProjectId] = useState(defaultProject);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [milestone, setMilestone] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const valid = invoiceNo.trim().length >= 3 && Number(amount) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Invoice"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                no: invoiceNo.trim(),
                projectId,
                milestone: milestone.trim(),
                amount: Number(amount),
                date,
                status: 'Draft',
                note: notes || undefined,
              })
            }
          >
            Save Draft
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Project">
          <Select value={projectId} onChange={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
        <Field label="Invoice Date">
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Your Invoice Number" required hint="The number on your own invoice / RA bill — recorded exactly as entered">
          <input className="input" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV/2026-27/041" />
        </Field>
        <Field label="Amount (₹)" required hint="Enter gross amount including taxes">
          <input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1850000" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Bill / Milestone Description">
            <input className="input" value={milestone} onChange={(e) => setMilestone(e.target.value)} placeholder="e.g. RA Bill 9 — Wearing Course Zone 1" />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Notes (optional)">
            <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Measurement book reference, test reports enclosed, etc." />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function NoteModal({
  invoice,
  onClose,
  onSave,
}: {
  invoice: Invoice | null;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const [lastId, setLastId] = useState<string | null>(null);
  if ((invoice?.id ?? null) !== lastId) {
    setLastId(invoice?.id ?? null);
    if (invoice) setNote(invoice.note ?? '');
  }
  return (
    <Modal
      open={invoice !== null}
      onClose={onClose}
      title={invoice ? `Note — ${invoice.no}` : ''}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(note.trim())}>
            Save Note
          </button>
        </>
      }
    >
      <Field label="Note" hint={invoice && invoice.status !== 'Draft' ? 'This invoice is with the department — the note is the only field you can still change.' : 'Saved on the invoice record.'}>
        <textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Measurement book reference, test reports enclosed, etc." />
      </Field>
    </Modal>
  );
}
