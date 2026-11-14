import { useEffect } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import type { AgentId } from '../data/agents';
import { health, type ActivityEntry, type AgentStatusPayload } from './api';
import { playSound } from './sound';

/** Escucha el canal de eventos del servidor: estado real de los agentes y actividad. */
export function useServerEvents() {
  useEffect(() => {
    const store = useOfficeStore.getState();
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      es = new EventSource('/api/events');
      es.addEventListener('open', () => {
        const wasOffline = useOfficeStore.getState().serverOnline !== true;
        store.setServerOnline(true);
        if (wasOffline) {
          store
            .loadBusinesses()
            .then(() => Promise.all([store.refreshCrmSummary(), store.refreshCalendarSummary(), store.refreshTasks()]))
            .catch(() => undefined);
          health()
            .then((h) => store.setAiEnabled(h.ai))
            .catch(() => undefined);
        }
      });
      es.addEventListener('agent_statuses', (e) => {
        store.applyStatuses(JSON.parse((e as MessageEvent).data));
      });
      es.addEventListener('agent_status', (e) => {
        const p = JSON.parse((e as MessageEvent).data) as AgentStatusPayload & { agentId: AgentId };
        const prev = useOfficeStore.getState().runtime[p.agentId]?.status;
        store.applyStatuses({ [p.agentId]: p });
        if (prev === 'trabajando' && p.status === 'disponible') playSound('listo');
        if (p.status === 'error' && prev !== 'error') playSound('error');
      });
      es.addEventListener('activity', (e) => {
        const a = JSON.parse((e as MessageEvent).data) as ActivityEntry;
        store.pushActivity(a);
        if (a.agentId === 'sofia') void store.refreshCrmSummary();
        if (a.agentId === 'diego') void store.refreshCalendarSummary();
      });
      es.addEventListener('render', (e) => {
        const ev = JSON.parse((e as MessageEvent).data);
        const prev = useOfficeStore.getState().lastRender;
        store.pushRender(ev);
        if (ev.render.status === 'listo' && !(prev?.render.id === ev.render.id && prev?.render.status === 'listo')) playSound('listo');
      });
      es.addEventListener('tasks_changed', (e) => {
        const { businessId } = JSON.parse((e as MessageEvent).data) as { businessId: string };
        if (businessId === useOfficeStore.getState().activeBusinessId) void store.refreshTasks();
      });
      es.addEventListener('error', () => {
        store.setServerOnline(false);
        es?.close();
        if (!closed) retry = setTimeout(connect, 3000);
      });
    };
    connect();
    return () => {
      closed = true;
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, []);
}
