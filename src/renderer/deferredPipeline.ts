import { Filter, GlProgram } from 'pixi.js';

export const ENGINE_NAME = 'Ulf-cRPG-Engine';

export type RenderBufferMode =
  | 'final_pbr'
  | 'albedo_only'
  | 'normal_map'
  | 'depth_dag'
  | 'walkability_fov';

export interface ScreenSpacePointLight {
  screenX: number;
  screenY: number;
  zHeightPx: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
  radiusPx: number;
}

export interface SurfaceNormalMaterialSample {
  nx: number;
  ny: number;
  roughness: number;
  metallic: number;
}

/**
 * Pure mathematical evaluation of the 2.5D Deferred Normal-Mapped PBR lighting model
 * (Blinn-Phong / GGX approximation with metallic specular response and radial falloff).
 */
export function evaluateDeferredPbrLightAtPoint(
  px: number,
  py: number,
  surface: SurfaceNormalMaterialSample,
  lights: ReadonlyArray<ScreenSpacePointLight>,
  ambientIntensity: number,
  out?: { r: number; g: number; b: number; specular: number }
): { r: number; g: number; b: number; specular: number } {
  const nz = Math.sqrt(Math.max(0.05, 1.0 - surface.nx * surface.nx - surface.ny * surface.ny));

  let totalR = ambientIntensity * 0.84;
  let totalG = ambientIntensity * 0.91;
  let totalB = ambientIntensity * 1.14;
  let totalSpec = 0;

  for (const l of lights) {
    const dx = l.screenX - px;
    const dy = l.screenY - py;
    const dist2D = Math.hypot(dx, dy);
    if (dist2D >= l.radiusPx) continue;

    const invLen = 1.0 / Math.max(1.0, Math.hypot(dx, dy, l.zHeightPx));
    const lx = dx * invLen;
    const ly = dy * invLen;
    const lz = l.zHeightPx * invLen;

    const nDotL = Math.max(0.0, surface.nx * lx + surface.ny * ly + nz * lz);
    const normDist = dist2D / l.radiusPx;
    const attenuation = Math.pow(1.0 - normDist * normDist, 2.0) * l.intensity;

    const hx = lx;
    const hy = ly;
    const hz = lz + 1.0;
    const hLen = Math.max(0.001, Math.hypot(hx, hy, hz));
    const nDotH = Math.max(
      0.0,
      (surface.nx * hx + surface.ny * hy + nz * hz) / hLen
    );

    const shininess = Math.max(4.0, (1.0 - surface.roughness) * 64.0);
    const spec =
      Math.pow(nDotH, shininess) *
      (0.18 + surface.metallic * 0.85) *
      attenuation *
      (nDotL > 0 ? 1.0 : 0.0);

    const diffuseTerm = (0.32 + 0.68 * nDotL) * attenuation;
    totalR += l.r * diffuseTerm + l.r * spec;
    totalG += l.g * diffuseTerm + l.g * spec;
    totalB += l.b * diffuseTerm + l.b * spec;
    totalSpec += spec;
  }

  if (out) {
    out.r = totalR;
    out.g = totalG;
    out.b = totalB;
    out.specular = totalSpec;
    return out;
  }

  return {
    r: totalR,
    g: totalG,
    b: totalB,
    specular: totalSpec
  };
}

