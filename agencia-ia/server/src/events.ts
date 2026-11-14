import type { ServerResponse } from 'node:http';

/** Canal de eventos en vivo (Server-Sent Events) hacia la interfaz. */
const clients = new Set<ServerResponse>();

export function addClient(res: ServerResponse) {
  clients.add(res);
  res.on('close', () => clients.delete(res));
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

// Mantiene vivas las conexiones a través de proxies.
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25_000).unref();
