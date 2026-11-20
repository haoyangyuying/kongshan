import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, alpha = 0.05, seed = 1) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < amount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = rand() * 2.2 + 0.3;
    const v = rand() * 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * (0.3 + rand())})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 青瓦：竖向瓦垄 + 横向叠瓦 */
export function roofTexture(): THREE.Texture {
  const key = 'roof';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#4b504c';
  ctx.fillRect(0, 0, 512, 512);
  // 瓦垄
  for (let x = 0; x < 512; x += 22) {
    const g = ctx.createLinearGradient(x, 0, x + 22, 0);
    g.addColorStop(0, 'rgba(14,17,16,0.55)');
    g.addColorStop(0.28, 'rgba(110,118,112,0.32)');
    g.addColorStop(0.5, 'rgba(150,158,150,0.18)');
    g.addColorStop(0.72, 'rgba(70,76,72,0.2)');
    g.addColorStop(1, 'rgba(10,13,12,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 22, 512);
  }
  // 横向瓦缝
  for (let y = 0; y < 512; y += 54) {
    ctx.fillStyle = 'rgba(12,15,14,0.28)';
    ctx.fillRect(0, y, 512, 3);
    ctx.fillStyle = 'rgba(190,196,186,0.06)';
    ctx.fillRect(0, y + 3, 512, 2);
  }
  noise(ctx, 512, 512, 4200, 0.06, 7);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

export function plasterTexture(): THREE.Texture {
  const key = 'plaster';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#e3dccb';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 12 + Math.random() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,138,112,${0.02 + Math.random() * 0.05})`);
    g.addColorStop(1, 'rgba(150,138,112,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  noise(ctx, 256, 256, 2400, 0.07, 13);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function woodTexture(base = '#5b2f26'): THREE.Texture {
  const key = 'wood' + base;
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(128, 512);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * 128;
    ctx.strokeStyle = `rgba(20,10,8,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 512; y += 32) ctx.lineTo(x + Math.sin(y * 0.02 + i) * 2.2, y);
    ctx.stroke();
  }
  noise(ctx, 128, 512, 1200, 0.05, 21);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function stoneTexture(base = '#8c8b7e'): THREE.Texture {
  const key = 'stone' + base;
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 3 + Math.random() * 26;
    ctx.fillStyle = `rgba(${40 + Math.random() * 40},${42 + Math.random() * 40},${38 + Math.random() * 36},${0.02 + Math.random() * 0.07})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  noise(ctx, 256, 256, 3000, 0.09, 33);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** 棂窗 / 格扇 */
export function latticeTexture(paper = '#e8dec8', wood = '#4a2c22'): THREE.Texture {
  const key = 'lattice' + paper + wood;
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(256, 384);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 256, 384);
  ctx.strokeStyle = wood;
  ctx.lineWidth = 5;
  // 外框
  ctx.strokeRect(8, 8, 240, 368);
  ctx.lineWidth = 3;
  // 冰裂纹 + 方格
  for (let y = 32; y < 360; y += 44) {
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(244, y);
    ctx.stroke();
  }
  for (let x = 32; x < 240; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, 372);
    ctx.stroke();
  }
  ctx.lineWidth = 2;
  for (let y = 54; y < 360; y += 88) {
    for (let x = 56; x < 240; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x - 22, y - 20);
      ctx.lineTo(x + 22, y + 20);
      ctx.moveTo(x + 22, y - 20);
      ctx.lineTo(x - 22, y + 20);
      ctx.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** 匾额/楹联 */
export function plaqueTexture(
  text: string,
  opts: { bg?: string; fg?: string; border?: string; vertical?: boolean; sub?: string } = {},
): THREE.Texture {
  const vertical = opts.vertical ?? false;
  const chars = [...text];
  const w = vertical ? 128 : Math.max(256, chars.length * 96 + 64);
  const h = vertical ? Math.max(256, chars.length * 92 + 52) : 160;
  const { c, ctx } = makeCanvas(w, h);
  ctx.fillStyle = opts.bg ?? '#22302c';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = opts.border ?? '#b08a4f';
  ctx.lineWidth = 5;
  ctx.strokeRect(9, 9, w - 18, h - 18);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.fillStyle = opts.fg ?? '#e8cf9a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${vertical ? 64 : 80}px "Songti SC", "STSong", "Noto Serif SC", serif`;
  if (vertical) {
    const gap = (h - 60) / chars.length;
    chars.forEach((ch, i) => ctx.fillText(ch, w / 2, 32 + gap * (i + 0.5)));
  } else {
    const gap = (w - 60) / chars.length;
    chars.forEach((ch, i) => ctx.fillText(ch, 30 + gap * (i + 0.5), h / 2 - (opts.sub ? 8 : 0)));
  }
  if (opts.sub) {
    ctx.font = '20px "Songti SC", serif';
    ctx.fillStyle = 'rgba(232,207,154,0.6)';
    ctx.fillText(opts.sub, w / 2, h - 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(keyOf(text, opts), t);
  return t;
}

function keyOf(text: string, opts: object) {
  return 'plaque' + text + JSON.stringify(opts);
}

/** 大殿背屏：千佛龛 */
export function thousandBuddhaTexture(): THREE.Texture {
  const key = 'thousand';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(512, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#252a24');
  g.addColorStop(0.5, '#31362c');
  g.addColorStop(1, '#1d211c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  // 小佛龛
  for (let y = 24; y < 512; y += 52) {
    for (let x = 24; x < 512; x += 52) {
      const off = (Math.floor(y / 52) % 2) * 26;
      const cx = x + off;
      ctx.strokeStyle = 'rgba(190,160,105,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, y, 13, Math.PI, 0);
      ctx.lineTo(cx + 13, y + 16);
      ctx.lineTo(cx - 13, y + 16);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,170,112,0.1)';
      ctx.beginPath();
      ctx.arc(cx, y + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const glow = ctx.createRadialGradient(256, 240, 20, 256, 240, 320);
  glow.addColorStop(0, 'rgba(255,206,130,0.16)');
  glow.addColorStop(1, 'rgba(255,206,130,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function glowTexture(): THREE.Texture {
  const key = 'glow';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,238,196,1)');
  g.addColorStop(0.18, 'rgba(255,214,145,0.72)');
  g.addColorStop(0.46, 'rgba(255,183,96,0.22)');
  g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function smokeTexture(): THREE.Texture {
  const key = 'smoke';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(235,232,222,0.55)');
  g.addColorStop(0.4, 'rgba(225,222,212,0.2)');
  g.addColorStop(1, 'rgba(220,218,208,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function moonTexture(): THREE.Texture {
  const key = 'moon';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,252,238,1)');
  g.addColorStop(0.32, 'rgba(250,246,228,0.96)');
  g.addColorStop(0.36, 'rgba(220,228,240,0.24)');
  g.addColorStop(0.7, 'rgba(200,214,230,0.06)');
  g.addColorStop(1, 'rgba(200,214,230,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

export function waterNormalTexture(): THREE.Texture {
  const key = 'water';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 8 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(160,160,160,0.35)');
    g.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  cache.set(key, t);
  return t;
}


export function pavingTexture(): THREE.Texture {
  const key = 'paving';
  if (cache.has(key)) return cache.get(key)!;
  const { c, ctx } = makeCanvas(512, 512);
  ctx.fillStyle = '#8d8b7b';
  ctx.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 64 : 0;
    for (let col = -1; col < 4; col++) {
      const x = col * 128 + off;
      const y = row * 128;
      const shade = 118 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${shade},${shade + 1},${shade - 10})`;
      ctx.fillRect(x + 3, y + 3, 122, 122);
      ctx.strokeStyle = 'rgba(50,50,42,0.24)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3, y + 3, 122, 122);
      // 石面颗粒
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = `rgba(60,58,48,${Math.random() * 0.08})`;
        ctx.fillRect(x + 6 + Math.random() * 114, y + 6 + Math.random() * 114, 1.5, 1.5);
      }
    }
  }
  noise(ctx, 512, 512, 3200, 0.06, 41);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}
