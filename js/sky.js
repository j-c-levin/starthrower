import { PALETTE } from './palette.js';

const DOME_RADIUS = 3000;
const STAR_COUNT = 800;
const STAR_NEAR = 1900;
const STAR_FAR = 2600;
const ROT_RATE = 0.0000024; // rad/ms — one lazy revolution in ~45 min

export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// JS twin of the dome fragment shader — ambient.js colors nebula edges with it
export function skyColorAt(h, colors) {
  const { top, bottom, horizon } = colors;
  const s = Math.min(1, Math.max(0, (h + 0.4) / 0.9));
  const t = s * s * (3 - 2 * s);
  const band = Math.exp(-Math.abs(h) * 7.0) * 0.6;
  const mix = (a, b, f) => a + (b - a) * f;
  const base = {
    r: mix(bottom.r, top.r, t),
    g: mix(bottom.g, top.g, t),
    b: mix(bottom.b, top.b, t),
  };
  return {
    r: mix(base.r, horizon.r, band),
    g: mix(base.g, horizon.g, band),
    b: mix(base.b, horizon.b, band),
  };
}

export function skyPalette(THREE_) {
  const T = THREE_ || THREE;
  const darken = (hex, f) => {
    const c = new T.Color(hex);
    c.multiplyScalar(f);
    return c;
  };
  const horizon = new T.Color(PALETTE.violet).lerp(new T.Color(PALETTE.magenta), 0.16).multiplyScalar(0.5);
  return { top: darken(PALETTE.space, 0.6), bottom: darken(PALETTE.space, 0.42), horizon };
}

const DOME_VERT = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// mesh vertex colors are written as authored sRGB values and picked up by the
// renderer's linear->sRGB output transform; raw ShaderMaterials bypass it, so
// apply the same transfer here or nothing sky-matched ever lines up
const SRGB_FN = `
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
`;

const DOME_FRAG = `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uHorizon;
varying vec3 vDir;
${SRGB_FN}
void main() {
  float h = normalize(vDir).y;
  float t = smoothstep(-0.4, 0.5, h);
  float band = exp(-abs(h) * 7.0) * 0.6;
  vec3 base = mix(uBottom, uTop, t);
  gl_FragColor = vec4(toSRGB(mix(base, uHorizon, band)), 1.0);
}
`;

const STAR_VERT = `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize;
}
`;

const STAR_FRAG = `
varying vec3 vColor;
${SRGB_FN}
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(toSRGB(vColor), 1.0);
}
`;

function buildStars() {
  const rng = makeRng(20260814);
  const pos = new Float32Array(STAR_COUNT * 3);
  const col = new Float32Array(STAR_COUNT * 3);
  const size = new Float32Array(STAR_COUNT);
  const ink = new THREE.Color(PALETTE.ink);
  const cyan = new THREE.Color(PALETTE.cyan);
  const amber = new THREE.Color(PALETTE.amber);
  const lav = new THREE.Color(PALETTE.violet).lerp(ink, 0.55);
  const px = Math.min(2, window.devicePixelRatio || 1);
  const tmp = new THREE.Color();
  for (let i = 0; i < STAR_COUNT; i++) {
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const rxz = Math.sqrt(Math.max(0, 1 - u * u));
    const r = STAR_NEAR + (STAR_FAR - STAR_NEAR) * rng();
    pos[i * 3] = r * rxz * Math.cos(phi);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * rxz * Math.sin(phi);
    const roll = rng();
    tmp.copy(roll < 0.12 ? cyan : roll < 0.18 ? amber : roll < 0.3 ? lav : ink);
    tmp.multiplyScalar(0.3 + 0.7 * rng() * rng());
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
    const hero = rng() < 0.06;
    size[i] = (hero ? 3.4 + rng() * 1.2 : 1.2 + rng() * 1.6) * px;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function register() {
  AFRAME.registerComponent('space-sky', {
    init() {
      const colors = skyPalette();
      const domeGeo = new THREE.SphereGeometry(DOME_RADIUS, 32, 20);
      const domeMat = new THREE.ShaderMaterial({
        vertexShader: DOME_VERT,
        fragmentShader: DOME_FRAG,
        uniforms: {
          uTop: { value: colors.top },
          uBottom: { value: colors.bottom },
          uHorizon: { value: colors.horizon },
        },
        side: THREE.BackSide,
        depthWrite: false,
      });
      this.dome = new THREE.Mesh(domeGeo, domeMat);
      this.dome.renderOrder = -10;
      this.dome.frustumCulled = false;

      this.stars = buildStars();
      const tilt = new THREE.Group();
      tilt.rotation.z = 0.14;
      tilt.add(this.stars);

      this.group = new THREE.Group();
      this.group.add(this.dome);
      this.group.add(tilt);
      this.el.setObject3D('spaceSky', this.group);
      this.rigEl = document.querySelector('#rig');
    },

    // the dome follows the rig so distant scenery keeps zero parallax over the 1250m rail
    tick(t) {
      this.stars.rotation.y = t * ROT_RATE;
      if (this.rigEl) this.group.position.copy(this.rigEl.object3D.position);
    },

    remove() {
      this.el.removeObject3D('spaceSky');
      this.dome.geometry.dispose();
      this.dome.material.dispose();
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    },
  });
}

if (typeof AFRAME !== 'undefined') register();
