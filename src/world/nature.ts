import * as THREE from 'three';
import { M, box, cyl, mesh, strut } from './materials';
import { glowTexture, moonTexture, smokeTexture, stoneTexture, waterNormalTexture } from './textures';

/* ============================================================
   地形
   ============================================================ */

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function valueNoise(x: number, z: number) {
  return (
    Math.sin(x * 0.11 + 1.7) * Math.cos(z * 0.09 - 0.4) * 0.5 +
    Math.sin(x * 0.045 - z * 0.06) * 0.35 +
    Math.sin(x * 0.23 + z * 0.19 + 2.1) * 0.15
  );
}

/** 平地的边缘隆起为山，院内保持平整 */
export function terrainHeight(x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x) - 34);
  const dz = Math.max(0, z < -38 ? -38 - z : z > 50 ? z - 50 : 0);
  const d = Math.hypot(dx, dz);
  if (d <= 0) return 0;
  const t = smoothstep(0, 46, d);
  const hills = 9 + valueNoise(x * 0.6, z * 0.6) * 12 + smoothstep(10, 70, d) * 26;
  return t * hills;
}

export function createGround(): THREE.Mesh {
  const size = 340;
  const seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);
    const n = valueNoise(x * 2.3, z * 2.3);
    if (y > 10) c.setHSL(0.27, 0.13, 0.19 + n * 0.02);
    else if (y > 1.5) c.setHSL(0.24, 0.16, 0.24 + n * 0.03);
    else c.setHSL(0.22 + n * 0.015, 0.17, 0.28 + n * 0.035);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // 苔地与土斑
  const tex = stoneTexture('#7c7a68');
  tex.repeat.set(48, 48);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 1, metalness: 0, map: tex, color: '#b7c2a6',
  });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

/* ============================================================
   远山 / 云
   ============================================================ */

const sharedMats = {
  pineA: new THREE.MeshStandardMaterial({ color: '#3d5344', roughness: 1, flatShading: true }),
  pineB: new THREE.MeshStandardMaterial({ color: '#465c4a', roughness: 1, flatShading: true }),
  maple: ['#8f3f2e', '#a35033', '#7d3227', '#ad6039'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.94, flatShading: true })),
  crown: ['#bda95a', '#cbb86b', '#ac9647', '#d6c47c'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, flatShading: true })),
  lotus: new THREE.MeshStandardMaterial({ color: '#dca3a8', roughness: 0.75, side: THREE.DoubleSide }),
  lotusCore: new THREE.MeshStandardMaterial({ color: '#b08a4f', roughness: 0.6, metalness: 0.3 }),
  pad: new THREE.MeshStandardMaterial({ color: '#486b45', roughness: 0.8, side: THREE.DoubleSide }),
};

export function createMountains(): THREE.Group {
  const g = new THREE.Group();
  const ring = (count: number, radius: number, minH: number, maxH: number, color: string, opacity = 1, yOff = 0) => {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: 1, metalness: 0, flatShading: true, transparent: opacity < 1, opacity,
      fog: true,
    });
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const r = radius * (0.85 + Math.random() * 0.3);
      const h = minH + Math.random() * (maxH - minH);
      const w = h * (0.9 + Math.random() * 0.8);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(w, h, 5 + Math.floor(Math.random() * 3), 1), m);
      cone.position.set(Math.cos(a) * r, yOff + h / 2 - 8, Math.sin(a) * r);
      cone.rotation.y = Math.random() * Math.PI;
      cone.scale.z = 0.7 + Math.random() * 0.7;
      g.add(cone);
    }
  };
  ring(18, 155, 36, 68, '#61757a', 1, 0);
  ring(20, 116, 26, 50, '#455c59', 1, 0);
  ring(24, 88, 14, 32, '#354a44', 1, 0);
  return g;
}

