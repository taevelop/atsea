import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { decodeEmbeddedModel } from './embedded-models.js';
import { LURE } from '../game/ocean.js';

const LURE_BOX = new THREE.Box3();
const LURE_VERTEX = new THREE.Vector3();
const LURE_SIZE = new THREE.Vector3();

export const MODEL_IDS = [
  'fish0', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6',
  'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler',
  'shark', 'megalodon', 'sub', 'coral', 'starfish', 'seaweed', 'rock',
  'turtle', 'crab', 'shrimp', 'dolphin', 'whale', 'oarfish',
];

// Tint skin only; retain eyes, stripes, teeth, and bioluminescent markings.
// Secondary skin materials keep some of their original shading.
const SKIN_TINTS = {
  turtle: { 'Turtle shell': 1, 'Turtle skin': .6 },
  crab: { 'Crab shell': 1, 'Crab legs': .7 },
  shrimp: { 'Shrimp shell': 1, 'Shrimp legs': .6 },
  dolphin: { Top: 1, Bottom: .4 },
  whale: { Top: 1, Bottom: .4 },
  oarfish: { 'Oarfish silver': 1 },
  fish0: { Tetra_Main: 1, Tetra_Light: .6, Tetra_Fins: .6 },
  fish1: { Top: 1, Bottom: .6 },
  fish2: { BlueTang_Main: 1 },
  fish3: { Butterfly_Main: 1 },
  fish4: { Pufferfish_Main: 1, Pufferfish_Light: .6 },
  fish5: { Top: 1, Bottom: .6, Fins: .7 },
  fish6: { Body: 1 },
  lantern: { Top: 1, Bottom: .6, Fins: .7 },
  shark: { Top: 1 },
  jelly: { 'Jelly bell': 1, 'Jelly tentacles': .6, 'Jelly inner crown': .6 },
  seahorse: { 'Seahorse ochre': 1, 'Seahorse fin': .6, 'Seahorse ridge': .7 },
  squid: { 'Squid mantle': 1, 'Squid underside': .6, 'Squid fin': .7 },
  octopus: { 'Octopus mantle': 1, 'Octopus arms': 1 },
  ray: { Top: 1 },
  angler: { Anglerfish_Main: 1, Anglerfish_Light: .6, Anglerfish_Fins: .7 },
};

const KEEP_RARE_DETAIL = /eyes|iris|outline|stripes|teeth|_dark|_black|^light$|photophores/i;

