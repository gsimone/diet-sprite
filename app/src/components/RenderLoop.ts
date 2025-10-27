import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type Stats from 'stats.js'

export interface RenderHooks {
  beforeRender?: () => void
  afterRender?: () => void
}

export interface RenderLoopOptions {
  scene: THREE.Scene
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  controls?: OrbitControls
  stats?: Stats
  disableAutoResize?: boolean
}

/**
 * Manages the render loop and window resizing with hooks for custom rendering logic
 */
export class RenderLoop {
  private scene: THREE.Scene
  private camera: THREE.Camera
  private renderer: THREE.WebGLRenderer
  private controls?: OrbitControls
  private stats?: Stats
  private animationId: number | null = null
  private hooks: RenderHooks = {}
  private disableAutoResize: boolean

  constructor(options: RenderLoopOptions) {
    this.scene = options.scene
    this.camera = options.camera
    this.renderer = options.renderer
    this.controls = options.controls
    this.stats = options.stats
    this.disableAutoResize = options.disableAutoResize ?? false

    if (!this.disableAutoResize) {
      this.setupResizeHandler()
    }
  }

  /**
   * Set hooks for before and after render
   */
  setHooks(hooks: RenderHooks) {
    this.hooks = hooks
  }

  /**
   * Start the render loop
   */
  start() {
    if (this.animationId !== null) {
      console.warn('Render loop is already running')
      return
    }

    const animate = () => {
      this.animationId = requestAnimationFrame(animate)

      // Begin stats tracking
      this.stats?.begin()

      // Update controls
      this.controls?.update()

      // Call before render hook
      this.hooks.beforeRender?.()

      // Render main scene
      this.renderer.render(this.scene, this.camera)

      // Call after render hook
      this.hooks.afterRender?.()

      // End stats tracking
      this.stats?.end()
    }

    animate()
  }

  /**
   * Stop the render loop
   */
  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  /**
   * Handle window resize
   */
  private handleResize = () => {
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
    }
    
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  /**
   * Set up resize handler
   */
  private setupResizeHandler() {
    window.addEventListener('resize', this.handleResize)
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stop()
    if (!this.disableAutoResize) {
      window.removeEventListener('resize', this.handleResize)
    }
  }
}