export function createCloudSea(): THREE.Group {
  const g = new THREE.Group();
  const tex = smokeTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
    const r = 120 + Math.random() * 60;
    const m = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.2 + Math.random() * 0.12,
      depthWrite: false, color: '#e8e6da', fog: true,
    });
    const p = new THREE.Mesh(geo, m);
    p.position.set(Math.cos(a) * r, 10 + Math.random() * 14, Math.sin(a) * r);
    p.scale.set(60 + Math.random() * 50, 18 + Math.random() * 12, 1);
    p.lookAt(0, p.position.y, 0);
    p.userData.drift = 0.01 + Math.random() * 0.02;
    p.userData.base = p.position.clone();
    g.add(p);
  }
  return g;
}

/* ============================================================
   天空
   ============================================================ */

export type SkyUniforms = {
  uTop: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunColor: { value: THREE.Color };
  uSunDir: { value: THREE.Vector3 };
  uStars: { value: number };
  uTime: { value: number };
  uCloud: { value: number };
};

export function createSky(): { mesh: THREE.Mesh; uniforms: SkyUniforms } {
  const uniforms: SkyUniforms = {
    uTop: { value: new THREE.Color('#5f7181') },
    uHorizon: { value: new THREE.Color('#d9b28d') },
    uSunColor: { value: new THREE.Color('#ffbf7a') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.2, -0.9).normalize() },
    uStars: { value: 0 },
    uTime: { value: 0 },
    uCloud: { value: 0.5 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      varying vec3 vDir;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uStars;
      uniform float uCloud;
      uniform float uTime;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
                   mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise(p);
          p = p * 2.03 + 11.7;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float up = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, pow(up, 0.62));

        // 地平线暖光
        col += uSunColor * pow(max(0.0, 1.0 - up), 5.0) * 0.16;

        // 太阳/月亮
        float sd = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSunColor * pow(sd, 1400.0) * 2.4;
        col += uSunColor * pow(sd, 14.0) * 0.14;

        // 云：只在地平线以上
        if (d.y > 0.015) {
          vec2 cp = d.xz / (d.y + 0.22);
          float c1 = fbm(cp * 1.3 + vec2(uTime * 0.004, uTime * 0.0015));
          float c2 = fbm(cp * 2.7 - vec2(uTime * 0.0025, 0.0));
          float cloud = smoothstep(0.46, 0.8, c1 * 0.72 + c2 * 0.28);
          cloud *= smoothstep(0.015, 0.14, d.y) * (1.0 - smoothstep(0.72, 1.0, d.y) * 0.55);
          vec3 cloudCol = mix(uHorizon * 1.12, vec3(1.0, 0.96, 0.9), 0.42);
          col = mix(col, cloudCol, cloud * uCloud);
        }

        // 星星
        if (uStars > 0.001 && d.y > 0.03) {
          vec2 gp = d.xz / (d.y + 0.05) * 70.0;
          vec2 cell = floor(gp);
          float h = hash(cell);
          vec2 f = fract(gp) - 0.5;
          float star = smoothstep(0.13, 0.0, length(f)) * step(0.93, h);
          float tw = 0.65 + 0.35 * sin(uTime * 2.0 + h * 40.0);
          col += vec3(0.9, 0.94, 1.0) * star * tw * uStars * smoothstep(0.03, 0.3, d.y);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 40, 24), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

export function createSun(): THREE.Sprite {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonTexture(), transparent: true, opacity: 0.85, depthWrite: false, fog: false,
    color: '#ffd7a0', blending: THREE.AdditiveBlending,
  }));
  m.scale.setScalar(90);
  m.position.set(-160, 60, -180);
  return m;
}

export function createMoon(): THREE.Sprite {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonTexture(), transparent: true, opacity: 0, depthWrite: false, fog: false,
    color: '#ffffff',
  }));
  m.scale.setScalar(46);
  m.position.set(-90, 60, -150);
  return m;
}

/* ============================================================
   树木
   ============================================================ */

