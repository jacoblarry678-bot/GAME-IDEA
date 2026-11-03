// Aerial perspective: replaces three.js's fog with height fog (thick in the
// low air, thinning with altitude, so tall rides and hills stand out of the
// haze) that glows with sunlight when you look toward the sun. Every
// material shares the fog chunks, so this is patched once, before anything
// compiles. Lit materials know the sun through their directional light;
// unlit ones (neon, signs) get the height fog alone.
//
// Also: cloud shadows. Big soft shadows drift slowly across the park as
// clouds pass over the sun, worked into the sunlight itself for every lit
// material. `atmos` is shared by every material (x: time, y: cloud cover).
import * as THREE from 'three';

export const atmos = { x: 0, y: 0.42 };
let installed = false;

export function installAtmosphere() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk;
  C.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogView;
#endif
`;
  C.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogView = mvPosition.xyz;
#endif
`;
  C.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogView;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;
  // lit materials: flag that the sun's light is in scope for the fog, and
  // the cloud shadows
  C.lights_pars_begin = C.lights_pars_begin + `
#define ATMOS_LIT 1
uniform vec2 uAtmos;
float atmosHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float atmosNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( atmosHash( i ), atmosHash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( atmosHash( i + vec2( 0.0, 1.0 ) ), atmosHash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
}
float atmosCloudShadow( vec3 viewPos ) {
  vec3 w = cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz;
  vec2 p = w.xz * 0.0032 + vec2( uAtmos.x * 0.011, uAtmos.x * 0.0045 );
  float n = ( atmosNoise( p ) * 0.5 + atmosNoise( p * 2.1 + 5.2 ) * 0.25 + atmosNoise( p * 4.3 + 1.7 ) * 0.125 ) / 0.875;
  float c = smoothstep( 1.0 - uAtmos.y, 1.0 - uAtmos.y + 0.16, n );
  return 1.0 - c * 0.62;
}
`;
  const dirShadow = 'vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif';
  if (!C.lights_fragment_begin.includes(dirShadow)) throw new Error('atmosphere: lights_fragment_begin changed');
  C.lights_fragment_begin = C.lights_fragment_begin.replace(dirShadow, `${dirShadow}
\t\t#if ( UNROLLED_LOOP_INDEX == 0 )
\t\tdirectLight.color *= atmosCloudShadow( geometryPosition );
\t\t#endif`);
  for (const id of ['standard', 'physical', 'lambert', 'phong', 'toon']) {
    if (THREE.ShaderLib[id]) THREE.ShaderLib[id].uniforms.uAtmos = { value: atmos };
  }
  C.fog_fragment = /* glsl */`
#ifdef USE_FOG
  {
    float fogDist = length( vFogView );
    #ifdef FOG_EXP2
      // the ray from the eye, in the world: how much it climbs or falls
      vec3 rayW = ( vec4( vFogView, 0.0 ) * viewMatrix ).xyz;
      const float falloff = 0.011;
      float h0 = max( cameraPosition.y, 0.0 );
      float dy = rayW.y * falloff;
      float heightTerm = exp( - h0 * falloff ) * ( abs( dy ) > 0.0005 ? ( 1.0 - exp( - dy ) ) / dy : 1.0 );
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDist * fogDist * heightTerm * 1.15 );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    vec3 fogTint = fogColor;
    #if defined( ATMOS_LIT ) && NUM_DIR_LIGHTS > 0
      // looking toward the sun, the haze glows with its light
      float toSun = max( dot( vFogView / max( fogDist, 0.001 ), directionalLights[ 0 ].direction ), 0.0 );
      vec3 sunCol = directionalLights[ 0 ].color;
      fogTint += sunCol * ( pow( toSun, 10.0 ) * 0.16 + pow( toSun, 3.0 ) * 0.035 );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogTint, clamp( fogFactor, 0.0, 1.0 ) );
  }
#endif
`;
}
