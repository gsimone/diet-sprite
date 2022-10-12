import { shaderMaterial } from "@react-three/drei";
import { extend } from "@react-three/fiber";

export const materialKey = (() => Math.random())();

const billboardChunk = /* glsl */ `
  vec3 billboard(vec2 v, mat4 view){
    vec3 up = vec3(view[0][1], view[1][1], view[2][1]);
    vec3 right = vec3(view[0][0], view[1][0], view[2][0]);
    vec3 p = right * v.x + up * v.y;
    return p;
  }
`;

const MyMaterial = shaderMaterial(
  {
    u_data: null,
    u_map: null,
    u_index: 0,
    u_slices: [4, 4],
    u_vertices: 8,
    u_debugUv: 0,
  },
  /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D u_data;
  uniform float u_index;

  uniform vec2 u_slices;
  uniform float u_vertices;
  
  // returns the relative UVs in the flipbook given absolute UVs and flipbook data 
  vec2 flipbookUv( vec2 uv, vec2 slices, float index ) {
    float horizontalIndex = mod(index, slices.x);
    float verticalIndex = floor(index / slices.x);
    
    float u = uv.x + 0.5;
    u = u / slices.x +  (1. / slices.x) * horizontalIndex;

    float v = uv.y + 0.5;
    v = ( v / slices.y) + 1. - (1. / slices.y) * (verticalIndex + 1.);

    return vec2(u, v);
  }

  vec3 getPositionFromDataTexture( sampler2D dataTexture, int vertexID, float numberOfVertices, vec2 slices, float index) {
    float u = float( vertexID ) / numberOfVertices;
    float total = slices.x * slices.y;
    float v  = ( 1. / total ) * index;
    vec3 pos = texture2D( dataTexture, vec2( u, v ) ).rgb;

    return pos;
  }

  ${billboardChunk}
  
  void main () {
    // the index is offset by gl_instanceID to give it some pizzaz
    float offsetIndex = u_index - mod(float(gl_InstanceID), u_slices.x * u_slices.y);

    vec3 pos = getPositionFromDataTexture( u_data, gl_VertexID, u_vertices, u_slices, offsetIndex );
    vUv = flipbookUv( pos.xy, u_slices, offsetIndex );

    #ifdef USE_INSTANCING
      pos = (instanceMatrix * vec4(pos, 1.0)).xyz;
    #endif

    pos = billboard( pos.xy, viewMatrix );

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`,
  /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D u_map;
  uniform float u_index;
  uniform float u_debugUv;

  void main() {
    vec4 color = texture2D(u_map, vUv).rgba;
    
    gl_FragColor = vec4(mix(color, vec4(vUv, 0., 1.), u_debugUv));
  }
`
);

/**
 * Simple material that renders UVs
 */
const MyUVsMaterial = shaderMaterial(
  {},
  /* glsl */ `
  varying vec2 vUv; 

  void main () {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,
  /* glsl */ `
  varying vec2 vUv;

  void main () {
    gl_FragColor = vec4(vUv, 0.0, 1.0);
  }
`
);

/*
 * Simple Billboard material
 **/
const MyBillboardMaterial = shaderMaterial(
  {
    map: null,
  },
  /* glsl */ `
  varying vec2 vUv; 

  ${billboardChunk}

  void main () {
    vUv = uv;

    vec4 transformed = vec4(position, 1.);

    transformed = vec4(billboard(transformed.xy, viewMatrix), 1.);

    #ifdef USE_INSTANCING
      transformed = instanceMatrix * transformed;
    #endif
    
    gl_Position = projectionMatrix * modelViewMatrix * transformed;
  }
`,
  /* glsl */ `
  varying vec2 vUv;
  uniform sampler2D map;

  void main () {
    vec4 col = texture2D(map, vUv);
    gl_FragColor = vec4(col);
  }
`
);

extend({ MyMaterial, MyBillboardMaterial, MyUVsMaterial });