const VERTEX_GLSL = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreenPx;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    vScreenPx = position;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const FRAGMENT_GLSL = `
precision highp float;
in vec2 vTextureCoord;
in vec2 vScreenPx;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uAmbient;
uniform float uTime;
uniform float uEnablePbr;
uniform vec2 uCameraOffset;
uniform float uZoom;
uniform vec4 uLight0PosRad;
uniform vec4 uLight0ColInt;
uniform vec4 uLight1PosRad;
uniform vec4 uLight1ColInt;
uniform vec4 uLight2PosRad;
uniform vec4 uLight2ColInt;
uniform vec4 uLight3PosRad;
uniform vec4 uLight3ColInt;
uniform vec4 uLight4PosRad;
uniform vec4 uLight4ColInt;
uniform vec4 uLight5PosRad;
uniform vec4 uLight5ColInt;

float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float mistNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbmMist(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
        v += a * mistNoise(p);
        p *= 2.03;
        a *= 0.5;
    }
    return v;
}

vec3 evalPointLight(vec4 posRad, vec4 colInt, vec2 fragPx, vec3 N, vec3 albedo) {
    if (posRad.w <= 1.0 || colInt.w <= 0.001) return vec3(0.0);
    vec2 delta = posRad.xy - fragPx;
    float dist = length(delta);
    if (dist >= posRad.w) return vec3(0.0);

    float normD = dist / posRad.w;
    float atten = pow(max(0.0, 1.0 - normD * normD), 2.4) * min(colInt.w, 1.25);

    vec3 L = normalize(vec3(delta, posRad.z));
    float nDotL = max(0.0, dot(N, L));

    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float nDotH = max(0.0, dot(N, H));
    float spec = pow(nDotH, 32.0) * 0.14 * atten;

    vec3 diffuse = albedo * colInt.rgb * (0.12 + 0.34 * nDotL) * atten;
    vec3 specular = colInt.rgb * spec;
    return diffuse + specular;
}

void main(void) {
    vec4 base = texture(uTexture, vTextureCoord);
    if (uEnablePbr < 0.5) {
        finalColor = base;
        return;
    }

    // Reconstruct micro-surface normal from neighborhood relief gradients
    vec2 texel = uInputSize.zw * 1.25;
    vec3 cL = texture(uTexture, vTextureCoord - vec2(texel.x, 0.0)).rgb;
    vec3 cR = texture(uTexture, vTextureCoord + vec2(texel.x, 0.0)).rgb;
    vec3 cU = texture(uTexture, vTextureCoord - vec2(0.0, texel.y)).rgb;
    vec3 cD = texture(uTexture, vTextureCoord + vec2(0.0, texel.y)).rgb;

    float hL = dot(cL, vec3(0.299, 0.587, 0.114));
    float hR = dot(cR, vec3(0.299, 0.587, 0.114));
    float hU = dot(cU, vec3(0.299, 0.587, 0.114));
    float hD = dot(cD, vec3(0.299, 0.587, 0.114));

    vec3 N = normalize(vec3((hL - hR) * 2.4, (hU - hD) * 2.4, 1.0));

    // Subtle Bloom only for very bright flame cores (> 0.82)
    vec3 avgNeighbor = (cL + cR + cU + cD) * 0.25;
    vec3 bloom = max(vec3(0.0), avgNeighbor - vec3(0.82)) * 0.16;

    // Natural ambient illumination preserving dark fantasy contrast & texture details
    float zenith = 0.90 + 0.10 * max(0.0, dot(N, normalize(vec3(-0.35, -0.55, 0.75))));
    float ambFactor = mix(0.48, 0.92, clamp(uAmbient, 0.1, 1.0));
    vec3 ambientCol = base.rgb * vec3(0.92, 0.95, 1.04) * (ambFactor * zenith);

    vec3 dynamicLights = vec3(0.0);
    dynamicLights += evalPointLight(uLight0PosRad, uLight0ColInt, vScreenPx, N, base.rgb);
    dynamicLights += evalPointLight(uLight1PosRad, uLight1ColInt, vScreenPx, N, base.rgb);
    dynamicLights += evalPointLight(uLight2PosRad, uLight2ColInt, vScreenPx, N, base.rgb);
    dynamicLights += evalPointLight(uLight3PosRad, uLight3ColInt, vScreenPx, N, base.rgb);
    dynamicLights += evalPointLight(uLight4PosRad, uLight4ColInt, vScreenPx, N, base.rgb);
    dynamicLights += evalPointLight(uLight5PosRad, uLight5ColInt, vScreenPx, N, base.rgb);

    // Energy-conserving soft-knee compression so overlapping lights never blind or wash out textures
    dynamicLights = dynamicLights / (vec3(1.0) + dynamicLights * 1.35);

    // Subtle drifting woodland mist
    vec2 worldCoord = (vScreenPx - uCameraOffset) / max(0.2, uZoom);
    float mist = fbmMist(worldCoord * 0.0045 + vec2(uTime * 0.04, -uTime * 0.02));
    float mistMask = smoothstep(0.55, 0.85, mist) * 0.045;
    vec3 mistCol = (vec3(0.10, 0.15, 0.22) + dynamicLights * 0.25) * mistMask;

    vec3 col = ambientCol + dynamicLights + bloom + mistCol;

    // Gentle vignette & soft shoulder roll-off without over-brightening midtones
    vec2 centered = vTextureCoord * 2.0 - 1.0;
    float vig = clamp(1.0 - dot(centered, centered) * 0.16, 0.68, 1.0);
    col *= vig;
    col = col / (vec3(1.0) + max(vec3(0.0), col - vec3(0.75)) * 0.65);

    finalColor = vec4(clamp(col, 0.0, 1.0), base.a);
}
`;

