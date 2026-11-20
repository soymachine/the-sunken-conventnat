// Final picture: soft bloom on fire, then paper grain, vignette and a sepia grade.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const Print = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrade: { value: new THREE.Vector3(1, 1, 1) } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform vec3 uGrade; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float v = smoothstep(1.0, 0.35, length((vUv - 0.5) * vec2(1.25, 1.5)));
      c *= mix(0.55, 1.0, v);
      c *= 0.95 + 0.1 * hash(vUv * vec2(1733.0, 977.0) + fract(uTime * 0.37) * 31.0);
      float l = dot(c, vec3(0.3, 0.59, 0.11));
      c = mix(vec3(l), c, 1.12);
      c = mix(c, l * vec3(1.1, 0.97, 0.76), 0.1) * uGrade;
      c = max(vec3(0.0), (c - 0.18) * 1.16 + 0.18);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// A miniature's shallow focus: the band across the charts stays sharp, the table above and below softens.
const TiltShift = {
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uFocus: { value: 0.56 }, uBand: { value: 0.2 }, uMax: { value: 7 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uFocus, uBand, uMax; varying vec2 vUv;
    void main() {
      float k = smoothstep(uBand, uBand + 0.32, abs(vUv.y - uFocus)) * uMax;
      if (k < 0.15) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 acc = vec4(0.0);
      for (int i = 0; i < 20; i++) {
        float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 20.0);
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a)) * r * k / uRes);
      }
      gl_FragColor = acc / 20.0;
    }`,
};

export class Post {
  private composer: EffectComposer;
  private print: ShaderPass;
  private tilt: ShaderPass;
  /** Colour multiplier: warm on your turn, colder on the enemy's. */
  grade = new THREE.Vector3(1, 1, 1);

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.4, 1.0));
    this.tilt = new ShaderPass(TiltShift);
    this.composer.addPass(this.tilt);
    this.print = new ShaderPass(Print);
    this.composer.addPass(this.print);
    this.composer.addPass(new OutputPass());
  }
  setSize(w: number, h: number, pixelRatio: number) {
    this.composer.setPixelRatio(pixelRatio); this.composer.setSize(w, h);
    (this.tilt.uniforms.uRes.value as THREE.Vector2).set(w, h);
  }
  /** Where the sharp band sits on screen (0 = bottom, 1 = top) and how wide it is. */
  setFocus(y: number, band: number) { this.tilt.uniforms.uFocus.value = y; this.tilt.uniforms.uBand.value = band; }
  render(t: number) {
    this.print.uniforms.uTime.value = t;
    (this.print.uniforms.uGrade.value as THREE.Vector3).lerp(this.grade, 0.04);
    this.composer.render();
  }
}
