import * as THREE from 'three';
import { FBOVisualizer } from './FBOVisualizer';

const billboardChunk = /* glsl */ `
  mat4 billboardMatrix(mat4 modelView) {
    // Create a billboard matrix by removing rotation
    // Keep only translation (last column) and scale
    mat4 bb = modelView;
    bb[0][0] = 1.0;
    bb[0][1] = 0.0;
    bb[0][2] = 0.0;
    
    bb[1][0] = 0.0;
    bb[1][1] = 1.0;
    bb[1][2] = 0.0;
    
    bb[2][0] = 0.0;
    bb[2][1] = 0.0;
    bb[2][2] = 1.0;
    
    return bb;
  }
`;

function createOverdrawCountMaterial(map: THREE.Texture, threshold: number, maxOverdraw: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
      alphaTest: { value: threshold },
      overdrawIncrement: { value: 1.0 / maxOverdraw },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;

      ${billboardChunk}

      void main() {
        vUv = uv;
        
        vec4 pos = vec4(position, 1.0);
        
        #ifdef USE_INSTANCING
          pos = instanceMatrix * pos;
        #endif
        
        // Apply billboard transformation
        mat4 bbModelView = billboardMatrix(modelViewMatrix);
        vec4 mvPosition = bbModelView * pos;
        
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float alphaTest;
      uniform float overdrawIncrement;
      varying vec2 vUv;
      
      void main() {
        // Sample the texture
        
        // Output a normalized increment for additive blending
        // Each pixel drawn will add this amount
        gl_FragColor = vec4(overdrawIncrement, 0.0, 0.0, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: false,
  });
}

function createVisualizationMaterial(overdrawTexture: THREE.Texture, maxOverdraw: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tOverdraw: { value: overdrawTexture },
      maxOverdraw: { value: maxOverdraw },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tOverdraw;
      uniform float maxOverdraw;
      varying vec2 vUv;
      
      // Magma color map (common in data visualization)
      // Perceptually uniform gradient from black through purple, red, orange to yellow
      vec3 heatMap(float value) {
        // Clamp value to [0, 1]
        value = clamp(value, 0.0, 1.0);
        
        // Magma color map approximation
        // Black -> purple -> magenta -> red -> orange -> yellow
        vec3 c0 = vec3(0.001, 0.001, 0.014); // Almost black
        vec3 c1 = vec3(0.106, 0.063, 0.314); // Dark purple
        vec3 c2 = vec3(0.357, 0.106, 0.490); // Purple-magenta
        vec3 c3 = vec3(0.647, 0.161, 0.431); // Magenta-red
        vec3 c4 = vec3(0.906, 0.357, 0.329); // Red-orange
        vec3 c5 = vec3(0.992, 0.682, 0.380); // Orange-yellow
        vec3 c6 = vec3(0.996, 0.996, 0.749); // Light yellow
        
        vec3 color;
        if (value < 0.166) {
          color = mix(c0, c1, value * 6.0);
        } else if (value < 0.333) {
          color = mix(c1, c2, (value - 0.166) * 6.0);
        } else if (value < 0.5) {
          color = mix(c2, c3, (value - 0.333) * 6.0);
        } else if (value < 0.666) {
          color = mix(c3, c4, (value - 0.5) * 6.0);
        } else if (value < 0.833) {
          color = mix(c4, c5, (value - 0.666) * 6.0);
        } else {
          color = mix(c5, c6, (value - 0.833) * 6.0);
        }
        
        return color;
      }
      
      void main() {
        // Read overdraw count from render target
        float overdrawCount = texture2D(tOverdraw, vUv).r;
        
        // Apply exponential scaling to make differences more apparent
        // pow(x, 0.5) = sqrt(x) makes small values more visible
        float normalizedOverdraw = pow(overdrawCount, 0.5);
        
        // Apply heat map coloring
        vec3 color = heatMap(normalizedOverdraw);
        
        // Show black for no overdraw
        if (overdrawCount < 0.001) {
          color = vec3(0.0);
        }
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
}

export interface OverdrawVisualizerOptions {
  renderer: THREE.WebGLRenderer;
  camera: THREE.Camera;
  geometry: THREE.BufferGeometry;
  map: THREE.Texture;
  threshold: number;
  instanceCount?: number;
  instanceMatrices?: THREE.Matrix4[];
  maxOverdraw?: number;
}

export class OverdrawVisualizer {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.Camera;
  
  // Two render targets: one for accumulating overdraw, one for visualization
  private overdrawRenderTarget: THREE.WebGLRenderTarget;
  private visualizationRenderTarget: THREE.WebGLRenderTarget;
  
  // Overdraw counting scene
  private overdrawScene: THREE.Scene;
  private mesh: THREE.Mesh | THREE.InstancedMesh;
  private overdrawCountMaterial: THREE.ShaderMaterial;
  
  // Visualization scene (heat map)
  private visualizationScene: THREE.Scene;
  private visualizationCamera: THREE.OrthographicCamera;
  private visualizationMaterial: THREE.ShaderMaterial;
  private visualizationQuad: THREE.Mesh;
  
  private fboVisualizer: FBOVisualizer;
  private maxOverdraw: number;

  constructor(options: OverdrawVisualizerOptions) {
    this.renderer = options.renderer;
    this.camera = options.camera;
    this.maxOverdraw = options.maxOverdraw ?? 100.0;

    // Get renderer size
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    // Create render target for accumulating overdraw counts
    this.overdrawRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType, // Use float for accurate accumulation
    });

    // Create render target for visualization (heat map)
    this.visualizationRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // Create overdraw counting scene
    this.overdrawScene = new THREE.Scene();
    this.overdrawScene.background = new THREE.Color(0x0C1116);

    // Create overdraw counting material
    this.overdrawCountMaterial = createOverdrawCountMaterial(
      options.map,
      options.threshold,
      this.maxOverdraw
    );

    // Create mesh or instanced mesh
    if (options.instanceCount && options.instanceMatrices && options.instanceMatrices.length > 0) {
      const instancedMesh = new THREE.InstancedMesh(
        options.geometry,
        this.overdrawCountMaterial,
        options.instanceCount
      );

      // Set instance matrices
      for (let i = 0; i < options.instanceMatrices.length; i++) {
        instancedMesh.setMatrixAt(i, options.instanceMatrices[i]);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;

      this.mesh = instancedMesh;
    } else {
      const mesh = new THREE.Mesh(options.geometry, this.overdrawCountMaterial);
      mesh.scale.setScalar(6); // Match the scale from Scene3D
      this.mesh = mesh;
    }

    this.overdrawScene.add(this.mesh);

    // Create visualization scene with heat map
    this.visualizationScene = new THREE.Scene();
    this.visualizationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    this.visualizationMaterial = createVisualizationMaterial(
      this.overdrawRenderTarget.texture,
      this.maxOverdraw
    );
    
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.visualizationQuad = new THREE.Mesh(quadGeometry, this.visualizationMaterial);
    this.visualizationScene.add(this.visualizationQuad);

    // Create FBO visualizer (displays the heat map)
    const visualizerScale = 0.25;
    const visualizerHeight = size.y * visualizerScale;
    const visualizerWidth = size.x * visualizerScale;

    this.fboVisualizer = new FBOVisualizer({
      renderTarget: this.visualizationRenderTarget,
      renderer: this.renderer,
      size: { width: visualizerWidth, height: visualizerHeight },
      position: { x: 20, y: size.y - visualizerHeight - 20 },
    });
  }

  /**
   * Update the visualizer (call this every frame)
   */
  render() {
    // Store current state
    const originalRenderTarget = this.renderer.getRenderTarget();
    const originalAutoClear = this.renderer.autoClear;
    const originalClearColor = this.renderer.getClearColor(new THREE.Color());
    const originalClearAlpha = this.renderer.getClearAlpha();

    // PASS 1: Render overdraw counting scene to accumulate overdraw values
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(this.overdrawRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.overdrawScene, this.camera);

    // PASS 2: Render visualization (heat map) to visualization render target
    this.renderer.setRenderTarget(this.visualizationRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.visualizationScene, this.visualizationCamera);

    // Restore render target and state
    this.renderer.setRenderTarget(originalRenderTarget);
    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.autoClear = originalAutoClear;

    // Render FBO visualizer to screen
    this.fboVisualizer.render();
  }

  /**
   * Update render target size on window resize
   */
  setSize(width: number, height: number) {
    this.overdrawRenderTarget.setSize(width, height);
    this.visualizationRenderTarget.setSize(width, height);

    const visualizerScale = 0.25;
    const visualizerHeight = height * visualizerScale;
    const visualizerWidth = width * visualizerScale;

    this.fboVisualizer.setSize(visualizerWidth, visualizerHeight);
    this.fboVisualizer.setPosition(20, height - visualizerHeight - 20);
  }

  /**
   * Set the maximum overdraw count for normalization
   * Higher values make the heat map less sensitive
   */
  setMaxOverdraw(value: number) {
    this.maxOverdraw = value;
    this.visualizationMaterial.uniforms.maxOverdraw.value = value;
    this.overdrawCountMaterial.uniforms.overdrawIncrement.value = 1.0 / value;
  }

  /**
   * Update instance matrices (for animated instances)
   */
  updateInstanceMatrices(matrices: THREE.Matrix4[]) {
    if (this.mesh instanceof THREE.InstancedMesh) {
      for (let i = 0; i < matrices.length; i++) {
        this.mesh.setMatrixAt(i, matrices[i]);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.overdrawRenderTarget.dispose();
    this.visualizationRenderTarget.dispose();
    this.overdrawCountMaterial.dispose();
    this.visualizationMaterial.dispose();
    this.visualizationQuad.geometry.dispose();
    this.fboVisualizer.dispose();

    if (this.mesh instanceof THREE.InstancedMesh) {
      this.mesh.dispose();
    }
  }
}

