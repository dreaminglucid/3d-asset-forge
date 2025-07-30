import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ArmorFittingService } from '../../services/fitting/armor/ArmorFittingService'
import { X, Sparkles, Zap, Activity } from 'lucide-react'
import { Select } from '../common'
import { cn } from '../../styles'

// Available avatars and armors from gdd-assets
const AVAILABLE_AVATARS = [
  { id: 'thug', name: 'Thug', path: './gdd-assets/thug/thug_rigged.glb' },
  { id: 'troll', name: 'Troll', path: './gdd-assets/troll/troll_rigged.glb' },
  { id: 'goblin', name: 'Goblin', path: './gdd-assets/goblin/goblin_rigged.glb' },
  { id: 'imp', name: 'Imp', path: './gdd-assets/imp/imp_rigged.glb' },
]

const AVAILABLE_ARMORS = [
  { id: 'body-metal-base', name: 'Metal Base', path: './gdd-assets/body-metal-base/body-metal-base.glb' },
  { id: 'body-metal-bronze', name: 'Metal Bronze', path: './gdd-assets/body-metal-bronze/body-metal-bronze.glb' },
  { id: 'body-metal-mithril', name: 'Metal Mithril', path: './gdd-assets/body-metal-mithril/body-metal-mithril.glb' },
  { id: 'body-metal-steel', name: 'Metal Steel', path: './gdd-assets/body-metal-steel/body-metal-steel.glb' },
  { id: 'body-leather-base', name: 'Leather Base', path: './gdd-assets/body-leather-base-01/body-leather-base-01.glb' },
  { id: 'body-leather-leather', name: 'Leather', path: './gdd-assets/body-leather-01-leather/body-leather-01-leather.glb' },
  { id: 'body-leather-hard', name: 'Hard Leather', path: './gdd-assets/body-leather-01-hard-leather/body-leather-01-hard-leather.glb' },
  { id: 'body-leather-studded', name: 'Studded Leather', path: './gdd-assets/body-leather-01-studded-leather/body-leather-01-studded-leather.glb' },
]

interface IntuitiveMeshFittingDebuggerProps {
  onClose: () => void
}

