import React, { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { SkinnedMesh, Mesh, Vector3, Color, Box3Helper, BufferGeometry, BufferAttribute } from 'three'
import EquipmentViewer, { EquipmentViewerRef } from '../Equipment/EquipmentViewer'
import { ArmorFittingService, BodyRegion, CollisionPoint } from '../../services/fitting/armor/ArmorFittingService'
import { MeshDeformationService, ControlPoint } from '../../services/fitting/deformation/MeshDeformationService'
import { WeightTransferService } from '../../services/fitting/deformation/WeightTransferService'
import { IterativeArmorFittingService, FittingParameters } from '../../services/fitting/armor/IterativeArmorFittingService'
import { GenericMeshFittingService } from '../../services/fitting/armor/GenericMeshFittingService'
import { HullBasedFittingService, HullFittingParameters } from '../../services/fitting/armor/HullBasedFittingService'

export interface ArmorFittingViewerRef extends EquipmentViewerRef {
  // Fitting operations
  performBoundingBoxFit: () => void
  performCollisionBasedFit: () => void
  performSmoothDeformation: () => void
  performIterativeFit: (parameters?: FittingParameters) => void
  performHullBasedFit: (parameters?: HullFittingParameters) => void
  performBodyHullFit: () => void
  transferWeights: () => void
  
  // Visualization
  setVisualizationMode: (mode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull') => void
  setSelectedBone: (boneIndex: number) => void
  
  // Get fitting data
  getBodyRegions: () => Map<string, BodyRegion> | null
  getCollisions: () => CollisionPoint[] | null
  getFittingServices: () => {
    fitting: ArmorFittingService
    deformation: MeshDeformationService
    weightTransfer: WeightTransferService
    hullBased: HullBasedFittingService
  }
  
  // Mesh access - NEW
  getMeshReferences: () => {
    avatarMesh: THREE.SkinnedMesh | null
    armorMesh: THREE.Mesh | null
    helmetMesh: THREE.Mesh | null
    scene: THREE.Scene | null
  }
  
  // Helmet fitting operations - NEW
  performHelmetFitting: (params?: {
    method?: 'auto' | 'manual'
    sizeMultiplier?: number
    fitTightness?: number
    verticalOffset?: number
    forwardOffset?: number
    rotation?: { x: number; y: number; z: number }
  }) => Promise<void>
  attachHelmetToHead: () => void
  detachHelmetFromHead: () => void
}

interface ArmorFittingViewerProps {
  avatarUrl?: string
  armorUrl?: string
  helmetUrl?: string // NEW - for helmet support
  armorSubtype?: string // Use subtype from metadata
  equipmentSlot?: string // Manual override for equipment slot
  showWireframe?: boolean
  visualizationMode?: 'none' | 'regions' | 'collisions' | 'weights' | 'hull'
  selectedBone?: number
  fittingConfig?: { margin?: number } // Optional fitting configuration

  helmetTransform?: { // NEW - for helmet transforms
    position: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number }
    scale: number
  }
  onBodyRegionsComputed?: (regions: Map<string, BodyRegion>) => void
  onCollisionsDetected?: (collisions: CollisionPoint[]) => void
  onFittingComplete?: () => void
}

// Helper function to detect armor slot from subtype
const detectArmorSlot = (armorSubtype?: string): string => {
  if (!armorSubtype) return 'Spine2' // Default to torso
  
  const subtypeLower = armorSubtype.toLowerCase()
  
  // Direct mapping based on subtype
  if (subtypeLower === 'helmet' || subtypeLower === 'head') {
    return 'Head'
  }
  
  if (subtypeLower === 'body' || subtypeLower === 'chest' || subtypeLower === 'torso') {
    return 'Spine2' // Chest bone
  }
  
  if (subtypeLower === 'legs' || subtypeLower === 'greaves' || subtypeLower === 'pants') {
    return 'Hips'
  }
  
  // Default to torso
  return 'Spine2'
}

export const ArmorFittingViewer = forwardRef<ArmorFittingViewerRef, ArmorFittingViewerProps>((props, ref) => {
  const equipmentViewerRef = useRef<EquipmentViewerRef>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const [bodyRegions, setBodyRegions] = useState<Map<string, BodyRegion> | null>(null)
  const [collisions, setCollisions] = useState<CollisionPoint[] | null>(null)
  const [visualizationMode, setVisualizationModeState] = useState<'none' | 'regions' | 'collisions' | 'weights' | 'hull'>('none')
  const [selectedBone, setSelectedBoneState] = useState<number>(0)
  const [isReady, setIsReady] = useState(false)
  
  // Detect armor slot - use manual override if provided, otherwise auto-detect
  const armorSlot = props.equipmentSlot || detectArmorSlot(props.armorSubtype)
  
  // Visualization helpers
  const visualizationGroup = useRef<THREE.Group>(new THREE.Group())
  
  // Services
  const fittingService = useRef(new ArmorFittingService())
  const deformationService = useRef(new MeshDeformationService())
  const weightTransferService = useRef(new WeightTransferService())
  const iterativeFittingService = useRef(new IterativeArmorFittingService())
  const hullBasedFittingService = useRef(new HullBasedFittingService())
  const genericFittingService = useRef(new GenericMeshFittingService()) // NEW - for helmet fitting
  
  // Store references to avatar, armor, and helmet meshes
  const avatarMeshRef = useRef<SkinnedMesh | null>(null)
  const armorMeshRef = useRef<Mesh | null>(null)
  const helmetMeshRef = useRef<Mesh | null>(null) // NEW - for helmet
  const isFittingRef = useRef<boolean>(false)
  const visualizationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Find meshes in the scene
  const findMeshes = (): { avatarMesh: SkinnedMesh | null; armorMesh: Mesh | null; helmetMesh: Mesh | null } | null => {
    // First try using stored refs
    if (avatarMeshRef.current && (armorMeshRef.current || helmetMeshRef.current)) {
      console.log('🔍 ArmorFittingViewer: Using cached mesh refs')
      return { 
        avatarMesh: avatarMeshRef.current, 
        armorMesh: armorMeshRef.current,
        helmetMesh: helmetMeshRef.current 
      }
    }
    
    // Try to get from EquipmentViewer directly
    if (equipmentViewerRef.current?.getScene && equipmentViewerRef.current?.getAvatar && equipmentViewerRef.current?.getEquipment) {
      const scene = equipmentViewerRef.current.getScene()
      const avatar = equipmentViewerRef.current.getAvatar()
      const equipment = equipmentViewerRef.current.getEquipment()
      
      console.log('🔍 ArmorFittingViewer: Got from EquipmentViewer - scene:', !!scene, 'avatar:', !!avatar, 'equipment:', !!equipment)
      
      // Find SkinnedMesh in avatar
      let avatarMesh: SkinnedMesh | null = null
      if (avatar) {
        avatar.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
            avatarMesh = child
          }
        })
      }
      
      // Equipment should be a Mesh
      let armorMesh: Mesh | null = null
      if (equipment) {
        if (equipment instanceof THREE.Mesh) {
          armorMesh = equipment
        } else {
          // If equipment is a group, find the mesh inside
          equipment.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && !armorMesh) {
              armorMesh = child
            }
          })
        }
      }
      
      if (avatarMesh || armorMesh) {
        console.log('🔍 ArmorFittingViewer: Found meshes - avatar:', !!avatarMesh, 'armor:', !!armorMesh)
        avatarMeshRef.current = avatarMesh
        armorMeshRef.current = armorMesh
        helmetMeshRef.current = null // No helmet in this path yet
        return { avatarMesh, armorMesh, helmetMesh: null }
      }
    }
    
    // Fallback: try to get scene from ref
    const scene = sceneRef.current || equipmentViewerRef.current?.getScene?.()
    if (!scene) {
      console.log('🔍 ArmorFittingViewer: No scene available')
      return null
    }
    
    let avatarMesh: SkinnedMesh | null = null
    let armorMesh: Mesh | null = null
    let helmetMesh: Mesh | null = null
      
    // First pass: find avatar
    scene.traverse((child: THREE.Object3D) => {
      if (child instanceof THREE.SkinnedMesh && !avatarMesh && !child.userData.isEquipment) {
        console.log('🔍 ArmorFittingViewer: Found avatar SkinnedMesh:', child.name)
        avatarMesh = child
      }
    })
    
    // Second pass: find equipment (armor and helmet)
    scene.traverse((child: THREE.Object3D) => {
      if (child.userData.isEquipment) {
        console.log('🔍 ArmorFittingViewer: Found equipment object:', child.name, 'type:', child.type, 'userData:', child.userData)
        
        // Check if it's a helmet based on slot or name
        const isHelmet = child.userData.equipmentSlot === 'Head' || 
                        child.name.toLowerCase().includes('helmet') ||
                        child.name.toLowerCase().includes('head')
        
        if (child instanceof THREE.Mesh) {
          if (isHelmet && !helmetMesh) {
            helmetMesh = child
          } else if (!isHelmet && !armorMesh) {
            armorMesh = child
          }
        } else if (child instanceof THREE.Group || child instanceof THREE.Object3D) {
          // Look for mesh inside the group
          child.traverse((subChild: THREE.Object3D) => {
            if (subChild instanceof THREE.Mesh) {
              if (isHelmet && !helmetMesh) {
                console.log('🔍 ArmorFittingViewer: Found helmet mesh inside equipment:', subChild.name)
                helmetMesh = subChild
              } else if (!isHelmet && !armorMesh) {
                console.log('🔍 ArmorFittingViewer: Found armor mesh inside equipment:', subChild.name)
                armorMesh = subChild
              }
            }
          })
        }
      }
    })
    
    console.log('🔍 ArmorFittingViewer: findMeshes final result - avatar:', !!avatarMesh, 'armor:', !!armorMesh, 'helmet:', !!helmetMesh)
    
    avatarMeshRef.current = avatarMesh
    armorMeshRef.current = armorMesh
    helmetMeshRef.current = helmetMesh
    
    return { avatarMesh, armorMesh, helmetMesh }
  }
  
  // Visualization functions
  const clearVisualization = () => {
    visualizationGroup.current.clear()
  }
  
  const visualizeBodyRegions = () => {
    if (!bodyRegions) return
    
    clearVisualization()
    
    const colors = {
      head: new Color(0xff0000),
      torso: new Color(0x00ff00),
      arms: new Color(0x0000ff),
      legs: new Color(0xffff00),
      hips: new Color(0xff00ff)
    }
    
    // Get meshes
    const meshes = findMeshes()
    if (!meshes || !meshes.avatarMesh) return
    
    // Get target region
    const targetRegion = getTargetRegion()
    
    bodyRegions.forEach((region, name) => {
      const isTarget = targetRegion && region.name === targetRegion.name
      const color = colors[name as keyof typeof colors] || new Color(0xffffff)
      
      // Create bounding box helper
      const helper = new Box3Helper(region.boundingBox, color)
      if (helper.material && 'linewidth' in helper.material) {
        (helper.material as THREE.LineBasicMaterial).linewidth = isTarget ? 3 : 1
      }
      visualizationGroup.current.add(helper)
      
      // For target region, create debug mesh
      if (isTarget && meshes.avatarMesh) {
        const debugMeshes = iterativeFittingService.current.createBodyRegionDebugMesh(
          meshes.avatarMesh,
          region.boundingBox
        )
        visualizationGroup.current.add(debugMeshes.regionMesh)
      }
    })
  }
  
  const visualizeCollisions = () => {
    if (!collisions) return
    
    clearVisualization()
    
    const sphereGeometry = new THREE.SphereGeometry(0.01, 8, 8)
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    
    collisions.forEach(collision => {
      const sphere = new THREE.Mesh(sphereGeometry, material)
      sphere.position.copy(collision.position)
      visualizationGroup.current.add(sphere)
      
      // Add line showing push direction
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        collision.position,
        collision.position.clone().add(collision.normal.clone().multiplyScalar(collision.penetrationDepth))
      ])
      const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xff0000 }))
      visualizationGroup.current.add(line)
    })
  }
  
  const visualizeWeights = () => {
    if (!avatarMeshRef.current) return
    
    // Check if the mesh is actually skinned
    if (!(avatarMeshRef.current instanceof THREE.SkinnedMesh)) {
      console.warn('Avatar mesh is not a SkinnedMesh, cannot visualize weights')
      return
    }
    
    // Clear any pending visualization
    if (visualizationTimeoutRef.current) {
      clearTimeout(visualizationTimeoutRef.current)
      visualizationTimeoutRef.current = null
    }
    
    // Always restore original material first to avoid conflicts
    restoreOriginalMaterials()
    
    // Small delay to ensure cleanup is complete
    visualizationTimeoutRef.current = setTimeout(() => {
      if (!avatarMeshRef.current) return
      
      // Store original material if not already stored
      if (!avatarMeshRef.current.userData.originalMaterial) {
        avatarMeshRef.current.userData.originalMaterial = avatarMeshRef.current.material
      }
      
      // Create a simple color-based visualization without custom shaders
      // This avoids shader compilation conflicts
      const geometry = avatarMeshRef.current.geometry
      if (!geometry.attributes.skinIndex || !geometry.attributes.skinWeight) {
        console.warn('Mesh does not have skinning attributes')
        return
      }
      
      // Create vertex colors based on bone weights
      const colors = new Float32Array(geometry.attributes.position.count * 3)
      const skinIndices = geometry.attributes.skinIndex
      const skinWeights = geometry.attributes.skinWeight
      
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        let weight = 0
        
        // Check if this vertex is influenced by the selected bone
        for (let j = 0; j < 4; j++) {
          const idx = skinIndices.getComponent(i, j)
          if (Math.abs(idx - selectedBone) < 0.5) {
            weight = skinWeights.getComponent(i, j)
            break
          }
        }
        
        // Convert weight to color (heatmap)
        let r = 0, g = 0, b = 0
        if (weight < 0.25) {
          // Blue to Cyan
          r = 0
          g = weight * 4
          b = 1
        } else if (weight < 0.5) {
          // Cyan to Green
          r = 0
          g = 1
          b = 1 - (weight - 0.25) * 4
        } else if (weight < 0.75) {
          // Green to Yellow
          r = (weight - 0.5) * 4
          g = 1
          b = 0
        } else {
          // Yellow to Red
          r = 1
          g = 1 - (weight - 0.75) * 4
          b = 0
        }
        
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      
      // Use a simple material with vertex colors
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
      })
      
      avatarMeshRef.current.material = material
    }, 50)
  }
  
  const restoreOriginalMaterials = () => {
    if (avatarMeshRef.current && avatarMeshRef.current.userData.originalMaterial) {
      // Also remove any vertex colors that were added
      if (avatarMeshRef.current.geometry.attributes.color) {
        avatarMeshRef.current.geometry.deleteAttribute('color')
      }
      avatarMeshRef.current.material = avatarMeshRef.current.userData.originalMaterial
      delete avatarMeshRef.current.userData.originalMaterial
    }
  }
  
  const visualizeBodyHull = () => {
    clearVisualization()
    
    const meshes = findMeshes()
    if (!meshes || !meshes.avatarMesh) return
    
    const hullMesh = hullBasedFittingService.current.createHullVisualization(meshes.avatarMesh)
    if (hullMesh) {
      visualizationGroup.current.add(hullMesh)
      console.log('🎯 ArmorFittingViewer: Visualizing body hull')
    }
  }
  
  // Fitting operations
  const performBoundingBoxFit = () => {
    console.log('🎯 ArmorFittingViewer: performBoundingBoxFit called')
    
    // Prevent concurrent fitting operations
    if (isFittingRef.current) {
      console.log('🎯 ArmorFittingViewer: Fitting already in progress, skipping')
      return
    }
    
    isFittingRef.current = true
    
    // Try multiple times to find meshes as they may still be loading
    let attempts = 0
    const tryFit = () => {
      attempts++
      const meshes = findMeshes()
      
      if (!meshes || !meshes.avatarMesh || !meshes.armorMesh) {
        if (attempts < 10) {
          console.log(`🎯 ArmorFittingViewer: Meshes not ready yet, attempt ${attempts}/10`)
          setTimeout(tryFit, 200)
          return
        } else {
          console.error('🎯 ArmorFittingViewer: Failed to find meshes after 10 attempts')
          isFittingRef.current = false
          return
        }
      }
      
      const { avatarMesh, armorMesh } = meshes
      console.log('🎯 ArmorFittingViewer: Found meshes, computing regions...')
      
      // First compute regions if not already done
      let regions = bodyRegions
      if (!regions || regions.size === 0) {
        regions = fittingService.current.computeBodyRegions(avatarMesh, avatarMesh.skeleton)
        setBodyRegions(regions)
        props.onBodyRegionsComputed?.(regions)
      }
    
    // Find appropriate region for armor based on detected slot
    let targetRegion: BodyRegion | undefined
    
    console.log('🎯 ArmorFittingViewer: Looking for region for slot:', armorSlot)
    console.log('🎯 ArmorFittingViewer: Available regions:', Array.from(regions.keys()))
    
    // Log all regions and their bounds for debugging
    regions.forEach((region, name) => {
      const size = region.boundingBox.getSize(new Vector3())
      const center = region.boundingBox.getCenter(new Vector3())
      console.log(`🎯 ArmorFittingViewer: Region ${name} - center:`, center, 'size:', size)
    })
    
    if (armorSlot === 'Head') {
      targetRegion = regions.get('head')
    } else if (armorSlot === 'Hips') {
      targetRegion = regions.get('legs') || regions.get('hips')
    } else if (armorSlot === 'Spine2') {
      targetRegion = regions.get('torso') || regions.get('chest')
    } else {
      // For other slots, try to find matching region
      targetRegion = regions.get('torso') || regions.get('chest')
    }
    
    // Fallback to first available region
    if (!targetRegion) {
      console.warn('🎯 ArmorFittingViewer: No matching region found, using first available')
      targetRegion = Array.from(regions.values())[0]
    }
    
          if (targetRegion) {
        console.log('🎯 ArmorFittingViewer: Fitting armor to region:', targetRegion.name)
        fittingService.current.fitArmorToBoundingBox(armorMesh, targetRegion, props.fittingConfig?.margin)
        
        // Mark armor as fitted to prevent EquipmentViewer from re-scaling it
        armorMesh.userData.isFitted = true
        
        // Force scene update
        if (equipmentViewerRef.current?.updateEquipmentTransform) {
          equipmentViewerRef.current.updateEquipmentTransform()
        }
        if (equipmentViewerRef.current?.forceRender) {
          equipmentViewerRef.current.forceRender()
        }
      } else {
        console.error('🎯 ArmorFittingViewer: No target region available for fitting')
      }
    
    // Reset fitting flag
    isFittingRef.current = false
    }
    
    // Start the fitting process
    tryFit()
  }
  
  const performCollisionBasedFit = () => {
    console.log('🎯 ArmorFittingViewer: performCollisionBasedFit called')
    const meshes = findMeshes()
    if (!meshes) {
      console.error('🎯 ArmorFittingViewer: No meshes found for collision fit')
      return
    }
    const { avatarMesh, armorMesh } = meshes
    if (!avatarMesh || !armorMesh) {
      console.error('🎯 ArmorFittingViewer: Missing meshes for collision fit')
      return
    }
    
    console.log('🎯 ArmorFittingViewer: Detecting collisions...')
    // Detect collisions
    const detectedCollisions = fittingService.current.detectCollisions(avatarMesh, armorMesh)
    console.log('🎯 ArmorFittingViewer: Detected', detectedCollisions.length, 'collisions')
    setCollisions(detectedCollisions)
    props.onCollisionsDetected?.(detectedCollisions)
    
    if (detectedCollisions.length > 0) {
      console.log('🎯 ArmorFittingViewer: Resolving collisions...')
      // Resolve collisions with fewer iterations
      fittingService.current.resolveCollisions(armorMesh, detectedCollisions, 1)
      
      // Apply strong smoothing to fix any spikes
      console.log('🎯 ArmorFittingViewer: Smoothing mesh...')
      fittingService.current.smoothMesh(armorMesh, 0.7) // Increased smoothing strength
      
      // Force update
      if (equipmentViewerRef.current?.updateEquipmentTransform) {
        equipmentViewerRef.current.updateEquipmentTransform()
      }
      if (equipmentViewerRef.current?.forceRender) {
        equipmentViewerRef.current.forceRender()
      }
    }
  }
  
  const performSmoothDeformation = () => {
    const meshes = findMeshes()
    if (!meshes) return
    const { armorMesh } = meshes
    if (!armorMesh) return
    
    console.log('🎯 ArmorFittingViewer: Performing smooth deformation')
    
    // Use the improved smoothing from ArmorFittingService
    fittingService.current.smoothMesh(armorMesh, 0.8) // Strong smoothing
    
    // Force update
    if (equipmentViewerRef.current?.forceRender) {
      equipmentViewerRef.current.forceRender()
    }
  }
  
  const performIterativeFit = (parameters?: FittingParameters) => {
    console.log('🎯 ArmorFittingViewer: performIterativeFit called')
    const meshes = findMeshes()
    if (!meshes) return
    const { avatarMesh, armorMesh } = meshes
    if (!avatarMesh || !armorMesh) {
      console.error('🎯 ArmorFittingViewer: Missing meshes for iterative fit')
      return
    }
    
    // Get target region
    const targetRegion = getTargetRegion()
    if (!targetRegion) {
      console.error('🎯 ArmorFittingViewer: No target region for iterative fit')
      return
    }
    
    // Default parameters - updated based on debugger success
    const defaultParams: FittingParameters = {
      iterations: 15,
      stepSize: 0.4,
      smoothingRadius: 0.5,
      smoothingStrength: 0.3,
      targetOffset: 0.01, // 1cm from body surface
      sampleRate: 1.0
    }
    
    const params = parameters || defaultParams
    
    console.log('🎯 ArmorFittingViewer: Starting iterative fit with params:', params)
    console.log('🎯 Target region:', targetRegion.name, 'bounds:', targetRegion.boundingBox)
    
    // Mark as fitted before fitting
    armorMesh.userData.isFitted = true
    
    // Store the armor's current world transform
    const armorWorldMatrix = armorMesh.matrixWorld.clone()
    const armorParent = armorMesh.parent
    
    // Store initial armor bounds before fitting
    const armorBoundsBefore = new THREE.Box3().setFromObject(armorMesh)
    const armorCenterBefore = armorBoundsBefore.getCenter(new THREE.Vector3())
    console.log('🎯 ArmorFittingViewer: Armor bounds before iterative fit:',
      armorBoundsBefore.min.x.toFixed(3), armorBoundsBefore.min.y.toFixed(3), armorBoundsBefore.min.z.toFixed(3),
      'to',
      armorBoundsBefore.max.x.toFixed(3), armorBoundsBefore.max.y.toFixed(3), armorBoundsBefore.max.z.toFixed(3)
    )
    console.log('🎯 ArmorFittingViewer: Armor center before:', armorCenterBefore.x.toFixed(3), armorCenterBefore.y.toFixed(3), armorCenterBefore.z.toFixed(3))
    
    // Check if armor is positioned correctly at torso
    const targetCenter = targetRegion.boundingBox.getCenter(new THREE.Vector3())
    const distanceToTarget = armorCenterBefore.distanceTo(targetCenter)
    console.log('🎯 ArmorFittingViewer: Distance from armor to target region:', distanceToTarget.toFixed(3))
    
    if (distanceToTarget > 0.5) { // If armor is more than 50cm from target
      console.warn('⚠️ ArmorFittingViewer: Armor seems to be positioned incorrectly! Re-centering...')
      // Re-center armor to target region before fitting
      const offset = targetCenter.clone().sub(armorCenterBefore)
      armorMesh.position.add(offset)
      armorMesh.updateMatrixWorld(true)
    }
    
    // Temporarily remove armor from its parent to work in world space
    if (armorParent) {
      armorParent.remove(armorMesh)
      armorMesh.position.setFromMatrixPosition(armorMesh.matrixWorld)
      armorMesh.quaternion.setFromRotationMatrix(armorMesh.matrixWorld)
      armorMesh.scale.setFromMatrixScale(armorMesh.matrixWorld)
      armorMesh.updateMatrixWorld(true)
    }
    
    // Use the generic fitting service directly
    const genericService = new GenericMeshFittingService()
    
    // For now, use the full avatar mesh but adjust parameters based on region
    // This is more stable than creating a partial mesh
    console.log('🎯 ArmorFittingViewer: Fitting to avatar mesh targeting region:', targetRegion.name)
    console.log('🎯 ArmorFittingViewer: Region bounds:', targetRegion.boundingBox.min, targetRegion.boundingBox.max)
    
    // Adjust parameters based on region size
    const regionSize = targetRegion.boundingBox.getSize(new THREE.Vector3())
    const adjustedParams = {
      ...params,
      // Scale smoothing radius based on region size
      smoothingRadius: Math.min(params.smoothingRadius || 0.02, regionSize.length() * 0.1),
      // Reduce target offset for tighter fit
      targetOffset: Math.min(params.targetOffset || 0.01, regionSize.length() * 0.02),
      // Pass the target region bounds for constraint
      targetBounds: targetRegion.boundingBox
    }
    
    console.log('🎯 ArmorFittingViewer: Constraining armor to region bounds')
    genericService.fitMeshToTarget(armorMesh, avatarMesh, adjustedParams)
    
    // Restore armor to its parent
    if (armorParent) {
      armorParent.add(armorMesh)
      armorMesh.updateMatrixWorld(true)
    }
    
    // Check armor bounds after fitting
    const armorBounds = new THREE.Box3().setFromObject(armorMesh)
    const armorSize = armorBounds.getSize(new THREE.Vector3())
    const armorCenter = armorBounds.getCenter(new THREE.Vector3())
    
    console.log('🎯 ArmorFittingViewer: Armor after fitting:')
    console.log('   Size:', armorSize.x.toFixed(3), armorSize.y.toFixed(3), armorSize.z.toFixed(3))
    console.log('   Center:', armorCenter.x.toFixed(3), armorCenter.y.toFixed(3), armorCenter.z.toFixed(3))
    console.log('   Position:', armorMesh.position.x.toFixed(3), armorMesh.position.y.toFixed(3), armorMesh.position.z.toFixed(3))
    console.log('   Scale:', armorMesh.scale.x.toFixed(3), armorMesh.scale.y.toFixed(3), armorMesh.scale.z.toFixed(3))
    
    // Force update
    if (equipmentViewerRef.current?.forceRender) {
      equipmentViewerRef.current.forceRender()
    }
  }
  
  const performBodyHullFit = () => {
    console.log('🎯 ArmorFittingViewer: performBodyHullFit called - new improved workflow')
    
    const meshes = findMeshes()
    if (!meshes) return
    const { avatarMesh, armorMesh } = meshes
    if (!avatarMesh || !armorMesh) {
      console.error('🎯 ArmorFittingViewer: Missing meshes for body hull fit')
      return
    }
    
    try {
      // Step 1: Extract body vertices only (torso region)
      console.log('Step 1: Extracting body vertices...')
      const bodyData = fittingService.current.extractBodyVertices(avatarMesh, avatarMesh.skeleton)
      
      // Step 2: Create body mesh for hull computation
      console.log('Step 2: Creating body mesh...')
      const bodyMesh = fittingService.current.createBodyMesh(bodyData.positions, bodyData.indices)
      
      // Step 3: Compute visual hull from body mesh
      console.log('Step 3: Computing visual hull...')
      // We'll use the body mesh itself as the hull for now
      // In production, you could use a convex hull library like three-mesh-bvh or ConvexGeometry
      const hullMesh = bodyMesh.clone()
      hullMesh.material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.3 
      })
      
      // Apply the avatar's world transform to the hull
      hullMesh.updateMatrixWorld(true)
      
      // Step 4: Position armor at body center
      console.log('Step 4: Positioning armor...')
      const bodyCenter = bodyData.bounds.getCenter(new Vector3())
      const armorBounds = new THREE.Box3().setFromObject(armorMesh)
      const armorCenter = armorBounds.getCenter(new Vector3())
      
      // Move armor so its center aligns with body center
      const offset = bodyCenter.clone().sub(armorCenter)
      armorMesh.position.add(offset)
      armorMesh.updateMatrixWorld(true)
      
      // Step 5: Scale armor to be 20% larger than body bounds
      console.log('Step 5: Scaling armor to 120% of body size...')
      const bodySize = bodyData.bounds.getSize(new Vector3())
      const largestBodyExtent = Math.max(bodySize.x, bodySize.y, bodySize.z)
      
      // Recalculate armor bounds after positioning
      armorBounds.setFromObject(armorMesh)
      const armorSize = armorBounds.getSize(new Vector3())
      const largestArmorExtent = Math.max(armorSize.x, armorSize.y, armorSize.z)
      
      // Calculate scale factor to make armor 20% larger than body
      const targetSize = largestBodyExtent * 1.2
      const scaleFactor = targetSize / largestArmorExtent
      
      armorMesh.scale.multiplyScalar(scaleFactor)
      armorMesh.updateMatrixWorld(true)
      
      console.log(`Scaled armor by ${scaleFactor.toFixed(3)} to achieve 120% of body size`)
      console.log(`Body extent: ${largestBodyExtent.toFixed(3)}, Target armor extent: ${targetSize.toFixed(3)}`)
      
      // Step 6: Use hull as shrink target
      console.log('Step 6: Fitting armor to body hull...')
      
      // Use the generic fitting service with the hull as target
      const genericFitter = new GenericMeshFittingService()
      const fittingParams = {
        iterations: 20,
        stepSize: 0.3,
        smoothingRadius: 0.1,
        smoothingStrength: 0.4,
        targetOffset: 0.01, // 1cm offset from body
        preserveFeatures: true,
        useImprovedShrinkwrap: true
      }
      
      // Perform the fitting
      genericFitter.fitMeshToTarget(armorMesh, hullMesh, fittingParams)
      
      // Mark as fitted
      armorMesh.userData.isFitted = true
      
      // Optional: Add hull to scene for visualization
      if (sceneRef.current) {
        hullMesh.name = 'BodyHull_Debug'
        // Remove any existing hull
        const existingHull = sceneRef.current.getObjectByName('BodyHull_Debug')
        if (existingHull) {
          sceneRef.current.remove(existingHull)
        }
        // Uncomment to visualize hull during fitting
        // sceneRef.current.add(hullMesh)
      }
      
      // Force update
      if (equipmentViewerRef.current?.forceRender) {
        equipmentViewerRef.current.forceRender()
      }
      
      console.log('🎯 ArmorFittingViewer: Body hull fitting complete!')
      props.onFittingComplete?.()
      
    } catch (error) {
      console.error('🎯 ArmorFittingViewer: Error in body hull fitting:', error)
    }
  }
  
  // Helper to get target region based on armor slot
  const getTargetRegion = (): BodyRegion | null => {
    if (!bodyRegions) return null
    
    const armorSlot = props.equipmentSlot || detectArmorSlot(props.armorSubtype)
    
    if (armorSlot === 'Head') {
      return bodyRegions.get('head') || null
    } else if (armorSlot === 'Hips') {
      return bodyRegions.get('legs') || bodyRegions.get('hips') || null
    } else if (armorSlot === 'Spine2') {
      return bodyRegions.get('torso') || null
    }
    
    return bodyRegions.get('torso') || null
  }
  
  // Create a mesh containing only vertices from a specific body region
  const createRegionMesh = (avatarMesh: SkinnedMesh, region: BodyRegion): Mesh | null => {
    if (!region.vertices || region.vertices.length === 0) {
      console.log('🎯 ArmorFittingViewer: No vertices in region')
      return null
    }
    
    try {
      console.log('🎯 ArmorFittingViewer: Creating region mesh with', region.vertices.length, 'vertices')
      
      const geometry = avatarMesh.geometry as BufferGeometry
      const position = geometry.attributes.position as BufferAttribute
      const normal = geometry.attributes.normal as BufferAttribute
      
      console.log('🎯 ArmorFittingViewer: Avatar geometry has', position.count, 'vertices')
      
      // Create arrays for the region geometry
      const regionVertices: number[] = []
      const regionNormals: number[] = []
      const vertexMap = new Map<number, number>() // original index -> new index
      
      // Extract vertices from the region
      region.vertices.forEach((vertexIndex) => {
        const newIndex = regionVertices.length / 3
        vertexMap.set(vertexIndex, newIndex)
        
        regionVertices.push(
          position.getX(vertexIndex),
          position.getY(vertexIndex),
          position.getZ(vertexIndex)
        )
        
        if (normal) {
          regionNormals.push(
            normal.getX(vertexIndex),
            normal.getY(vertexIndex),
            normal.getZ(vertexIndex)
          )
        }
      })
      
      console.log('🎯 ArmorFittingViewer: Extracted', regionVertices.length / 3, 'vertices for region')
      
      // Create the region geometry
      const regionGeometry = new BufferGeometry()
      regionGeometry.setAttribute('position', new BufferAttribute(new Float32Array(regionVertices), 3))
      if (regionNormals.length > 0) {
        regionGeometry.setAttribute('normal', new BufferAttribute(new Float32Array(regionNormals), 3))
      }
      
      // Create indices if the original has them
      if (geometry.index) {
        const indices: number[] = []
        const originalIndices = geometry.index.array
        
        // Find triangles that have all vertices in the region
        for (let i = 0; i < originalIndices.length; i += 3) {
          const v0 = originalIndices[i]
          const v1 = originalIndices[i + 1]
          const v2 = originalIndices[i + 2]
          
          if (vertexMap.has(v0) && vertexMap.has(v1) && vertexMap.has(v2)) {
            indices.push(
              vertexMap.get(v0)!,
              vertexMap.get(v1)!,
              vertexMap.get(v2)!
            )
          }
        }
        
        if (indices.length > 0) {
          regionGeometry.setIndex(indices)
        }
      }
      
      // Create mesh with same transform as avatar
      const regionMesh = new Mesh(regionGeometry, avatarMesh.material)
      regionMesh.position.copy(avatarMesh.position)
      regionMesh.rotation.copy(avatarMesh.rotation)
      regionMesh.scale.copy(avatarMesh.scale)
      regionMesh.updateMatrixWorld(true)
      
      return regionMesh
    } catch (error) {
      console.error('Error creating region mesh:', error)
      return null
    }
  }
  
  const performHullBasedFit = async (parameters?: HullFittingParameters) => {
    console.log('🎯 ArmorFittingViewer: performHullBasedFit called')
    const meshes = findMeshes()
    if (!meshes) return
    const { avatarMesh, armorMesh } = meshes
    if (!avatarMesh || !armorMesh) {
      console.error('🎯 ArmorFittingViewer: Missing meshes for hull-based fit')
      return
    }
    
    // Default parameters optimized for body armor
    const defaultParams: HullFittingParameters = {
      targetOffset: 0.02, // 2cm from body surface
      iterations: 5,
      stepSize: 0.5,
      smoothInfluence: 5, // 5 edge connections
      smoothStrength: 0.7,
      maxDisplacement: 0.05, // Max 5cm movement per iteration
      preserveVolume: false,
      maintainPosition: true // Keep armor centered
    }
    
    const params = parameters || defaultParams
    
    console.log('🎯 ArmorFittingViewer: Starting hull-based fit with params:', params)
    
    // Mark as fitted
    armorMesh.userData.isFitted = true
    
    // Perform hull-based fitting
    await hullBasedFittingService.current.fitArmorToBodyHull(
      armorMesh,
      avatarMesh,
      params
    )
    
    // Force update
    if (equipmentViewerRef.current?.forceRender) {
      equipmentViewerRef.current.forceRender()
    }
    
    props.onFittingComplete?.()
  }
  
  const transferWeights = () => {
    const meshes = findMeshes()
    if (!meshes) return
    const { avatarMesh, armorMesh } = meshes
    if (!avatarMesh || !armorMesh) return
    
    const result = weightTransferService.current.transferWeights(
      avatarMesh,
      armorMesh,
      avatarMesh.skeleton,
      { method: 'inpainted' }
    )
    
    console.log('Weight transfer result:', result)
    props.onFittingComplete?.()
  }
  

  
  // Expose methods
  useImperativeHandle(ref, () => ({
    ...equipmentViewerRef.current!,
    
    performBoundingBoxFit,
    performCollisionBasedFit,
    performSmoothDeformation,
    performIterativeFit,
    performHullBasedFit,
    transferWeights,
    performBodyHullFit,
    
    setVisualizationMode: (mode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull') => {
      setVisualizationModeState(mode)
      
      // Clear previous visualization
      restoreOriginalMaterials()
      clearVisualization()
      
      // Apply new visualization
      switch (mode) {
        case 'regions':
          visualizeBodyRegions()
          break
        case 'collisions':
          visualizeCollisions()
          break
        case 'weights':
          visualizeWeights()
          break
        case 'hull':
          visualizeBodyHull()
          break
      }
    },
    
    setSelectedBone: (boneIndex: number) => {
      setSelectedBoneState(boneIndex)
      if (visualizationMode === 'weights') {
        visualizeWeights()
      }
    },
    
    getBodyRegions: () => bodyRegions,
    getCollisions: () => collisions,
    getFittingServices: () => ({
      fitting: fittingService.current,
      deformation: deformationService.current,
      weightTransfer: weightTransferService.current,
      hullBased: hullBasedFittingService.current
    }),
    
    // Mesh access - NEW
    getMeshReferences: () => {
      const meshes = findMeshes()
      return {
        avatarMesh: meshes?.avatarMesh || null,
        armorMesh: meshes?.armorMesh || null,
        helmetMesh: meshes?.helmetMesh || null,
        scene: sceneRef.current
      }
    },
    
    // Helmet fitting operations - NEW
    performHelmetFitting: async (params) => {
      const meshes = findMeshes()
      if (!meshes || !meshes.avatarMesh || !meshes.helmetMesh) {
        console.error('Avatar or helmet mesh not available for fitting')
        return
      }
      
      try {
        const result = await genericFittingService.current.fitHelmetToHead(
          meshes.helmetMesh,
          meshes.avatarMesh,
          {
            method: params?.method || 'auto',
            sizeMultiplier: params?.sizeMultiplier || 1.0,
            fitTightness: params?.fitTightness || 0.85,
            verticalOffset: params?.verticalOffset || 0,
            forwardOffset: params?.forwardOffset || 0,
            rotation: params?.rotation ? new THREE.Euler(
              params.rotation.x * Math.PI / 180,
              params.rotation.y * Math.PI / 180,
              params.rotation.z * Math.PI / 180
            ) : new THREE.Euler(0, 0, 0),
            attachToHead: false,
            showHeadBounds: false,
            showCollisionDebug: false
          }
        )
        
        console.log('Helmet fitting complete:', result)
        
        if (props.onFittingComplete) {
          props.onFittingComplete()
        }
      } catch (error) {
        console.error('Helmet fitting failed:', error)
      }
    },
    
    attachHelmetToHead: () => {
      const meshes = findMeshes()
      if (!meshes || !meshes.avatarMesh || !meshes.helmetMesh) {
        console.error('Avatar or helmet mesh not available for attachment')
        return
      }
      
      // Find head bone
      let headBone: THREE.Bone | null = null
      meshes.avatarMesh.traverse((child) => {
        if (child instanceof THREE.Bone && 
            (child.name.toLowerCase().includes('head') || 
             child.name === 'mixamorigHead')) {
          headBone = child as THREE.Bone
        }
      })
      
      if (!headBone) {
        console.error('Head bone not found')
        return
      }
      
      // Store world transform before attachment
      const worldPos = new THREE.Vector3()
      const worldQuat = new THREE.Quaternion()
      const worldScale = new THREE.Vector3()
      meshes.helmetMesh.getWorldPosition(worldPos)
      meshes.helmetMesh.getWorldQuaternion(worldQuat)
      meshes.helmetMesh.getWorldScale(worldScale)
      
      // Attach to head bone
      const bone = headBone as THREE.Bone
      bone.attach(meshes.helmetMesh)
      
      // Restore world transform
      meshes.helmetMesh.position.copy(worldPos)
      meshes.helmetMesh.quaternion.copy(worldQuat)
      meshes.helmetMesh.scale.copy(worldScale)
      
      console.log('Helmet attached to head bone:', bone.name)
    },
    
    detachHelmetFromHead: () => {
      const meshes = findMeshes()
      if (!meshes || !meshes.helmetMesh) {
        console.error('Helmet mesh not available for detachment')
        return
      }
      
      const scene = sceneRef.current
      if (!scene) {
        console.error('Scene not available')
        return
      }
      
      // Store world transform before detachment
      const worldPos = new THREE.Vector3()
      const worldQuat = new THREE.Quaternion()
      const worldScale = new THREE.Vector3()
      meshes.helmetMesh.getWorldPosition(worldPos)
      meshes.helmetMesh.getWorldQuaternion(worldQuat)
      meshes.helmetMesh.getWorldScale(worldScale)
      
      // Detach from parent (head bone) and add back to scene
      scene.attach(meshes.helmetMesh)
      
      // Restore world transform
      meshes.helmetMesh.position.copy(worldPos)
      meshes.helmetMesh.quaternion.copy(worldQuat)
      meshes.helmetMesh.scale.copy(worldScale)
      
      console.log('Helmet detached from head')
    }
  }))
  

  // Initialize scene reference
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    
    const checkScene = () => {
      const viewer = equipmentViewerRef.current
      if (viewer?.getScene) {
        const scene = viewer.getScene()
        if (scene && scene !== sceneRef.current) {
          sceneRef.current = scene
          console.log('🎯 ArmorFittingViewer: Scene obtained from EquipmentViewer')
          
          // Add visualization group to scene
          if (!scene.getObjectByName('VisualizationGroup')) {
            visualizationGroup.current.name = 'VisualizationGroup'
            scene.add(visualizationGroup.current)
            console.log('🎯 ArmorFittingViewer: Visualization group added to scene')
          }
          
          // Mark as ready
          setIsReady(true)
          
          if (intervalId) {
            clearInterval(intervalId)
            intervalId = null
          }
        }
      }
    }
    
    // Check immediately
    checkScene()
    
    // Check periodically until scene is available
    intervalId = setInterval(checkScene, 100)
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      // Clear any pending visualization timeout
      if (visualizationTimeoutRef.current) {
        clearTimeout(visualizationTimeoutRef.current)
        visualizationTimeoutRef.current = null
      }
      // Restore original materials before unmounting
      restoreOriginalMaterials()
      clearVisualization()
      if (sceneRef.current && visualizationGroup.current.parent) {
        sceneRef.current.remove(visualizationGroup.current)
      }
    }
  }, [])
  
  // Update visualization when mode changes
  useEffect(() => {
    if (props.visualizationMode !== undefined) {
      setVisualizationModeState(props.visualizationMode)
      
      // Clear any pending visualization timeout when mode changes
      if (visualizationTimeoutRef.current) {
        clearTimeout(visualizationTimeoutRef.current)
        visualizationTimeoutRef.current = null
      }
      
      restoreOriginalMaterials()
      clearVisualization()
      
      switch (props.visualizationMode) {
        case 'regions':
          if (bodyRegions) visualizeBodyRegions()
          break
        case 'collisions':
          if (collisions) visualizeCollisions()
          break
        case 'weights':
          visualizeWeights()
          break
        case 'hull':
          visualizeBodyHull()
          break
        case 'none':
          // Ensure everything is cleaned up
          restoreOriginalMaterials()
          clearVisualization()
          break
      }
    }
  }, [props.visualizationMode, bodyRegions, collisions])
  
  // Update selected bone
  useEffect(() => {
    if (props.selectedBone !== undefined) {
      setSelectedBoneState(props.selectedBone)
      if (visualizationMode === 'weights') {
        visualizeWeights()
      }
    }
  }, [props.selectedBone, visualizationMode])
  
  // Compute body regions when avatar loads
  useEffect(() => {
    // Clean up any existing visualization when URLs change
    if (visualizationTimeoutRef.current) {
      clearTimeout(visualizationTimeoutRef.current)
      visualizationTimeoutRef.current = null
    }
    restoreOriginalMaterials()
    clearVisualization()
    
    if (props.avatarUrl && props.armorUrl && equipmentViewerRef.current) {
      console.log('🎯 ArmorFittingViewer: Avatar and armor URLs set, waiting for load...')
      
      let checkCount = 0
      const checkInterval = setInterval(() => {
        checkCount++
        
        const meshes = findMeshes()
        if (meshes?.avatarMesh && meshes.avatarMesh.skeleton) {
          console.log('🎯 ArmorFittingViewer: Computing body regions...')
          const regions = fittingService.current.computeBodyRegions(meshes.avatarMesh, meshes.avatarMesh.skeleton)
          setBodyRegions(regions)
          props.onBodyRegionsComputed?.(regions)
          clearInterval(checkInterval)
        } else if (checkCount > 30) { // Stop after 3 seconds
          console.warn('🎯 ArmorFittingViewer: Timeout waiting for meshes')
          clearInterval(checkInterval)
        }
      }, 100)
      
      return () => clearInterval(checkInterval)
    }
  }, [props.avatarUrl, props.armorUrl, props.onBodyRegionsComputed])
  
  return (
    <EquipmentViewer
      ref={equipmentViewerRef}
      avatarUrl={props.avatarUrl}
      equipmentUrl={props.armorUrl}
      showSkeleton={props.showWireframe}
      equipmentSlot={armorSlot}
      weaponType="armor" // Tell EquipmentViewer this is armor, not a weapon
      autoScale={false} // Disable auto-scaling for armor fitting
      scaleOverride={1} // Keep original scale
      // Disable weapon-specific features
      gripOffset={{ x: 0, y: 0, z: 0 }}
      orientationOffset={{ x: 0, y: 0, z: 0 }}
      positionOffset={{ x: 0, y: 0, z: 0 }}
    />
  )
})

ArmorFittingViewer.displayName = 'ArmorFittingViewer' 