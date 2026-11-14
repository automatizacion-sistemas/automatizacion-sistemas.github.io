import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentDefinition, AgentId } from '../data/agents';
import { api, sendChat, type Business, type ChatMessage } from '../lib/api';
import { useOfficeStore } from '../store/useOfficeStore';
import { playSound } from '../lib/sound';

const SUGGESTIONS: Record<AgentId, string[]> = {
  valeria: [
    'Propón 3 conceptos para un video de 30 segundos sobre nuestro servicio principal.',
    'Escribe un guion vertical de 20 segundos dividido en escenas.',
    'Redacta los prompts de imagen para cada escena del guion.',
  ],
  diego: [
    'Prepara una publicación para Instagram, Facebook y TikTok sobre nuestro servicio principal.',
    'Sugiere un calendario editorial de 2 semanas.',
    'Dame 15 hashtags relevantes para nuestro público.',
  ],
  sofia: [
    'Crea una oferta comercial para captar nuevos clientes este mes.',
    'Redacta un mensaje de WhatsApp de primer contacto (borrador).',
    'Prepara respuestas a las 5 objeciones más comunes de nuestros clientes.',
  ],
};

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* el navegador bloqueó el portapapeles */
        }
      }}
      className="rounded-lg px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      {done ? 'Copiado' : 'Copiar'}
    </button>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="md text-sm leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: ({ node: _node, ...p }) => <a {...p} target="_blank" rel="noreferrer" /> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export function AgentChat({ agent, business }: { agent: AgentDefinition; business: Business }) {
  const openModal = useOfficeStore((s) => s.openModal);
  const serverOnline = useOfficeStore((s) => s.serverOnline);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    setError(null);
    api
      .messages(agent.id, business.id)
      .then((r) => !cancelled && setMessages(r.messages))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [agent.id, business.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming !== null) return;
    setError(null);
    setInput('');
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: message,
      model: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...(m ?? []), optimistic]);
    setStreaming('');
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const final = await sendChat({
        agentId: agent.id,
        businessId: business.id,
        message,
        signal: ctrl.signal,
        onDelta: (d) => setStreaming((s) => (s ?? '') + d),
      });
      setMessages((m) => [...(m ?? []), final]);
    } catch (e) {
      // El servidor descarta el mensaje si no hubo respuesta: lo devolvemos al cuadro de texto.
      setMessages((m) => (m ?? []).filter((x) => x.id !== optimistic.id));
      setInput(message);
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        playSound('error');
      }
    } finally {
      setStreaming(null);
      abortRef.current = null;
    }
  };

  const clear = async () => {
    if (!window.confirm(`¿Borrar toda la conversación con ${agent.name} para "${business.name}"? No se puede deshacer.`)) return;
    try {
      await api.clearChat(agent.id, business.id);
      setMessages([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages === null && !error && <p className="text-sm text-slate-400">Cargando conversación…</p>}

        {messages?.length === 0 && streaming === null && (
          <div>
            <p className="text-sm text-slate-600">
              Conversa con {agent.name} sobre <strong className="font-semibold">{business.name}</strong>. Conoce la ficha del negocio.
            </p>
            <div className="mt-3 space-y-2">
              {SUGGESTIONS[agent.id].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="block w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-8 whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2.5 text-sm text-white">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="mr-2 rounded-2xl rounded-bl-md bg-slate-50 px-3.5 py-2.5">
              <Markdown text={m.content} />
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>
                  {m.outputTokens != null && `${m.outputTokens.toLocaleString('es-PE')} tokens`}
                  {m.costUsd != null && ` · ~US$ ${m.costUsd.toFixed(4)}`}
                </span>
                <CopyButton text={m.content} />
              </div>
            </div>
          ),
        )}

        {streaming !== null && (
          <div className="mr-2 rounded-2xl rounded-bl-md bg-slate-50 px-3.5 py-2.5">
            {streaming ? (
              <Markdown text={streaming} />
            ) : (
              <p className="text-sm text-slate-500">{agent.name} está pensando…</p>
            )}
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="mt-1.5 rounded-lg px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-200"
            >
              Detener
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
            {/clave|ANTHROPIC|configurad/i.test(error) && (
              <button type="button" onClick={() => openModal('integraciones')} className="ml-1 font-semibold underline">
                Ver integraciones
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={2}
            placeholder={`Escribe a ${agent.name}…`}
            disabled={serverOnline === false}
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming !== null || serverOnline === false}
            className="h-11 shrink-0 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>Enter envía · Shift+Enter nueva línea · cada respuesta consume tokens de tu cuenta</span>
          {!!messages?.length && streaming === null && (
            <button type="button" onClick={clear} className="font-medium hover:text-rose-600">
              Borrar conversación
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
