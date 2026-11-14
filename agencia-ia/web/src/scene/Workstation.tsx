import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_DOT, STATUS_LABEL, type AgentDefinition } from '../data/agents';
import { useOfficeStore } from '../store/useOfficeStore';
import { playSound } from '../lib/sound';
import { Character } from './Character';
import { screenTexture } from './textures';

const WOOD = '#c8a27a';
const PANEL = '#e5e7eb';

interface Props {
  agent: AgentDefinition;
  index: number;
}

/** Puesto de trabajo: escritorio, monitor, silla, cubículo, lámpara y el personaje. */
export function Workstation({ agent, index }: Props) {
  const runtime = useOfficeStore((s) => s.runtime[agent.id]);
  const selected = useOfficeStore((s) => s.selectedId === agent.id);
  const hovered = useOfficeStore((s) => s.hoveredId === agent.id);
  const select = useOfficeStore((s) => s.select);
  const hover = useOfficeStore((s) => s.hover);
  const ring = useRef<THREE.Mesh>(null);

  const statusLine =
    runtime.status === 'disponible'
      ? 'Disponible'
      : runtime.status === 'trabajando'
        ? 'Respondiendo en el chat…'
        : runtime.status === 'error'
          ? 'Error · ver panel'
          : STATUS_LABEL[runtime.status];
  const screen = useMemo(
    () => screenTexture(agent.look.accent, agent.role.toUpperCase(), statusLine),
    [agent.look.accent, agent.role, statusLine],
  );
  useEffect(() => () => screen.dispose(), [screen]);

  useFrame((state) => {
    if (!ring.current) return;
    const m = ring.current.material as THREE.MeshBasicMaterial;
    const target = selected ? 0.55 : hovered ? 0.35 : 0;
    m.opacity = THREE.MathUtils.lerp(m.opacity, target, 0.15);
    const s = 1 + Math.sin(state.clock.elapsedTime * 3) * (selected ? 0.04 : 0);
    ring.current.scale.set(s, s, s);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(agent.id);
    playSound('abrir');
  };
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover(agent.id);
    document.body.style.cursor = 'pointer';
  };
  const onOut = () => {
    hover(null);
    document.body.style.cursor = '';
  };

  return (
    <group position={agent.desk.position}>
      {/* Lámpara colgante (fuera de la rotación para que quede alineada al techo) */}
      <group position={[0, 3.1, 0.35]}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 1, 6]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh>
          <coneGeometry args={[0.32, 0.28, 24, 1, true]} />
          <meshStandardMaterial color="#1e293b" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.3, 24]} />
          <meshBasicMaterial color="#fff7e0" />
        </mesh>
        <pointLight position={[0, -0.3, 0]} intensity={4} distance={4.2} decay={1.6} color="#ffe8c2" />
      </group>

      <group rotation={[0, agent.desk.rotationY, 0]} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
        {/* Anillo de selección */}
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.25]}>
          <ringGeometry args={[1.05, 1.2, 48]} />
          <meshBasicMaterial color={agent.look.accent} transparent opacity={0} depthWrite={false} />
        </mesh>

        {/* Alfombra de puesto */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.25]} receiveShadow>
          <circleGeometry args={[1.0, 40]} />
          <meshStandardMaterial color={agent.look.accent} transparent opacity={0.16} />
        </mesh>

        {/* Escritorio */}
        <mesh position={[0, 0.76, 0.72]} castShadow receiveShadow>
          <boxGeometry args={[1.7, 0.06, 0.82]} />
          <meshStandardMaterial color={WOOD} roughness={0.55} />
        </mesh>
        {[
          [-0.8, 0.38, 0.38],
          [0.8, 0.38, 0.38],
          [-0.8, 0.38, 1.06],
          [0.8, 0.38, 1.06],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.05, 0.76, 0.05]} />
            <meshStandardMaterial color="#475569" metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        {/* Cajonera */}
        <mesh position={[0.55, 0.36, 0.78]} castShadow>
          <boxGeometry args={[0.42, 0.66, 0.6]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
        </mesh>

        {/* Monitor (pantalla orientada al personaje) */}
        <group position={[0, 0.79, 1.0]}>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.3, 0.03, 0.2]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0.17, 0.02]}>
            <boxGeometry args={[0.05, 0.28, 0.04]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.86, 0.52, 0.05]} />
            <meshStandardMaterial color="#111827" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.42, -0.027]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[0.8, 0.46]} />
            <meshBasicMaterial map={screen} toneMapped={false} />
          </mesh>
        </group>

        {/* Teclado, ratón y taza */}
        <mesh position={[0, 0.8, 0.55]} castShadow>
          <boxGeometry args={[0.5, 0.025, 0.17]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <mesh position={[0.4, 0.8, 0.55]} castShadow>
          <boxGeometry args={[0.07, 0.025, 0.11]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <mesh position={[-0.6, 0.85, 0.75]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.12, 16]} />
          <meshStandardMaterial color={agent.look.accent} />
        </mesh>

        {/* Silla */}
        <group position={[0, 0, -0.08]}>
          <mesh position={[0, 0.48, 0]} castShadow>
            <boxGeometry args={[0.56, 0.08, 0.52]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.88, -0.27]} castShadow>
            <boxGeometry args={[0.52, 0.7, 0.07]} />
            <meshStandardMaterial color="#1f2937" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.42, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} roughness={0.3} />
          </mesh>
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.2, 0.04, Math.cos(a) * 0.2]} rotation={[0, a, 0]}>
                <boxGeometry args={[0.05, 0.04, 0.4]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
            );
          })}
        </group>

        {/* Paneles del cubículo */}
        <mesh position={[0, 0.6, 1.25]} castShadow receiveShadow>
          <boxGeometry args={[2.1, 1.2, 0.06]} />
          <meshStandardMaterial color={PANEL} roughness={0.85} />
        </mesh>
        <mesh position={[0, 1.22, 1.25]}>
          <boxGeometry args={[2.12, 0.04, 0.08]} />
          <meshStandardMaterial color={agent.look.accent} />
        </mesh>
        <mesh position={[-1.05, 0.55, 0.55]} castShadow receiveShadow>
          <boxGeometry args={[0.06, 1.1, 1.45]} />
          <meshStandardMaterial color={PANEL} roughness={0.85} />
        </mesh>

        {/* Personaje */}
        <group position={[0, 0, -0.1]}>
          <Character look={agent.look} phase={index * 3.7} highlighted={hovered || selected} working={runtime.status === 'trabajando'} />
        </group>
      </group>

      {/* Etiqueta con nombre y estado REAL */}
      <Html position={[0, 2.25, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <button
          type="button"
          onClick={() => {
            select(agent.id);
            playSound('abrir');
          }}
          onMouseEnter={() => hover(agent.id)}
          onMouseLeave={() => hover(null)}
          style={{ pointerEvents: 'auto' }}
          className={`agent-tag flex items-center gap-2 whitespace-nowrap rounded-full border bg-white/95 px-3 py-1.5 text-left shadow-md transition ${
            selected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-white hover:border-slate-300'
          }`}
          aria-label={`Abrir panel de ${agent.name}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[runtime.status]}`} aria-hidden />
          <span className="text-[13px] font-semibold leading-none text-slate-900">{agent.name}</span>
          <span className="text-[11px] leading-none text-slate-500">· {STATUS_LABEL[runtime.status]}</span>
        </button>
      </Html>
    </group>
  );
}
