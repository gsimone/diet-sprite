import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DietSpriteGeometry } from 'diet-sprite';
import { RenderLoop } from './RenderLoop';
import Stats from 'stats.js';

const MAX_OVERDRAW = 30;

/**
 * From `maath/random`
 * 
 * Generate random points uniformly distributed in a sphere
 * @param buffer - Float32Array to fill with points (length should be multiple of 3)
 * @param options - Options with radius of the sphere
 * @returns The filled buffer
 */
function randomInSphere(buffer: Float32Array, options: { radius: number }): Float32Array {
  const { radius } = options;
  const count = buffer.length / 3;
  
  for (let i = 0; i < count; i++) {
    // Generate random point in sphere using rejection sampling
    let x, y, z, len;
    do {
      x = Math.random() * 2 - 1;
      y = Math.random() * 2 - 1;
      z = Math.random() * 2 - 1;
      len = Math.sqrt(x * x + y * y + z * z);
    } while (len > 1);
    
    // Scale to desired radius
    buffer[i * 3] = x * radius;
    buffer[i * 3 + 1] = y * radius;
    buffer[i * 3 + 2] = z * radius;
  }
  
  return buffer;
}

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

function createBillboardMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map },
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
      varying vec2 vUv;
      uniform sampler2D map;

      void main() {
        vec4 col = texture2D(map, vUv);
       
        gl_FragColor = vec4(col);
      }
    `,
    transparent: true,
    depthWrite: true,
    depthTest: true,
    alphaTest: 0.1,
    depthFunc: THREE.LessEqualDepth,
  });
}

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
        vec4 texColor = texture2D(map, vUv);
        gl_FragColor = vec4(overdrawIncrement, 0.0, 0.0, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
  });
}

function createVisualizationMaterial(overdrawTexture: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      tOverdraw: { value: overdrawTexture },
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
      varying vec2 vUv;
      
      // Magma color map (common in data visualization)
      // Perceptually uniform gradient from black through purple, red, orange to yellow
      vec3 heatMap(float value) {
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
        float overdrawCount = texture2D(tOverdraw, vUv).r;
        vec3 color = heatMap(overdrawCount);
        
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

function createSimpleQuadGeometry(texture: THREE.Texture): THREE.BufferGeometry {
  const geometry = new THREE.PlaneGeometry(1, texture.image.height / texture.image.width);
  return geometry;
}

export interface Scene3DOptions {
  container: HTMLElement;
  imageSrc: string;
  vertices: number;
  threshold: number;
  gridSize: number;
  animate?: boolean;
  fps?: number;
  useInstancing?: boolean;
  instanceGridSize?: number;
}

export class Scene3D {
  private container: HTMLElement;
  
  // Left canvas (simple quad overdraw visualization)
  private leftRenderer: THREE.WebGLRenderer;
  private leftOverdrawScene: THREE.Scene;
  private leftOverdrawMesh: THREE.Mesh | THREE.InstancedMesh | null = null;
  private leftOverdrawRT: THREE.WebGLRenderTarget;
  private leftVisualizationRT: THREE.WebGLRenderTarget;
  
  // Right canvas (clipped sprite overdraw visualization)
  private rightRenderer: THREE.WebGLRenderer;
  private rightOverdrawScene: THREE.Scene;
  private rightOverdrawMesh: THREE.Mesh | THREE.InstancedMesh | null = null;
  private rightOverdrawRT: THREE.WebGLRenderTarget;
  private rightVisualizationRT: THREE.WebGLRenderTarget;
  
  // Shared resources
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private clock: THREE.Clock;
  private renderLoop: RenderLoop;
  
  private texture: THREE.Texture | null = null;
  private quadGeometry: THREE.BufferGeometry | null = null;
  private clippedGeometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private overdrawMaterial: THREE.ShaderMaterial | null = null;
  
  // Visualization
  private visualizationScene: THREE.Scene;
  private visualizationCamera: THREE.OrthographicCamera;
  private leftVisualizationMaterial: THREE.ShaderMaterial | null = null;
  private rightVisualizationMaterial: THREE.ShaderMaterial | null = null;
  private visualizationQuad: THREE.Mesh;
  
  private options: Required<Scene3DOptions>;
  private currentFrameIndex: number = 0;
  private instanceMatrices: THREE.Matrix4[] = [];
  private rotationSpeed: number = 10; // degrees per second
  
  private resizeObserver: ResizeObserver;
  private stats: Stats;
  
  // Store event listeners for cleanup
  private eventListeners: Map<string, (e: Event) => void> = new Map();
  
  // Track disposal and loading state
  private disposed: boolean = false;
  private loadingImage: HTMLImageElement | null = null;

  constructor(options: Scene3DOptions) {
    console.log('Scene3D constructor called');
    this.container = options.container;
    this.options = {
      ...options,
      animate: options.animate ?? false,
      fps: options.fps ?? 30,
      useInstancing: options.useInstancing ?? false,
      instanceGridSize: options.instanceGridSize ?? 128,
    };

    this.clock = new THREE.Clock();

    // Create stats (hidden by default, can be shown if needed)
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.position = 'absolute';
    this.stats.dom.style.left = '0px';
    this.stats.dom.style.top = '0px';
    this.stats.dom.style.display = 'none'; // Hide the stats panel
    this.container.appendChild(this.stats.dom);

    // Create wrapper div for two canvases
    const canvasWrapper = document.createElement('div');
    canvasWrapper.style.display = 'flex';
    canvasWrapper.style.width = '100%';
    canvasWrapper.style.height = '100%';
    canvasWrapper.style.gap = '0px';
    this.container.appendChild(canvasWrapper);

    // Create left container with canvas and label
    const leftContainer = document.createElement('div');
    leftContainer.style.position = 'relative';
    leftContainer.style.width = '50%';
    leftContainer.style.height = '100%';
    canvasWrapper.appendChild(leftContainer);

    // Create left renderer (simple quad)
    this.leftRenderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
    });
    this.leftRenderer.setPixelRatio(window.devicePixelRatio);
    this.leftRenderer.domElement.style.width = '100%';
    this.leftRenderer.domElement.style.height = '100%';
    leftContainer.appendChild(this.leftRenderer.domElement);

    // Left label will be added by React component

    // Create right container with canvas and label
    const rightContainer = document.createElement('div');
    rightContainer.style.position = 'relative';
    rightContainer.style.width = '50%';
    rightContainer.style.height = '100%';
    canvasWrapper.appendChild(rightContainer);

    // Create right renderer (clipped sprite)
    this.rightRenderer = new THREE.WebGLRenderer({ 
      alpha: true,
      antialias: true,
    });
    this.rightRenderer.setPixelRatio(window.devicePixelRatio);
    this.rightRenderer.domElement.style.width = '100%';
    this.rightRenderer.domElement.style.height = '100%';
    rightContainer.appendChild(this.rightRenderer.domElement);

    // Right label will be added by React component

    // Create overdraw scenes
    this.leftOverdrawScene = new THREE.Scene();
    this.leftOverdrawScene.background = new THREE.Color(0x0C1116);
    
    this.rightOverdrawScene = new THREE.Scene();
    this.rightOverdrawScene.background = new THREE.Color(0x0C1116);

    // Create shared camera
    const aspect = (this.container.clientWidth / 2) / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100000);
    
    // Calculate camera position to fit around instances sphere
    const sphereRadius = 15; // Same as in createInstancedMeshes
    const padding = 20; // Extra padding around the sphere
    const distance = sphereRadius + padding;
    
    // Position camera at an angle to show the sphere nicely
    this.camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
    
    // Create render targets
    const width = Math.floor(this.container.clientWidth / 2);
    const height = this.container.clientHeight;
    
    this.leftOverdrawRT = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
    
    this.leftVisualizationRT = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    this.rightOverdrawRT = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    });
    
    this.rightVisualizationRT = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });

    // Create visualization scene
    this.visualizationScene = new THREE.Scene();
    this.visualizationCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeom = new THREE.PlaneGeometry(2, 2);
    this.visualizationQuad = new THREE.Mesh(quadGeom);
    this.visualizationScene.add(this.visualizationQuad);
    
    // Now set size after everything is created
    this.updateSize();

    // Create controls - attach to right canvas, but apply to shared camera
    this.controls = new OrbitControls(this.camera, this.rightRenderer.domElement);
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    this.controls.enableZoom = false;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 10; // Closer to the sphere
    this.controls.maxDistance = 100; // Not too far away

    // Also listen to left canvas for controls
    const leftCanvas = this.leftRenderer.domElement;
    const rightCanvas = this.rightRenderer.domElement;
    
    // Forward mouse events from left canvas to controls
    ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'contextmenu'].forEach(eventType => {
      const handler = (e: Event) => {
        const newEvent = new (e.constructor as any)(e.type, e);
        rightCanvas.dispatchEvent(newEvent);
      };
      leftCanvas.addEventListener(eventType, handler);
      this.eventListeners.set(eventType, handler);
    });

    // Create empty dummy scene for RenderLoop (we handle all rendering in hooks)
    const dummyScene = new THREE.Scene();
    
    // Create render loop - we handle all rendering in the hooks
    this.renderLoop = new RenderLoop({
      scene: dummyScene,
      camera: this.camera,
      renderer: this.rightRenderer,
      controls: this.controls,
      stats: this.stats,
      disableAutoResize: true,
    });

    // Set up render hooks
    this.renderLoop.setHooks({
      beforeRender: this.handleBeforeRender,
      afterRender: this.handleAfterRender,
    });

    // Handle resize
    this.resizeObserver = new ResizeObserver(() => {
      this.updateSize();
    });
    this.resizeObserver.observe(this.container);

    // Load texture and start
    this.loadTexture();
  }


  private updateSize() {
    const width = Math.floor(this.container.clientWidth / 2);
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.leftRenderer.setSize(width, height);
    this.rightRenderer.setSize(width, height);
    
    this.leftOverdrawRT.setSize(width, height);
    this.leftVisualizationRT.setSize(width, height);
    this.rightOverdrawRT.setSize(width, height);
    this.rightVisualizationRT.setSize(width, height);
  }

  private async loadTexture() {
    return new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = this.options.imageSrc;
      
      // Store reference for cleanup
      this.loadingImage = image;
      
      image.onload = () => {
        // Check if disposed during loading
        if (this.disposed) {
          resolve();
          return;
        }
        
        this.texture = new THREE.Texture(image);
        this.texture.needsUpdate = true;
        this.loadingImage = null; // Clear reference once loaded
        this.createScene();
        this.start();
        resolve();
      };
      
      image.onerror = (error) => {
        this.loadingImage = null;
        reject(error);
      };
    });
  }


  private createScene() {
    if (!this.texture) return;

    const gridDimension = Math.sqrt(this.options.gridSize);
    const horizontalSlices = gridDimension;
    const verticalSlices = gridDimension;

    // Create simple quad geometry for left side
    this.quadGeometry = createSimpleQuadGeometry(this.texture);

    // Create clipped sprite geometry for right side
    this.clippedGeometry = new DietSpriteGeometry(
      this.texture,
      this.options.vertices,
      this.options.threshold,
      [horizontalSlices, verticalSlices],
      [0, 0],
      true
    );

    // Create materials
    this.material = createBillboardMaterial(this.texture);
    this.overdrawMaterial = createOverdrawCountMaterial(this.texture, this.options.threshold, MAX_OVERDRAW);

    // Create visualization materials
    this.leftVisualizationMaterial = createVisualizationMaterial(this.leftOverdrawRT.texture);
    this.rightVisualizationMaterial = createVisualizationMaterial(this.rightOverdrawRT.texture);

    if (this.options.useInstancing) {
      this.createInstancedMeshes();
    } else {
      this.createSingleMeshes();
    }
  }


  private createSingleMeshes() {
    if (!this.quadGeometry || !this.clippedGeometry || !this.overdrawMaterial) return;

    // Left overdraw scene: simple quad
    this.leftOverdrawMesh = new THREE.Mesh(this.quadGeometry, this.overdrawMaterial);
    this.leftOverdrawMesh.scale.setScalar(6);
    this.leftOverdrawScene.add(this.leftOverdrawMesh);

    // Right overdraw scene: clipped sprite
    this.rightOverdrawMesh = new THREE.Mesh(this.clippedGeometry, this.overdrawMaterial);
    this.rightOverdrawMesh.scale.setScalar(6);
    this.rightOverdrawScene.add(this.rightOverdrawMesh);
  }

  private createInstancedMeshes() {
    if (!this.quadGeometry || !this.clippedGeometry || !this.overdrawMaterial) return;

    const gridSize = this.options.instanceGridSize;
    const count = gridSize * gridSize;

    // Set up instance positions in a sphere
    const radius = 15;
    const points = randomInSphere(new Float32Array(count * 3), { radius });
    const dummy = new THREE.Object3D();
    this.instanceMatrices = [];

    for (let i = 0; i < count; i++) {
      const x = points[i * 3];
      const y = points[i * 3 + 1];
      const z = points[i * 3 + 2];
      
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      const matrix = dummy.matrix.clone();
      this.instanceMatrices.push(matrix);
    }

    // Left overdraw scene: simple quad instanced
    const leftOverdrawInstancedMesh = new THREE.InstancedMesh(this.quadGeometry, this.overdrawMaterial, count);
    for (let i = 0; i < count; i++) {
      leftOverdrawInstancedMesh.setMatrixAt(i, this.instanceMatrices[i]);
    }
    leftOverdrawInstancedMesh.instanceMatrix.needsUpdate = true;
    this.leftOverdrawMesh = leftOverdrawInstancedMesh;
    this.leftOverdrawScene.add(leftOverdrawInstancedMesh);

    // Right overdraw scene: clipped sprite instanced
    const rightOverdrawInstancedMesh = new THREE.InstancedMesh(this.clippedGeometry, this.overdrawMaterial, count);
    for (let i = 0; i < count; i++) {
      rightOverdrawInstancedMesh.setMatrixAt(i, this.instanceMatrices[i]);
    }
    rightOverdrawInstancedMesh.instanceMatrix.needsUpdate = true;
    this.rightOverdrawMesh = rightOverdrawInstancedMesh;
    this.rightOverdrawScene.add(rightOverdrawInstancedMesh);
  }

  private handleBeforeRender = () => {
    // Update animation frame if needed
    if (this.options.animate && this.texture) {
      const gridDimension = Math.sqrt(this.options.gridSize);
      const totalFrames = gridDimension * gridDimension;
      
      if (totalFrames > 1) {
        const t = this.clock.getElapsedTime();
        const newIndex = Math.floor(t * this.options.fps) % totalFrames;
        
        if (newIndex !== this.currentFrameIndex) {
          this.currentFrameIndex = newIndex;
          this.updateGeometry();
        }
      }
    }

    // Rotate particle systems slowly
    const elapsedTime = this.clock.getElapsedTime();
    const rotationAngle = (elapsedTime * this.rotationSpeed * Math.PI) / 180; // Convert to radians
    
    // Rotate around Y axis
    if (this.leftOverdrawMesh) {
      this.leftOverdrawMesh.rotation.y = rotationAngle;
    }
    if (this.rightOverdrawMesh) {
      this.rightOverdrawMesh.rotation.y = rotationAngle;
    }

    // Render left canvas overdraw visualization (quad)
    this.renderOverdrawVisualization(
      this.leftRenderer, 
      this.leftOverdrawScene, 
      this.leftOverdrawRT, 
      this.leftVisualizationRT, 
      this.leftVisualizationMaterial
    );
  };

  private handleAfterRender = () => {
    // Render right canvas overdraw visualization (clipped sprite)
    this.renderOverdrawVisualization(
      this.rightRenderer, 
      this.rightOverdrawScene, 
      this.rightOverdrawRT, 
      this.rightVisualizationRT, 
      this.rightVisualizationMaterial
    );
  };

  private renderOverdrawVisualization(
    renderer: THREE.WebGLRenderer,
    overdrawScene: THREE.Scene,
    overdrawRT: THREE.WebGLRenderTarget,
    visualizationRT: THREE.WebGLRenderTarget,
    visualizationMaterial: THREE.ShaderMaterial | null
  ) {
    if (!visualizationMaterial) return;

    // Store original state
    const originalRenderTarget = renderer.getRenderTarget();
    const originalAutoClear = renderer.autoClear;

    // PASS 1: Render overdraw counting to RT
    renderer.autoClear = true;
    renderer.setRenderTarget(overdrawRT);
    renderer.clear();
    renderer.render(overdrawScene, this.camera);

    // PASS 2: Render visualization (heat map) to RT
    this.visualizationQuad.material = visualizationMaterial;
    renderer.setRenderTarget(visualizationRT);
    renderer.clear();
    renderer.render(this.visualizationScene, this.visualizationCamera);

    // PASS 3: Render visualization to screen
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(this.visualizationScene, this.visualizationCamera);

    // Restore state
    renderer.setRenderTarget(originalRenderTarget);
    renderer.autoClear = originalAutoClear;
  }

  private updateGeometry() {
    if (!this.texture) return;

    const gridDimension = Math.sqrt(this.options.gridSize);
    const horizontalSlices = gridDimension;
    const verticalSlices = gridDimension;
    const horizontalIndex = this.currentFrameIndex % horizontalSlices;
    const verticalIndex = Math.floor(this.currentFrameIndex / horizontalSlices);

    // Create new clipped geometry (quad doesn't change for animation)
    const newClippedGeometry = new DietSpriteGeometry(
      this.texture,
      this.options.vertices,
      this.options.threshold,
      [horizontalSlices, verticalSlices],
      [horizontalIndex, verticalIndex],
      true
    );

    // Update right overdraw mesh
    if (this.rightOverdrawMesh) {
      const oldGeometry = this.rightOverdrawMesh.geometry;
      this.rightOverdrawMesh.geometry = newClippedGeometry;
      oldGeometry.dispose();
    }

    this.clippedGeometry = newClippedGeometry;
  }

  public start() {
    this.renderLoop.start();
  }

  public stop() {
    this.renderLoop.stop();
  }

  public dispose() {
    console.log('Scene3D dispose called');
    
    // Mark as disposed to prevent callbacks from executing
    this.disposed = true;
    
    // Clean up loading image if still loading
    if (this.loadingImage) {
      this.loadingImage.onload = null;
      this.loadingImage.onerror = null;
      this.loadingImage.src = ''; // Stop loading
      this.loadingImage = null;
    }
    
    this.renderLoop.dispose();
    this.resizeObserver.disconnect();
    
    // Remove event listeners
    const leftCanvas = this.leftRenderer.domElement;
    this.eventListeners.forEach((handler, eventType) => {
      leftCanvas.removeEventListener(eventType, handler);
    });
    this.eventListeners.clear();
    
    // Remove stats DOM element
    if (this.stats.dom.parentElement) {
      this.stats.dom.parentElement.removeChild(this.stats.dom);
    }
    
    // Dispose overdraw meshes
    if (this.leftOverdrawMesh) {
      this.leftOverdrawScene.remove(this.leftOverdrawMesh);
      if (this.leftOverdrawMesh instanceof THREE.InstancedMesh) {
        this.leftOverdrawMesh.dispose();
      }
    }

    if (this.rightOverdrawMesh) {
      this.rightOverdrawScene.remove(this.rightOverdrawMesh);
      if (this.rightOverdrawMesh instanceof THREE.InstancedMesh) {
        this.rightOverdrawMesh.dispose();
      }
    }

    // Dispose geometries
    if (this.quadGeometry) {
      this.quadGeometry.dispose();
    }

    if (this.clippedGeometry) {
      this.clippedGeometry.dispose();
    }

    // Dispose materials
    if (this.material) {
      this.material.dispose();
    }

    if (this.overdrawMaterial) {
      this.overdrawMaterial.dispose();
    }

    if (this.leftVisualizationMaterial) {
      this.leftVisualizationMaterial.dispose();
    }

    if (this.rightVisualizationMaterial) {
      this.rightVisualizationMaterial.dispose();
    }

    // Dispose render targets
    this.leftOverdrawRT.dispose();
    this.leftVisualizationRT.dispose();
    this.rightOverdrawRT.dispose();
    this.rightVisualizationRT.dispose();

    // Dispose visualization quad
    this.visualizationQuad.geometry.dispose();

    // Dispose texture
    if (this.texture) {
      this.texture.dispose();
    }

    // Dispose controls and renderers
    this.controls.dispose();
    this.leftRenderer.dispose();
    this.rightRenderer.dispose();
    
    // Clear the entire container to remove all DOM elements
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }

  public updateOptions(options: Partial<Scene3DOptions>) {
    this.options = { ...this.options, ...options };
  }

  public setRotationSpeed(speed: number) {
    this.rotationSpeed = speed;
  }

  /**
   * Update geometry parameters without recreating the entire scene
   * This regenerates geometries but keeps renderers, camera, and controls intact
   */
  public updateGeometryParams(vertices: number, threshold: number, gridSize: number) {
    if (!this.texture) return;

    // Update options
    this.options.vertices = vertices;
    this.options.threshold = threshold;
    this.options.gridSize = gridSize;

    // Reset animation frame index
    this.currentFrameIndex = 0;

    const gridDimension = Math.sqrt(gridSize);
    const horizontalSlices = gridDimension;
    const verticalSlices = gridDimension;

    // Dispose old geometries
    if (this.quadGeometry) {
      this.quadGeometry.dispose();
    }
    if (this.clippedGeometry) {
      this.clippedGeometry.dispose();
    }

    // Create new geometries
    this.quadGeometry = createSimpleQuadGeometry(this.texture);
    this.clippedGeometry = new DietSpriteGeometry(
      this.texture,
      vertices,
      threshold,
      [horizontalSlices, verticalSlices],
      [0, 0],
      true
    );

    // Update meshes with new geometries
    if (this.leftOverdrawMesh) {
      const oldGeometry = this.leftOverdrawMesh.geometry;
      this.leftOverdrawMesh.geometry = this.quadGeometry;
      oldGeometry.dispose();
    }

    if (this.rightOverdrawMesh) {
      const oldGeometry = this.rightOverdrawMesh.geometry;
      this.rightOverdrawMesh.geometry = this.clippedGeometry;
      oldGeometry.dispose();
    }

    // Update overdraw material threshold
    if (this.overdrawMaterial) {
      this.overdrawMaterial.uniforms.alphaTest.value = threshold;
    }
  }

  /**
   * Update animation parameters without recreating anything
   */
  public updateAnimationParams(animate: boolean, fps: number) {
    this.options.animate = animate;
    this.options.fps = fps;
    this.currentFrameIndex = 0;
  }

  /**
   * Recreate meshes when instancing parameters change
   * This is more expensive but necessary when switching between single/instanced meshes
   */
  public updateInstancingParams(useInstancing: boolean, instanceGridSize: number) {
    if (!this.texture) return;

    // Update options
    this.options.useInstancing = useInstancing;
    this.options.instanceGridSize = instanceGridSize;

    // Remove old meshes
    if (this.leftOverdrawMesh) {
      this.leftOverdrawScene.remove(this.leftOverdrawMesh);
      if (this.leftOverdrawMesh instanceof THREE.InstancedMesh) {
        this.leftOverdrawMesh.dispose();
      }
      this.leftOverdrawMesh = null;
    }

    if (this.rightOverdrawMesh) {
      this.rightOverdrawScene.remove(this.rightOverdrawMesh);
      if (this.rightOverdrawMesh instanceof THREE.InstancedMesh) {
        this.rightOverdrawMesh.dispose();
      }
      this.rightOverdrawMesh = null;
    }

    // Create new meshes
    if (useInstancing) {
      this.createInstancedMeshes();
    } else {
      this.createSingleMeshes();
    }
  }

  // Getter methods to expose canvas elements for React
  public getLeftCanvas(): HTMLCanvasElement {
    return this.leftRenderer.domElement;
  }

  public getRightCanvas(): HTMLCanvasElement {
    return this.rightRenderer.domElement;
  }

  public getLeftContainer(): HTMLElement {
    return this.leftRenderer.domElement.parentElement!;
  }

  public getRightContainer(): HTMLElement {
    return this.rightRenderer.domElement.parentElement!;
  }
}