export function createAtmosphericPostFilter(): Filter | null {
  try {
    const glProgram = GlProgram.from({
      vertex: VERTEX_GLSL.trim(),
      fragment: FRAGMENT_GLSL.trim(),
      name: 'ulf-crpg-engine-post-fx'
    });
    return new Filter({
      glProgram,
      resources: {
        postUniforms: {
          uAmbient: { value: 0.46, type: 'f32' },
          uTime: { value: 0.0, type: 'f32' },
          uEnablePbr: { value: 1.0, type: 'f32' },
          uCameraOffset: { value: [640, 360], type: 'vec2<f32>' },
          uZoom: { value: 1.0, type: 'f32' },
          uLight0PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight0ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' },
          uLight1PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight1ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' },
          uLight2PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight2ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' },
          uLight3PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight3ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' },
          uLight4PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight4ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' },
          uLight5PosRad: { value: [0, 0, 42, 0], type: 'vec4<f32>' },
          uLight5ColInt: { value: [1, 0.65, 0.25, 0], type: 'vec4<f32>' }
        }
      }
    });
  } catch {
    return null;
  }
}

export function updateAtmosphericFilterUniforms(
  filter: Filter | null,
  ambient: number,
  time: number,
  enablePbr: boolean,
  cameraOffsetX: number,
  cameraOffsetY: number,
  zoom: number,
  lights: ReadonlyArray<ScreenSpacePointLight>
): void {
  if (!filter) return;
  const group = filter.resources.postUniforms?.uniforms;
  if (!group) return;

  group.uAmbient = ambient;
  group.uTime = time;
  group.uEnablePbr = enablePbr ? 1.0 : 0.0;
  if (!group.uCameraOffset) {
    group.uCameraOffset = [cameraOffsetX, cameraOffsetY];
  } else {
    group.uCameraOffset[0] = cameraOffsetX;
    group.uCameraOffset[1] = cameraOffsetY;
  }
  group.uZoom = zoom;

  for (let i = 0; i < 6; i++) {
    const l = lights[i];
    const posKey = `uLight${i}PosRad`;
    const colKey = `uLight${i}ColInt`;
    if (l) {
      const canvasX = cameraOffsetX + l.screenX * zoom;
      const canvasY = cameraOffsetY + (l.screenY - 24) * zoom;
      if (!group[posKey]) {
        group[posKey] = [canvasX, canvasY, l.zHeightPx * zoom, l.radiusPx * zoom];
      } else {
        group[posKey][0] = canvasX;
        group[posKey][1] = canvasY;
        group[posKey][2] = l.zHeightPx * zoom;
        group[posKey][3] = l.radiusPx * zoom;
      }
      if (!group[colKey]) {
        group[colKey] = [l.r, l.g, l.b, l.intensity];
      } else {
        group[colKey][0] = l.r;
        group[colKey][1] = l.g;
        group[colKey][2] = l.b;
        group[colKey][3] = l.intensity;
      }
    } else {
      if (!group[posKey]) {
        group[posKey] = [0, 0, 0, 0];
      } else {
        group[posKey][0] = 0;
        group[posKey][1] = 0;
        group[posKey][2] = 0;
        group[posKey][3] = 0;
      }
      if (!group[colKey]) {
        group[colKey] = [0, 0, 0, 0];
      } else {
        group[colKey][0] = 0;
        group[colKey][1] = 0;
        group[colKey][2] = 0;
        group[colKey][3] = 0;
      }
    }
  }
}
