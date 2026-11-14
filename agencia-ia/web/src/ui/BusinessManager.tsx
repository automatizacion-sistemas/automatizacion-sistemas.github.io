import { useEffect, useMemo, useState } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import { api, type Business, type BusinessInput, type Socials } from '../lib/api';
import { Modal } from './Modal';
import { ImportButton, ImportFromClaude } from './ImportFromClaude';

const EMPTY: BusinessInput = {
  name: '',
  description: '',
  products: '',
  audience: '',
  goals: '',
  colors: ['#1e3a8a'],
  socials: {},
};

const SOCIAL_FIELDS: { key: keyof Socials; label: string; placeholder: string }[] = [
  { key: 'facebook', label: 'Facebook', placeholder: 'facebook.com/tu-pagina' },
  { key: 'instagram', label: 'Instagram', placeholder: '@tucuenta' },
  { key: 'tiktok', label: 'TikTok', placeholder: '@tucuenta' },
  { key: 'youtube', label: 'YouTube', placeholder: 'youtube.com/@tucanal' },
  { key: 'whatsapp', label: 'WhatsApp', placeholder: '+51 999 999 999' },
  { key: 'web', label: 'Sitio web', placeholder: 'https://…' },
];

export function BusinessLogo({ business, size = 40 }: { business: Business; size?: number }) {
  const [broken, setBroken] = useState(false);
  const color = business.colors[0] ?? '#334155';
  if (business.hasLogo && !broken)
    return (
      <img
        src={api.logoUrl(business)}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-xl border border-slate-200 bg-white object-contain"
        style={{ width: size, height: size }}
      />
    );
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      aria-hidden
    >
      {business.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {hint && <span className="ml-1 text-xs text-slate-400">{hint}</span>}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

function BusinessForm({
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  initial: Business | null;
  onSaved: (b: Business) => void;
  onCancel: () => void;
  onDeleted: (id: string, nextActiveId: string | null) => void;
}) {
  const [form, setForm] = useState<BusinessInput>(() =>
    initial
      ? {
          name: initial.name,
          description: initial.description,
          products: initial.products,
          audience: initial.audience,
          goals: initial.goals,
          colors: initial.colors.length ? initial.colors : ['#1e3a8a'],
          socials: { ...initial.socials },
        }
      : EMPTY,
  );
  const [logo, setLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [importing, setImporting] = useState(false);
  const [filled, setFilled] = useState(false);
  const logoPreview = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);
  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const set = <K extends keyof BusinessInput>(k: K, v: BusinessInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('El nombre comercial es obligatorio.');
    setSaving(true);
    setError(null);
    try {
      let saved = initial ? await api.updateBusiness(initial.id, form) : await api.createBusiness(form);
      if (logo) saved = await api.uploadLogo(saved.id, logo);
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setSaving(true);
    try {
      const res = await api.deleteBusiness(initial.id);
      onDeleted(initial.id, res.activeId);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-indigo-50/60 p-3 text-sm text-slate-700">
        <span className="flex-1">¿Ya describiste tu negocio en un chat o proyecto de Claude? Trae esa información aquí.</span>
        <ImportButton onClick={() => setImporting(true)} label="Completar con Claude" />
      </div>
      {filled && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Datos de Claude cargados en el formulario. Revísalos y pulsa {initial ? '"Guardar cambios"' : '"Crear negocio"'}.
        </p>
      )}
      {importing && (
        <ImportFromClaude
          kind="ficha"
          business={{ ...(initial ?? ({} as Business)), name: form.name || 'mi negocio' }}
          onClose={() => setImporting(false)}
          onFicha={(d) => {
            const x = d as Partial<BusinessInput>;
            setForm((f) => ({
              name: x.name || f.name,
              description: x.description || f.description,
              products: x.products || f.products,
              audience: x.audience || f.audience,
              goals: x.goals || f.goals,
              colors: x.colors?.length ? x.colors : f.colors,
              socials: { ...f.socials, ...(x.socials ?? {}) },
            }));
            setFilled(true);
          }}
        />
      )}
      <div className="flex items-center gap-4">
        {logoPreview ? (
          <img src={logoPreview} alt="" className="h-16 w-16 rounded-xl border border-slate-200 object-contain" />
        ) : initial ? (
          <BusinessLogo business={initial} size={64} />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
            Logo
          </span>
        )}
        <div className="text-sm">
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50">
            {initial?.hasLogo || logo ? 'Cambiar logotipo' : 'Subir logotipo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > 2 * 1024 * 1024) return setError('El logotipo supera los 2 MB.');
                setLogo(f);
              }}
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">PNG, JPG o WEBP · máx. 2 MB</p>
        </div>
      </div>

      <Field label="Nombre comercial *">
        <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={120} required />
      </Field>
      <Field label="Descripción">
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <Field label="Productos y servicios" hint="uno por línea, con precio si quieres">
        <textarea className={inputCls} rows={3} value={form.products} onChange={(e) => set('products', e.target.value)} />
      </Field>
      <Field label="Público objetivo">
        <textarea className={inputCls} rows={2} value={form.audience} onChange={(e) => set('audience', e.target.value)} />
      </Field>
      <Field label="Objetivos comerciales">
        <textarea className={inputCls} rows={2} value={form.goals} onChange={(e) => set('goals', e.target.value)} />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Colores corporativos</legend>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {form.colors.map((c, i) => (
            <span key={i} className="flex items-center gap-1 rounded-xl border border-slate-200 py-1 pl-1 pr-2">
              <input
                type="color"
                value={c}
                onChange={(e) => set('colors', form.colors.map((x, j) => (j === i ? e.target.value : x)))}
                className="h-7 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                aria-label={`Color ${i + 1}`}
              />
              <span className="font-mono text-xs text-slate-500">{c}</span>
              <button
                type="button"
                onClick={() => set('colors', form.colors.filter((_, j) => j !== i))}
                className="ml-1 text-slate-400 hover:text-rose-600"
                aria-label={`Quitar color ${c}`}
              >
                ×
              </button>
            </span>
          ))}
          {form.colors.length < 6 && (
            <button
              type="button"
              onClick={() => set('colors', [...form.colors, '#f59e0b'])}
              className="rounded-xl border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + Color
            </button>
          )}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-slate-800">Redes sociales</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {SOCIAL_FIELDS.map((s) => (
            <label key={s.key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs text-slate-500">{s.label}</span>
              <input
                className={inputCls}
                placeholder={s.placeholder}
                value={form.socials[s.key] ?? ''}
                onChange={(e) => set('socials', { ...form.socials, [s.key]: e.target.value })}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear negocio'}
        </button>
      </div>

      {initial && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="text-sm font-semibold text-rose-800">Eliminar negocio</p>
          <p className="mt-1 text-xs text-rose-700">
            Se borran su ficha, su logotipo y todas las conversaciones con los agentes. No se puede deshacer. Escribe{' '}
            <strong>{initial.name}</strong> para confirmar.
          </p>
          <div className="mt-2 flex gap-2">
            <input className={inputCls} value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} aria-label="Confirmar nombre" />
            <button
              type="button"
              disabled={confirmDelete.trim() !== initial.name || saving}
              onClick={remove}
              className="shrink-0 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

/** Gestión de negocios y clientes: cada uno con su ficha y sus conversaciones separadas. */
export function BusinessManager() {
  const businesses = useOfficeStore((s) => s.businesses);
  const activeId = useOfficeStore((s) => s.activeBusinessId);
  const openModal = useOfficeStore((s) => s.openModal);
  const upsert = useOfficeStore((s) => s.upsertBusiness);
  const removeBusiness = useOfficeStore((s) => s.removeBusiness);
  const setActive = useOfficeStore((s) => s.setActiveBusiness);
  const [editing, setEditing] = useState<Business | 'nuevo' | null>(businesses.length ? null : 'nuevo');

  return (
    <Modal
      title="Negocios y clientes"
      subtitle="Cada negocio tiene su propia ficha y sus propias conversaciones; nada se mezcla."
      onClose={() => openModal(null)}
    >
      {editing ? (
        <BusinessForm
          key={editing === 'nuevo' ? 'nuevo' : editing.id}
          initial={editing === 'nuevo' ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(b) => {
            upsert(b);
            setEditing(null);
          }}
          onDeleted={(id, next) => {
            removeBusiness(id, next);
            setEditing(null);
          }}
        />
      ) : (
        <div className="p-5 sm:p-6">
          {businesses.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay negocios registrados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              {businesses.map((b) => (
                <li key={b.id} className="flex items-center gap-3 p-3">
                  <BusinessLogo business={b} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{b.name}</p>
                    <p className="truncate text-xs text-slate-500">{b.description || 'Sin descripción'}</p>
                  </div>
                  {b.id === activeId ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">Activo</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActive(b.id)}
                      className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditing(b)}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setEditing('nuevo')}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Nuevo negocio
          </button>
        </div>
      )}
    </Modal>
  );
}