export function createGinkgo(scale = 1): {
  group: THREE.Group;
  ribbons: THREE.Object3D[];
  crown: THREE.Vector3;
} {
  const g = new THREE.Group();
  const bark = M.bark;
  // 主干
  g.add(strut(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 3.4, 0.1), 0.55, bark, 8));
  g.add(strut(new THREE.Vector3(0.3, 3.2, 0.1), new THREE.Vector3(0.7, 5.2, -0.1), 0.4, bark, 8));
  const ribbons: THREE.Object3D[] = [];
  const branchTips: THREE.Vector3[] = [];
  const branches = [
    [0.7, 4.2, -0.1, 2.9, 6.2, 1.3],
    [0.5, 4.6, 0.2, -2.7, 6.6, 1.5],
    [0.8, 4.9, 0, 0.6, 7.2, -2.4],
    [0.4, 4.0, 0.3, -1.4, 6.0, -2.2],
    [0.6, 5.0, 0, 3.2, 7.0, -1.4],
  ];
  for (const [x0, y0, z0, x1, y1, z1] of branches) {
    const a = new THREE.Vector3(x0, y0, z0);
    const b = new THREE.Vector3(x1, y1, z1);
    g.add(strut(a, b, 0.2, bark, 6));
    branchTips.push(b);
    // 小枝
    for (let i = 0; i < 3; i++) {
      const t = 0.45 + i * 0.18;
      const start = new THREE.Vector3().lerpVectors(a, b, t);
      const end = start.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2));
      g.add(strut(start, end, 0.07, bark, 5));
    }
  }
  // 树冠
  for (let i = 0; i < 9; i++) {
    const tip = branchTips[i % branchTips.length];
    const center = tip.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.5 + Math.random() * 1.2, (Math.random() - 0.5) * 2.2));
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 + Math.random() * 0.9, 1), sharedMats.crown[i % sharedMats.crown.length]);
    blob.position.copy(center);
    blob.scale.set(1.1, 0.8, 1.05);
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  // 扇形小叶
  const leafGeo = new THREE.CircleGeometry(0.16, 6, 0, Math.PI * 0.9);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#d9c36a', roughness: 0.95, side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 320);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 320; i++) {
    const tip = branchTips[i % branchTips.length];
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 2.9;
    dummy.position.set(tip.x + Math.cos(a) * r, tip.y + 0.2 + Math.random() * 2.2, tip.z + Math.sin(a) * r);
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    dummy.scale.setScalar(0.7 + Math.random() * 0.8);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
  }
  leaves.castShadow = false;
  g.add(leaves);

  // 红绸
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 2.0;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = 2.2 + Math.random() * 1.9;
    const ribbon = new THREE.Group();
    const cloth = mesh(new THREE.PlaneGeometry(0.1, 0.75), new THREE.MeshStandardMaterial({
      color: '#b23a2c', roughness: 0.9, side: THREE.DoubleSide,
    }), 0, -0.38, 0, false, false);
    cloth.rotation.y = Math.random() * Math.PI;
    ribbon.add(cloth);
    const tag = mesh(new THREE.PlaneGeometry(0.16, 0.22), M.paper, 0, -0.82, 0, false, false);
    tag.rotation.y = cloth.rotation.y;
    ribbon.add(tag);
    ribbon.position.set(x, y, z);
    ribbon.userData.phase = Math.random() * Math.PI * 2;
    ribbon.userData.noMerge = true;
    g.add(ribbon);
    ribbons.push(ribbon);
    // 系绳
    g.add(box(0.01, 0.2, 0.01, M.redDark, x, y + 0.1, z));
  }

  g.scale.setScalar(scale);
  return { group: g, ribbons, crown: new THREE.Vector3(0, 7.5 * scale, 0) };
}

export function createPine(scale = 1): THREE.Group {
  const g = new THREE.Group();
  const h = 6 * scale;
  g.add(cyl(0.18 * scale, 0.36 * scale, h * 0.62, 7, M.bark, 0, h * 0.31, 0));
  const layers = 4;
  for (let i = 0; i < layers; i++) {
    const y = h * (0.3 + i * 0.17);
    const r = (2.6 - i * 0.5) * scale;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(r, h * 0.28, 7, 1),
      i % 2 ? sharedMats.pineA : sharedMats.pineB,
    );
    cone.position.y = y + h * 0.12;
    cone.castShadow = true;
    g.add(cone);
  }
  return g;
}

