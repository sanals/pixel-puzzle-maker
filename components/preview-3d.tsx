"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { buildPuzzleGroup } from "@/lib/geometry-generators"
import type { GridLayout } from "@/lib/grid-engine"
import type { EmbossingStyle, PaletteColor } from "@/lib/types"
import { usePuzzle } from "@/components/puzzle-context"
import { Paintbrush } from "lucide-react"

interface Preview3DProps {
  layout: GridLayout
  palette: PaletteColor[]
  embossing: EmbossingStyle
}

export function Preview3D({ layout, palette, embossing }: Preview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const { paintMode, setPaintMode, activeColorIndex, paintCell } = usePuzzle()

  const stateRef = useRef({ paintMode, activeColorIndex, paintCell })
  useEffect(() => {
    stateRef.current = { paintMode, activeColorIndex, paintCell }
  }, [paintMode, activeColorIndex, paintCell])

  // Refs for persisting ThreeJS objects across re-renders
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  // 1. Init Scene, Camera, Renderer (Runs once)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    sceneRef.current = scene
    scene.background = new THREE.Color("#0f1424")

    const aspect = (width && height) ? (width / height) : 1
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 5000)
    // PREVENT NaN CORRUPTION: OrbitControls breaks if camera and target are both (0,0,0)
    camera.position.set(100, 100, 100)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    rendererRef.current = renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width || 100, height || 100)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controlsRef.current = controls
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    // Lighting rig
    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    scene.add(key)
    scene.userData.keyLight = key

    const fill = new THREE.DirectionalLight(0x9db4ff, 0.4)
    scene.add(fill)
    scene.userData.fillLight = fill

    // Ground shadow catcher
    const groundGeo = new THREE.PlaneGeometry(10000, 10000)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    scene.add(ground)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      if (controlsRef.current) {
         controlsRef.current.update()
      }
      if (sceneRef.current && cameraRef.current) {
        renderer.render(sceneRef.current, cameraRef.current)
      }
    }
    animate()

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return
      const w = mountRef.current.clientWidth
      const h = mountRef.current.clientHeight
      if (w === 0 || h === 0) return
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(mount)
    
    // Raycasting for paint mode
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    
    const onPointerDown = (event: PointerEvent) => {
      if (!stateRef.current.paintMode || !groupRef.current || !cameraRef.current || event.button !== 0) return
      
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      
      raycaster.setFromCamera(mouse, cameraRef.current)
      
      const intersects = raycaster.intersectObject(groupRef.current, true)
      
      for (const intersect of intersects) {
        if (intersect.object instanceof THREE.InstancedMesh && intersect.instanceId !== undefined) {
           const placements = intersect.object.userData.placements
           if (placements && placements[intersect.instanceId]) {
             const p = placements[intersect.instanceId]
             stateRef.current.paintCell(p.gx, p.gy, stateRef.current.activeColorIndex)
             break
           }
        }
      }
    }
    
    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      groundGeo.dispose()
      groundMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  useEffect(() => {
    if (controlsRef.current) {
      if (paintMode) {
        controlsRef.current.mouseButtons = {
          LEFT: 99 as THREE.MOUSE, // 99 doesn't match any mouse button, effectively disabling LEFT
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE
        }
      } else {
        controlsRef.current.mouseButtons = {
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN
        }
      }
    }
  }, [paintMode])

  const lastSpanRef = useRef<number | null>(null)

  // 2. Build Puzzle Geometries and update Camera/Lights based on Layout
  useEffect(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!scene || !camera || !controls) return

    const span = Math.max(layout.boardWidth, layout.boardDepth)
    
    // Only reset camera and lights if the physical size of the board changes
    if (lastSpanRef.current !== span) {
      lastSpanRef.current = span
      
      // Temporarily disable damping to force a hard teleport without residual momentum
      controls.enableDamping = false
      camera.position.set(span * 0.75, span * 0.85, span * 0.95)
      controls.target.set(0, layout.baseHeight, 0)
      camera.lookAt(0, layout.baseHeight, 0)
      controls.update() 
      controls.enableDamping = true
      
      if (scene.userData.keyLight) {
         const key = scene.userData.keyLight as THREE.DirectionalLight
         key.position.set(span * 0.6, span * 1.2, span * 0.4)
         const d = span * 0.9
         key.shadow.camera.left = -d
         key.shadow.camera.right = d
         key.shadow.camera.top = d
         key.shadow.camera.bottom = -d
         key.shadow.camera.far = span * 4
         key.shadow.camera.updateProjectionMatrix()
      }
      
      if (scene.userData.fillLight) {
         const fill = scene.userData.fillLight as THREE.DirectionalLight
         fill.position.set(-span * 0.5, span * 0.4, -span * 0.6)
      }
    }

    let currentDispose: (() => void) | null = null
    let mounted = true

    buildPuzzleGroup(layout, palette, embossing).then(({ group, dispose }) => {
      if (!mounted) {
        dispose()
        return
      }
      
      // Remove old group if it exists
      if (groupRef.current) {
         scene.remove(groupRef.current)
      }
      
      currentDispose = dispose
      groupRef.current = group
      scene.add(group)
    })

    return () => {
      mounted = false
      if (currentDispose) currentDispose()
      if (groupRef.current && scene) {
         scene.remove(groupRef.current)
         groupRef.current = null
      }
    }
  }, [layout, palette, embossing])

  return (
    <div className="relative h-full w-full">
      <div ref={mountRef} className="absolute inset-0" aria-label="Interactive 3D preview" />
      
      {paintMode && (
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center z-10">
          <div className="rounded-full bg-background/80 px-4 py-2 text-sm font-medium shadow-md backdrop-blur-sm border">
            Paint Mode: Click tiles to apply selected color (Right-click to rotate)
          </div>
        </div>
      )}
    </div>
  )
}
