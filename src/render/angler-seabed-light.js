import * as THREE from 'three';
import { LURE } from '../game/ocean.js';

/** Soft lure light on the existing sand mesh, with no extra lights or draw calls. */
export class AnglerSeabedLight {
  constructor(ground) {
    this.ground = ground;
    this.light = new THREE.BufferAttribute(new Float32Array(ground.geometry.attributes.position.count), 1);
    this.light.setUsage(THREE.DynamicDrawUsage);
    ground.geometry.setAttribute('anglerIrradiance', this.light);
    ground.material.onBeforeCompile = shader => {
      shader.uniforms.anglerLightColor = { value: new THREE.Color(LURE) };
      shader.vertexShader = 'attribute float anglerIrradiance;\nvarying float vAnglerIrradiance;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvAnglerIrradiance = anglerIrradiance;');
      shader.fragmentShader = 'uniform vec3 anglerLightColor;\nvarying float vAnglerIrradiance;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += anglerLightColor * vAnglerIrradiance;');
    };
    ground.material.customProgramCacheKey = () => 'angler-seabed-light-v1';
  }

  update(instances) {
    const { ground, light } = this;
    const vertices = ground.geometry.attributes.position;
    light.array.fill(0);
    for (const instance of instances) {
      if (!instance.lure || !instance.group.visible) continue;
      const { position, pulse } = instance.lure;
      const width = instance.size.x * instance.pivot.scale.x;
      for (let i = 0; i < vertices.count; i++) {
        const height = position.y - (vertices.getY(i) + ground.position.y);
        if (height < 0 || height >= 75) continue;
        const dx = vertices.getX(i) + ground.position.x - position.x;
        const dz = vertices.getZ(i) + ground.position.z - position.z;
        const radius = Math.max(10, width * .6) + height * .25;
        const falloff = 1 - (dx * dx + dz * dz) / (radius * radius);
        if (falloff <= 0) continue;
        const strength = 2.2 * pulse * (1 - height / 75) ** 2 * falloff ** 2;
        light.array[i] = Math.min(3, light.array[i] + strength);
      }
    }
    // Clearing every frame also removes light immediately when an animal is recycled.
    light.needsUpdate = true;
  }
}