export function createMaple(scale = 1): THREE.Group {
  const g = new THREE.Group();
  g.add(cyl(0.2 * scale, 0.34 * scale, 3.2 * scale, 7, M.bark, 0, 1.6 * scale, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const tip = new THREE.Vector3(Math.cos(a) * 1.6 * scale, (4 + Math.random()) * scale, Math.sin(a) * 1.6 * scale);
    g.add(strut(new THREE.Vector3(0, 2.6 * scale, 0), tip, 0.1 * scale, M.bark, 5));
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry((1.5 + Math.random() * 0.6) * scale, 1), sharedMats.maple[i]);
    blob.position.copy(tip).add(new THREE.Vector3(0, 0.5 * scale, 0));
    blob.scale.set(1.2, 0.8, 1.1);
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

export function createBamboo(center: THREE.Vector2, width: number, depth: number, count = 130): THREE.Group {
  const g = new THREE.Group();
  const stalkGeo = new THREE.CylinderGeometry(0.05, 0.065, 1, 5);
  stalkGeo.translate(0, 0.5, 0);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#6f7d4e', roughness: 0.9 });
  const stalks = new THREE.InstancedMesh(stalkGeo, stemMat, count);
  const leafGeo = new THREE.PlaneGeometry(0.09, 0.5);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#5d7047', roughness: 1, side: THREE.DoubleSide });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, count * 3);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const x = center.x + (Math.random() - 0.5) * width;
    const z = center.y + (Math.random() - 0.5) * depth;
    const h = 5 + Math.random() * 4;
    dummy.position.set(x, 0, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.12, Math.random() * Math.PI, (Math.random() - 0.5) * 0.12);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stalks.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 3; k++) {
      dummy.position.set(x + (Math.random() - 0.5) * 1.2, h * (0.55 + Math.random() * 0.4), z + (Math.random() - 0.5) * 1.2);
      dummy.rotation.set(Math.random() * 1.2 - 0.6, Math.random() * Math.PI, Math.random() * 1.2 - 0.6);
      dummy.scale.setScalar(0.8 + Math.random() * 1.4);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  }
  stalks.castShadow = true;
  g.add(stalks, leaves);
  return g;
}

export function createGrass(): THREE.InstancedMesh {
  const geo = new THREE.ConeGeometry(0.055, 0.26, 3);
  geo.translate(0, 0.13, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#5c6d4b', roughness: 1, flatShading: true });
  const count = 2200;
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let i = 0;
  let guard = 0;
  while (i < count && guard < count * 8) {
    guard++;
    const x = (Math.random() - 0.5) * 92;
    const z = (Math.random() - 0.5) * 110 + 4;
    if (Math.abs(x) < 22 && z > -30 && z < 45) continue;
    const inPond = (x / 12.5) ** 2 + ((z - 15) / 7) ** 2 < 1.1;
    if (inPond) continue;
    const y = terrainHeight(x, z);
    if (y > 6) continue;
    dummy.position.set(x, y, z);
    dummy.rotation.y = Math.random() * Math.PI;
    dummy.scale.setScalar(0.45 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(i++, dummy.matrix);
  }
  inst.count = i;
  inst.receiveShadow = true;
  return inst;
}

export function createRocks(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#6e6d60', roughness: 0.98, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 20 + Math.random() * 38;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 8;
    const s = 0.4 + Math.random() * 1.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
    rock.position.set(x, terrainHeight(x, z) + s * 0.25, z);
    rock.scale.set(1, 0.6 + Math.random() * 0.4, 1);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    rock.receiveShadow = true;
    g.add(rock);
  }
  return g;
}

/* ============================================================
   放生池
   ============================================================ */

export function createPond(rx = 12, rz = 6.6): {
  group: THREE.Group;
  water: THREE.Mesh;
  statics: THREE.Group;
  uniforms: Record<string, THREE.IUniform>;
  update: (dt: number, t: number) => void;
} {
  const g = new THREE.Group();
  const statics = new THREE.Group();
  statics.name = 'pondStatic';
  g.add(statics);
  const y = 0.14;

  const waterUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color('#132722') },
    uShallow: { value: new THREE.Color('#33513f') },
    uSky: { value: new THREE.Color('#8fa08e') },
    uSunDir: { value: new THREE.Vector3(0.3, 0.5, 0.6).normalize() },
    uSunColor: { value: new THREE.Color('#ffcf9a') },
    uFogColor: { value: new THREE.Color('#c2c6bb') },
    uFogDensity: { value: 0.008 },
  };
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormalW;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      varying vec3 vWorld;
      varying vec3 vNormalW;
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSky;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;

      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec2 p = vWorld.xz;
        float w1 = sin(p.x * 1.55 + uTime * 0.6) * sin(p.y * 1.2 - uTime * 0.42);
        float w2 = sin((p.x + p.y) * 2.4 + uTime * 1.05);
        float w3 = sin(p.x * 4.1 - uTime * 0.8) * 0.4;
        vec3 N = normalize(vec3(w1 * 0.06 + w2 * 0.025 + w3 * 0.015, 1.0, w2 * 0.05 - w1 * 0.035));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + 0.28 * w1 + 0.12 * w2);
        col = mix(col, uSky, clamp(fres * 0.34, 0.0, 0.45));
        float spec = pow(max(dot(reflect(-normalize(uSunDir), N), V), 0.0), 120.0);
        col += uSunColor * spec * 0.32;
        // 涟漪亮线
        float ripple = smoothstep(0.92, 1.0, sin(p.x * 3.1 + p.y * 2.3 + uTime * 1.4) * 0.5 + 0.5);
        col += vec3(0.14, 0.16, 0.13) * ripple * 0.1;
        float dist = length(cameraPosition - vWorld);
        float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uFogColor, clamp(f, 0.0, 0.9));
        gl_FragColor = vec4(col, 0.84);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const waterGeo = new THREE.CircleGeometry(1, 72);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, waterMat);
  water.scale.set(rx, 1, rz);
  water.position.y = y;
  water.renderOrder = 2;
  g.add(water);

  // 池底
  const bottom = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshStandardMaterial({ color: '#33402f', roughness: 1 }),
  );
  bottom.rotation.x = -Math.PI / 2;
  bottom.scale.set(rx * 0.98, rz * 0.98, 1);
  bottom.position.y = 0.02;
  bottom.receiveShadow = true;
  g.add(bottom);

  // 石沿
  const stoneMat = M.stone;
  const n = 52;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) < 0.16) continue;
    const px = Math.cos(a) * (rx + 0.42);
    const pz = Math.sin(a) * (rz + 0.42);
    const block = box(1.5, 0.34, 0.85, stoneMat, px, 0.17, pz);
    block.rotation.y = -a + Math.PI / 2;
    block.scale.z = 0.9 + Math.random() * 0.2;
    statics.add(block);
  }
  // 内侧矮壁
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(Math.cos(a)) < 0.16) continue;
    const block = box(1.3, 0.5, 0.25, M.stoneDark, Math.cos(a) * (rx - 0.05), -0.1, Math.sin(a) * (rz - 0.05));
    block.rotation.y = -a + Math.PI / 2;
    statics.add(block);
  }

  // 荷叶
  const padMat = sharedMats.pad;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 0.86;
    const px = Math.cos(a) * rx * r;
    const pz = Math.sin(a) * rz * r;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.3 + Math.random() * 0.38, 12, 0.3, Math.PI * 1.87), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.rotation.z = Math.random() * Math.PI;
    pad.position.set(px, y + 0.015 + Math.random() * 0.01, pz);
    statics.add(pad);
  }
  // 荷花
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 0.5;
    const flower = createLotusFlower();
    flower.position.set(Math.cos(a) * rx * r, y + 0.02, Math.sin(a) * rz * r);
    flower.scale.setScalar(0.75 + Math.random() * 0.5);
    statics.add(flower);
  }

  // 锦鲤
  const koi: { group: THREE.Group; phase: number; r: number; speed: number; y: number }[] = [];
  const koiColors = ['#c8622f', '#e0d6bb', '#d18a3a', '#8c3b2a', '#e8e2ca'];
  for (let i = 0; i < 9; i++) {
    const fish = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: koiColors[i % koiColors.length], roughness: 0.55 });
    const body = mesh(new THREE.SphereGeometry(0.11, 10, 7), bodyMat, 0, 0, 0, false, false);
    body.scale.set(1.7, 0.7, 0.55);
    fish.add(body);
    const tail = mesh(new THREE.ConeGeometry(0.1, 0.24, 5), bodyMat, -0.25, 0, 0, false, false);
    tail.rotation.z = Math.PI / 2;
    fish.add(tail);
    fish.position.y = 0.05;
    g.add(fish);
    koi.push({ group: fish, phase: Math.random() * Math.PI * 2, r: 0.35 + Math.random() * 0.55, speed: 0.06 + Math.random() * 0.1, y });
  }

  const update = (dt: number, t: number) => {
    waterUniforms.uTime.value = t;
    for (const f of koi) {
      f.phase += dt * f.speed;
      const px = Math.cos(f.phase) * rx * f.r;
      const pz = Math.sin(f.phase * 1.3) * rz * f.r;
      f.group.position.set(px, 0.06 + Math.sin(t * 0.8 + f.phase) * 0.02, pz);
      f.group.rotation.y = -f.phase + Math.PI / 2;
      const tail = f.group.children[1] as THREE.Mesh;
      tail.rotation.y = Math.sin(t * 6 + f.phase) * 0.5;
    }
  };

  return { group: g, water, statics, uniforms: waterUniforms, update };
}

