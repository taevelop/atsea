import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { decodeEmbeddedModel } from './embedded-models.js';

export const MODEL_IDS = [
  'fish0', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6',
  'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler',
  'shark', 'megalodon', 'sub', 'coral', 'starfish', 'seaweed', 'rock',
];

/** Shared geometry/textures, separate skeletons, and a single asset request per species. */
export class ModelLibrary {
  constructor() {
    this.models = new Map();
    this.materials = new Set();
    this.thumbnails = new Map();
  }

  async load(onProgress = () => {}) {
    const loader = new GLTFLoader();
    const embeddedElement = document.getElementById('sea-embedded-models');
    const embeddedModels = embeddedElement ? JSON.parse(embeddedElement.textContent) : null;
    let loaded = 0;
    // Limit parse/upload pressure on mobile instead of launching twenty uploads together.
    const pending = [...MODEL_IDS];
    const worker = async () => {
      while (pending.length) {
        const id = pending.shift();
        let gltf;
        try {
          gltf = embeddedModels
            ? await loader.parseAsync(await decodeEmbeddedModel(embeddedModels[id]), '')
            : await loader.loadAsync(`${import.meta.env.BASE_URL}models/${id}.glb`);
        }
        catch (cause) { pending.length = 0; throw new Error(`Could not load ${id}.glb`, { cause }); }
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        if (![size.x, size.y, size.z].every(Number.isFinite) || size.length() === 0)
          throw new Error(`Empty model: ${id}.glb`);
        const rareMaterials = new Map();
        gltf.scene.traverse(mesh => {
          if (!mesh.isMesh) return;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const material of originals) {
            // Some old source materials default to fully metallic without an environment map.
            if ('metalness' in material) material.metalness = Math.min(material.metalness, .18);
            if ('roughness' in material) material.roughness = Math.max(.32, material.roughness);
            this.materials.add(material);
            const rare = material.clone();
            rare.color?.set('#dcf9ff');
            if (rare.emissive) { rare.emissive.set('#82dbef'); rare.emissiveIntensity = .35; }
            rareMaterials.set(material, rare);
            this.materials.add(rare);
          }
        });
        this.models.set(id, { gltf, size, center, rareMaterials });
        onProgress({ loaded: ++loaded, total: MODEL_IDS.length, label: id });
      }
    };
    const results = await Promise.allSettled([worker(), worker(), worker()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  create(id, rare = false) {
    const resolvedId = id;
    const source = this.models.get(resolvedId);
    if (!source) throw new Error(`Unknown 3D species: ${id}`);
    const object = clone(source.gltf.scene);
    object.position.sub(source.center);
    if (rare || id === 'megalodon') object.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(material => source.rareMaterials.get(material))
        : source.rareMaterials.get(mesh.material);
    });
    const pivot = new THREE.Group();
    pivot.add(object);
    const group = new THREE.Group();
    group.add(pivot);
    const mixer = source.gltf.animations.length ? new THREE.AnimationMixer(object) : null;
    if (mixer) {
      const clip = source.gltf.animations.find(c => /swim|idle|slow/i.test(c.name)) || source.gltf.animations[0];
      mixer.clipAction(clip).play();
    }
    return { group, pivot, object, size: source.size, mixer, id, rare, phase: Math.random() * 10 };
  }

  release(instance) {
    instance.mixer?.stopAllAction();
    instance.mixer?.uncacheRoot(instance.object);
    instance.object.traverse(mesh => {
      // Skeleton GPU textures belong to the clone; mesh geometry and materials are shared.
      if (mesh.isSkinnedMesh) mesh.skeleton.dispose();
    });
    instance.group.removeFromParent();
  }

  makeThumbnails(renderer) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#e2f8ff', '#3b5a69', 2.5));
    const key = new THREE.DirectionalLight('#fff2d6', 3);
    key.position.set(-2, 5, 8);
    scene.add(key);
    const camera = new THREE.OrthographicCamera(-2.5, 2.5, 1.65, -1.65, .1, 100);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(1);
    renderer.setSize(256, 170, false);
    renderer.setClearColor(0x000000, 0);
    const silhouette = new THREE.MeshBasicMaterial({ color: '#2c4758' });
    for (const id of MODEL_IDS) {
      for (const mode of ['normal', 'rare', 'locked']) {
        const instance = this.create(id, mode === 'rare');
        const scale = Math.min(4 / instance.size.x, 2.65 / instance.size.y, 4 / Math.max(.01, instance.size.z));
        instance.pivot.scale.setScalar(scale);
        instance.pivot.rotation.y = -.16;
        instance.pivot.rotation.x = id === 'ray' ? .42 : id === 'starfish' ? 1.0 : 0;
        instance.mixer?.setTime(.5);
        if (mode === 'locked') instance.object.traverse(mesh => { if (mesh.isMesh) mesh.material = silhouette; });
        scene.add(instance.group);
        renderer.render(scene, camera);
        this.thumbnails.set(`${id}:${mode}`, renderer.domElement.toDataURL('image/png'));
        this.release(instance);
      }
    }
    silhouette.dispose();
  }

  getThumbnail(id, { rare = false, locked = false } = {}) {
    return this.thumbnails.get(`${id}:${locked ? 'locked' : rare ? 'rare' : 'normal'}`) || '';
  }

  dispose() {
    const geometries = new Set(), textures = new Set(), skeletons = new Set();
    for (const { gltf } of this.models.values()) gltf.scene.traverse(mesh => {
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.skeleton) skeletons.add(mesh.skeleton);
    });
    for (const material of this.materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
    for (const texture of textures) { texture.source?.data?.close?.(); texture.dispose(); }
    this.models.clear();
    this.materials.clear();
    this.thumbnails.clear();
  }
}