// Scene component
function Scene({ 
  fittingService,
  armorFittingService,
  selectedAvatarPath,
  selectedArmorPath,
  isProcessing,
  onModelsLoaded,
  currentAnimation,
  isAnimationPlaying,
  showWorkspace,
  fittedArmorRef,
  debugMode
}: {
  fittingService: React.MutableRefObject<any> // TODO: SimpleArmorFittingService is missing
  armorFittingService: React.MutableRefObject<ArmorFittingService>
  selectedAvatarPath: string
  selectedArmorPath: string
  isProcessing: boolean
  onModelsLoaded: (avatar: THREE.SkinnedMesh, armor: THREE.Mesh) => void
  currentAnimation: string
  isAnimationPlaying: boolean
  showWorkspace: boolean
  fittedArmorRef: React.MutableRefObject<THREE.SkinnedMesh | null>
  debugMode: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const workspaceGroupRef = useRef<THREE.Group>(null)
  const debugArrowGroupRef = useRef<THREE.Group>(null)

  // Debug arrow group (removed - not needed in units-aware service)
  useEffect(() => {
    // Units-aware service handles debug internally
  }, [])

  // Load models
  const avatar = useGLTF(selectedAvatarPath)
  const armor = useGLTF(selectedArmorPath)

  // Create clones for manipulation
  const avatarClone = React.useMemo(() => {
    if (!avatar) return null
    const clone = avatar.scene.clone()
    
    // Setup skeleton for SkinnedMesh
    const skinnedMeshes: THREE.SkinnedMesh[] = []
    const bones: THREE.Bone[] = []
    
    clone.traverse((child) => {
      if (child instanceof THREE.Bone) {
        bones.push(child)
      } else if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child)
      }
    })
    
    clone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
          ;(child.material as THREE.MeshStandardMaterial).transparent = true
          ;(child.material as THREE.MeshStandardMaterial).opacity = 0.8
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }
        if (bones.length > 0) {
          const newSkeleton = new THREE.Skeleton(bones)
          child.bind(newSkeleton, child.bindMatrix)
        }
      } else if (child instanceof THREE.Mesh) {
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }
      }
    })
    
    return clone
  }, [avatar, selectedAvatarPath])

  const armorClone = React.useMemo(() => {
    if (!armor) return null
    const clone = armor.scene.clone()
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
          const mat = child.material as THREE.MeshStandardMaterial
          mat.color.set('#4472C4')
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }
      }
    })
    return clone
  }, [armor, selectedArmorPath])

  // Setup models
  useEffect(() => {
    if (avatarClone && armorClone) {
      // Find meshes
      let avatarMesh: THREE.SkinnedMesh | null = null
      let armorMesh: THREE.Mesh | null = null

      avatarClone.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
          avatarMesh = child
          child.userData.isAvatar = true
        }
      })

      armorClone.traverse((child) => {
        if (child instanceof THREE.Mesh && !armorMesh) {
          armorMesh = child
          child.userData.isArmor = true
        }
      })

      if (avatarMesh && armorMesh) {
        // Debug: Log the actual structure
        console.log('=== SCENE SETUP DEBUG ===')
        console.log('Avatar structure:')
        let parent = (avatarMesh as THREE.SkinnedMesh).parent
        let depth = 0
        while (parent && depth < 5) {
          console.log(`  Parent ${depth}: ${parent.name}, scale:`, parent.scale)
          parent = parent.parent
          depth++
        }
        console.log('Avatar local scale:', (avatarMesh as THREE.SkinnedMesh).scale)
        console.log('Avatar world matrix:', (avatarMesh as THREE.SkinnedMesh).matrixWorld)
        
        // Get world scale properly
        const avatarWorldScale = new THREE.Vector3()
        const avatarWorldPos = new THREE.Vector3()
        const avatarWorldQuat = new THREE.Quaternion()
        ;(avatarMesh as THREE.SkinnedMesh).matrixWorld.decompose(avatarWorldPos, avatarWorldQuat, avatarWorldScale)
        console.log('Avatar world scale (decomposed):', avatarWorldScale)
        
        // Check geometry bounds
        ;(avatarMesh as THREE.SkinnedMesh).geometry.computeBoundingBox()
        const avatarGeoBounds = (avatarMesh as THREE.SkinnedMesh).geometry.boundingBox!
        console.log('Avatar geometry bounds:', avatarGeoBounds.min, avatarGeoBounds.max)
        console.log('Avatar geometry size:', avatarGeoBounds.getSize(new THREE.Vector3()))
        
        // Don't modify scales here - let the fitting service handle everything
        // Just make sure they're positioned reasonably for viewing
        
        // Center avatar at origin
        const avatarBounds = new THREE.Box3().setFromObject(avatarClone)
        avatarClone.position.y = -avatarBounds.min.y
        
        // Position armor to the side for initial view
        const armorBounds = new THREE.Box3().setFromObject(armorClone)
        armorClone.position.x = avatarBounds.max.x + 0.5
        armorClone.position.y = -armorBounds.min.y
        
        avatarClone.updateMatrixWorld(true)
        armorClone.updateMatrixWorld(true)
        
        console.log('Scene setup complete')
        console.log('Avatar bounds:', avatarBounds.min, avatarBounds.max)
        console.log('Armor bounds:', armorBounds.min, armorBounds.max)
        console.log('=== END SCENE SETUP DEBUG ===')
        
        onModelsLoaded(avatarMesh, armorMesh)
      }
    }
  }, [avatarClone, armorClone, onModelsLoaded])

  // Animation handling
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  
  useEffect(() => {
    if (!avatar || !avatarClone || !isAnimationPlaying) return
    
    if (avatar.animations && avatar.animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(avatarClone)
      const clip = avatar.animations[0]
      const action = mixerRef.current.clipAction(clip)
      action.reset()
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
    }
    
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction()
        mixerRef.current = null
      }
    }
  }, [avatar, avatarClone, isAnimationPlaying])

  const lastDebugTimeRef = useRef(0)
  
  useFrame((state, delta) => {
    if (mixerRef.current && isAnimationPlaying) {
      mixerRef.current.update(delta)
    }
    
    // Debug fitted armor state every second
    if (fittedArmorRef.current && debugMode) {
      const now = Date.now()
      
      if (now - lastDebugTimeRef.current > 1000) { // Log every second
        lastDebugTimeRef.current = now
        
        console.log('=== FRAME DEBUG ===')
        console.log('Fitted armor visible:', fittedArmorRef.current.visible)
        
        const worldScale = new THREE.Vector3()
        fittedArmorRef.current.getWorldScale(worldScale)
        console.log('Fitted armor world scale:', worldScale)
        
        const box = new THREE.Box3().setFromObject(fittedArmorRef.current)
        const size = new THREE.Vector3()
        box.getSize(size)
        console.log('Fitted armor size:', size.length())
        console.log('Fitted armor bounds:', box.min, box.max)
        
        // Check if something is modifying the armor
        if (fittedArmorRef.current instanceof THREE.SkinnedMesh) {
          console.log('Bind matrix determinant:', fittedArmorRef.current.bindMatrix.determinant())
          console.log('Skeleton bones count:', fittedArmorRef.current.skeleton?.bones.length)
        }
        
        console.log('=== END FRAME DEBUG ===')
      }
    }
  })

  // Show workspace meshes when enabled
  useEffect(() => {
    if (!workspaceGroupRef.current) return

    // Clear previous workspace visualization
    while (workspaceGroupRef.current.children.length > 0) {
      const child = workspaceGroupRef.current.children[0]
      workspaceGroupRef.current.remove(child)
    }

    // Note: Workspace visualization removed as the new intuitive service
    // handles normalization internally without exposing workspace
  }, [showWorkspace])

  if (!avatarClone || !armorClone) return null

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />
      
      <group ref={groupRef}>
        <primitive object={avatarClone} />
        <primitive object={armorClone} />
      </group>
      
      <group ref={workspaceGroupRef} />
      <group ref={debugArrowGroupRef} />
      
      <gridHelper args={[10, 10]} />
    </>
  )
}