export function createLotusFlower(): THREE.Group {
  const g = new THREE.Group();
  const petalMat = sharedMats.lotus;
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + ring * 0.4;
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4, 1, true), petalMat);
      petal.position.set(Math.cos(a) * 0.1, 0.08 + ring * 0.05, Math.sin(a) * 0.1);
      petal.rotation.set(Math.cos(a) * 0.65, 0, -Math.sin(a) * 0.65);
      g.add(petal);
    }
  }
  g.add(cyl(0.05, 0.06, 0.08, 6, sharedMats.lotusCore, 0, 0.1, 0));
  return g;
}

/* ============================================================
   粒子：香火、尘埃、萤火、落叶、雾
   ============================================================ */

export function createSmoke(origin: THREE.Vector3, count = 70): {
  points: THREE.Points; update: (dt: number, t: number) => void;
} {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const life = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.2;
    pos[i * 3 + 1] = origin.y + Math.random() * 2;
    pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;
    seed[i] = Math.random() * 10;
    life[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.85, map: smokeTexture(), transparent: true, opacity: 0.3,
    depthWrite: false, color: '#d8d4c6', sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 3;
  const update = (dt: number, t: number) => {
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      life[i] += dt * 0.12;
      if (life[i] > 1) {
        life[i] = 0;
        arr[i * 3] = origin.x + (Math.random() - 0.5) * 0.18;
        arr[i * 3 + 1] = origin.y;
        arr[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.18;
      }
      const l = life[i];
      arr[i * 3] += Math.sin(t * 0.6 + seed[i] + l * 5) * 0.0016;
      arr[i * 3 + 1] += dt * (0.3 + l * 0.3);
      arr[i * 3 + 2] += Math.cos(t * 0.45 + seed[i] * 1.3) * 0.0014;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.26 + Math.sin(t * 0.4) * 0.04;
  };
  return { points, update };
}

export function createDust(count = 260): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = 0.5 + Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 60 + 5;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.055, map: glowTexture(), transparent: true, opacity: 0.4,
    depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe6b8', sizeAttenuation: true,
  });
  const p = new THREE.Points(geo, mat);
  p.frustumCulled = false;
  return p;
}

