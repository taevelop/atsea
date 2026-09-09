import * as THREE from 'three';
import { ModelLibrary } from './model-library.js';
import { DATA } from '../game/data.js';
import { ChompEffects } from './chomp-effects.js';

const clamp = THREE.MathUtils.clamp;
const TEMP = new THREE.Object3D();
const UP = new THREE.Vector3(0, 1, 0);
const COLORS = ['#208ca2', '#0d536e', '#062b44', '#031422', '#020c16'].map(c => new THREE.Color(c));

const waterVertex = `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const waterFragment = `
  uniform float uTime, uDepth, uWater, uRed;
  varying vec3 vWorld;
  void main() {
    float d = clamp(-vWorld.y / uDepth, 0.0, 1.0);
    vec3 top = vec3(.009, .115, .185);
    vec3 mid = vec3(.003, .040, .080);
    vec3 deep = vec3(.0015, .009, .023);
    vec3 col = d < .5 ? mix(top, mid, smoothstep(0., .5, d)) : mix(mid, deep, smoothstep(.5, 1., d));
    float bend = vWorld.x + vWorld.y * .18;
    float ray = pow(max(0., sin(bend * .17 + sin(uTime * .11) * .3)), 12.);
    ray += .55 * pow(max(0., sin(bend * .39 - uTime * .032)), 22.);
    float wisps = sin(vWorld.x * .03 + vWorld.y * .013 + uTime * .018) * .5 + .5;
    col += vec3(.065, .15, .16) * ray * exp(-d * 9.) * .26;
    col += vec3(.008, .021, .027) * wisps * (1. - d);
    vec3 red = mix(vec3(.19, .022, .018), vec3(.012, .002, .009), d);
    col = mix(col, red + ray * vec3(.025, .007, .002), uRed);
    col = mix(vec3(.0015, .005, .012), col, uWater);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function labelTexture(text, color = '#e6f8ff') {
  const canvas = document.createElement('canvas');
  canvas.width = text.length <= 2 ? 80 : 512; canvas.height = 80;
  const context = canvas.getContext('2d');
  context.font = '500 32px system-ui, sans-serif';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = 'rgba(2, 13, 22, .86)';
  context.beginPath(); context.roundRect(0, 0, canvas.width, 80, 18); context.fill();
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, 40);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** The simulation keeps its 2D coordinates; this side-view camera only travels vertically. */
export class SeaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.library = new ModelLibrary();
    this.instances = new Map();
    this.environmentInstances = [];
    this.pool = new Map();
    this.ownedGeometries = new Set();
    this.ownedMaterials = new Set();
    this.ownedTextures = new Set();
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.camera = new THREE.OrthographicCamera(-40, 40, 24, -24, .1, 300);
    this.scene.fog = new THREE.Fog('#0c4c65', 112, 215);
    this.ambient = new THREE.HemisphereLight('#adf4ff', '#133a53', 2.0);
    this.key = new THREE.DirectionalLight('#c9f6ef', 2.8);
    this.key.position.set(-40, 60, 75);
    this.fill = new THREE.DirectionalLight('#408cbc', 1.0);
    this.fill.position.set(70, 15, 30);
    this.scene.add(this.ambient, this.key, this.fill);
    this.uniforms = {
      uTime: { value: 0 }, uDepth: { value: 250 }, uWater: { value: 1 }, uRed: { value: 0 },
    };
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setClearColor('#020c16', 1);
    this.ready = false;
    this.clock = 0;
    this.metrics = { frames: 0, fps: 0, visibleModels: 0, drawCalls: 0, triangles: 0 };
    this.lastMetricsAt = performance.now();
    this.frameSamples = 0;
    this.qualityScale = 1;
  }

  async init(onProgress) {
    await this.library.load(onProgress);
    this.library.makeThumbnails(this.renderer);
    this.ready = true;
  }

  getThumbnail(id, options) { return this.library.getThumbnail(id, options); }

  getStats() { return { ...this.metrics, pixelRatio: this.renderer.getPixelRatio(), qualityScale: this.qualityScale, geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures }; }

  geometry(value) { this.ownedGeometries.add(value); return value; }
  material(value) { this.ownedMaterials.add(value); return value; }
  texture(value) { this.ownedTextures.add(value); return value; }

  clearWorld() {
    this.chompEffects?.dispose();
    this.megaIndicator?.material.map?.dispose();
    this.megaLabel = null;
    for (const instance of this.instances.values()) this.library.release(instance);
    for (const instance of this.environmentInstances) this.library.release(instance);
    for (const instances of this.pool.values()) for (const instance of instances) this.library.release(instance);
    this.instances.clear(); this.pool.clear(); this.environmentInstances = [];
    this.world.clear();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    this.ownedGeometries.clear(); this.ownedMaterials.clear(); this.ownedTextures.clear();
  }

  resize({ width, height, cols, rows, depth, cw, chh }) {
    if (!this.ready || width < 1 || height < 1) return;
    this.clearWorld();
    this.layout = { width, height, cols, rows, depth, cw, chh };
    this.aspect = chh / cw;
    this.mobile = width < 620;
    this.qualityScale = 1;
    this.lastMetricsAt = performance.now();
    this.frameSamples = 0;
    this.fastWindows = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(width, height, false);
    // Use the actual measured canvas bounds, including the partial last row/column.
    this.viewWidth = width / cw;
    this.viewHeight = height / cw;
    this.camera.left = -this.viewWidth / 2; this.camera.right = this.viewWidth / 2;
    this.camera.top = this.viewHeight / 2; this.camera.bottom = -this.viewHeight / 2;
    this.camera.updateProjectionMatrix();
    this.uniforms.uDepth.value = depth * this.aspect;
    this.makeEnvironment();
    this.makeEffects();
    this.ocean = null;
  }

  makeEnvironment() {
    const { cols, depth } = this.layout, a = this.aspect;
    const water = new THREE.Mesh(
      this.geometry(new THREE.PlaneGeometry(cols * 2, depth * a * 1.2)),
      this.material(new THREE.ShaderMaterial({ vertexShader: waterVertex, fragmentShader: waterFragment, uniforms: this.uniforms, depthWrite: false })),
    );
    water.position.set(cols / 2, -depth * a / 2, -85);
    water.renderOrder = -10;
    this.world.add(water);

    const surfaceGeometry = this.geometry(new THREE.PlaneGeometry(cols * 1.5, 72, 100, 12));
    surfaceGeometry.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(surfaceGeometry, this.material(new THREE.MeshStandardMaterial({
      color: '#62d2d9', roughness: .24, metalness: .12, transparent: true, opacity: .55, side: THREE.DoubleSide,
    })));
    this.surface.position.set(cols / 2, -.2 * a, -18);
    this.world.add(this.surface);
    this.surfaceBase = Float32Array.from(surfaceGeometry.attributes.position.array);

    const groundGeometry = this.geometry(new THREE.PlaneGeometry(cols * 1.5, 70, 90, 28));
    groundGeometry.rotateX(-Math.PI / 2);
    const positions = groundGeometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    const sand = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i);
      const ridge = Math.sin(x * .115 + z * .035) * .65 + Math.sin(x * .34 - z * .1) * .22;
      positions.setY(i, Math.max(0, -z) * .11 + ridge);
      sand.set('#8b9983').multiplyScalar(.78 + .10 * Math.sin(x * 3.9 + z * 4.1));
      colors.set([sand.r, sand.g, sand.b], i * 3);
    }
    groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groundGeometry.computeVertexNormals();
    this.ground = new THREE.Mesh(groundGeometry, this.material(new THREE.MeshStandardMaterial({
      vertexColors: true, color: '#b2b6a0', roughness: .9, side: THREE.DoubleSide,
    })));
    this.ground.position.set(cols / 2, -(depth - .4) * a, -16);
    this.world.add(this.ground);

    // Distant outcrops are actual 3D meshes, with space left open for swimming and aiming.
    const rocks = this.mobile ? 7 : 13;
    for (let i = 0; i < rocks; i++) {
      const rock = this.library.create('rock');
      const size = 2.5 + (Math.sin(i * 47.3) + 1) * 2.1;
      rock.pivot.scale.setScalar(size / Math.max(rock.size.x, rock.size.y));
      rock.pivot.rotation.set(0, i * 1.7, .09 * Math.sin(i));
      rock.group.position.set((i + .5) / rocks * cols, -(depth - 1) * a + size * .25, -15 - (i % 3) * 8);
      this.environmentInstances.push(rock);
      this.world.add(rock.group);
    }
    // Sparse distant reef walls give the water depth without covering the aiming area.
    for (let i = 0; i < 8; i++) {
      const rock = this.library.create('rock');
      const left = i % 2 === 0;
      const height = a * (9 + (i % 3) * 4);
      rock.pivot.scale.set(cols * .14 / rock.size.x, height / rock.size.y, 16 / rock.size.z);
      rock.pivot.rotation.z = left ? -.13 : .13;
      rock.group.position.set(left ? -cols * .045 : cols * 1.045, -depth * a * (.30 + Math.floor(i / 2) * .17), -65);
      this.environmentInstances.push(rock);
      this.world.add(rock.group);
    }
    // Slow suspended particles sell the volume without covering the fish silhouettes.
    const count = this.mobile ? 110 : 260;
    this.particleSeeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) this.particleSeeds.set([Math.random() * cols, Math.random(), -10 - Math.random() * 48], i * 3);
    const particleGeometry = this.geometry(new THREE.BufferGeometry());
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    this.particles = new THREE.Points(particleGeometry, this.material(new THREE.PointsMaterial({
      color: '#8ac0c9', size: 1.2, sizeAttenuation: false, transparent: true, opacity: .36, depthWrite: false,
    })));
    this.world.add(this.particles);
  }

  makeEffects() {
    const bubbleGeo = this.geometry(new THREE.SphereGeometry(1, 8, 6));
    this.bubbles = new THREE.InstancedMesh(bubbleGeo, this.material(new THREE.MeshStandardMaterial({
      color: '#bce9ee', metalness: .18, roughness: .12, transparent: true, opacity: .28, depthWrite: false,
    })), 400);
    this.bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bubbles.frustumCulled = false;
    this.world.add(this.bubbles);
    this.lines = [false, true].map(manual => {
      const geometry = this.geometry(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
      const material = this.material(new THREE.LineBasicMaterial({ color: manual ? '#f7d87b' : '#88afbf', transparent: true, opacity: .85 }));
      const line = new THREE.Line(geometry, material);
      const hook = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(.34, .065, 6, 16, Math.PI * 1.55)), this.material(new THREE.MeshStandardMaterial({
        color: manual ? '#ffe198' : '#d4e5ea', emissive: manual ? '#986320' : '#2b414a', emissiveIntensity: .4, roughness: .35,
      })));
      const target = new THREE.Mesh(this.geometry(new THREE.TorusGeometry(.65, .04, 6, 24)), this.material(new THREE.MeshBasicMaterial({color: '#ffe59a', transparent: true, opacity: .8})));
      this.world.add(line, hook, target);
      return { line, hook, target };
    });
    this.alarms = new THREE.Group(); this.world.add(this.alarms);
    this.alarmMaterial = this.material(new THREE.SpriteMaterial({ map: this.texture(labelTexture('!', '#ffe8a8')), depthTest: false }));
    this.angryMaterial = this.material(new THREE.SpriteMaterial({ map: this.texture(labelTexture('!', '#ff8973')), depthTest: false }));
    this.alarmSprites = [];
    this.chompEffects = new ChompEffects();
    this.world.add(this.chompEffects);
    this.bait = new THREE.Mesh(this.geometry(new THREE.IcosahedronGeometry(.55, 1)), this.material(new THREE.MeshStandardMaterial({
      color: '#ffda69', emissive: '#e9af25', emissiveIntensity: 1.2, roughness: .5,
    })));
    this.world.add(this.bait);
    this.megaIndicator = new THREE.Sprite(this.material(new THREE.SpriteMaterial({ depthTest: false, transparent: true })));
    this.megaIndicator.scale.set(24, 3.75, 1); this.megaIndicator.renderOrder = 20;
    this.world.add(this.megaIndicator);
    this.redLabel = new THREE.Sprite(this.material(new THREE.SpriteMaterial({ map: this.texture(labelTexture('RED OCEAN', '#ff9b87')), transparent: true, depthTest: false })));
    this.redLabel.scale.set(22, 3.4, 1); this.world.add(this.redLabel);
    this.beam = new THREE.Mesh(this.geometry(new THREE.ConeGeometry(3, 25, 24, 1, true)), this.material(new THREE.MeshBasicMaterial({
      color: '#bcebc8', transparent: true, opacity: .09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })));
    this.world.add(this.beam);
  }

  acquire(entity, id, width, height, x, y, z = 0) {
    const key = `${id}:${!!entity.rare}`;
    let instance = this.instances.get(entity);
    if (instance && (instance.id !== id || instance.rare !== !!entity.rare)) { this.recycle(entity, instance); instance = null; }
    if (!instance) {
      instance = this.pool.get(key)?.pop() || this.library.create(id, !!entity.rare);
      this.instances.set(entity, instance);
      this.world.add(instance.group);
    }
    this.library.setColor(instance, entity.color);
    const scale = Math.min(width / Math.max(.001, instance.size.x), height / Math.max(.001, instance.size.y));
    instance.pivot.scale.setScalar(scale);
    instance.group.position.set(x, y, z);
    instance.group.visible = true;
    return instance;
  }

  recycle(entity, instance) {
    this.instances.delete(entity);
    instance.group.removeFromParent();
    const key = `${instance.id}:${!!instance.rare}`;
    if (!this.pool.has(key)) this.pool.set(key, []);
    const pool = this.pool.get(key);
    if (pool.length < 12) pool.push(instance);
    else this.library.release(instance);
  }

  syncOcean({ ocean, cam, rows, clock }) {
    const a = this.aspect;
    const active = new Set();
    const visibleTop = cam - 2, visibleBottom = cam + rows + 2;
    for (const [kind, list] of [...Object.entries(ocean.groups), ['sub', ocean.subs]]) {
      for (const being of list) {
        if (being.y + being.h < visibleTop || being.y > visibleBottom || being.x + being.w < -2 || being.x > ocean.w + 2) continue;
        active.add(being);
        const id = kind === 'fish' ? being.guideId : kind;
        const centerX = being.x + being.w / 2;
        const centerY = -((Number.isFinite(being.yf) && kind !== 'sub' ? being.yf : being.y) + being.h / 2) * a;
        // Keep simulation footprints; halve the turtle and scale shrimp to twice the second-smallest fish in 3D.
        const sizeScale = kind === 'turtle' ? .5 : kind === 'shrimp' ? DATA.sizes.FISH[1].w * 2 / being.w : 1;
        const instance = this.acquire(being, id, being.w * sizeScale, being.h * a * sizeScale, centerX, centerY);
        instance.group.position.z = -2 - (Math.sin(instance.phase * 5.3) + 1) * 3;
        const yaw = being.dir < 0 ? Math.PI : 0;
        instance.pivot.rotation.y = (kind === 'crab' ? 0 : yaw) + Math.sin(clock * .65 + instance.phase) * .11;
        instance.pivot.rotation.x = kind === 'ray' ? .42 + Math.sin(clock * .45 + instance.phase) * .08 : kind === 'turtle' ? .35 : 0;
        instance.pivot.rotation.z = (kind === 'seahorse' || kind === 'jelly') ? Math.sin(clock + instance.phase) * .035 : Math.sin(clock * .8 + instance.phase) * .025;
        instance.mixer?.setTime(clock * (being.rush ? 2.4 : .8) + instance.phase);
        this.library.updateGlow(instance, clock, 1.5);
      }
    }
    if (cam + rows + 12 >= ocean.floorY - 12) {
      for (const item of ocean.floor) {
        active.add(item);
        const id = item.kind === 'starfish' || item.creep ? 'starfish' : 'coral';
        const instance = this.acquire(item, id, item.w, item.h * a,
          item.x + item.w / 2, -(ocean.floorY - item.h / 2) * a, -1);
        instance.pivot.rotation.y = Math.sin(instance.phase) * .35;
        instance.pivot.rotation.x = id === 'starfish' ? 1.0 : 0;
        const actualHeight = id === 'starfish'
          ? (instance.size.y * Math.cos(1.0) + instance.size.z * Math.sin(1.0)) * instance.pivot.scale.x
          : instance.size.y * instance.pivot.scale.x;
        instance.group.position.y = -ocean.floorY * a + actualHeight / 2;
        instance.mixer?.setTime(clock * .6 + instance.phase);
      }
      for (const weed of ocean.weeds) {
        active.add(weed);
        const instance = this.acquire(weed, 'seaweed', Math.max(2, weed.h * .48), weed.h * a, weed.x, -(ocean.floorY - weed.h / 2) * a, -4);
        instance.group.position.y = -ocean.floorY * a + instance.size.y * instance.pivot.scale.x / 2;
        instance.pivot.rotation.z = Math.sin(clock * .7 + instance.phase) * .065;
        instance.mixer?.setTime(clock * .5 + instance.phase);
      }
    }
    for (const [entity, instance] of this.instances) if (!active.has(entity)) this.recycle(entity, instance);
    this.metrics.visibleModels = this.instances.size;
  }

  updateEffects({ ocean, cam, rows, clock, redTide }) {
    const a = this.aspect;
    let count = 0;
    for (const bubble of ocean.bubbles) {
      if (bubble.y < cam - 1 || bubble.y > cam + rows + 1 || count >= 400) continue;
      TEMP.position.set(bubble.x, -bubble.y * a, 3);
      TEMP.rotation.set(0, 0, 0);
      TEMP.scale.setScalar(.12 + (bubble.s || .3) * .25);
      TEMP.updateMatrix();
      this.bubbles.setMatrixAt(count++, TEMP.matrix);
    }
    this.bubbles.count = count; this.bubbles.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 2; i++) {
      const rod = i ? ocean.rod : ocean.line, effect = this.lines[i];
      effect.line.visible = effect.hook.visible = !!rod;
      effect.target.visible = false;
      if (!rod) continue;
      const pos = effect.line.geometry.attributes.position;
      pos.setXYZ(0, rod.x - .25, -Math.max(cam, 0) * a + a, 8);
      pos.setXYZ(1, rod.x, -rod.tip * a, 8); pos.needsUpdate = true;
      effect.line.geometry.computeBoundingSphere();
      effect.hook.position.set(rod.x, -rod.tip * a, 8);
      effect.hook.rotation.z = Math.PI / 6;
      effect.hook.material.color.set(rod.state === 'on' || rod.state === 'shark' ? '#ff9778' : '#ffe09a');
      if (i && rod.mark && rod.state !== 'up') {
        const m = rod.mark;
        effect.target.visible = true;
        effect.target.position.set(m.x + m.w / 2, -(m.y - .7) * a, 9);
        effect.target.scale.setScalar(.75 + .12 * Math.sin(clock * 4));
      }
    }
    while (this.alarmSprites.length < ocean.alarms.length) {
      const sprite = new THREE.Sprite(this.alarmMaterial);
      this.alarmSprites.push(sprite); this.alarms.add(sprite);
    }
    this.alarmSprites.forEach((sprite, i) => {
      const alarm = ocean.alarms[i];
      sprite.visible = !!alarm;
      if (!alarm) return;
      const fish = alarm.fish;
      sprite.material = alarm.mood === 'angry' ? this.angryMaterial : this.alarmMaterial;
      const x = alarm.mood === 'angry' ? fish.x + (fish.dir === 1 ? fish.w - 4 : 4) : fish.x + fish.w / 2;
      sprite.position.set(x, -Math.max(cam + 1, fish.y - 1.5) * a, 10);
      sprite.scale.set(3.5, 2.2, 1);
    });
    this.chompEffects.update(ocean.chomps, { aspect: a, cam, rows });
    this.bait.visible = !!ocean.bait;
    if (ocean.bait) { this.bait.position.set(ocean.bait.x, -ocean.bait.y * a, 8); this.bait.rotation.set(clock, clock * .7, 0); }
    const mega = ocean.groups.megalodon?.[0];
    const above = mega && mega.y + mega.h <= cam;
    const below = mega && mega.y >= cam + rows;
    this.megaIndicator.visible = !!(above || below);
    if (above || below) {
      const far = Math.round(Math.max(0, above ? cam - mega.y - mega.h : mega.y - cam - rows) / ocean.depth * 1500);
      const label = `${above ? '↑' : '↓'}  ${far} m  ${above ? '↑' : '↓'}`;
      if (label !== this.megaLabel) {
        this.megaIndicator.material.map?.dispose();
        this.megaIndicator.material.map = labelTexture(label, '#bcefff');
        this.megaIndicator.material.needsUpdate = true;
        this.megaLabel = label;
      }
      this.megaIndicator.position.set(clamp(mega.x + mega.w / 2, 12, Math.max(12, ocean.w - 12)), -(above ? cam + 1.1 : cam + rows - 1.1) * a, 15);
    }
    this.redLabel.visible = redTide;
    this.redLabel.position.set(ocean.w / 2, -(cam + 2) * a, 15);
    const sub = ocean.subs[0];
    this.beam.visible = !!sub;
    if (sub) {
      const front = sub.x + (sub.dir === 1 ? sub.w : 0);
      this.beam.position.set(front + sub.dir * 12.5, -(sub.y + sub.h * .62) * a, -2);
      this.beam.quaternion.setFromUnitVectors(UP, new THREE.Vector3(-sub.dir, 0, 0));
    }
  }

  render(state) {
    if (!this.ready || !this.layout) return;
    const { cam, rows, depth, clock, waterOn, redTide, ocean } = state;
    this.clock = clock;
    this.uniforms.uTime.value = clock;
    this.uniforms.uWater.value = waterOn ? 1 : 0;
    this.uniforms.uRed.value = redTide ? 1 : 0;
    this.camera.position.set(this.viewWidth / 2, -cam * this.aspect - this.viewHeight / 2, 120);
    this.camera.rotation.set(0, 0, 0);
    const fraction = clamp((cam + rows / 2) / depth, 0, 1), ramp = fraction * (COLORS.length - 1);
    this.scene.fog.color.copy(COLORS[Math.floor(ramp)]).lerp(COLORS[Math.min(COLORS.length - 1, Math.floor(ramp) + 1)], ramp % 1);
    if (redTide) this.scene.fog.color.set('#3b0d18');
    if (!waterOn) this.scene.fog.color.set('#020914');
    this.ambient.intensity = 1.7 - fraction * .55;
    this.key.intensity = 2.8 - fraction * 1.65;
    this.key.position.set(-30, -cam * this.aspect + 60, 70);
    this.key.target.position.set(ocean.w / 2, -(cam + rows / 2) * this.aspect, 0);
    this.key.target.updateMatrixWorld();
    this.fill.position.set(ocean.w + 20, -(cam + rows * .4) * this.aspect, 40);
    this.fill.target.position.copy(this.key.target.position); this.fill.target.updateMatrixWorld();
    this.surface.visible = cam < 8 && waterOn;
    if (this.surface.visible) {
      const pos = this.surface.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = this.surfaceBase[i * 3], z = this.surfaceBase[i * 3 + 2];
        pos.setY(i, (Math.sin(x * .3 + clock * .65 + z * .08) + .5 * Math.sin(x * .71 - clock * .8)) * .14 * this.aspect);
      }
      pos.needsUpdate = true; this.surface.geometry.computeVertexNormals();
    }
    const particlePos = this.particles.geometry.attributes.position;
    for (let i = 0; i < particlePos.count; i++) {
      const seed = this.particleSeeds[i * 3 + 1];
      const y = ((seed + clock * .003) % 1) * this.viewHeight;
      particlePos.setXYZ(i, this.particleSeeds[i * 3] + Math.sin(clock * .09 + seed * 10), -cam * this.aspect - y, this.particleSeeds[i * 3 + 2]);
    }
    particlePos.needsUpdate = true;
    this.particles.geometry.computeBoundingSphere();
    this.syncOcean(state);
    this.updateEffects(state);
    this.metrics.frames++; this.frameSamples++;
    const now = performance.now(), elapsed = now - this.lastMetricsAt;
    if (elapsed >= 2000) {
      this.metrics.fps = Math.round(this.frameSamples * 1000 / elapsed);
      this.metrics.drawCalls = this.renderer.info.render.calls;
      this.metrics.triangles = this.renderer.info.render.triangles;
      this.frameSamples = 0; this.lastMetricsAt = now;
      // Reduce only pixel work; do not silently remove animals selected by the user.
      const previousQuality = this.qualityScale;
      if (this.metrics.fps < (this.mobile ? 27 : 43) && this.qualityScale > .65) {
        this.fastWindows = 0;
        this.qualityScale = Math.max(.65, this.qualityScale - .1);
      } else if (this.metrics.fps >= 57 && this.qualityScale < 1) {
        this.fastWindows++;
        if (this.fastWindows >= 3) { this.qualityScale = Math.min(1, this.qualityScale + .1); this.fastWindows = 0; }
      } else { this.fastWindows = 0; }
      if (previousQuality !== this.qualityScale) {
        this.renderer.setPixelRatio(this.dpr * this.qualityScale);
        this.renderer.setSize(this.layout.width, this.layout.height, false);
      }
    }
    // Resizing clears the drawing buffer: always draw AFTER adaptive resolution changes.
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.megaIndicator?.material.map?.dispose();
    this.clearWorld();
    this.library.dispose();
    this.renderer.dispose();
    this.ready = false;
  }
}
