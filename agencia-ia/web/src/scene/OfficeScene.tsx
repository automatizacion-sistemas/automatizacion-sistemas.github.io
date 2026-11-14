import { useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { AGENTS, AGENT_BY_ID } from '../data/agents';
import { useOfficeStore } from '../store/useOfficeStore';
import { Room } from './Room';
import { Workstation } from './Workstation';

const OVERVIEW_TARGET = new THREE.Vector3(0, 0.9, -0.4);
const OVERVIEW_DIR = new THREE.Vector3(0.42, 0.62, 0.66).normalize();
const FOV = 35;
// Ejes de pantalla de la cámara (derecha y arriba) para encuadrar al agente fuera del panel.
const CAM_RIGHT = new THREE.Vector3(0, 1, 0).cross(OVERVIEW_DIR).normalize();
const CAM_UP = OVERVIEW_DIR.clone().cross(CAM_RIGHT).normalize();
/** Ancho de la oficina (m) que debe caber en pantalla en la vista general. */
const OFFICE_SPAN = 13.5;

function overviewDistanceFor(aspect: number) {
  const tanHalfV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const byWidth = OFFICE_SPAN / (2 * tanHalfV * aspect);
  return Math.min(48, Math.max(17, byWidth * 0.8));
}

/** Mueve la cámara con suavidad al seleccionar un agente o al volver a la vista general. */
function CameraRig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const selectedId = useOfficeStore((s) => s.selectedId);
  const resetTick = useOfficeStore((s) => s.resetViewTick);
  const anim = useRef<{ target: THREE.Vector3; pos: THREE.Vector3; t: number } | null>(null);

  const narrow = size.width < 768;
  const aspect = size.width / Math.max(1, size.height);
  const overviewDistance = overviewDistanceFor(aspect);

  const goTo = (target: THREE.Vector3, distance: number) => {
    anim.current = { target: target.clone(), pos: target.clone().addScaledVector(OVERVIEW_DIR, distance), t: 0 };
  };

  // Vista inicial
  useEffect(() => {
    camera.position.copy(OVERVIEW_TARGET).addScaledVector(OVERVIEW_DIR, overviewDistance);
    controls.current?.target.copy(OVERVIEW_TARGET);
    controls.current?.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) {
      const [x, , z] = AGENT_BY_ID[selectedId].desk.position;
      const agentPos = new THREE.Vector3(x, 1.1, z + 0.3);
      const distance = narrow ? Math.max(11, overviewDistance * 0.45) : 8.5;
      const visibleH = 2 * distance * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const target = agentPos.clone();
      if (narrow) {
        // En celular el panel es una hoja inferior: el agente queda en la parte alta de la pantalla.
        target.addScaledVector(CAM_UP, -visibleH * 0.27);
      } else {
        // En escritorio el panel ocupa la derecha: el agente queda a la izquierda del centro.
        target.addScaledVector(CAM_RIGHT, visibleH * aspect * 0.15);
      }
      goTo(target, distance);
    } else {
      goTo(OVERVIEW_TARGET, overviewDistance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, resetTick, narrow, overviewDistance]);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const cancel = () => {
      anim.current = null;
    };
    c.addEventListener('start', cancel);
    return () => c.removeEventListener('start', cancel);
  }, []);

  useFrame((_, delta) => {
    const a = anim.current;
    const c = controls.current;
    if (!a || !c) return;
    a.t = Math.min(1, a.t + delta / 1.1);
    const k = 1 - Math.pow(1 - a.t, 3);
    c.target.lerp(a.target, k * 0.25 + 0.02);
    camera.position.lerp(a.pos, k * 0.25 + 0.02);
    c.update();
    if (a.t >= 1 && camera.position.distanceTo(a.pos) < 0.02) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={5}
      maxDistance={50}
      minPolarAngle={0.35}
      maxPolarAngle={1.25}
      minAzimuthAngle={-0.4}
      maxAzimuthAngle={1.4}
    />
  );
}

export function OfficeScene() {
  const select = useOfficeStore((s) => s.select);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.1, far: 120, position: [8, 11, 12] }}
      gl={{ antialias: true }}
      onPointerMissed={(e) => {
        // Solo un clic en el "vacío" del lienzo cierra el panel; los clics en las etiquetas HTML no.
        if ((e.target as HTMLElement | null)?.tagName === 'CANVAS') select(null);
      }}
      aria-label="Oficina virtual en 3D con tres agentes"
    >
      <color attach="background" args={['#e9edf3']} />
      <fog attach="fog" args={['#e9edf3', 30, 60]} />

      <hemisphereLight args={['#ffffff', '#cbd5e1', 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-11}
        shadow-camera-right={11}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      {/* Luz que entra por las ventanas */}
      <directionalLight position={[-2, 5, -12]} intensity={0.5} color="#dbeafe" />

      <Room />
      {AGENTS.map((agent, i) => (
        <Workstation key={agent.id} agent={agent} index={i} />
      ))}

      <CameraRig />
    </Canvas>
  );
}
