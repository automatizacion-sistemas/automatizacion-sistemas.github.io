import { create } from 'zustand';
import type { AgentId, AgentStatus } from '../data/agents';
import {
  api,
  calendar,
  crm,
  tasksApi,
  type ActivityEntry,
  type AgentStatusPayload,
  type Business,
  type CalendarSummary,
  type CrmSummary,
  type TasksSummary,
  type VideoRender,
} from '../lib/api';

/** Estado REAL de cada agente, tal como lo informa el servidor. */
export interface AgentRuntime {
  status: AgentStatus;
  lastError: string | null;
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

export type Modal = 'negocios' | 'integraciones' | 'crm' | 'calendario' | 'tareas' | 'nueva_tarea' | 'video' | null;

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
  calendarSummary: CalendarSummary | null;
  refreshCalendarSummary: () => Promise<void>;
  tasksSummary: TasksSummary | null;
  /** Último avance de exportación recibido del servidor. */
  lastRender: { projectId: string; render: VideoRender } | null;
  pushRender: (e: { projectId: string; render: VideoRender }) => void;
  /** Se incrementa cuando el servidor avisa que cambió el tablero. */
  tasksVersion: number;
  refreshTasks: () => Promise<void>;

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
  calendarSummary: null,
  tasksSummary: null,
  lastRender: null,
  pushRender: (e) => set({ lastRender: e }),
  tasksVersion: 0,
  refreshTasks: async () => {
    const id = get().activeBusinessId;
    set((st) => ({ tasksVersion: st.tasksVersion + 1 }));
    if (!id) return set({ tasksSummary: null });
    try {
      const summary = await tasksApi.summary(id);
      if (get().activeBusinessId === id) set({ tasksSummary: summary });
    } catch {
      /* servidor no disponible */
    }
  },
  refreshCalendarSummary: async () => {
    const id = get().activeBusinessId;
    if (!id) return set({ calendarSummary: null });
    try {
      const summary = await calendar.summary(id);
      if (get().activeBusinessId === id) set({ calendarSummary: summary });
    } catch {
      /* servidor no disponible */
    }
  },

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
