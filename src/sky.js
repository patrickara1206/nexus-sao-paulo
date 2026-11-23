import * as T from 'three';

// The sky is rendered in world directions, independent of the player's location.
// Cloud cover is illustrative afternoon weather over the plateau.
export function createSaoPauloSky() {
 const material = new T.ShaderMaterial({
  side: T.BackSide,
  depthWrite: false,
  toneMapped: false,
  uniforms: {
   horizon: {value: new T.Color('#c8dde9')},
   zenith: {value: new T.Color('#387bbd')},
   sunDirection: {value: new T.Vector3(-170,120,-80).normalize()},
   daylight: {value: 1},
   cloudTime: {value: 0},
  },
  vertexShader: `
   varying vec3 domeDirection;
   void main() {
    domeDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
   }
  `,
  fragmentShader: `
   varying vec3 domeDirection;
   uniform vec3 horizon;
   uniform vec3 zenith;
   uniform vec3 sunDirection;
   uniform float daylight;
   uniform float cloudTime;

   float hash(vec2 cell) {
    vec3 p = fract(vec3(cell.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
   }

   float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
   }

   float cloudDensity(vec2 p) {
    mat2 turn = mat2(0.8, 0.6, -0.6, 0.8);
    float value = noise(p) * 0.55;
    p = turn * p * 2.02;
    value += noise(p) * 0.25;
    p = turn * p * 2.04;
    value += noise(p) * 0.14;
    return value + noise(p * 2.08) * 0.06;
   }

   void main() {
    vec3 ray = normalize(domeDirection);
    float elevation = max(0.0, ray.y);
    vec3 color = mix(horizon, zenith, pow(smoothstep(0.0, 0.88, elevation), 0.42));
    float towardSun = max(0.0, dot(ray, sunDirection));
    color += vec3(0.13, 0.088, 0.042) * pow(towardSun, 15.0);

    vec2 cloudPoint = ray.xz / (elevation + 0.19) * 3.2 + vec2(24.1, 31.7) + vec2(cloudTime*.0018,cloudTime*.0005);
    float density = cloudDensity(cloudPoint);
    float cloud = smoothstep(0.49, 0.68, density) * smoothstep(0.015, 0.14, elevation);
    float shading = smoothstep(0.48, 0.78, density + towardSun * 0.11);
    vec3 cloudColor = mix(vec3(0.57, 0.65, 0.73), vec3(0.96, 0.96, 0.93), shading);
    cloudColor *= mix(vec3(.09,.12,.18), vec3(1.0), daylight);
    color = mix(color, cloudColor, cloud * 0.89);

    float solarDisc = smoothstep(0.99995, 0.99999, towardSun) * smoothstep(0.01, 0.07, elevation);
    color += vec3(2.1, 1.8, 1.4) * solarDisc;
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
   }
  `,
 });
 const sky = new T.Mesh(new T.SphereGeometry(1, 32, 18), material);
 sky.name = 'São Paulo — céu diurno e nuvens';
 sky.scale.setScalar(14000);
 sky.frustumCulled = false;
 sky.renderOrder = 10000;
 return sky;
}
