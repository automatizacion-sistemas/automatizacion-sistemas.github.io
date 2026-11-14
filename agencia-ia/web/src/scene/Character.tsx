import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AgentLook } from '../data/agents';

interface Props {
  look: AgentLook;
  /** Desfase para que los tres personajes no se muevan sincronizados. */
  phase: number;
  highlighted: boolean;
  /** El servidor informa que el agente está ejecutando algo real: escribe sin pausas. */
  working: boolean;
}

/**
 * Personaje sentado, de estilo "bloque", mirando hacia +Z (hacia su teclado).
 * Las animaciones son ilustrativas: no representan la ejecución real de tareas.
 */
export function Character({ look, phase, highlighted, working }: Props) {
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + phase;
    const k = Math.min(1, delta * 6);
    if (!torso.current || !head.current || !armL.current || !armR.current) return;

    // Ciclo de 12 s: escribe, hace una pausa para estirarse y mirar alrededor, vuelve a escribir.
    const cycle = t % 12;
    const pausing = !reduced.current && !working && cycle > 8 && cycle < 10.6;
    const typing = !reduced.current && !pausing;

    // Respiración
    const breath = reduced.current ? 0 : Math.sin(t * 1.6) * 0.012;
    torso.current.scale.y = 1 + breath;

    // Brazos
    const baseArm = pausing ? -0.35 : -1.12;
    const tapL = typing ? Math.sin(t * (working ? 22 : 15)) * 0.07 : 0;
    const tapR = typing ? Math.sin(t * (working ? 22 : 15) + Math.PI) * 0.07 : 0;
    armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, baseArm + tapL, k);
    armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, baseArm + tapR, k);
    armL.current.rotation.z = THREE.MathUtils.lerp(armL.current.rotation.z, pausing ? 0.25 : 0.06, k);
    armR.current.rotation.z = THREE.MathUtils.lerp(armR.current.rotation.z, pausing ? -0.25 : -0.06, k);

    // Cabeza: mira la pantalla, en la pausa gira hacia los compañeros; si está resaltado mira a la cámara.
    let yaw = typing ? Math.sin(t * 0.7) * 0.06 : Math.sin((cycle - 8) * 2.2) * 0.6;
    let pitch = typing ? -0.12 + Math.sin(t * 2.3) * 0.02 : 0.05;
    if (highlighted && !working) {
      yaw = -0.45;
      pitch = 0.02;
    }
    head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, yaw, k);
    head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, pitch, k);

    // Ligero balanceo del torso en la pausa
    torso.current.rotation.x = THREE.MathUtils.lerp(torso.current.rotation.x, pausing ? -0.08 : 0.06, k * 0.6);
  });

  const skin = <meshStandardMaterial color={look.skin} roughness={0.7} />;
  const shirt = <meshStandardMaterial color={look.shirt} roughness={0.6} />;
  const pants = <meshStandardMaterial color={look.pants} roughness={0.8} />;
  const hair = <meshStandardMaterial color={look.hair} roughness={0.9} />;
  const dark = <meshStandardMaterial color="#111827" roughness={0.4} />;

  return (
    <group>
      {/* Cadera y piernas (sentado) */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[0.46, 0.16, 0.36]} />
        {pants}
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.58, 0.25]} castShadow>
            <boxGeometry args={[0.2, 0.16, 0.46]} />
            {pants}
          </mesh>
          <mesh position={[x, 0.33, 0.46]} castShadow>
            <boxGeometry args={[0.18, 0.5, 0.18]} />
            {pants}
          </mesh>
          <mesh position={[x, 0.05, 0.52]} castShadow>
            <boxGeometry args={[0.2, 0.1, 0.28]} />
            {dark}
          </mesh>
        </group>
      ))}

      {/* Torso, brazos y cabeza */}
      <group ref={torso} position={[0, 0.66, 0]}>
        <mesh position={[0, 0.28, 0]} castShadow>
          <boxGeometry args={[0.52, 0.56, 0.3]} />
          {shirt}
        </mesh>
        {/* Cuello de la camisa */}
        <mesh position={[0, 0.55, 0.06]}>
          <boxGeometry args={[0.24, 0.05, 0.2]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>

        {([
          [armL, -0.33],
          [armR, 0.33],
        ] as const).map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 0.48, 0]} rotation={[-1.12, 0, 0]}>
            <mesh position={[0, -0.19, 0]} castShadow>
              <boxGeometry args={[0.14, 0.4, 0.15]} />
              {shirt}
            </mesh>
            <mesh position={[0, -0.44, 0]} castShadow>
              <boxGeometry args={[0.12, 0.12, 0.12]} />
              {skin}
            </mesh>
          </group>
        ))}

        <group ref={head} position={[0, 0.6, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 12]} />
            {skin}
          </mesh>
          <mesh position={[0, 0.24, 0]} castShadow>
            <boxGeometry args={[0.38, 0.36, 0.34]} />
            {skin}
          </mesh>
          {/* Ojos */}
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 0.27, 0.172]}>
              <sphereGeometry args={[0.028, 10, 10]} />
              {dark}
            </mesh>
          ))}
          {/* Cejas */}
          {[-0.08, 0.08].map((x) => (
            <mesh key={`c${x}`} position={[x, 0.33, 0.172]}>
              <boxGeometry args={[0.08, 0.018, 0.01]} />
              {hair}
            </mesh>
          ))}
          {/* Sonrisa */}
          <mesh position={[0, 0.17, 0.172]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.05, 0.012, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#7f1d1d" roughness={0.6} />
          </mesh>
          {/* Mejillas */}
          {[-0.13, 0.13].map((x) => (
            <mesh key={`m${x}`} position={[x, 0.19, 0.171]}>
              <circleGeometry args={[0.03, 12]} />
              <meshStandardMaterial color="#f87171" transparent opacity={0.35} />
            </mesh>
          ))}

          {/* Cabello */}
          <mesh position={[0, 0.44, -0.01]} castShadow>
            <boxGeometry args={[0.41, 0.1, 0.38]} />
            {hair}
          </mesh>
          <mesh position={[0, 0.3, -0.16]} castShadow>
            <boxGeometry args={[0.41, 0.26, 0.08]} />
            {hair}
          </mesh>
          {look.hairStyle === 'largo' && (
            <>
              <mesh position={[0, 0.12, -0.18]} castShadow>
                <boxGeometry args={[0.42, 0.5, 0.08]} />
                {hair}
              </mesh>
              {[-0.2, 0.2].map((x) => (
                <mesh key={x} position={[x, 0.2, -0.02]} castShadow>
                  <boxGeometry args={[0.05, 0.38, 0.32]} />
                  {hair}
                </mesh>
              ))}
            </>
          )}
          {look.hairStyle === 'mono' && (
            <mesh position={[0, 0.42, -0.2]} castShadow>
              <sphereGeometry args={[0.1, 14, 14]} />
              {hair}
            </mesh>
          )}
          {look.hairStyle === 'corto' && (
            <mesh position={[0.06, 0.47, 0.1]} rotation={[0.2, 0, -0.1]} castShadow>
              <boxGeometry args={[0.3, 0.06, 0.16]} />
              {hair}
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
