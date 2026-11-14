import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { floorTexture, rugTexture, signTexture, windowTexture } from './textures';

const W = 16; // ancho (x)
const D = 9.6; // fondo (z)
const H = 3.4; // alto de muros
const BACK_Z = -D / 2;
const LEFT_X = -W / 2;

type V3 = [number, number, number];

function Plant({ position, scale = 1 }: { position: V3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.17, 0.5, 16]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <icosahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial color="#4d9a5b" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[0.15, 1.1, 0.05]} castShadow>
        <icosahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color="#5fb36d" roughness={0.8} flatShading />
      </mesh>
      <mesh position={[-0.14, 1.02, -0.08]} castShadow>
        <icosahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color="#3f8a4d" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

function Window({ x }: { x: number }) {
  const tex = useMemo(() => windowTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);
  const w = 2.4;
  const h = 1.6;
  return (
    <group position={[x, 1.85, BACK_Z + 0.11]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Marco */}
      {[
        [0, h / 2, w + 0.1, 0.08],
        [0, -h / 2, w + 0.1, 0.08],
        [-w / 2, 0, 0.08, h],
        [w / 2, 0, 0.08, h],
        [0, 0, 0.05, h],
      ].map(([px, py, sx, sy], i) => (
        <mesh key={i} position={[px, py, 0.02]}>
          <boxGeometry args={[sx, sy, 0.06]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
      <mesh position={[0, -h / 2 - 0.06, 0.08]}>
        <boxGeometry args={[w + 0.2, 0.05, 0.2]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
    </group>
  );
}

function Clock() {
  const minute = useRef<THREE.Group>(null);
  const hour = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  // Grupo orientado hacia +X (el reloj cuelga del muro izquierdo); las agujas giran sobre su eje Z local.
  return (
    <group position={[LEFT_X + 0.12, 2.55, 0.4]} rotation={[0, Math.PI / 2, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <torusGeometry args={[0.3, 0.025, 8, 32]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <group ref={minute} position={[0, 0, 0.035]}>
        <mesh position={[0, 0.11, 0]}>
          <boxGeometry args={[0.012, 0.22, 0.012]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
      <group ref={hour} position={[0, 0, 0.045]}>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.022, 0.14, 0.012]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>
    </group>
  );
}

export function Room() {
  const floor = useMemo(() => floorTexture(), []);
  const rug = useMemo(() => rugTexture(), []);
  const sign = useMemo(() => signTexture(), []);
  useEffect(
    () => () => {
      floor.dispose();
      rug.dispose();
      sign.dispose();
    },
    [floor, rug, sign],
  );

  return (
    <group>
      {/* Piso tipo maqueta */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[W, 0.3, D]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floor} roughness={0.9} />
      </mesh>

      {/* Muros */}
      <mesh position={[0, H / 2, BACK_Z]} receiveShadow>
        <boxGeometry args={[W, H, 0.2]} />
        <meshStandardMaterial color="#eef1f5" roughness={0.95} />
      </mesh>
      <mesh position={[LEFT_X, H / 2, 0]} receiveShadow>
        <boxGeometry args={[0.2, H, D]} />
        <meshStandardMaterial color="#e6eaf0" roughness={0.95} />
      </mesh>
      {/* Zócalos */}
      <mesh position={[0, 0.06, BACK_Z + 0.11]}>
        <boxGeometry args={[W, 0.12, 0.03]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[LEFT_X + 0.11, 0.06, 0]}>
        <boxGeometry args={[0.03, 0.12, D]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      {/* Franja de color de marca en el muro */}
      <mesh position={[0, 1.0, BACK_Z + 0.105]}>
        <planeGeometry args={[W, 0.05]} />
        <meshBasicMaterial color="#6366f1" />
      </mesh>

      <Window x={-5.3} />
      <Window x={2.7} />

      {/* Letrero de la agencia */}
      <group position={[-1.3, 2.2, BACK_Z + 0.12]}>
        <mesh>
          <planeGeometry args={[2.9, 0.725]} />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>

      <Clock />

      {/* Estantería (muro izquierdo) */}
      <group position={[LEFT_X + 0.35, 0, -2.6]}>
        <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.45, 2.0, 1.6]} />
          <meshStandardMaterial color="#a47b55" roughness={0.7} />
        </mesh>
        {[0.45, 0.95, 1.45].map((y) => (
          <group key={y}>
            <mesh position={[0.05, y, 0]}>
              <boxGeometry args={[0.4, 0.04, 1.5]} />
              <meshStandardMaterial color="#8b6544" />
            </mesh>
            {[-0.55, -0.4, -0.25, 0.1, 0.25, 0.5].map((z, i) => (
              <mesh key={z} position={[0.1, y + 0.17, z]} castShadow>
                <boxGeometry args={[0.28, 0.3 - (i % 3) * 0.04, 0.1]} />
                <meshStandardMaterial color={['#6366f1', '#0d9488', '#d97706', '#e11d48', '#475569', '#7c3aed'][i]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      {/* Estación de café */}
      <group position={[LEFT_X + 0.45, 0, 2.7]}>
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.65, 0.9, 1.6]} />
          <meshStandardMaterial color="#f1f5f9" />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <boxGeometry args={[0.7, 0.05, 1.65]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 1.15, -0.35]} castShadow>
          <boxGeometry args={[0.35, 0.42, 0.32]} />
          <meshStandardMaterial color="#111827" metalness={0.3} roughness={0.4} />
        </mesh>
        {[0.15, 0.35].map((z) => (
          <mesh key={z} position={[0.05, 1.0, z]} castShadow>
            <cylinderGeometry args={[0.045, 0.04, 0.1, 12]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        ))}
      </group>

      {/* Sala de reuniones informal */}
      <group position={[5.6, 0, -3.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.5]} receiveShadow>
          <planeGeometry args={[3.2, 1.9]} />
          <meshStandardMaterial map={rug} roughness={1} />
        </mesh>
        {/* Sofá */}
        <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.4, 0.75]} />
          <meshStandardMaterial color="#4f46e5" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.65, -0.3]} castShadow>
          <boxGeometry args={[2.4, 0.5, 0.18]} />
          <meshStandardMaterial color="#4338ca" roughness={0.9} />
        </mesh>
        {[-1.15, 1.15].map((x) => (
          <mesh key={x} position={[x, 0.45, 0]} castShadow>
            <boxGeometry args={[0.18, 0.5, 0.75]} />
            <meshStandardMaterial color="#4338ca" roughness={0.9} />
          </mesh>
        ))}
        {/* Mesa de centro */}
        <mesh position={[0, 0.3, 1.0]} castShadow receiveShadow>
          <boxGeometry args={[1.2, 0.06, 0.6]} />
          <meshStandardMaterial color="#c8a27a" />
        </mesh>
        <mesh position={[0, 0.14, 1.0]}>
          <boxGeometry args={[1.0, 0.28, 0.4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* Cuadro */}
        <group position={[0, 1.95, -0.88]}>
          <mesh>
            <boxGeometry args={[1.5, 0.95, 0.04]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[-0.25, 0.05, 0.03]}>
            <circleGeometry args={[0.28, 32]} />
            <meshBasicMaterial color="#a78bfa" />
          </mesh>
          <mesh position={[0.3, -0.1, 0.031]}>
            <planeGeometry args={[0.55, 0.5]} />
            <meshBasicMaterial color="#2dd4bf" />
          </mesh>
          <mesh position={[0.1, 0.22, 0.032]}>
            <planeGeometry args={[0.5, 0.12]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </group>
      </group>

      {/* Plantas */}
      <Plant position={[LEFT_X + 0.6, 0, BACK_Z + 0.6]} scale={1.2} />
      <Plant position={[7.4, 0, BACK_Z + 0.55]} scale={1.1} />
      <Plant position={[LEFT_X + 0.55, 0, 4.1]} />
      <Plant position={[-2.2, 0, 2.4]} scale={0.85} />
      <Plant position={[2.2, 0, 2.4]} scale={0.85} />
      <Plant position={[-0.6, 0, BACK_Z + 0.5]} scale={0.8} />
    </group>
  );
}
