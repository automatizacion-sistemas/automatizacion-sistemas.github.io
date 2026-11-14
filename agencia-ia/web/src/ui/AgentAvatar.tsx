import type { AgentDefinition } from '../data/agents';

/** Retrato plano del agente, con la misma paleta que su personaje 3D. */
export function AgentAvatar({ agent, size = 44 }: { agent: AgentDefinition; size?: number }) {
  const { skin, hair, shirt, hairStyle, accent } = agent.look;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <rect width="64" height="64" rx="16" fill={accent} opacity="0.25" />
      {hairStyle === 'largo' && <rect x="15" y="16" width="34" height="38" rx="6" fill={hair} />}
      <rect x="18" y="50" width="28" height="14" rx="4" fill={shirt} />
      <rect x="18" y="18" width="28" height="28" rx="6" fill={skin} />
      <rect x="17" y="14" width="30" height="9" rx="4" fill={hair} />
      {hairStyle === 'mono' && <circle cx="32" cy="11" r="6" fill={hair} />}
      {hairStyle === 'corto' && <rect x="26" y="12" width="20" height="6" rx="3" fill={hair} />}
      <circle cx="26" cy="31" r="2.2" fill="#111827" />
      <circle cx="38" cy="31" r="2.2" fill="#111827" />
      <path d="M27 38 Q32 42 37 38" stroke="#7f1d1d" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