export function IntuitiveMeshFittingDebugger({ onClose }: IntuitiveMeshFittingDebuggerProps) {
  const fittingService = useRef({} as any) // TODO: SimpleArmorFittingService is missing
  const armorFittingService = useRef(new ArmorFittingService())
  const sceneRef = useRef<THREE.Scene | null>(null)
  
  // State
  const [selectedAvatar, setSelectedAvatar] = useState(AVAILABLE_AVATARS[0])
  const [selectedArmor, setSelectedArmor] = useState(AVAILABLE_ARMORS[0])
  const [isProcessing, setIsProcessing] = useState(false)
  const [iterations, setIterations] = useState(10)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showWorkspace, setShowWorkspace] = useState(false)
  const [fittingResult, setFittingResult] = useState<{
    success: boolean
    executionTime: number
  } | null>(null)
  
  // Animation states
  const [currentAnimation, setCurrentAnimation] = useState('idle')
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)
  const [isArmorBound, setIsArmorBound] = useState(false)
  const [debugMode, setDebugMode] = useState(false)
  
  // Mesh references
  const avatarMeshRef = useRef<THREE.SkinnedMesh | null>(null)
  const armorMeshRef = useRef<THREE.Mesh | null>(null)
  const originalArmorRef = useRef<THREE.Mesh | null>(null)
  const fittedArmorRef = useRef<THREE.SkinnedMesh | null>(null)

  // Handle model loading
  const handleModelsLoaded = (avatar: THREE.SkinnedMesh, armor: THREE.Mesh) => {
    console.log('Models loaded - Avatar:', avatar.name, 'Armor:', armor.name)
    
    avatarMeshRef.current = avatar
    armorMeshRef.current = armor
    
    // Store a deep clone of the original armor
    const originalClone = armor.clone()
    originalClone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry = child.geometry.clone()
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
        }
      }
    })
    originalArmorRef.current = originalClone
    
    // Reset fitting state
    setFittingResult(null)
    setIsArmorBound(false)
    if (fittedArmorRef.current && fittedArmorRef.current.parent) {
      fittedArmorRef.current.parent.remove(fittedArmorRef.current)
      fittedArmorRef.current = null
    }
  }

  // Reset when models change
  useEffect(() => {
    setFittingResult(null)
    setIsArmorBound(false)
    setIsAnimationPlaying(false)
    setCurrentAnimation('idle')
    if (fittedArmorRef.current && fittedArmorRef.current.parent) {
      fittedArmorRef.current.parent.remove(fittedArmorRef.current)
      fittedArmorRef.current = null
    }
  }, [selectedAvatar.id, selectedArmor.id])

  // The magic auto-fit function
  const performAutoFit = async () => {
    if (!avatarMeshRef.current || !armorMeshRef.current) {
      console.error('Models not loaded')
      return
    }

    setIsProcessing(true)
    
    try {
      // Reset armor to original state
      if (originalArmorRef.current && armorMeshRef.current) {
        // Remove old fitted armor if exists
        if (fittedArmorRef.current && fittedArmorRef.current.parent) {
          fittedArmorRef.current.parent.remove(fittedArmorRef.current)
          fittedArmorRef.current = null
        }
        
        // Show original armor again
        armorMeshRef.current.visible = true
      }

      // Perform the fitting
      const startTime = performance.now()
      let skinnedArmor: THREE.SkinnedMesh | null = null
      
      try {
        skinnedArmor = fittingService.current.fitAndBindArmor(
          avatarMeshRef.current,
          armorMeshRef.current,
          {
            iterations: iterations,
            shrinkwrapOffset: 0.01,
            weightSearchRadius: 0.05
          }
        )
      } catch (error) {
        console.error('Fitting failed:', error)
        throw error
      }
      
      const executionTime = performance.now() - startTime

      // Handle the result
      if (skinnedArmor) {
        console.log('Fitting successful, handling result...')
        console.log('Result mesh:', skinnedArmor)
        console.log('Result mesh position:', skinnedArmor.position)
        console.log('Result mesh scale:', skinnedArmor.scale)
        console.log('Result mesh visible:', skinnedArmor.visible)
        
        // Hide original armor
        armorMeshRef.current.visible = false
        
        // Add fitted armor to the same parent as the avatar
        // The geometry has been transformed to the avatar's parent space
        const avatarParent = avatarMeshRef.current.parent
        
        if (avatarParent) {
          console.log('Adding fitted armor to avatar parent:', avatarParent.name || 'unnamed')
          console.log('Armor geometry has been transformed to avatar parent space')
          avatarParent.add(skinnedArmor)
          
          // Update world matrix after adding
          skinnedArmor.updateMatrixWorld(true)
          
          // Log final state
          console.log('Fitted armor added to scene')
          console.log('Final position:', skinnedArmor.position)
          console.log('Final scale:', skinnedArmor.scale)
          
          // Check bounds
          const box = new THREE.Box3().setFromObject(skinnedArmor)
          console.log('Final bounds:', box.min, box.max)
          const size = new THREE.Vector3()
          box.getSize(size)
          console.log('Final size:', size)
          console.log('Expected size (avatar world size * 1.1):', 
            new THREE.Vector3(0.017 * 1.1, 0.0149 * 1.1, 0.0034 * 1.1)
          )
        }
        
        // Store reference to fitted armor
        fittedArmorRef.current = skinnedArmor
        
        // Update material to show fitted state
        skinnedArmor.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
            const mat = child.material as THREE.MeshStandardMaterial
            if (mat) {
              mat.color.set('#00ff00')
              mat.emissive = new THREE.Color(0x00ff00)
              mat.emissiveIntensity = 0.1
            }
          }
        })
        
        // Set the armor as already bound since it's a SkinnedMesh
        setIsArmorBound(true)
      }

      setFittingResult({
        success: true,
        executionTime: executionTime
      })

      // Update scene
      if (sceneRef.current) {
        sceneRef.current.updateMatrixWorld(true)
      }
    } catch (error) {
      console.error('Auto-fit failed:', error)
      setFittingResult({
        success: false,
        executionTime: 0
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset meshes
  const resetMeshes = () => {
    if (originalArmorRef.current && armorMeshRef.current) {
      // Remove fitted armor if exists
      if (fittedArmorRef.current && fittedArmorRef.current.parent) {
        fittedArmorRef.current.parent.remove(fittedArmorRef.current)
        fittedArmorRef.current = null
      }
      
      // Show original armor
      armorMeshRef.current.visible = true
      
      // Reset states
      setFittingResult(null)
      setIsArmorBound(false)
      setIsAnimationPlaying(false)
    }
  }



  // Update scene debug info
  const updateSceneDebug = () => {
    if (!avatarMeshRef.current || !sceneRef.current) return
    
    console.log('=== SCENE SETUP DEBUG ===')
    console.log('Avatar structure:')
    
    let parent = avatarMeshRef.current.parent
    let depth = 0
    while (parent && depth < 10) {
      console.log(`  Parent ${depth}: ${parent.name || '(unnamed)'}, scale:`, parent.scale)
      parent = parent.parent
      depth++
    }
    
    console.log('Avatar local scale:', avatarMeshRef.current.scale)
    console.log('Avatar world matrix:', avatarMeshRef.current.matrixWorld)
    
    // Get world scale properly
    const worldScale = new THREE.Vector3()
    avatarMeshRef.current.getWorldScale(worldScale)
    console.log('Avatar world scale (decomposed):', worldScale)
    
    // Check geometry bounds
    if ((avatarMeshRef.current as THREE.SkinnedMesh).geometry) {
      const geo = (avatarMeshRef.current as THREE.SkinnedMesh).geometry
      geo.computeBoundingBox()
      console.log('Avatar geometry bounds:', geo.boundingBox?.min, geo.boundingBox?.max)
      const size = new THREE.Vector3()
      geo.boundingBox?.getSize(size)
      console.log('Avatar geometry size:', size)
    }
    
    // Update scene matrices
    sceneRef.current.updateMatrixWorld(true)
    
    // Check fitted armor if it exists
    if (fittedArmorRef.current) {
      console.log('\nFitted armor debug:')
      console.log('Fitted armor visible:', fittedArmorRef.current.visible)
      console.log('Fitted armor parent:', fittedArmorRef.current.parent?.name)
      
      const fittedScale = new THREE.Vector3()
      fittedArmorRef.current.getWorldScale(fittedScale)
      console.log('Fitted armor world scale:', fittedScale)
      
      const fittedBox = new THREE.Box3().setFromObject(fittedArmorRef.current)
      console.log('Fitted armor bounds:', fittedBox.min, fittedBox.max)
      const fittedSize = new THREE.Vector3()
      fittedBox.getSize(fittedSize)
      console.log('Fitted armor size:', fittedSize)
      console.log('Fitted armor size length:', fittedSize.length())
      
      // Check if it's being culled
      if (fittedArmorRef.current instanceof THREE.SkinnedMesh) {
        console.log('Fitted armor frustumCulled:', fittedArmorRef.current.frustumCulled)
        console.log('Fitted armor bindMatrix:', fittedArmorRef.current.bindMatrix)
      }
    }
    
    // Get bounds
    const avatarBounds = new THREE.Box3().setFromObject(avatarMeshRef.current)
    const armorBounds = armorMeshRef.current ? new THREE.Box3().setFromObject(armorMeshRef.current) : null
    
    console.log('Scene setup complete')
    console.log('Avatar bounds:', avatarBounds.min, avatarBounds.max)
    if (armorBounds) {
      console.log('Armor bounds:', armorBounds.min, armorBounds.max)
    }
    console.log('=== END SCENE SETUP DEBUG ===')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-primary rounded-2xl border border-white/10 w-[90%] max-w-5xl h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Intuitive Armor Fitting</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                One-click perfect fitting with intelligent analysis
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
          >
            <X className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D View */}
          <div className="flex-1 relative bg-bg-secondary/20">
            <div className="absolute inset-0">
              <Canvas
                camera={{ position: [3, 3, 5], fov: 50 }}
                onCreated={({ scene }) => { sceneRef.current = scene }}
              >
                <Scene 
                  fittingService={fittingService}
                  armorFittingService={armorFittingService}
                  selectedAvatarPath={selectedAvatar.path}
                  selectedArmorPath={selectedArmor.path}
                  isProcessing={isProcessing}
                  onModelsLoaded={handleModelsLoaded}
                  currentAnimation={currentAnimation}
                  isAnimationPlaying={isAnimationPlaying}
                  showWorkspace={showWorkspace}
                  fittedArmorRef={fittedArmorRef}
                  debugMode={debugMode}
                />
              </Canvas>
            </div>
            
            {/* Magic Auto-Fit Button */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <button
                onClick={performAutoFit}
                disabled={isProcessing || isArmorBound}
                className={cn(
                  "px-8 py-4 rounded-xl font-medium transition-all duration-300",
                  "bg-gradient-to-r from-purple-600 to-blue-600 text-white",
                  "shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]",
                  "flex items-center gap-3 group",
                  "border border-white/20",
                  isProcessing && "opacity-50 cursor-not-allowed animate-pulse"
                )}
              >
                <Sparkles className={cn(
                  "w-5 h-5 transition-transform",
                  !isProcessing && "group-hover:rotate-12"
                )} />
                <span className="text-lg">
                  {isProcessing ? 'Fitting...' : 'Auto Fit'}
                </span>
                <div className={cn(
                  "w-2 h-2 rounded-full bg-white",
                  isProcessing ? "animate-ping" : "opacity-60"
                )} />
              </button>
              
              {isArmorBound && (
                <button
                  onClick={resetMeshes}
                  className="mt-3 px-6 py-2 rounded-lg bg-orange-600 text-white
                    hover:bg-orange-700 transition-colors flex items-center gap-2 mx-auto"
                >
                  Reset
                </button>
              )}
            </div>
            
            {/* Result Badge */}
            {fittingResult && (
              <div className={cn(
                "absolute top-4 left-4 px-4 py-2 rounded-lg backdrop-blur-md",
                "border animate-in slide-in-from-top duration-300",
                fittingResult.success 
                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                  : "bg-red-500/20 border-red-500/30 text-red-400"
              )}>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {fittingResult.success ? 'Perfect Fit with Animation!' : 'Fallback Applied'}
                  </span>
                </div>
                <div className="text-xs mt-1 opacity-80">
                  Completed in {fittingResult.executionTime.toFixed(0)}ms
                </div>
              </div>
            )}
            
            {/* Animation Controls */}
            {isArmorBound && (
              <div className="absolute top-4 right-4 bg-bg-primary/90 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                <button
                  onClick={() => setIsAnimationPlaying(!isAnimationPlaying)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isAnimationPlaying
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  )}
                >
                  {isAnimationPlaying ? 'Stop Animation' : 'Play Animation'}
                </button>
              </div>
            )}
          </div>
          
          {/* Simple Controls Panel */}
          <div className="w-80 border-l border-white/10 bg-bg-secondary/30 overflow-y-auto">
            <div className="p-6 space-y-6">
              {/* Model Selection */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-4">Select Models</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-text-secondary">Avatar</label>
                    <Select
                      value={selectedAvatar.id}
                      onChange={(e) => {
                        const avatar = AVAILABLE_AVATARS.find(a => a.id === e.target.value)
                        if (avatar) setSelectedAvatar(avatar)
                      }}
                      className="mt-1"
                    >
                      {AVAILABLE_AVATARS.map(avatar => (
                        <option key={avatar.id} value={avatar.id}>
                          {avatar.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-text-secondary">Armor</label>
                    <Select
                      value={selectedArmor.id}
                      onChange={(e) => {
                        const armor = AVAILABLE_ARMORS.find(a => a.id === e.target.value)
                        if (armor) setSelectedArmor(armor)
                      }}
                      className="mt-1"
                    >
                      {AVAILABLE_ARMORS.map(armor => (
                        <option key={armor.id} value={armor.id}>
                          {armor.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
              
              {/* Iterations Slider */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-4">Fitting Iterations</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Fast (5)</span>
                    <span className="text-primary font-medium">{iterations}</span>
                    <span className="text-text-secondary">Precise (20)</span>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="range"
                      min="5"
                      max="20"
                      step="1"
                      value={iterations}
                      onChange={(e) => setIterations(parseInt(e.target.value))}
                      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none
                        [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:bg-gradient-to-r [&::-webkit-slider-thumb]:from-purple-500 [&::-webkit-slider-thumb]:to-blue-500
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                        [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-purple-500/20"
                    />
                  </div>
                  
                  <p className="text-xs text-text-tertiary leading-relaxed">
                    More iterations = better fit but takes longer
                  </p>
                </div>
              </div>
              
              {/* Optional Advanced Settings */}
              <div className="border-t border-white/10 pt-4">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                </button>
                
                {showAdvanced && (
                  <div className="mt-4 space-y-4 animate-in slide-in-from-top duration-200">

                    
                    {/* Debug Options */}
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={debugMode}
                          onChange={(e) => setDebugMode(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-text-secondary">
                          Show debug arrows
                        </span>
                      </label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={showWorkspace}
                          onChange={(e) => setShowWorkspace(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <span className="text-xs text-text-secondary">
                          Show normalized workspace
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Info Box */}
              <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-lg p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-text-primary mb-2">
                  ✨ How It Works
                </h4>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• Automatically handles scale differences</li>
                  <li>• Transforms armor to skeleton space</li>
                  <li>• Smart shrinkwrap fitting</li>
                  <li>• Proper weight transfer</li>
                  <li>• Animation ready instantly!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Preload models
AVAILABLE_AVATARS.forEach(avatar => useGLTF.preload(avatar.path))
AVAILABLE_ARMORS.forEach(armor => useGLTF.preload(armor.path)) 