export function createFireflies(count = 46): {
  points: THREE.Points; update: (dt: number, t: number) => void; material: THREE.PointsMaterial;
} {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 26;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.4 + Math.random() * 2.2;
    pos[i * 3 + 2] = Math.sin(a) * r + 8;
    phase[i] = Math.random() * Math.PI * 2;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.16, map: glowTexture(), transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending, color: '#d6f08a', sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  const base = pos.slice();
  const update = (dt: number, t: number) => {
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] = base[i * 3] + Math.sin(t * 0.3 + phase[i]) * 0.8;
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.55 + phase[i] * 1.7) * 0.5;
      arr[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.26 + phase[i]) * 0.8;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return { points, update, material: mat };
}

export function createFallingLeaves(center: THREE.Vector3, count = 70): {
  mesh: THREE.InstancedMesh; update: (dt: number, t: number) => void;
} {
  const geo = new THREE.CircleGeometry(0.09, 5, 0, Math.PI * 0.85);
  const mat = new THREE.MeshStandardMaterial({ color: '#d5bd63', roughness: 0.95, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  inst.frustumCulled = false;
  const data: { x: number; y: number; z: number; vy: number; ph: number; rot: number }[] = [];
  for (let i = 0; i < count; i++) {
    data.push({
      x: center.x + (Math.random() - 0.5) * 7,
      y: Math.random() * 8,
      z: center.z + (Math.random() - 0.5) * 7,
      vy: 0.25 + Math.random() * 0.35,
      ph: Math.random() * Math.PI * 2,
      rot: Math.random() * Math.PI,
    });
  }
  const dummy = new THREE.Object3D();
  const update = (dt: number, t: number) => {
    for (let i = 0; i < count; i++) {
      const d = data[i];
      d.y -= dt * d.vy;
      if (d.y < 0.05) {
        d.y = 7 + Math.random() * 2;
        d.x = center.x + (Math.random() - 0.5) * 7;
        d.z = center.z + (Math.random() - 0.5) * 7;
      }
      dummy.position.set(d.x + Math.sin(t * 0.7 + d.ph) * 0.7, d.y, d.z + Math.cos(t * 0.5 + d.ph) * 0.5);
      dummy.rotation.set(t * 0.8 + d.rot, d.ph + t * 0.4, Math.sin(t + d.ph) * 0.8);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  };
  return { mesh: inst, update };
}

export function createMist(count = 9): { group: THREE.Group; update: (dt: number, t: number) => void } {
  const group = new THREE.Group();
  const tex = smokeTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const items: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number }[] = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.1 + Math.random() * 0.08, depthWrite: false,
      color: '#dfe2d6', fog: true,
    });
    const m = new THREE.Mesh(geo, mat);
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 30;
    m.position.set(Math.cos(a) * r, 0.9 + Math.random() * 2.4, Math.sin(a) * r + 6);
    m.scale.set(24 + Math.random() * 28, 5 + Math.random() * 5, 1);
    m.userData.phase = Math.random() * 10;
    group.add(m);
    items.push({ mesh: m, base: m.position.clone(), phase: Math.random() * Math.PI * 2 });
  }
  const update = (_dt: number, t: number) => {
    for (const it of items) {
      it.mesh.position.x = it.base.x + Math.sin(t * 0.03 + it.phase) * 2.6;
      it.mesh.position.z = it.base.z + Math.cos(t * 0.024 + it.phase) * 1.8;
    }
  };
  // 始终面向相机
  group.userData.billboard = true;
  return { group, update };
}

