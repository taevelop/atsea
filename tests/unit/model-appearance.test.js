import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

async function load(id) {
  const bytes = readFileSync(new URL(`../../public/models/${id}.glb`, import.meta.url));
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
}

function pose(gltf, mixer, fraction) {
  mixer.setTime(gltf.animations[0].duration * fraction);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(mesh => {
    if (!mesh.isSkinnedMesh) return;
    mesh.skeleton.update();
    mesh.computeBoundingSphere();
  });
}

function vertices(mesh) {
  return Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
    mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
}

describe('visible details on the exported swimming models', () => {
  it.each(['dolphin', 'whale', 'fish1', 'fish5', 'fish6', 'lantern', 'shark', 'megalodon'])(
    '%s has two eyes exposed on the head throughout its swim', async id => {
      const gltf = await load(id);
      const mixer = new THREE.AnimationMixer(gltf.scene);
      mixer.clipAction(gltf.animations[0]).play();
      const eyeMeshes = [];
      gltf.scene.traverse(mesh => {
        if (mesh.isMesh && mesh.material.name === 'Natural dark eyes') eyeMeshes.push(mesh);
      });
      expect(eyeMeshes.length).toBeGreaterThan(0);
      for (let frame = 0; frame < 8; frame++) {
        pose(gltf, mixer, frame / 8);
        const points = eyeMeshes.flatMap(vertices);
        for (const side of [-1, 1]) {
          const eye = points.filter(p => p.z * side > 0);
          expect(eye.length).toBeGreaterThan(20);
          const center = new THREE.Box3().setFromPoints(eye).getCenter(new THREE.Vector3());
          const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, side * 100), new THREE.Vector3(0, 0, -side));
          const hit = ray.intersectObject(gltf.scene, true)[0];
          // A body intersection first means the eye is buried, even if its mesh exists.
          expect(hit?.object.material.name, `${id}, cycle ${frame}/8, side ${side}`).toBe('Natural dark eyes');
        }
      }
    },
  );

  it('keeps all four turtle flipper roots inside the shell throughout the swim', async () => {
    const gltf = await load('turtle');
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
    const flippers = new Map();
    gltf.scene.traverse(mesh => {
      if (!mesh.isSkinnedMesh) return;
      const { skinIndex, skinWeight } = mesh.geometry.attributes;
      for (let i = 0; i < skinIndex.count; i++) {
        const bone = mesh.skeleton.bones[skinIndex.getX(i)].name;
        if (!/^(Front|Rear)/.test(bone) || skinWeight.getX(i) < .9) continue;
        if (!flippers.has(bone)) flippers.set(bone, []);
        flippers.get(bone).push([mesh, i]);
      }
    });
    expect(flippers.size).toBe(4);
    for (let frame = 0; frame < 16; frame++) {
      pose(gltf, mixer, frame / 16);
      for (const [name, entries] of flippers) {
        const intersectsShell = entries.some(([mesh, i]) => {
          const p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
          return (p.x / .82) ** 2 + ((p.y - .13) / .32) ** 2 + (p.z / .58) ** 2 < .95;
        });
        expect(intersectsShell, `${name}, cycle ${frame}/16`).toBe(true);
      }
    }
  });
});
