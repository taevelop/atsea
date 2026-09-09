import * as THREE from 'three';
import { CHOMP_LIFETIME } from '../game/ocean.js';

const CAPACITY = 64, SPARKS = 10;

/** A short, camera-facing bite flash, expanding shock waves and outward streaks. */
export class ChompEffects extends THREE.Group {
  constructor() {
    super();
    this.transform = new THREE.Object3D();
    this.color = new THREE.Color();
    const batch = (geometry, color, opacity, capacity, order) => {
      const material = new THREE.MeshBasicMaterial({
        color, transparent: true, opacity, blending: THREE.AdditiveBlending,
        depthWrite: false, depthTest: false, fog: false, toneMapped: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = order;
      mesh.count = 0;
      this.add(mesh);
      return mesh;
    };
    this.rings = batch(new THREE.RingGeometry(.84, 1, 40), '#ff795c', .95, CAPACITY * 2, 11);
    this.flashes = batch(new THREE.CircleGeometry(1, 24), '#ffe8bc', .7, CAPACITY, 12);
    this.sparks = batch(new THREE.PlaneGeometry(1, 1), '#ffdb9a', .95, CAPACITY * SPARKS, 13);
  }

  place(mesh, x, y, z, sx, sy, angle, brightness) {
    const transform = this.transform;
    transform.position.set(x, y, z);
    transform.rotation.set(0, 0, angle);
    transform.scale.set(sx, sy, 1);
    transform.updateMatrix();
    mesh.setMatrixAt(mesh.count, transform.matrix);
    mesh.setColorAt(mesh.count++, this.color.setRGB(brightness, brightness, brightness));
  }

  update(chomps, { aspect, cam, rows }) {
    this.rings.count = this.flashes.count = this.sparks.count = 0;
    let count = 0;
    for (const chomp of chomps) {
      if (chomp.y < cam - 5 || chomp.y > cam + rows + 5 || chomp.age >= CHOMP_LIFETIME) continue;
      if (count++ >= CAPACITY) break;
      const progress = THREE.MathUtils.clamp(chomp.age / CHOMP_LIFETIME, 0, 1);
      const fade = (1 - progress) ** 1.4;
      const x = chomp.x + 2, y = -(chomp.y + 1) * aspect;
      const radius = 1.8 + 3.4 * Math.sqrt(progress);
      this.place(this.rings, x, y, 12, radius, radius * .85, 0, fade);
      this.place(this.rings, x, y, 12, radius * .70, radius * .60, 0, fade * .65);
      const flash = Math.max(0, 1 - progress * 2.5);
      if (flash > 0) this.place(this.flashes, x, y, 13, 1.9 * flash, 1.4 * flash, 0, flash);
      for (let i = 0; i < SPARKS; i++) {
        const angle = i / SPARKS * Math.PI * 2 + .15;
        const distance = radius * (1.02 + (i % 2) * .2);
        this.place(this.sparks, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance * .85,
          14, (.8 + (i % 3) * .22) * (1 - progress), .18 * (1 - progress), angle, fade);
      }
    }
    for (const mesh of this.children) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const mesh of this.children) {
      mesh.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.clear();
    this.removeFromParent();
  }
}
