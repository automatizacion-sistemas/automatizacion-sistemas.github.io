import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import {
  CHANNELS,
  PRIORITIES,
  STAGES,
  crm,
  fillTemplate,
  whatsappLink,
  type Business,
  type Followup,
  type Prospect,
  type ProspectInput,
  type Stage,
  type Template,
} from '../lib/api';
import { Modal } from './Modal';

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
const btnPrimary = 'rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40';
const btnSecondary = 'rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? STAGES[0];
const priorityOf = (id: string) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[1];

function StageBadge({ stage }: { stage: string }) {
  const s = stageOf(stage);
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function FollowupBadge({ date, stage }: { date: string | null; stage: Stage }) {
  if (!date || stage === 'ganado' || stage === 'perdido') return <span className="text-xs text-slate-400">—</span>;
  const t = todayIso();
  const cls = date < t ? 'text-rose-700 font-semibold' : date === t ? 'text-amber-700 font-semibold' : 'text-slate-600';
  return (
    <span className={`whitespace-nowrap text-xs ${cls}`}>
      {date < t ? 'Vencido · ' : date === t ? 'Hoy · ' : ''}
      {fmtDate(date)}
    </span>
  );
}

// ---------------------------------------------------------------- Formulario de prospecto

const EMPTY: ProspectInput = {
  name: '',
  company: '',
  phone: '',
  email: '',
  service: '',
  contactDate: null,
  stage: 'nuevo',
  priority: 'tibio',
  nextFollowup: null,
  notes: '',
};

function ProspectForm({
  business,
  initial,
  onSaved,
  onCancel,
}: {
  business: Business;
  initial: Prospect | null;
  onSaved: (p: Prospect) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ProspectInput>(() => (initial ? { ...initial } : { ...EMPTY, contactDate: todayIso() }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProspectInput>(k: K, v: ProspectInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const services = useMemo(
    () =>
      business.products
        .split('\n')
        .map((s) => s.replace(/^[-•*\s]+/, '').trim())
        .filter(Boolean),
    [business.products],
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(initial ? await crm.updateProspect(initial.id, f) : await crm.createProspect(business.id, f));
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Nombre del prospecto *</span>
          <input className={`${inputCls} mt-1`} value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={160} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Empresa</span>
          <input className={`${inputCls} mt-1`} value={f.company} onChange={(e) => set('company', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Teléfono</span>
          <input
            className={`${inputCls} mt-1`}
            value={f.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="+51 987 654 321"
            inputMode="tel"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Correo</span>
          <input className={`${inputCls} mt-1`} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Servicio de interés</span>
          <input className={`${inputCls} mt-1`} list="crm-services" value={f.service} onChange={(e) => set('service', e.target.value)} />
          <datalist id="crm-services">
            {services.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Fecha de contacto</span>
          <input
            className={`${inputCls} mt-1`}
            type="date"
            value={f.contactDate ?? ''}
            onChange={(e) => set('contactDate', e.target.value || null)}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Estado comercial</span>
          <select className={`${inputCls} mt-1`} value={f.stage} onChange={(e) => set('stage', e.target.value as Stage)}>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Clasificación</span>
          <select className={`${inputCls} mt-1`} value={f.priority} onChange={(e) => set('priority', e.target.value as ProspectInput['priority'])}>
            {PRIORITIES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Próximo seguimiento</span>
          <input
            className={`${inputCls} mt-1`}
            type="date"
            value={f.nextFollowup ?? ''}
            onChange={(e) => set('nextFollowup', e.target.value || null)}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-slate-800">Observaciones</span>
        <textarea className={`${inputCls} mt-1`} rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Agregar prospecto'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Detalle: seguimientos y WhatsApp

function ProspectDetail({
  business,
  prospect,
  templates,
  onChanged,
  onDeleted,
  onBack,
}: {
  business: Business;
  prospect: Prospect;
  templates: Template[];
  onChanged: (p: Prospect) => void;
  onDeleted: (id: string) => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [followups, setFollowups] = useState<Followup[] | null>(null);
  const [fu, setFu] = useState({ date: todayIso(), channel: 'whatsapp', note: '', nextFollowup: '' });
  const [tplId, setTplId] = useState(templates[0]?.id ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    crm
      .followups(prospect.id)
      .then((r) => setFollowups(r.followups))
      .catch((e) => setError((e as Error).message));
  }, [prospect.id]);
  useEffect(load, [load]);

  useEffect(() => {
    const t = templates.find((x) => x.id === tplId);
    setMessage(t ? fillTemplate(t.body, prospect, business.name) : '');
  }, [tplId, templates, prospect, business.name]);

  const addFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Si no se indica un nuevo seguimiento, se conserva la fecha que ya tenía el prospecto.
      const { nextFollowup, ...rest } = fu;
      const updated = await crm.addFollowup(prospect.id, nextFollowup ? { ...rest, nextFollowup } : rest);
      onChanged(updated);
      setFu({ date: todayIso(), channel: 'whatsapp', note: '', nextFollowup: '' });
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const openWhatsapp = () => {
    const link = whatsappLink(prospect.phone, message);
    if ('error' in link) return setError(link.error);
    window.open(link.url, '_blank', 'noopener,noreferrer');
    void crm.whatsappOpened(prospect.id, templates.find((t) => t.id === tplId)?.name);
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar a ${prospect.name} y todos sus seguimientos? No se puede deshacer.`)) return;
    try {
      await crm.deleteProspect(prospect.id);
      onDeleted(prospect.id);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (editing)
    return (
      <div className="p-5 sm:p-6">
        <ProspectForm
          business={business}
          initial={prospect}
          onCancel={() => setEditing(false)}
          onSaved={(p) => {
            onChanged(p);
            setEditing(false);
          }}
        />
      </div>
    );

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <button type="button" onClick={onBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Volver a la lista
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <span className={`h-2.5 w-2.5 rounded-full ${priorityOf(prospect.priority).dot}`} title={priorityOf(prospect.priority).label} />
            {prospect.name}
          </h3>
          <p className="text-sm text-slate-600">
            {[prospect.company, prospect.service].filter(Boolean).join(' · ') || 'Sin empresa ni servicio'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {[prospect.phone, prospect.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
            Editar
          </button>
          <button type="button" onClick={remove} className="rounded-xl px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
            Eliminar
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">Estado</dt>
          <dd className="mt-0.5">
            <StageBadge stage={prospect.stage} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Clasificación</dt>
          <dd className="mt-0.5 font-medium text-slate-800">{priorityOf(prospect.priority).label}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Fecha de contacto</dt>
          <dd className="mt-0.5 text-slate-800">{fmtDate(prospect.contactDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Próximo seguimiento</dt>
          <dd className="mt-0.5">
            <FollowupBadge date={prospect.nextFollowup} stage={prospect.stage} />
          </dd>
        </div>
      </dl>
      {prospect.notes && <p className="whitespace-pre-wrap text-sm text-slate-700">{prospect.notes}</p>}

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Mensaje de WhatsApp</h4>
        <p className="mt-0.5 text-xs text-slate-600">
          Se abre WhatsApp en tu dispositivo con el texto listo. <strong>Nada se envía hasta que tú lo confirmes allí.</strong> Gratis.
        </p>
        {templates.length > 0 && (
          <select className={`${inputCls} mt-3`} value={tplId} onChange={(e) => setTplId(e.target.value)} aria-label="Plantilla">
            <option value="">Mensaje libre</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                Plantilla: {t.name}
              </option>
            ))}
          </select>
        )}
        <textarea
          className={`${inputCls} mt-2`}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={templates.length ? '' : 'Escribe el mensaje (o crea plantillas en la pestaña Plantillas).'}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openWhatsapp}
            disabled={!message.trim()}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            Abrir en WhatsApp
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(message).catch(() => undefined)}
            disabled={!message.trim()}
            className={btnSecondary}
          >
            Copiar texto
          </button>
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-slate-900">Registrar seguimiento</h4>
        <form onSubmit={addFollowup} className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs text-slate-500">
              Fecha
              <input type="date" className={`${inputCls} mt-0.5`} value={fu.date} onChange={(e) => setFu({ ...fu, date: e.target.value })} required />
            </label>
            <label className="block text-xs text-slate-500">
              Canal
              <select className={`${inputCls} mt-0.5`} value={fu.channel} onChange={(e) => setFu({ ...fu, channel: e.target.value })}>
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">
              Próximo seguimiento
              <input
                type="date"
                className={`${inputCls} mt-0.5`}
                value={fu.nextFollowup}
                onChange={(e) => setFu({ ...fu, nextFollowup: e.target.value })}
              />
            </label>
          </div>
          <textarea
            className={inputCls}
            rows={2}
            placeholder="¿Qué pasó? Ej.: Llamé, pidió propuesta para planillas."
            value={fu.note}
            onChange={(e) => setFu({ ...fu, note: e.target.value })}
            required
          />
          <button type="submit" disabled={saving || !fu.note.trim()} className={btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar seguimiento'}
          </button>
        </form>

        <ol className="mt-4 space-y-2">
          {followups?.length === 0 && <li className="text-sm text-slate-500">Todavía no hay seguimientos.</li>}
          {followups?.map((f) => (
            <li key={f.id} className="rounded-xl border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-500">
                {fmtDate(f.date)} · {CHANNELS.find((c) => c.id === f.channel)?.label ?? f.channel}
              </p>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{f.note}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Plantillas

function Templates({
  business,
  templates,
  onChange,
}: {
  business: Business;
  templates: Template[];
  onChange: (t: Template[]) => void;
}) {
  const [editing, setEditing] = useState<Template | 'nuevo' | null>(null);
  const [form, setForm] = useState({ name: '', body: '' });
  const [error, setError] = useState<string | null>(null);

  const start = (t: Template | 'nuevo') => {
    setEditing(t);
    setError(null);
    setForm(t === 'nuevo' ? { name: '', body: 'Hola {nombre}, te saluda el equipo de {negocio}. ' } : { name: t.name, body: t.body });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing === 'nuevo') {
        const t = await crm.createTemplate(business.id, form);
        onChange([...templates, t].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      } else if (editing) {
        const t = await crm.updateTemplate(editing.id, form);
        onChange(templates.map((x) => (x.id === t.id ? t : x)));
      }
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (t: Template) => {
    if (!window.confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await crm.deleteTemplate(t.id);
      onChange(templates.filter((x) => x.id !== t.id));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="space-y-4 p-5 sm:p-6">
      <p className="text-sm text-slate-600">
        Mensajes reutilizables para WhatsApp. Variables disponibles: <code className="rounded bg-slate-100 px-1">{'{nombre}'}</code>{' '}
        <code className="rounded bg-slate-100 px-1">{'{nombre_completo}'}</code> <code className="rounded bg-slate-100 px-1">{'{empresa}'}</code>{' '}
        <code className="rounded bg-slate-100 px-1">{'{servicio}'}</code> <code className="rounded bg-slate-100 px-1">{'{negocio}'}</code>
      </p>
      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {editing ? (
        <form onSubmit={save} className="space-y-2 rounded-2xl border border-slate-200 p-4">
          <input className={inputCls} placeholder="Nombre (ej.: Primer contacto)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <textarea className={inputCls} rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" className={btnPrimary}>
              Guardar plantilla
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => start('nuevo')} className={btnPrimary}>
          + Nueva plantilla
        </button>
      )}
      <ul className="space-y-2">
        {templates.length === 0 && !editing && <li className="text-sm text-slate-500">Aún no hay plantillas.</li>}
        {templates.map((t) => (
          <li key={t.id} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-900">{t.name}</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => start(t)} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  Editar
                </button>
                <button type="button" onClick={() => remove(t)} className="rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">
                  Eliminar
                </button>
              </div>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{t.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- Informe

function csvCell(v: string | number | null) {
  const s = v === null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function Report({ business, prospects }: { business: Business; prospects: Prospect[] }) {
  const summary = useOfficeStore((s) => s.crmSummary);
  const exportCsv = () => {
    const head = ['Nombre', 'Empresa', 'Teléfono', 'Correo', 'Servicio', 'Fecha de contacto', 'Estado', 'Clasificación', 'Próximo seguimiento', 'Seguimientos', 'Observaciones'];
    const rows = prospects.map((p) => [
      p.name,
      p.company,
      p.phone,
      p.email,
      p.service,
      p.contactDate,
      stageOf(p.stage).label,
      priorityOf(p.priority).label,
      p.nextFollowup,
      p.followupCount,
      p.notes,
    ]);
    // Punto y coma y BOM: Excel en español lo abre con columnas y tildes correctas.
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospectos-${business.name.replace(/[^\w]+/g, '-').toLowerCase()}-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!summary) return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  const max = Math.max(1, ...Object.values(summary.byStage));
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Prospectos', summary.total, 'text-slate-900'],
          ['Seguimientos vencidos', summary.overdue, summary.overdue ? 'text-rose-700' : 'text-slate-900'],
          ['Para hoy', summary.dueToday, summary.dueToday ? 'text-amber-700' : 'text-slate-900'],
          ['Próximos 7 días', summary.dueWeek, 'text-slate-900'],
        ].map(([label, n, cls]) => (
          <div key={label as string} className="rounded-2xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-2xl font-bold ${cls}`}>{n}</p>
          </div>
        ))}
      </div>
      <section>
        <h4 className="text-sm font-semibold text-slate-900">Embudo por estado</h4>
        <ul className="mt-2 space-y-1.5">
          {STAGES.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-sm">
              <span className="w-36 shrink-0 text-slate-600">{s.label}</span>
              <span className="h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
                <span
                  className="block h-full rounded-md bg-slate-800"
                  style={{ width: `${(summary.byStage[s.id] / max) * 100}%` }}
                />
              </span>
              <span className="w-8 text-right font-semibold tabular-nums text-slate-800">{summary.byStage[s.id]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          Tasa de cierre:{' '}
          <strong className="text-slate-900">
            {summary.winRate === null ? 'sin cierres todavía' : `${Math.round(summary.winRate * 100)} % (ganados sobre cerrados)`}
          </strong>
        </p>
      </section>
      <button type="button" onClick={exportCsv} disabled={!prospects.length} className={btnSecondary}>
        Descargar prospectos (Excel / CSV)
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- Ventana principal

type Tab = 'prospectos' | 'plantillas' | 'informe';

export function CrmModal() {
  const openModal = useOfficeStore((s) => s.openModal);
  const refreshSummary = useOfficeStore((s) => s.refreshCrmSummary);
  const business = useOfficeStore((s) => s.businesses.find((b) => b.id === s.activeBusinessId) ?? null);
  const [tab, setTab] = useState<Tab>('prospectos');
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [view, setView] = useState<{ kind: 'lista' } | { kind: 'nuevo' } | { kind: 'detalle'; id: string }>({ kind: 'lista' });
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<string>('');
  const [onlyDue, setOnlyDue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!business) return;
    setProspects(null);
    setView({ kind: 'lista' });
    Promise.all([crm.prospects(business.id), crm.templates(business.id)])
      .then(([p, t]) => {
        setProspects(p.prospects);
        setTemplates(t.templates);
      })
      .catch((e) => setError((e as Error).message));
    void refreshSummary();
  }, [business?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = todayIso();
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (prospects ?? []).filter(
      (p) =>
        (!stage || p.stage === stage) &&
        (!onlyDue || (p.nextFollowup && p.nextFollowup <= t && p.stage !== 'ganado' && p.stage !== 'perdido')) &&
        (!needle || [p.name, p.company, p.phone, p.email, p.service].some((v) => v.toLowerCase().includes(needle))),
    );
  }, [prospects, q, stage, onlyDue, t]);

  const upsert = (p: Prospect) => {
    setProspects((list) => {
      const l = list ?? [];
      return l.some((x) => x.id === p.id) ? l.map((x) => (x.id === p.id ? p : x)) : [p, ...l];
    });
    void refreshSummary();
  };

  if (!business)
    return (
      <Modal title="CRM comercial" onClose={() => openModal(null)}>
        <div className="p-6">
          <p className="text-sm text-slate-600">Primero registra un negocio: cada negocio tiene su propia cartera de prospectos.</p>
          <button type="button" onClick={() => openModal('negocios')} className={`${btnPrimary} mt-3`}>
            Registrar negocio
          </button>
        </div>
      </Modal>
    );

  const current = view.kind === 'detalle' ? prospects?.find((p) => p.id === view.id) : null;

  return (
    <Modal title="CRM comercial" subtitle={`${business.name} · gestionado por Sofía · gratuito y guardado en tu computadora`} onClose={() => openModal(null)} wide>
      <div role="tablist" className="sticky top-0 z-10 flex gap-1 border-b border-slate-200 bg-white px-4">
        {(
          [
            ['prospectos', 'Prospectos'],
            ['plantillas', 'Plantillas'],
            ['informe', 'Informe'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium ${
              tab === id ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="m-5 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {tab === 'plantillas' && <Templates business={business} templates={templates} onChange={setTemplates} />}
      {tab === 'informe' && <Report business={business} prospects={prospects ?? []} />}

      {tab === 'prospectos' && view.kind === 'nuevo' && (
        <div className="p-5 sm:p-6">
          <ProspectForm
            business={business}
            initial={null}
            onCancel={() => setView({ kind: 'lista' })}
            onSaved={(p) => {
              upsert(p);
              setView({ kind: 'detalle', id: p.id });
            }}
          />
        </div>
      )}

      {tab === 'prospectos' && view.kind === 'detalle' && current && (
        <ProspectDetail
          key={current.id}
          business={business}
          prospect={current}
          templates={templates}
          onChanged={upsert}
          onBack={() => setView({ kind: 'lista' })}
          onDeleted={(id) => {
            setProspects((l) => (l ?? []).filter((x) => x.id !== id));
            setView({ kind: 'lista' });
            void refreshSummary();
          }}
        />
      )}

      {tab === 'prospectos' && view.kind === 'lista' && (
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inputCls} max-w-xs`} placeholder="Buscar nombre, empresa, teléfono…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className={inputCls.replace('w-full', 'w-auto')} value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={onlyDue} onChange={(e) => setOnlyDue(e.target.checked)} className="rounded" />
              Seguimientos para hoy o vencidos
            </label>
            <button type="button" onClick={() => setView({ kind: 'nuevo' })} className={`${btnPrimary} ml-auto`}>
              + Nuevo prospecto
            </button>
          </div>

          {prospects === null && !error && <p className="mt-6 text-sm text-slate-500">Cargando…</p>}
          {prospects?.length === 0 && (
            <p className="mt-6 text-sm text-slate-500">Aún no hay prospectos para {business.name}. Agrega el primero.</p>
          )}
          {!!prospects?.length && filtered.length === 0 && <p className="mt-6 text-sm text-slate-500">Ningún prospecto coincide con el filtro.</p>}

          {filtered.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Prospecto</th>
                    <th className="px-3 py-2 font-medium">Servicio</th>
                    <th className="px-3 py-2 font-medium">Estado</th>
                    <th className="px-3 py-2 font-medium">Próximo seguimiento</th>
                    <th className="px-3 py-2 font-medium">Contacto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setView({ kind: 'detalle', id: p.id })}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${priorityOf(p.priority).dot}`} title={priorityOf(p.priority).label} />
                          <span>
                            <span className="block font-semibold text-slate-900">{p.name}</span>
                            {p.company && <span className="block text-xs text-slate-500">{p.company}</span>}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{p.service || '—'}</td>
                      <td className="px-3 py-2.5">
                        <StageBadge stage={p.stage} />
                      </td>
                      <td className="px-3 py-2.5">
                        <FollowupBadge date={p.nextFollowup} stage={p.stage} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{p.phone || p.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