/** Shared geometry/textures, separate skeletons, and a single asset request per species. */
export class ModelLibrary {
  constructor() {
    this.models = new Map();
    this.materials = new Set();
    this.thumbnails = new Map();
    this.glowMaterials = new Map();
    this.glowTexture = null;
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
            if (rareMaterials.has(material)) continue;
            // Some old source materials default to fully metallic without an environment map.
            if ('metalness' in material) material.metalness = Math.min(material.metalness, .18);
            if ('roughness' in material) material.roughness = Math.max(.32, material.roughness);
            if (id === 'angler' && material.name === 'Light') {
              material.color.set(LURE);
              material.emissive.set(LURE);
              material.emissiveIntensity = 1.4;
              material.toneMapped = false;
            }
            this.materials.add(material);
            if (KEEP_RARE_DETAIL.test(material.name)) {
              rareMaterials.set(material, material);
              continue;
            }
            const rare = material.clone();
            rare.color?.set('#dcf9ff');
            if (rare.emissive) { rare.emissive.set('#82dbef'); rare.emissiveIntensity = 1.4; }
            rareMaterials.set(material, rare);
            this.materials.add(rare);
          }
        });
        this.models.set(id, { gltf, size, center, rareMaterials, colorMaterials: new Map() });
        onProgress({ loaded: ++loaded, total: MODEL_IDS.length, label: id });
      }
    };
    const results = await Promise.allSettled([worker(), worker(), worker()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }

  create(id, rare = false, color = null) {
    const resolvedId = id;
    const source = this.models.get(resolvedId);
    if (!source) throw new Error(`Unknown 3D species: ${id}`);
    const object = clone(source.gltf.scene);
    object.position.sub(source.center);
    const materialBindings = [];
    object.traverse(mesh => {
      if (mesh.isMesh) materialBindings.push({ mesh, original: mesh.material });
    });
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
    const glow = rare || id === 'megalodon' ? this.createGlow() : null;
    if (glow) group.add(glow);
    let lure = null;
    if (id === 'angler') object.traverse(mesh => {
      if (!mesh.isMesh || mesh.material.name !== 'Light') return;
      lure = { mesh, glow: this.createGlow(LURE), position: new THREE.Vector3(), pulse: 1 };
      group.add(lure.glow);
    });
    const mixer = source.gltf.animations.length ? new THREE.AnimationMixer(object) : null;
    if (mixer) {
      const clip = source.gltf.animations.find(c => /swim|idle|slow/i.test(c.name)) || source.gltf.animations[0];
      mixer.clipAction(clip).play();
    }
    const instance = { group, pivot, object, glow, lure, size: source.size, mixer, id, rare, materialBindings, color: null, phase: Math.random() * 10 };
    this.setColor(instance, color);
    return instance;
  }

  createGlow(color = '#79e6ff') {
    if (!this.glowTexture) {
      const side = 64, pixels = new Uint8Array(side * side * 4);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const r2 = ((x + .5) / side * 2 - 1) ** 2 + ((y + .5) / side * 2 - 1) ** 2;
        const offset = (y * side + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
        pixels[offset + 3] = Math.round(255 * Math.exp(-3 * r2) * Math.max(0, 1 - r2));
      }
      const map = new THREE.DataTexture(pixels, side, side);
      map.magFilter = map.minFilter = THREE.LinearFilter;
      map.needsUpdate = true;
      this.glowTexture = map;
    }
    if (!this.glowMaterials.has(color)) {
      // Rare halos and angler lures share the soft texture, including thumbnails.
      const material = new THREE.SpriteMaterial({
        map: this.glowTexture, color, opacity: .85, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false, toneMapped: false,
      });
      this.glowMaterials.set(color, material);
      this.materials.add(material);
    }
    return new THREE.Sprite(this.glowMaterials.get(color));
  }

  updateGlow(instance, clock, minPadding = 0) {
    if (!instance.glow && !instance.lure) return;
    // The shared simulation clock freezes both kinds of glow when paused.
    const pulse = 1 + Math.sin(clock * 2 + instance.phase) * .08;
    if (instance.lure) {
      const { mesh, glow, position } = instance.lure;
      // Follow the actual skinned bulb through swimming, turning, and model scaling.
      instance.object.updateWorldMatrix(true, true);
      mesh.skeleton?.update();
      LURE_BOX.makeEmpty();
      for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
        mesh.getVertexPosition(i, LURE_VERTEX).applyMatrix4(mesh.matrixWorld);
        LURE_BOX.expandByPoint(LURE_VERTEX);
      }
      LURE_BOX.getCenter(position);
      LURE_BOX.getSize(LURE_SIZE);
      glow.position.copy(position);
      instance.group.worldToLocal(glow.position);
      const diameter = Math.max(LURE_SIZE.x, LURE_SIZE.y, LURE_SIZE.z) * 4;
      glow.scale.setScalar(Math.max(diameter, minPadding * 2) * pulse);
      instance.lure.pulse = pulse;
    }
    if (!instance.glow) return;
    const scale = instance.pivot.scale.x;
    const width = instance.size.x * scale;
    const tilt = instance.pivot.rotation.x;
    const height = (instance.size.y * Math.abs(Math.cos(tilt)) + instance.size.z * Math.abs(Math.sin(tilt))) * scale;
    const padding = Math.max(minPadding, width * .16, height * .3);
    instance.glow.scale.set((width + padding * 2) * pulse, (height + padding * 2) * pulse, 1);
    instance.glow.position.z = -instance.size.z * scale * .6 - .01;
  }

  setColor(instance, color = null) {
    const skin = SKIN_TINTS[instance.id];
    if (!skin || instance.rare || instance.color === color) return;
    const source = this.models.get(instance.id);
    let materials = source.colorMaterials.get(color);
    if (color && !materials) {
      materials = new Map();
      const tint = new THREE.Color(color);
      for (const original of source.rareMaterials.keys()) {
        const strength = skin[original.name];
        if (!strength) continue;
        const material = original.clone();
        material.color.lerp(tint, strength);
        materials.set(original, material);
        this.materials.add(material);
      }
      // The simulation uses a small fixed palette; share each species/color variant.
      source.colorMaterials.set(color, materials);
    }
    for (const { mesh, original } of instance.materialBindings) {
      const resolve = material => materials?.get(material) || material;
      mesh.material = Array.isArray(original) ? original.map(resolve) : resolve(original);
    }
    instance.color = color;
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
        const scale = Math.min(4 / instance.size.x, 2.65 / instance.size.y, 4 / Math.max(.01, instance.size.z))
          * (instance.glow && mode !== 'locked' ? .78 : 1); // Leave room for the halo.
        instance.pivot.scale.setScalar(scale);
        instance.pivot.rotation.y = -.16;
        instance.pivot.rotation.x = id === 'ray' ? .42 : id === 'starfish' ? 1.0 : 0;
        instance.mixer?.setTime(.5);
        this.updateGlow(instance, 0);
        if (mode === 'locked' && instance.glow) instance.glow.visible = false;
        if (mode === 'locked' && instance.lure) instance.lure.glow.visible = false;
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
    this.glowMaterials.clear();
    this.glowTexture = null;
  }
}