/** 路径石板 */
export function createStonePath(points: [number, number][], width = 3.4): THREE.Group {
  const g = new THREE.Group();
  const mat = M.stone;
  for (let s = 0; s < points.length - 1; s++) {
    const [x0, z0] = points[s];
    const [x1, z1] = points[s + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    const count = Math.ceil(len / 0.85);
    const ang = Math.atan2(dx, dz);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = x0 + dx * t;
      const z = z0 + dz * t;
      const w = width * (0.92 + Math.random() * 0.1);
      const slab = box(w, 0.07, 0.78, mat, x, 0.045 + Math.random() * 0.012, z);
      slab.rotation.y = ang + (Math.random() - 0.5) * 0.06;
      slab.receiveShadow = true;
      slab.castShadow = false;
      g.add(slab);
    }
    // 两侧碎石
    for (let i = 0; i < count * 1.6; i++) {
      const t = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = x0 + dx * t + Math.cos(ang) * side * (width / 2 + 0.2 + Math.random() * 0.7);
      const z = z0 + dz * t - Math.sin(ang) * side * (width / 2 + 0.2 + Math.random() * 0.7);
      const pebble = mesh(new THREE.DodecahedronGeometry(0.08 + Math.random() * 0.1, 0), M.stoneDark, x, 0.04, z, false, true);
      pebble.scale.y = 0.4;
      g.add(pebble);
    }
  }
  return g;
}


