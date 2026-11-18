import { useMemo, useState } from 'react';
import { Users, Plus, Pencil, Trash2, Truck, Package } from 'lucide-react';
import { Card, SectionTitle, Tabs, StatusBadge, SearchInput, Select, Field, Modal, ConfirmModal, EmptyState, ProgressBar, Pills } from '../../components/ui';
import { Link } from '../../lib/router';
import { HBars } from '../../components/charts';
import { useStore } from '../../lib/store';
import type { Project, Worker, ResourceRow } from '../../lib/types';
import { cls } from '../../lib/utils';

const ROLES = ['Site Supervisor', 'Mason', 'Bar Bender', 'Carpenter (Shuttering)', 'Electrician', 'Steel Fixer', 'Paver Operator', 'Pipe Fitter', 'Welder', 'Excavator Operator', 'Construction Labour', 'Helper', 'Safety Officer', 'Equipment Operator'];

export default function Resources({ project }: { project: Project }) {
  const { workers, resources, addWorker, updateWorker, removeWorker, addResource, updateResource, removeResource, toast } = useStore();
  const [tab, setTab] = useState('workers');
  const [q, setQ] = useState('');
  const [catF, setCatF] = useState('All Categories');
  const [statusF, setStatusF] = useState('All Statuses');
  const [edit, setEdit] = useState<Worker | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Worker | null>(null);
  const [resAddOpen, setResAddOpen] = useState(false);
  const [resEdit, setResEdit] = useState<ResourceRow | null>(null);
  const [resRemoveTarget, setResRemoveTarget] = useState<ResourceRow | null>(null);
  const [utilTab, setUtilTab] = useState('Summary');

  const list = workers[project.id] ?? [];
  const resList = resources[project.id] ?? [];

  const filteredWorkers = useMemo(
    () =>
      list.filter((w) => {
        const t = q.trim().toLowerCase();
        if (t && !((w.name || '').toLowerCase().includes(t) || (w.role || '').toLowerCase().includes(t) || (w.area || '').toLowerCase().includes(t))) return false;
        if (catF !== 'All Categories' && w.category !== catF) return false;
        if (statusF !== 'All Statuses' && w.status !== statusF) return false;
        return true;
      }),
    [list, q, catF, statusF]
  );

  const summary = useMemo(() => {
    const active = list.filter((w) => w.status === 'Active');
    const withAttendance = active.filter((w) => w.attendance != null);
    return {
      total: list.length,
      skilled: list.filter((w) => w.category === 'Skilled').length,
      unskilled: list.filter((w) => w.category === 'Unskilled').length,
      supervisors: list.filter((w) => w.category === 'Supervisor').length,
      active: active.length,
      // Average only over workers whose attendance is actually recorded —
      // a worker with no attendance figure is not silently counted as 0%.
      attendance: withAttendance.length ? Math.round(withAttendance.reduce((s, w) => s + (w.attendance ?? 0), 0) / withAttendance.length) : null,
    };
  }, [list]);

  const filteredRes = useMemo(
    () =>
      resList.filter((r) => {
        const t = q.trim().toLowerCase();
        if (t && !(r.name || '').toLowerCase().includes(t)) return false;
        if (catF !== 'All Categories' && r.category !== catF) return false;
        return true;
      }),
    [resList, q, catF]
  );

  const utilItems = useMemo(() => {
    const byCat: Record<string, { alloc: number; used: number }> = {};
    resList.forEach((r) => {
      byCat[r.category] = byCat[r.category] ?? { alloc: 0, used: 0 };
      byCat[r.category].alloc += r.allocated;
      byCat[r.category].used += Math.min(r.used, r.allocated);
    });
    return Object.entries(byCat).map(([label, v]) => ({ label, value: v.alloc ? Math.round((v.used / v.alloc) * 100) : 0, color: 'bg-blue-700' }));
  }, [resList]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
        Project record — workers and resources are saved to this project's database record (project_workers / project_resources) and are visible to the department. Changes take effect only when the save succeeds.
      </div>
      <Card className="overflow-hidden">
        <Tabs
          tabs={[
            { key: 'workers', label: 'Workers', count: list.length },
            { key: 'resources', label: 'Resources', count: resList.length },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'workers' && (
          <>
            {/* Worker KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 p-5">
              {[
                { label: 'Total Workers', value: String(summary.total) },
                { label: 'Skilled', value: String(summary.skilled) },
                { label: 'Unskilled', value: String(summary.unskilled) },
                { label: 'Supervisors', value: String(summary.supervisors) },
                { label: 'Active Workers', value: String(summary.active) },
                { label: 'Avg Attendance', value: summary.attendance != null ? `${summary.attendance}%` : '—' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-700">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{s.label}</p>
                  <p className="font-display font-bold text-xl text-slate-800 mt-1 dark:text-slate-100">{s.value}</p>
                </div>
              ))}
            </div>

            <div className="px-5 pb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search worker, role or area…" />
              <Select value={catF} onChange={setCatF} options={['All Categories', 'Skilled', 'Unskilled', 'Supervisor'].map((v) => ({ value: v, label: v }))} />
              <Select value={statusF} onChange={setStatusF} options={['All Statuses', 'Active', 'On Leave', 'Transferred'].map((v) => ({ value: v, label: v }))} />
              <button className="btn btn-primary" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Worker
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker</th>
                    <th>Role</th>
                    <th>Category</th>
                    <th>Assigned Area</th>
                    <th>Attendance</th>
                    <th>Hours / Week</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => (
                    <tr key={w.id}>
                      <td>
                        <p className="font-bold text-slate-800 dark:text-slate-100">{w.name}</p>
                      </td>
                      <td className="text-xs font-semibold">{w.role}</td>
                      <td>
                        <span className={cls('text-[11px] font-bold rounded px-1.5 py-0.5', w.category === 'Supervisor' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : w.category === 'Skilled' ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
                          {w.category}
                        </span>
                      </td>
                      <td className="text-xs font-semibold">{w.area || '—'}</td>
                      <td>
                        {w.attendance != null ? (
                          <div className="flex items-center gap-2 w-24">
                            <ProgressBar value={w.attendance} height="h-2" className="w-16" color={w.attendance >= 90 ? 'bg-green-600' : w.attendance >= 75 ? 'bg-amber-500' : 'bg-slate-300'} />
                            <span className="text-xs font-bold tabular-nums">{w.attendance}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not recorded</span>
                        )}
                      </td>
                      <td className="text-xs font-bold tabular-nums">{w.hours != null ? `${w.hours}h` : '—'}</td>
                      <td><StatusBadge status={w.status} /></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-ghost btn-sm" onClick={() => setEdit(w)} aria-label={`Edit ${w.name}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button className="btn btn-ghost btn-sm text-red-600" onClick={() => setRemoveTarget(w)} aria-label={`Remove ${w.name}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWorkers.length === 0 && (
                <div className="p-6">
                  <EmptyState title="No workers match your filters" msg="Adjust the search, category or status filters, or add a new worker to this site." />
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'resources' && (
          <>
            <div className="px-5 pt-5 pb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
              <SearchInput value={q} onChange={setQ} placeholder="Search resource…" />
              <Select value={catF} onChange={setCatF} options={['All Categories', 'Machinery', 'Equipment', 'Vehicles', 'Materials'].map((v) => ({ value: v, label: v }))} />
              <div />
              <button className="btn btn-primary" onClick={() => setResAddOpen(true)}>
                <Plus className="w-4 h-4" />
                Add Resource
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Resource</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Allocated</th>
                    <th>Used</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRes.map((r) => {
                    const available = Math.max(0, r.qty - r.used);
                    return (
                      <tr key={r.id}>
                        <td className="font-bold text-slate-800 dark:text-slate-100">{r.name}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold rounded px-1.5 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {r.category === 'Machinery' ? <Truck className="w-3 h-3" /> : r.category === 'Materials' ? <Package className="w-3 h-3" /> : null}
                            {r.category}
                          </span>
                        </td>
                        <td className="text-xs font-bold tabular-nums">{r.qty} {r.unit}</td>
                        <td className="text-xs font-semibold tabular-nums">{r.allocated}</td>
                        <td className="text-xs font-semibold tabular-nums">{r.used}</td>
                        <td className="text-xs font-bold tabular-nums">{available} {r.unit}</td>
                        <td><StatusBadge status={r.status} /></td>
                        <td>
                          <div className="flex gap-1">
                            <button className="btn btn-ghost btn-sm" onClick={() => setResEdit(r)} aria-label={`Edit ${r.name}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button className="btn btn-ghost btn-sm text-red-600" onClick={() => setResRemoveTarget(r)} aria-label={`Remove ${r.name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredRes.length === 0 && (
                <div className="p-6">
                  <EmptyState title="No resources found" msg="No resources match the current filters." />
                </div>
              )}
            </div>

            {/* Utilization */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <SectionTitle icon={Truck} title="Utilization" className="mb-0" />
                <Pills options={['Summary', 'By Item']} value={utilTab} onChange={setUtilTab} />
              </div>
              {utilTab === 'Summary' ? (
                <HBars items={utilItems} />
              ) : (
                <HBars
                  items={resList
                    .filter((r) => r.allocated > 0 && r.category !== 'Materials')
                    .map((r) => ({ label: r.name, value: Math.round((Math.min(r.used, r.allocated) / r.allocated) * 100) }))}
                />
              )}
              <p className="text-[11px] text-slate-500 mt-4 font-medium dark:text-slate-400">
                Materials utilization compares consumption against allocation. “Low Stock” items (cement, bitumen) should be re-ordered with lead time in mind.
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Add/Edit worker modal */}
      <WorkerModal
        open={addOpen || edit !== null}
        worker={edit}
        onClose={() => {
          setAddOpen(false);
          setEdit(null);
        }}
        onSubmit={async (w) => {
          try {
            if (edit) {
              await updateWorker(project.id, { ...w, id: edit.id });
              toast('success', 'Worker updated', `${w.name}'s record was saved to the project record.`);
            } else {
              await addWorker(project.id, w);
              toast('success', 'Worker added', `${w.name} added to ${project.name} in the project record.`);
            }
            setAddOpen(false);
            setEdit(null);
          } catch (err) {
            toast('error', 'Worker not saved', err instanceof Error ? err.message : 'The worker could not be saved.');
          }
        }}
      />

      {/* Add/Edit resource modal */}
      <ResourceModal
        open={resAddOpen || resEdit !== null}
        resource={resEdit}
        onClose={() => {
          setResAddOpen(false);
          setResEdit(null);
        }}
        onSubmit={async (r) => {
          try {
            if (resEdit) {
              await updateResource(project.id, { ...r, id: resEdit.id });
              toast('success', 'Resource updated', `${r.name}'s record was saved to the project record.`);
            } else {
              await addResource(project.id, r);
              toast('success', 'Resource added', `${r.name} added to the ${project.name} record.`);
            }
            setResAddOpen(false);
            setResEdit(null);
          } catch (err) {
            toast('error', 'Resource not saved', err instanceof Error ? err.message : 'The resource could not be saved.');
          }
        }}
      />

      <ConfirmModal
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={async () => {
          if (!removeTarget) return;
          try {
            await removeWorker(project.id, removeTarget.id);
            toast('success', 'Worker removed', `${removeTarget.name} removed from the ${project.name} record.`);
          } catch (err) {
            toast('error', 'Worker not removed', err instanceof Error ? err.message : 'The worker could not be removed.');
          }
        }}
        title="Remove worker from site?"
        message={`${removeTarget?.name} (${removeTarget?.role}) will be permanently removed from the ${project.name} project record.`}
        confirmLabel="Remove"
        danger
      />

      <ConfirmModal
        open={resRemoveTarget !== null}
        onClose={() => setResRemoveTarget(null)}
        onConfirm={async () => {
          if (!resRemoveTarget) return;
          try {
            await removeResource(project.id, resRemoveTarget.id);
            toast('success', 'Resource removed', `${resRemoveTarget.name} removed from the ${project.name} record.`);
          } catch (err) {
            toast('error', 'Resource not removed', err instanceof Error ? err.message : 'The resource could not be removed.');
          }
        }}
        title="Remove resource from site?"
        message={`${resRemoveTarget?.name} will be permanently removed from the ${project.name} project record.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

function WorkerModal({
  open,
  worker,
  onClose,
  onSubmit,
}: {
  open: boolean;
  worker: Worker | null;
  onClose: () => void;
  onSubmit: (w: Omit<Worker, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState(ROLES[1]);
  const [category, setCategory] = useState<Worker['category']>('Skilled');
  const [area, setArea] = useState('');
  const [attendance, setAttendance] = useState('');
  const [hours, setHours] = useState('');
  const [status, setStatus] = useState<Worker['status']>('Active');

  // reset when opened
  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(worker?.name ?? '');
      setRole(worker?.role ?? ROLES[1]);
      setCategory(worker?.category ?? 'Skilled');
      setArea(worker?.area ?? '');
      setAttendance(worker?.attendance != null ? String(worker.attendance) : '');
      setHours(worker?.hours != null ? String(worker.hours) : '');
      setStatus(worker?.status ?? 'Active');
    }
  }

  const valid = name.trim().length > 2;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={worker ? `Edit Worker — ${worker.name}` : 'Add Worker to Site'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!valid}
            onClick={() =>
              onSubmit({
                name,
                role,
                category,
                area,
                status,
                // Attendance / hours are recorded only when actually
                // entered — a blank field stays "not recorded" (null)
                // rather than being filled with an assumed figure.
                attendance: attendance.trim() === '' ? null : Math.min(100, Math.max(0, Number(attendance) || 0)),
                hours: hours.trim() === '' ? null : Math.max(0, Number(hours) || 0),
              })
            }
          >
            {worker ? 'Save Changes' : 'Add Worker'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mahesh Salunkhe" />
        </Field>
        <Field label="Role">
          <Select value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: r }))} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(v) => setCategory(v as Worker['category'])} options={['Skilled', 'Unskilled', 'Supervisor'].map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label="Assigned Area">
          <input className="input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Zone 1" />
        </Field>
        <Field label="Attendance (%)" hint="Leave blank if not recorded yet">
          <input className="input" type="number" min="0" max="100" value={attendance} onChange={(e) => setAttendance(e.target.value)} placeholder="Not recorded" />
        </Field>
        <Field label="Hours / Week" hint="Leave blank if not recorded yet">
          <input className="input" type="number" min="0" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Not recorded" />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(v) => setStatus(v as Worker['status'])} options={['Active', 'On Leave', 'Transferred'].map((v) => ({ value: v, label: v }))} />
        </Field>
      </div>
    </Modal>
  );
}

function ResourceModal({
  open,
  resource,
  onClose,
  onSubmit,
}: {
  open: boolean;
  resource: ResourceRow | null;
  onClose: () => void;
  onSubmit: (r: Omit<ResourceRow, 'id'>) => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ResourceRow['category']>('Machinery');
  const [qty, setQty] = useState('1');
  const [allocated, setAllocated] = useState('0');
  const [used, setUsed] = useState('0');
  const [unit, setUnit] = useState('nos.');
  const [status, setStatus] = useState<ResourceRow['status']>('Available');

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName(resource?.name ?? '');
      setCategory(resource?.category ?? 'Machinery');
      setQty(resource ? String(resource.qty) : '1');
      setAllocated(resource ? String(resource.allocated) : '0');
      setUsed(resource ? String(resource.used) : '0');
      setUnit(resource?.unit ?? 'nos.');
      setStatus(resource?.status ?? 'Available');
    }
  }

  const q = Number(qty) || 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resource ? `Edit Resource — ${resource.name}` : 'Add Resource to Site'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={name.trim().length < 3 || q <= 0}
            onClick={() =>
              onSubmit({
                name,
                category,
                qty: q,
                // On first entry the full quantity is allocated to the
                // project and nothing is consumed yet; when editing, the
                // recorded allocated/used figures are kept as entered.
                allocated: resource ? Math.max(0, Number(allocated) || 0) : q,
                used: resource ? Math.max(0, Number(used) || 0) : 0,
                unit,
                status,
              })
            }
          >
            {resource ? 'Save Changes' : 'Add Resource'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Resource Name" required>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vibratory Roller 10T" />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(v) => setCategory(v as ResourceRow['category'])} options={['Machinery', 'Equipment', 'Vehicles', 'Materials'].map((v) => ({ value: v, label: v }))} />
        </Field>
        <Field label="Quantity" required>
          <input className="input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Unit">
          <Select value={unit} onChange={setUnit} options={['nos.', 'MT', 'm³', 'bags', 'KL', 'm', 'sets', 'units'].map((v) => ({ value: v, label: v }))} />
        </Field>
        {resource && (
          <>
            <Field label="Allocated">
              <input className="input" type="number" min="0" value={allocated} onChange={(e) => setAllocated(e.target.value)} />
            </Field>
            <Field label="Used">
              <input className="input" type="number" min="0" value={used} onChange={(e) => setUsed(e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Status">
          <Select value={status} onChange={(v) => setStatus(v as ResourceRow['status'])} options={['Available', 'In Use', 'Low Stock', 'Idle'].map((v) => ({ value: v, label: v }))} />
        </Field>
      </div>
    </Modal>
  );
}
