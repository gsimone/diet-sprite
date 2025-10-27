import * as THREE from 'three'

export interface FBOVisualizerOptions {
  renderTarget: THREE.WebGLRenderTarget
  renderer: THREE.WebGLRenderer
  size: { width: number; height: number }
  position: { x: number; y: number }
}

/**
 * Generic FBO Visualizer that renders a renderTarget to the screen
 * as a quad overlay at a specified position and size
 */
export class FBOVisualizer {
  private renderTarget: THREE.WebGLRenderTarget
  private renderer: THREE.WebGLRenderer
  private size: { width: number; height: number }
  private position: { x: number; y: number }
  
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private quad: THREE.Mesh
  private material: THREE.ShaderMaterial

  constructor(options: FBOVisualizerOptions) {
    this.renderTarget = options.renderTarget
    this.renderer = options.renderer
    this.size = options.size
    this.position = options.position

    // Create a simple scene with an orthographic camera for 2D rendering
    this.scene = new THREE.Scene()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    // Create a shader material to display the render target
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.renderTarget.texture }
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      depthTest: false,
      depthWrite: false
    })

    // Create a quad to display the texture
    const geometry = new THREE.PlaneGeometry(2, 2)
    this.quad = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.quad)
  }

  /**
   * Render the FBO to the screen at the specified position and size
   * Should be called AFTER the main scene render
   */
  render() {
    // Store original renderer state
    const originalRenderTarget = this.renderer.getRenderTarget()
    const originalScissorTest = this.renderer.getScissorTest()
    const originalViewport = new THREE.Vector4()
    this.renderer.getViewport(originalViewport)
    
    const rendererSize = new THREE.Vector2()
    this.renderer.getSize(rendererSize)

    // Ensure size and position are valid (non-negative)
    const width = Math.max(0, this.size.width)
    const height = Math.max(0, this.size.height)
    
    if (width <= 0 || height <= 0) {
      return
    }

    // Calculate position from bottom-left (WebGL coordinates)
    const x = Math.max(0, this.position.x)
    const y = Math.max(0, rendererSize.y - this.position.y - height)

    // Set up viewport and scissor for the visualizer
    this.renderer.setRenderTarget(null) // Render to screen
    this.renderer.setScissorTest(true)
    this.renderer.setScissor(x, y, width, height)
    this.renderer.setViewport(x, y, width, height)

    // Clear only this viewport region
    this.renderer.clearDepth()

    // Render the quad with the render target texture
    this.renderer.render(this.scene, this.camera)

    // Restore renderer state
    this.renderer.setRenderTarget(originalRenderTarget)
    this.renderer.setScissorTest(originalScissorTest)
    this.renderer.setViewport(originalViewport.x, originalViewport.y, originalViewport.z, originalViewport.w)
  }

  /**
   * Update the render target to visualize
   */
  setRenderTarget(renderTarget: THREE.WebGLRenderTarget) {
    this.renderTarget = renderTarget
    this.material.uniforms.tDiffuse.value = renderTarget.texture
  }

  /**
   * Update the size of the visualizer
   */
  setSize(width: number, height: number) {
    this.size = { width, height }
  }

  /**
   * Update the position of the visualizer
   */
  setPosition(x: number, y: number) {
    this.position = { x, y }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.material.dispose()
    this.quad.geometry.dispose()
  }
}

