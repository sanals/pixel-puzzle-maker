"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { buildPuzzleGroup } from "@/lib/geometry-generators"
import type { GridLayout } from "@/lib/grid-engine"
import type { EmbossingStyle, PaletteColor } from "@/lib/types"

interface Preview3DProps {
  layout: GridLayout
  palette: PaletteColor[]
  embossing: EmbossingStyle
}

export function Preview3D({ layout, palette, embossing }: Preview3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#0f1424")

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 5000)
    const span = Math.max(layout.boardWidth, layout.boardDepth)
    camera.position.set(span * 0.75, span * 0.85, span * 0.95)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    mount.appendChild(renderer.domElement)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.target.set(0, layout.baseHeight, 0)

    // Lighting rig
    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    scene.add(ambient)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(span * 0.6, span * 1.2, span * 0.4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    const d = span * 0.9
    key.shadow.camera.left = -d
    key.shadow.camera.right = d
    key.shadow.camera.top = d
    key.shadow.camera.bottom = -d
    key.shadow.camera.far = span * 4
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x9db4ff, 0.4)
    fill.position.set(-span * 0.5, span * 0.4, -span * 0.6)
    scene.add(fill)

    // Ground shadow catcher
    const groundGeo = new THREE.PlaneGeometry(span * 6, span * 6)
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.28 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = 0
    ground.receiveShadow = true
    scene.add(ground)

    const { group, dispose } = buildPuzzleGroup(layout, palette, embossing)
    scene.add(group)

    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const handleResize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const ro = new ResizeObserver(handleResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      dispose()
      groundGeo.dispose()
      groundMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [layout, palette, embossing])

  return <div ref={mountRef} className="h-full w-full" aria-label="Interactive 3D preview" />
}