export function createShrubs(): THREE.Group {
  const g = new THREE.Group();
  const mats = [
    new THREE.MeshStandardMaterial({ color: '#4d6044', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#596b4c', roughness: 1, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#6b6b4a', roughness: 1, flatShading: true }),
  ];
  const spots: [number, number, number][] = [
    [-15, 23, 1], [14, 21, 0.8], [-9, 30, 0.7], [9, 31, 0.9], [-16, 12, 0.8], [16, 14, 0.7],
    [-19, 5, 1.1], [19, 16, 0.8], [-14, -6, 0.7], [15, -6, 0.9], [-17, -26, 1], [17, -27, 0.8],
    [10, -32, 0.7], [-10, -32, 0.7], [30, 8, 0.9], [-30, 18, 1.0],
  ];
  for (const [x, z, s] of spots) {
    const bush = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry((0.45 + Math.random() * 0.4) * s, 1), mats[i % mats.length]);
      m.position.set((Math.random() - 0.5) * 0.8 * s, 0.35 * s + Math.random() * 0.25, (Math.random() - 0.5) * 0.8 * s);
      m.scale.y = 0.8;
      m.castShadow = true;
      m.receiveShadow = true;
      bush.add(m);
    }
    bush.position.set(x, terrainHeight(x, z), z);
    g.add(bush);
  }
  return g;
}

export function createFallenLeaves(center: THREE.Vector3, count = 260): THREE.InstancedMesh {
  const geo = new THREE.CircleGeometry(0.07, 5, 0, Math.PI * 0.85);
  const mat = new THREE.MeshStandardMaterial({ color: '#b6a04c', roughness: 0.95, side: THREE.DoubleSide });
  const inst = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 7;
    dummy.position.set(center.x + Math.cos(a) * r, 0.03, center.z + Math.sin(a) * r);
    dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 0.2, Math.random() * Math.PI, 0);
    dummy.scale.setScalar(0.7 + Math.random() * 0.8);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.receiveShadow = true;
  return inst;
}


export function createSkyClouds(): { group: THREE.Group; update: (dt: number, t: number, cam: THREE.Camera) => void } {
  const group = new THREE.Group();
  const tex = smokeTexture();
  const geo = new THREE.PlaneGeometry(1, 1);
  const items: { mesh: THREE.Mesh; base: THREE.Vector3; phase: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.16 + Math.random() * 0.1,
      depthWrite: false, color: i % 2 ? '#f0d6b2' : '#e8dcc8', fog: false,
    });
    const m = new THREE.Mesh(geo, mat);
    const a = -1.3 + Math.random() * 2.0;
    const r = 200 + Math.random() * 70;
    m.position.set(Math.sin(a) * r, 64 + Math.random() * 30, -Math.cos(a) * r);
    m.scale.set(120 + Math.random() * 90, 32 + Math.random() * 22, 1);
    m.lookAt(0, m.position.y, 0);
    m.userData.phase = Math.random() * Math.PI * 2;
    group.add(m);
    items.push({ mesh: m, base: m.position.clone(), phase: Math.random() * Math.PI * 2 });
  }
  const update = (_dt: number, t: number, cam: THREE.Camera) => {
    for (const it of items) {
      it.mesh.position.x = it.base.x + Math.sin(t * 0.008 + it.phase) * 4;
      it.mesh.lookAt(cam.position.x, it.mesh.position.y, cam.position.z);
    }
  };
  return { group, update };
}
