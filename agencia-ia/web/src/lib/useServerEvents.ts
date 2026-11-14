import { useEffect } from 'react';
import { useOfficeStore } from '../store/useOfficeStore';
import type { AgentId } from '../data/agents';
import type { ActivityEntry, AgentStatusPayload } from './api';
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
        if (wasOffline) store.loadBusinesses().catch(() => undefined);
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
        store.pushActivity(JSON.parse((e as MessageEvent).data) as ActivityEntry);
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
