import { create } from 'zustand';
import type { AgentId, AgentStatus } from '../data/agents';

/** Estado real de cada agente. En la Fase 1 no existe sistema de tareas: todos están disponibles y con 0 tareas. */
export interface AgentRuntime {
  status: AgentStatus;
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

interface OfficeState {
  runtime: Record<AgentId, AgentRuntime>;
  selectedId: AgentId | null;
  hoveredId: AgentId | null;
  soundOn: boolean;
  /** Se incrementa para pedir a la cámara que vuelva a la vista general. */
  resetViewTick: number;
  select: (id: AgentId | null) => void;
  hover: (id: AgentId | null) => void;
  toggleSound: () => void;
  resetView: () => void;
}

const idle = (): AgentRuntime => ({ status: 'disponible', pendingTasks: 0, runningTasks: 0, doneTasks: 0 });

export const useOfficeStore = create<OfficeState>((set) => ({
  runtime: { valeria: idle(), diego: idle(), sofia: idle() },
  selectedId: null,
  hoveredId: null,
  soundOn: readSoundPref(),
  resetViewTick: 0,
  select: (id) => set({ selectedId: id }),
  hover: (id) => set({ hoveredId: id }),
  toggleSound: () =>
    set((s) => {
      writeSoundPref(!s.soundOn);
      return { soundOn: !s.soundOn };
    }),
  resetView: () => set((s) => ({ selectedId: null, resetViewTick: s.resetViewTick + 1 })),
}));
