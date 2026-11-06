import { Filter, GlProgram } from 'pixi.js';

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
  ambientIntensity: number
): { r: number; g: number; b: number; specular: number } {
  const nz = Math.sqrt(Math.max(0.05, 1.0 - surface.nx * surface.nx - surface.ny * surface.ny));

  // Cool moonlight directional zenith term
  let totalR = ambientIntensity * 0.86;
  let totalG = ambientIntensity * 0.92;
  let totalB = ambientIntensity * 1.12;
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

    // Half-vector with viewer at (0, 0, 1)
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

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
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
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uAmbient;
uniform float uTime;

void main(void) {
    vec4 base = texture(uTexture, vTextureCoord);
    // Subtle ACES-inspired filmic contrast & atmospheric dark fantasy vignette
    vec2 uv = vTextureCoord;
    vec2 centered = uv * 2.0 - 1.0;
    float vig = clamp(1.0 - dot(centered, centered) * 0.22, 0.58, 1.0);
    vec3 col = base.rgb * vig;
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    finalColor = vec4(col, base.a);
}
`;

export function createAtmosphericPostFilter(): Filter | null {
  try {
    const glProgram = GlProgram.from({
      vertex: VERTEX_GLSL,
      fragment: FRAGMENT_GLSL,
      name: 'aethelgard-post-fx'
    });
    return new Filter({
      glProgram,
      resources: {
        postUniforms: {
          uAmbient: { value: 0.42, type: 'f32' },
          uTime: { value: 0.0, type: 'f32' }
        }
      }
    });
  } catch {
    return null;
  }
}
