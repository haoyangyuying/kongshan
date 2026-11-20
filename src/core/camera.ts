import * as THREE from 'three';

export type CameraMode = 'intro' | 'transition' | 'follow' | 'focus';

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'intro';
  yaw = 0;
  pitch = 0.34;
  dist = 5.6;
  private targetDist = 5.6;
  private followTarget = new THREE.Vector3();
  private smoothLook = new THREE.Vector3(0, 4, 24);
  private transitionT = 0;
  private fromPos = new THREE.Vector3();
  private fromLook = new THREE.Vector3();
  private focusPos = new THREE.Vector3();
  private focusLook = new THREE.Vector3();
  private focusTime = 0;
  private shakeAmt = 0;
  private elapsed = 0;
  groundY: (x: number, z: number) => number = () => 0;
  blocked: (x: number, z: number) => boolean = () => false;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  setIntro() {
    this.mode = 'intro';
    this.elapsed = 0;
    this.camera.position.set(30, 11, 72);
    this.camera.lookAt(-1, 5.2, 30);
    this.smoothLook.set(-1, 5.2, 30);
  }

  startFollow(playerYaw: number) {
    this.mode = 'transition';
    this.transitionT = 0;
    this.fromPos.copy(this.camera.position);
    this.fromLook.copy(this.smoothLook);
    this.yaw = playerYaw + Math.PI;
    this.pitch = 0.24;
    this.dist = 5.6;
    this.targetDist = 5.6;
  }

  orbit(dx: number, dy: number) {
    if (this.mode === 'intro') return;
    this.yaw -= dx * 0.0045;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0035, 0.02, 1.15);
  }

  zoom(delta: number) {
    if (this.mode === 'intro') return;
    this.targetDist = THREE.MathUtils.clamp(this.targetDist + delta * 0.0022, 3.0, 12.5);
  }

  focus(pos: THREE.Vector3, look: THREE.Vector3) {
    this.mode = 'focus';
    this.focusPos.copy(pos);
    this.focusLook.copy(look);
    this.focusTime = 0;
  }

  clearFocus() {
    if (this.mode === 'focus') {
      this.mode = 'transition';
      this.transitionT = 0;
      this.fromPos.copy(this.camera.position);
      this.fromLook.copy(this.smoothLook);
    }
  }

  shake(amount: number) {
    this.shakeAmt = Math.min(0.4, this.shakeAmt + amount);
  }

  private pullIn(target: THREE.Vector3, desired: THREE.Vector3): THREE.Vector3 {
    const dir = desired.clone().sub(target);
    const samples = 14;
    let free = 1;
    for (let i = 1; i <= samples; i++) {
      const k = i / samples;
      const p = target.clone().addScaledVector(dir, k);
      if (this.blocked(p.x, p.z)) {
        free = Math.max(0.16, (i - 1) / samples - 0.02);
        break;
      }
    }
    return target.clone().addScaledVector(dir, free);
  }

  update(dt: number, playerPos: THREE.Vector3, playerYaw: number) {
    this.elapsed += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 0.35);

    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const desiredTarget = new THREE.Vector3(playerPos.x, playerPos.y + 1.12, playerPos.z).addScaledVector(right, 0.42);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
      Math.sin(this.pitch) * this.dist + 0.35,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
    );
    const desiredPos = desiredTarget.clone().add(offset);
    desiredPos.y = Math.max(desiredPos.y, this.groundY(desiredPos.x, desiredPos.z) + 0.55);
    desiredPos.copy(this.pullIn(desiredTarget, desiredPos));

    if (this.mode === 'intro') {
      const t = this.elapsed;
      this.camera.position.set(30 - Math.min(3, t * 0.08) + Math.sin(t * 0.05) * 1.2, 11 + Math.sin(t * 0.12) * 0.2, 72 - Math.min(2, t * 0.05));
      this.smoothLook.lerp(new THREE.Vector3(-1 + Math.sin(t * 0.04) * 1.0, 5.2 + Math.sin(t * 0.09) * 0.15, 30), Math.min(1, dt * 1.4));
      this.camera.lookAt(this.smoothLook);
      return;
    }

    if (this.mode === 'focus') {
      this.focusTime += dt;
      const drift = Math.sin(this.focusTime * 0.22) * 0.12;
      const p = this.focusPos.clone().add(new THREE.Vector3(drift, Math.sin(this.focusTime * 0.18) * 0.05, 0));
      this.camera.position.lerp(p, Math.min(1, dt * 1.8));
      this.smoothLook.lerp(this.focusLook, Math.min(1, dt * 1.8));
      this.camera.lookAt(this.smoothLook);
      return;
    }

    this.dist += (this.targetDist - this.dist) * Math.min(1, dt * 5);

    if (this.mode === 'transition') {
      this.transitionT += dt;
      const k = Math.min(1, this.transitionT / 2.4);
      const e = k * k * (3 - 2 * k);
      const targetLook = desiredTarget;
      // 目标机位重新按当前 yaw 计算
      const off2 = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
        Math.sin(this.pitch) * this.dist + 0.35,
        Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
      );
      const toPos = desiredTarget.clone().add(off2);
      toPos.y = Math.max(toPos.y, this.groundY(toPos.x, toPos.z) + 0.55);
      toPos.copy(this.pullIn(desiredTarget, toPos));
      this.camera.position.lerpVectors(this.fromPos, toPos, e);
      this.smoothLook.lerpVectors(this.fromLook, targetLook, e);
      this.camera.lookAt(this.smoothLook);
      if (k >= 1) this.mode = 'follow';
      return;
    }

    // follow
    const k = Math.min(1, dt * 6.5);
    this.camera.position.lerp(desiredPos, k);
    this.followTarget.copy(desiredTarget);
    this.smoothLook.lerp(this.followTarget, Math.min(1, dt * 8));
    this.camera.lookAt(this.smoothLook);

    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.12;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
  }
}
