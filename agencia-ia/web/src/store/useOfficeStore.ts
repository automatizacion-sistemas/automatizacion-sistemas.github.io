import { create } from 'zustand';
import type { AgentId, AgentStatus } from '../data/agents';
import { api, crm, type ActivityEntry, type AgentStatusPayload, type Business, type CrmSummary } from '../lib/api';

/** Estado REAL de cada agente, tal como lo informa el servidor. */
export interface AgentRuntime {
  status: AgentStatus;
  lastError: string | null;
  /** Bandeja de tareas: se llena a partir de la Fase 3. */
  pendingTasks: number;
  runningTasks: number;
  doneTasks: number;
}

const SOUND_KEY = 'mi-agencia-ia:sonido';

function readSoundPref(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSoundPref(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* almacenamiento no disponible: la preferencia dura solo esta sesión */
  }
}

export type Modal = 'negocios' | 'integraciones' | 'crm' | null;

interface OfficeState {
  runtime: Record<AgentId, AgentRuntime>;
  selectedId: AgentId | null;
  hoveredId: AgentId | null;
  soundOn: boolean;
  resetViewTick: number;
  serverOnline: boolean | null;
  businesses: Business[];
  activeBusinessId: string | null;
  businessesLoaded: boolean;
  modal: Modal;
  /** Última actividad recibida en vivo (para refrescar listas). */
  lastActivity: ActivityEntry | null;
  /** true si hay una clave de Claude configurada (asistente IA opcional, de pago). */
  aiEnabled: boolean | null;
  crmSummary: CrmSummary | null;

  setAiEnabled: (on: boolean) => void;
  refreshCrmSummary: () => Promise<void>;
  select: (id: AgentId | null) => void;
  hover: (id: AgentId | null) => void;
  toggleSound: () => void;
  resetView: () => void;
  openModal: (m: Modal) => void;
  setServerOnline: (on: boolean) => void;
  applyStatuses: (all: Partial<Record<AgentId, AgentStatusPayload>>) => void;
  pushActivity: (a: ActivityEntry) => void;
  loadBusinesses: () => Promise<void>;
  setActiveBusiness: (id: string) => Promise<void>;
  upsertBusiness: (b: Business) => void;
  removeBusiness: (id: string, nextActiveId: string | null) => void;
}

const idle = (): AgentRuntime => ({
  status: 'disponible',
  lastError: null,
  pendingTasks: 0,
  runningTasks: 0,
  doneTasks: 0,
});

export const useOfficeStore = create<OfficeState>((set, get) => ({
  runtime: { valeria: idle(), diego: idle(), sofia: idle() },
  selectedId: null,
  hoveredId: null,
  soundOn: readSoundPref(),
  resetViewTick: 0,
  serverOnline: null,
  businesses: [],
  activeBusinessId: null,
  businessesLoaded: false,
  modal: null,
  lastActivity: null,
  aiEnabled: null,
  crmSummary: null,

  setAiEnabled: (on) => set({ aiEnabled: on }),
  refreshCrmSummary: async () => {
    const id = get().activeBusinessId;
    if (!id) return set({ crmSummary: null });
    try {
      const summary = await crm.summary(id);
      if (get().activeBusinessId === id) set({ crmSummary: summary });
    } catch {
      /* servidor no disponible: se reintenta con el próximo evento */
    }
  },

  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  toggleSound: () =>
    set((s) => {
      writeSoundPref(!s.soundOn);
      return { soundOn: !s.soundOn };
    }),
  resetView: () => set((s) => ({ selectedId: null, resetViewTick: s.resetViewTick + 1 })),
  openModal: (m) => set({ modal: m }),
  setServerOnline: (on) => set({ serverOnline: on }),
  applyStatuses: (all) =>
    set((s) => {
      const runtime = { ...s.runtime };
      for (const [id, p] of Object.entries(all) as [AgentId, AgentStatusPayload][]) {
        if (runtime[id]) runtime[id] = { ...runtime[id], status: p.status, lastError: p.lastError };
      }
      return { runtime };
    }),
  pushActivity: (a) => set({ lastActivity: a }),
  loadBusinesses: async () => {
    const { businesses, activeId } = await api.businesses();
    set({ businesses, activeBusinessId: activeId, businessesLoaded: true });
  },
  setActiveBusiness: async (id) => {
    const prev = get().activeBusinessId;
    set({ activeBusinessId: id });
    try {
      await api.setActive(id);
    } catch (e) {
      set({ activeBusinessId: prev });
      throw e;
    }
  },
  upsertBusiness: (b) =>
    set((s) => {
      const exists = s.businesses.some((x) => x.id === b.id);
      const businesses = (exists ? s.businesses.map((x) => (x.id === b.id ? b : x)) : [...s.businesses, b]).sort((a, c) =>
        a.name.localeCompare(c.name, 'es'),
      );
      return { businesses, activeBusinessId: s.activeBusinessId ?? b.id };
    }),
  removeBusiness: (id, nextActiveId) =>
    set((s) => ({ businesses: s.businesses.filter((b) => b.id !== id), activeBusinessId: nextActiveId })),
}));
