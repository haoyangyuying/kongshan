import * as THREE from 'three';
import { DEFAULT_MONK, createMonk, poseMonk, type MonkRig, type PoseState } from '../world/monk';
import { M, cyl, mesh } from '../world/materials';

export type ActionName = 'bow' | 'palms' | 'knock' | 'strike' | 'incense' | 'lantern';

export class Player {
  rig: MonkRig;
  pos = new THREE.Vector3();
  yaw = Math.PI;
  speed = 2.55;
  moving = false;
  sitting = false;
  action: ActionName | null = null;
  chanting = false;
  strikeKind: 'bell' | 'drum' = 'bell';
  private actionT = 0;
  private actionDur = 0;
  private onEnd: (() => void) | null = null;
  private walkPhase = 0;
  private target: THREE.Vector3 | null = null;
  private input = new THREE.Vector2();
  private targetYaw = Math.PI;
  private stepAccum = 0;
  private chantPulse = 0;
  lamp: THREE.Group;
  lampLight: THREE.PointLight;
  onStep: (() => void) | null = null;

  constructor(start: THREE.Vector3) {
    this.rig = createMonk(DEFAULT_MONK);
    this.pos.copy(start);
    this.rig.root.position.copy(start);
    this.rig.root.rotation.y = this.yaw;
    this.targetYaw = this.yaw;

    // 夜里的小灯笼
    this.lamp = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(0.16, 12, 10), M.lanternPaper, 0, -0.14, 0, false, false);
    body.scale.y = 1.25;
    this.lamp.add(body);
    this.lamp.add(cyl(0.055, 0.07, 0.04, 8, M.goldDark, 0, 0.02, 0));
    this.lamp.add(cyl(0.07, 0.055, 0.04, 8, M.goldDark, 0, -0.28, 0));
    this.lamp.add(mesh(new THREE.TorusGeometry(0.05, 0.01, 4, 10), M.woodDark, 0, 0.07, 0, false, false));
    this.lampLight = new THREE.PointLight('#ffbe78', 0, 7, 2);
    this.lampLight.position.set(0, -0.12, 0);
    this.lamp.add(this.lampLight);
    this.lamp.position.set(0.02, -0.34, 0.06);
    this.lamp.visible = false;
    this.rig.handL.add(this.lamp);
  }

  setLamp(on: boolean) {
    this.lamp.visible = on;
    this.lampLight.intensity = on ? 5.5 : 0;
  }

  get busy() {
    return this.action !== null;
  }

  get position() {
    return this.pos;
  }

  setMoveInput(x: number, z: number) {
    this.input.set(x, z);
    if (x !== 0 || z !== 0) this.target = null;
  }

  moveTo(x: number, z: number) {
    if (this.busy || this.sitting) return;
    this.target = new THREE.Vector3(x, 0, z);
  }

  stop() {
    this.target = null;
    this.input.set(0, 0);
  }

  playAction(name: ActionName, duration: number, onEnd?: () => void) {
    if (this.sitting) return;
    this.action = name;
    this.actionT = 0;
    this.actionDur = duration;
    this.onEnd = onEnd ?? null;
    this.target = null;
    this.input.set(0, 0);
  }

  sitAt(x: number, z: number, yaw: number) {
    this.target = null;
    this.chanting = false;
    this.input.set(0, 0);
    this.action = null;
    this.sitting = true;
    this.pos.x = x;
    this.pos.z = z;
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.rig.root.position.set(x, this.rig.root.position.y, z);
    this.rig.root.rotation.y = yaw;
  }

  stand() {
    this.sitting = false;
    this.chanting = false;
  }

  setChanting(on: boolean) {
    this.chanting = on;
  }

  setStrikeKind(kind: 'bell' | 'drum') {
    this.strikeKind = kind;
  }

  face(yaw: number) {
    this.yaw = yaw;
    this.targetYaw = yaw;
    this.rig.root.rotation.y = yaw;
  }

  knockChant() {
    this.chantPulse = 1;
  }

  /** 如果因碰撞体缝隙/传送卡在物体里，自动挪到最近的可站立点 */
  private escapeIfStuck(blocked: (x: number, z: number) => boolean) {
    if (!blocked(this.pos.x, this.pos.z)) return;
    for (let r = 0.25; r <= 2.6; r += 0.15) {
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const nx = this.pos.x + Math.cos(a) * r;
        const nz = this.pos.z + Math.sin(a) * r;
        if (!blocked(nx, nz)) {
          this.pos.x = nx;
          this.pos.z = nz;
          this.target = null;
          return;
        }
      }
    }
    // 若在池心等大面积阻挡里，向外多找几圈
    for (let r = 3.2; r <= 18; r += 0.8) {
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const nx = this.pos.x + Math.cos(a) * r;
        const nz = this.pos.z + Math.sin(a) * r;
        if (!blocked(nx, nz)) {
          this.pos.x = nx;
          this.pos.z = nz;
          this.target = null;
          return;
        }
      }
    }
  }

  update(
    dt: number,
    groundY: (x: number, z: number) => number,
    blocked: (x: number, z: number) => boolean,
  ) {
    this.escapeIfStuck(blocked);
    if (this.action) {
      this.actionT += dt;
      if (this.actionT >= this.actionDur) {
        const cb = this.onEnd;
        this.action = null;
        this.onEnd = null;
        cb?.();
      }
    }

    let vx = this.input.x;
    let vz = this.input.y;
    let len = Math.hypot(vx, vz);
    if (this.target && !this.busy && !this.sitting) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.22) {
        this.target = null;
      } else {
        vx = dx / d;
        vz = dz / d;
        len = 1;
        if (d < 1.2) {
          vx *= d / 1.2;
          vz *= d / 1.2;
        }
      }
    }

    if (this.busy || this.sitting) {
      vx = 0;
      vz = 0;
      len = 0;
    }

    this.moving = len > 0.08;
    if (this.moving) {
      const norm = Math.min(1, len);
      const step = this.speed * norm * dt;
      let nx = this.pos.x + vx * step;
      let nz = this.pos.z + vz * step;
      const rad = 0.32;
      if (!blocked(nx, nz)) {
        this.pos.x = nx;
        this.pos.z = nz;
      } else if (!blocked(nx, this.pos.z)) {
        this.pos.x = nx;
      } else if (!blocked(this.pos.x, nz)) {
        this.pos.z = nz;
      }
      this.targetYaw = Math.atan2(vx, vz);
      this.walkPhase += dt * 6.4 * norm;
      this.stepAccum += dt * norm;
      if (this.stepAccum > 0.48) {
        this.stepAccum = 0;
        this.onStep?.();
      }
    }

    // 朝向平滑
    let dyaw = this.targetYaw - this.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    this.yaw += dyaw * Math.min(1, dt * 9);
    this.rig.root.rotation.y = this.yaw;

    const gy = groundY(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14);
    this.rig.root.position.set(this.pos.x, this.pos.y, this.pos.z);

    let state: PoseState = 'idle';
    let progress = 0;
    if (this.action) {
      state = this.action;
      const elapsed = this.actionT;
      if (this.action === 'bow') progress = (elapsed % 1.4) / 1.4;
      else progress = Math.min(1, elapsed / Math.max(0.16, this.actionDur));
    } else if (this.sitting) {
      state = 'sit';
    } else if (this.moving) {
      state = 'walk';
    }
    poseMonk(this.rig, state, performance.now() / 1000, this.walkPhase, progress);
    if (this.action === 'strike') {
      this.rig.striker.visible = this.strikeKind === 'bell';
      this.rig.drumstick.visible = this.strikeKind === 'drum';
    }
    if (this.sitting && this.chanting) {
      this.rig.mallet.visible = true;
      this.rig.woodfish.visible = true;
      // 把手抬到膝前，让木鱼和木槌在背后视角也能看见
      this.rig.armL.rotation.x = -0.95;
      this.rig.armL.rotation.z = 0.5;
      this.rig.elbowL.rotation.x = 0.62;
      this.rig.armR.rotation.x = -0.9;
      this.rig.armR.rotation.z = -0.5;
      this.rig.elbowR.rotation.x = 0.72;
    }
    if (this.sitting && this.chantPulse > 0) {
      const k = this.chantPulse;
      this.rig.armR.rotation.x = -0.9 - Math.sin(k * Math.PI) * 0.35;
      this.rig.armR.rotation.z = -0.22;
      this.rig.elbowR.rotation.x = 1.15;
      this.chantPulse = Math.max(0, this.chantPulse - dt * 4.8);
    }
  }
}
