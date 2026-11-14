import * as THREE from 'three';

/** Texturas generadas en canvas: la oficina no depende de archivos ni de CDNs. */

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function finish(c: HTMLCanvasElement, repeat?: [number, number]) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

export function floorTexture() {
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#d9dde3';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#cfd4db';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  ctx.strokeStyle = 'rgba(100,116,139,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 128, 128);
  ctx.strokeRect(128, 128, 128, 128);
  ctx.strokeRect(128, 0, 128, 128);
  ctx.strokeRect(0, 128, 128, 128);
  return finish(c, [8, 5.5]);
}

export function rugTexture() {
  const { c, ctx } = makeCanvas(256, 128);
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 236, 108);
  ctx.strokeStyle = '#475569';
  for (let x = 24; x < 240; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, 108);
    ctx.stroke();
  }
  return finish(c);
}

export function signTexture() {
  const { c, ctx } = makeCanvas(1024, 256);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1024, 256);
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, '#a78bfa');
  grad.addColorStop(0.5, '#2dd4bf');
  grad.addColorStop(1, '#fbbf24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 236, 1024, 20);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '800 112px Inter, Segoe UI, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MI AGENCIA IA', 512, 110);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 34px Inter, Segoe UI, Arial, sans-serif';
  ctx.fillText('VIDEO · REDES SOCIALES · VENTAS', 512, 196);
  return finish(c);
}

/** Pantalla del monitor: muestra el estado REAL del agente, no actividad inventada. */
export function screenTexture(accent: string, title: string, statusLine: string) {
  const { c, ctx } = makeCanvas(320, 200);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 320, 28);
  ctx.fillStyle = '#0b1220';
  ctx.font = '700 16px Inter, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 12, 15);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statusLine, 160, 100);
  ctx.fillStyle = '#64748b';
  ctx.font = '500 13px Inter, Arial, sans-serif';
  ctx.fillText('Bandeja: 0 tareas', 160, 134);
  return finish(c);
}

export function windowTexture() {
  const { c, ctx } = makeCanvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#bfe3ff');
  g.addColorStop(0.65, '#e7f4ff');
  g.addColorStop(1, '#f6fbff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  // Siluetas de edificios lejanos
  ctx.fillStyle = 'rgba(148,163,184,0.45)';
  const blocks = [
    [0, 170, 40], [44, 140, 30], [78, 185, 46], [128, 120, 34], [166, 160, 42], [212, 135, 44],
  ];
  for (const [x, y, w] of blocks) ctx.fillRect(x, y, w, 256 - y);
  return finish(c);
}
