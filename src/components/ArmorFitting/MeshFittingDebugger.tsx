import React, { useRef, useState, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Text as DreiText, Html } from '@react-three/drei'
import { GenericMeshFittingService } from '../../services/fitting/armor/GenericMeshFittingService'
import { ArmorFittingService } from '../../services/fitting/armor/ArmorFittingService'
import { cn } from '../../styles'
import { X, Play, Grid3x3, Link, Activity, RotateCcw, Pause, Box, Sliders } from 'lucide-react'
import { useDebuggerStore } from '../../store/useDebuggerStore'
import { useAssets } from '../../hooks/useAssets'
import { ExtendedMesh } from '../../types'

// Styled range input component matching the app's design system
const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      type="range"
      {...props}
      className={cn(
        "w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer",
        "[&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full",
        "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none",
        "[&::-moz-range-thumb]:shadow-md",
        props.className
      )}
    />
  )
}

interface MeshFittingDebuggerProps {
  onClose: () => void
}

function Scene({
  fittingService,
  showWireframe,
  viewMode,
  selectedAvatarPath,
  selectedArmorPath,
  selectedHelmetPath,
  avatarMeshRef,
  armorMeshRef,
  helmetMeshRef,
  originalArmorGeometryRef,
  originalHelmetTransformRef,
  debugArrowGroupRef,
  headBoundsHelperRef,
  currentAnimation,
  isAnimationPlaying,
  showHeadBounds
}: {
  fittingService: React.MutableRefObject<GenericMeshFittingService>,
  isProcessing: boolean,
  showWireframe: boolean,
  viewMode: 'sphereCube' | 'avatarArmor' | 'helmetFitting',
  selectedAvatarPath: string,
  selectedArmorPath: string,
  selectedHelmetPath: string,
  avatarMeshRef: React.MutableRefObject<THREE.SkinnedMesh | null>,
  armorMeshRef: React.MutableRefObject<THREE.Mesh | null>,
  helmetMeshRef: React.MutableRefObject<THREE.Mesh | null>,
  originalArmorGeometryRef: React.MutableRefObject<THREE.BufferGeometry | null>,
  originalHelmetTransformRef: React.MutableRefObject<{
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
  } | null>,
  debugArrowGroupRef: React.MutableRefObject<THREE.Group | null>,
  headBoundsHelperRef: React.MutableRefObject<THREE.Box3Helper | null>,
  currentAnimation: 'tpose' | 'walking' | 'running',
  isAnimationPlaying: boolean,
  showHeadBounds: boolean
}) {
  // Source meshes (the ones being deformed)
  const sourceCubeRef = useRef<THREE.Mesh>(null)
  const sourceSphereRef = useRef<THREE.Mesh>(null)

  // Target meshes (the ones being fitted to)
  const targetSphereRef = useRef<THREE.Mesh>(null)
  const targetCubeRef = useRef<THREE.Mesh>(null)

  const groupRef = useRef<THREE.Group>(null)

  // Store original geometries
  const originalSourceCubeGeometry = useRef<THREE.BufferGeometry | null>(null)
  const originalSourceSphereGeometry = useRef<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    if (sourceCubeRef.current && !originalSourceCubeGeometry.current) {
      originalSourceCubeGeometry.current = sourceCubeRef.current.geometry.clone()
    }
    if (sourceSphereRef.current && !originalSourceSphereGeometry.current) {
      originalSourceSphereGeometry.current = sourceSphereRef.current.geometry.clone()
    }
  }, [])

  // Callback for when real models are loaded
  const handleModelsLoaded = (avatarMesh: THREE.SkinnedMesh, armorMesh: THREE.Mesh) => {
    console.log('=== MODELS LOADED CALLBACK ===')
    console.log('Avatar:', avatarMesh.name)
    console.log('Armor:', armorMesh.name)
    console.log('Armor current geometry vertices:', armorMesh.geometry.attributes.position.count)
    console.log('Armor userData before:', Object.keys(armorMesh.userData))

    avatarMeshRef.current = avatarMesh
    armorMeshRef.current = armorMesh

    // Store original armor geometry - make sure we're starting fresh
    if (armorMesh.geometry) {
      originalArmorGeometryRef.current = armorMesh.geometry.clone()
      // Don't set userData.originalGeometry here - it was already cleared
      console.log('Stored original geometry with', originalArmorGeometryRef.current.attributes.position.count, 'vertices')
    }

    console.log('Armor userData after:', Object.keys(armorMesh.userData))
    console.log('========================')
  }

  // Callback for when helmet models are loaded
  const handleHelmetModelsLoaded = (avatarMesh: THREE.SkinnedMesh, helmetMesh: THREE.Mesh) => {
    console.log('=== HELMET MODELS LOADED ===')
    console.log('Avatar:', avatarMesh.name)
    console.log('Helmet:', helmetMesh.name)

    avatarMeshRef.current = avatarMesh
    helmetMeshRef.current = helmetMesh

    // Store original helmet transform
    if (helmetMesh && !originalHelmetTransformRef.current) {
      originalHelmetTransformRef.current = {
        position: helmetMesh.position.clone(),
        rotation: helmetMesh.rotation.clone(),
        scale: helmetMesh.scale.clone()
      }
    }

    // Create head bounds helper
    if (showHeadBounds && avatarMesh) {
      const headInfo = fittingService.current.detectHeadRegion(avatarMesh)
      if (headBoundsHelperRef.current) {
        headBoundsHelperRef.current.parent?.remove(headBoundsHelperRef.current)
      }
      headBoundsHelperRef.current = new THREE.Box3Helper(headInfo.headBounds, 0x00ff00)
      groupRef.current?.add(headBoundsHelperRef.current)
    }
  }

  // Set up debug arrow group
  useEffect(() => {
    if (debugArrowGroupRef.current) {
      fittingService.current.setDebugArrowGroup(debugArrowGroupRef.current)
    }

    return () => {
      fittingService.current.clearDebugArrows()
    }
  }, [fittingService])

  // Update render helper if it exists
  useFrame(() => {
    // Update helmet render helper position if it exists
    const helmet = helmetMeshRef.current as ExtendedMesh | null
    if (helmet?.updateHelper && helmet?.renderHelper) {
      helmet.updateHelper()
    }
  })

  // Update wireframe for primitive meshes
  useEffect(() => {
    const updateMeshWireframe = (mesh: THREE.Mesh | null) => {
      if (mesh && mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).wireframe = showWireframe
      }
    }

    updateMeshWireframe(sourceCubeRef.current)
    updateMeshWireframe(sourceSphereRef.current)
    updateMeshWireframe(targetCubeRef.current)
    updateMeshWireframe(targetSphereRef.current)
  }, [showWireframe])

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <OrbitControls />

      <group ref={groupRef}>
        {viewMode === 'sphereCube' ? (
          <>
            {/* Cube to Sphere Demo (left side) */}
            <group position={[-2.5, 0, 0]}>
              {/* Label */}
              <DreiText
                position={[0, 2, 0]}
                fontSize={0.3}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                Cube → Sphere
              </DreiText>

              {/* Source Cube (larger, to wrap onto sphere) */}
              <mesh
                ref={sourceCubeRef}
                userData={{ originalGeometry: originalSourceCubeGeometry, isSource: true }}
              >
                <boxGeometry args={[2.5, 2.5, 2.5, 10, 10, 10]} />
                <meshStandardMaterial color="#4472C4" transparent opacity={0.8} />
              </mesh>

              {/* Target Sphere (smaller, inside the cube) */}
              <mesh
                ref={targetSphereRef}
                userData={{ isTarget: true }}
              >
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial color="#ED7D31" transparent opacity={0.6} />
              </mesh>
            </group>

            {/* Sphere to Cube Demo (right side) */}
            <group position={[2.5, 0, 0]}>
              {/* Label */}
              <DreiText
                position={[0, 2, 0]}
                fontSize={0.3}
                color="#ffffff"
                anchorX="center"
                anchorY="middle"
              >
                Sphere → Cube
              </DreiText>

              {/* Source Sphere (larger, to wrap onto cube) */}
              <mesh
                ref={sourceSphereRef}
                userData={{ originalGeometry: originalSourceSphereGeometry, isSource: true }}
              >
                <sphereGeometry args={[1.8, 32, 32]} />
                <meshStandardMaterial color="#4472C4" transparent opacity={0.8} />
              </mesh>

              {/* Target Cube (smaller, inside the sphere) */}
              <mesh
                ref={targetCubeRef}
                userData={{ isTarget: true }}
              >
                <boxGeometry args={[1.5, 1.5, 1.5]} />
                <meshStandardMaterial color="#ED7D31" transparent opacity={0.6} />
              </mesh>
            </group>
          </>
        ) : viewMode === 'avatarArmor' ? (
          /* Real Avatar Armor Demo */
          <AvatarArmorDemo
            key={`${selectedAvatarPath}-${selectedArmorPath}`}
            onReady={handleModelsLoaded}
            showWireframe={showWireframe}
            avatarPath={selectedAvatarPath}
            armorPath={selectedArmorPath}
            currentAnimation={currentAnimation}
            isAnimationPlaying={isAnimationPlaying}
          />
        ) : (
          /* Helmet Fitting Demo */
          <HelmetDemo
            key={`${selectedAvatarPath}-${selectedHelmetPath}`}
            onReady={handleHelmetModelsLoaded}
            showWireframe={showWireframe}
            avatarPath={selectedAvatarPath}
            helmetPath={selectedHelmetPath}
            currentAnimation={currentAnimation}
            isAnimationPlaying={isAnimationPlaying}
            showHeadBounds={showHeadBounds}
            headBoundsHelperRef={headBoundsHelperRef}
          />
        )}
      </group>

      {/* Debug Arrow Group */}
      <group ref={debugArrowGroupRef} />

      <gridHelper args={[10, 10]} />
    </>
  )
}

// Avatar Armor Demo Component
const AvatarArmorDemo: React.FC<{
  onReady: (avatarMesh: THREE.SkinnedMesh, armorMesh: THREE.Mesh) => void,
  showWireframe: boolean,
  avatarPath: string,
  armorPath: string,
  currentAnimation: 'tpose' | 'walking' | 'running',
  isAnimationPlaying: boolean
}> = ({ onReady, showWireframe, avatarPath, armorPath, currentAnimation, isAnimationPlaying }) => {
  const avatarRef = useRef<THREE.Group>(null)
  const armorRef = useRef<THREE.Group>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const mixer = useRef<THREE.AnimationMixer>()
  const lastTime = useRef(0)
  const activeAction = useRef<THREE.AnimationAction | null>(null)
  const animationFrame = useRef<number>()

  // Check if paths are valid before attempting to load
  const hasValidPaths = avatarPath && armorPath && avatarPath !== '' && armorPath !== ''

  // Determine if we need a separate animation file
  const needsAnimationFile = currentAnimation !== 'tpose'

  // Construct animation file path based on the model if animation is needed
  const animationPath = useMemo(() => {
    if (needsAnimationFile && avatarPath) {
      const match = avatarPath.match(/gdd-assets\/([^\/]+)\//);
      if (match) {
        const characterName = match[1];
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb';
        return `./gdd-assets/${characterName}/${animFileName}`;
      }
    }

    return null
  }, [avatarPath, currentAnimation, needsAnimationFile])

  // Only load models if paths are valid
  const animationGltf = hasValidPaths && animationPath ? useGLTF(animationPath) : null
  const avatar = hasValidPaths ? useGLTF(avatarPath) : null
  const armor = hasValidPaths ? useGLTF(armorPath) : null

  // Return early if no valid paths
  if (!hasValidPaths) {
    return (
      <group>
        <Html center>
          <div style={{
            color: 'white',
            background: 'rgba(0,0,0,0.8)',
            padding: '20px 40px',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: '500',
            minWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            Please select both an avatar and armor from the Asset Selection panel
          </div>
        </Html>
      </group>
    )
  }

  // Log available animations on load
  useEffect(() => {
    if (avatar && avatar.animations.length > 0) {
      console.log('=== Available animations in base model ===')
      avatar.animations.forEach((clip: THREE.AnimationClip, index: number) => {
        console.log(`${index}: ${clip.name} (${clip.duration}s)`)
      })
    }
  }, [avatar])

  // Clone the scenes to ensure fresh instances every time
  const avatarClone = useMemo(() => {
    if (!avatar) return null
    const clone = avatar.scene.clone()

    // Handle SkinnedMesh skeleton setup
    const skinnedMeshes: THREE.SkinnedMesh[] = []
    const bones: THREE.Bone[] = []

    clone.traverse((child) => {
      if (child instanceof THREE.Bone) {
        bones.push(child)
      } else if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child)
      }
    })

    // Clone materials and geometries, setup skeleton
    clone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        // Clone material and geometry
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }

        // Create new skeleton for the cloned mesh
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
  }, [avatar, avatarPath]) // Re-clone when model changes

  const armorClone = useMemo(() => {
    if (!armor) return null
    const clone = armor.scene.clone()
    // Also clone materials and geometries to ensure complete separation
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }
      }
    })
    return clone
  }, [armor, armorPath]) // Re-clone when model changes

  // Reset when paths change
  useEffect(() => {
    setIsLoaded(false)
  }, [avatarPath, armorPath])

  // Update wireframe mode without re-cloning
  useEffect(() => {
    if (armorClone) {
      armorClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe
          }
        }
      })
    }
  }, [showWireframe, armorClone])

  useEffect(() => {
    if (avatarClone && armorClone && !isLoaded) {
      // Find the SkinnedMesh in the cloned avatar
      let avatarMesh: THREE.SkinnedMesh | null = null
      avatarClone.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
          avatarMesh = child
          // Set avatar material to be semi-transparent
          if (avatarMesh.material) {
            const material = avatarMesh.material as THREE.MeshStandardMaterial
            material.transparent = true
            material.opacity = 0.7
          }
        }
      })

      // Find the Mesh in the cloned armor
      let armorMesh: THREE.Mesh | null = null
      armorClone.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && !armorMesh) {
          armorMesh = child

          // No need to clear userData - we have a fresh clone!
          // No need to reset transforms - they're already at defaults!

          // Set armor material to wireframe
          if (armorMesh.material) {
            const material = armorMesh.material as THREE.MeshStandardMaterial
            material.color.set('#4472C4')
            material.transparent = true
            material.opacity = 0.8
          }
        }
      })

      if (avatarMesh && armorMesh) {
        // TypeScript needs explicit reassignment for proper type narrowing
        const finalAvatarMesh = avatarMesh as THREE.SkinnedMesh
        const finalArmorMesh = armorMesh as THREE.Mesh

        console.log('AvatarArmorDemo: Setting up meshes')
        console.log('Avatar mesh found:', finalAvatarMesh)
        console.log('Armor mesh found:', finalArmorMesh)

        // Ensure avatar stands on the grid
        avatarClone.updateMatrixWorld(true)
        const initialAvatarBounds = new THREE.Box3().setFromObject(avatarClone)
        const avatarMinY = initialAvatarBounds.min.y

        if (avatarMinY !== 0) {
          // Adjust position so avatar's feet are at Y=0
          avatarClone.position.y = -avatarMinY
          console.log(`Adjusted avatar Y position by ${-avatarMinY} to stand on grid`)
        }

        // Mark them
        finalAvatarMesh.userData.isAvatar = true
        finalArmorMesh.userData.isArmor = true
        finalArmorMesh.userData.isSource = true

        // Original geometry storage is now handled in handleModelsLoaded callback
        // finalArmorMesh.userData.originalGeometry = { current: finalArmorMesh.geometry.clone() }

        // Basic scale normalization - scale both to same size
        const avatarBounds = new THREE.Box3().setFromObject(finalAvatarMesh)
        const avatarHeight = avatarBounds.getSize(new THREE.Vector3()).y
        const scale = 2 / avatarHeight // Normalize avatar to ~2 units tall

        console.log('=== INITIAL MODEL SETUP ===')
        console.log('Avatar original height:', avatarHeight)
        console.log('Normalizing scale:', scale)

        avatarClone.scale.setScalar(scale)
        armorClone.scale.setScalar(scale) // Use same scale for armor

        // Update matrices after scaling
        avatarClone.updateMatrixWorld(true)
        armorClone.updateMatrixWorld(true)

        // Log final setup state
        const setupAvatarBounds = new THREE.Box3().setFromObject(avatarClone)
        const setupArmorBounds = new THREE.Box3().setFromObject(armorClone)
        console.log('Avatar setup bounds:', setupAvatarBounds.getSize(new THREE.Vector3()))
        console.log('Armor setup bounds:', setupArmorBounds.getSize(new THREE.Vector3()))
        console.log('========================')

        // Don't do complex scaling here - let the fitting function handle it
        // Just normalize both models to a reasonable size

        console.log('Applied scale:', scale)
        console.log('Avatar scene scale:', avatarClone.scale.x, avatarClone.scale.y, avatarClone.scale.z)
        console.log('Armor scene scale:', armorClone.scale.x, armorClone.scale.y, armorClone.scale.z)

        // Update world matrices
        avatarClone.updateMatrixWorld(true)
        armorClone.updateMatrixWorld(true)

        // Check world matrices
        console.log('Avatar world matrix:', avatarClone.matrixWorld.elements)
        console.log('Armor world matrix:', armorClone.matrixWorld.elements)

        // Verify final bounds
        const finalAvatarBounds = new THREE.Box3().setFromObject(finalAvatarMesh)
        const finalArmorBounds = new THREE.Box3().setFromObject(finalArmorMesh)
        console.log('Final avatar bounds:', finalAvatarBounds)
        console.log('Final armor bounds:', finalArmorBounds)

        setIsLoaded(true)
        onReady(finalAvatarMesh, finalArmorMesh)
      }
    }
  }, [avatarClone, armorClone, isLoaded, onReady, showWireframe, avatarPath, armorPath])

  // Update wireframe when prop changes
  useEffect(() => {
    if (armorClone) {
      armorClone.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh && child.userData.isArmor) {
          const material = child.material as THREE.MeshStandardMaterial
          if (material) {
            material.wireframe = showWireframe
          }
        }
      })
    }
  }, [showWireframe, armorClone])

  // Animation mixer ref
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)

  // Handle animation playback
  useEffect(() => {
    if (!avatar || !avatarClone || !isLoaded) return

    // Find the avatar mesh
    let avatarMesh: THREE.SkinnedMesh | null = null
    avatarClone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
        avatarMesh = child
      }
    })

    if (!avatarMesh) return

    // Check for animations in both base model and animation file
    let animations = avatar.animations

    // If we're playing an animation and base model has no animations, check animation file
    if (isAnimationPlaying && currentAnimation !== 'tpose' && animations.length === 0 && animationGltf) {
      animations = animationGltf.animations
      console.log(`Using animations from ${currentAnimation} file:`, animations.length)
    } else {
      console.log(`Animations found in base model:`, animations.length)
    }

    if (!animations || animations.length === 0) {
      console.log('No animations found in either base model or animation file')
      return
    }

    // Create animation mixer if needed - always create new one for new model
    mixerRef.current = new THREE.AnimationMixer(avatarClone)
    const mixer = mixerRef.current

    // Handle animation state
    if (isAnimationPlaying && currentAnimation !== 'tpose') {
      // Find the specific animation by name
      let targetClip: THREE.AnimationClip | undefined

      // Try to find animation by name patterns - be more specific
      for (const clip of animations) {
        const clipName = clip.name.toLowerCase()
        console.log(`Available animation: "${clip.name}" (duration: ${clip.duration}s)`)

        // For walking, prefer "walk" but exclude "run"
        if (currentAnimation === 'walking') {
          if ((clipName.includes('walk') || clipName.includes('walking')) &&
            !clipName.includes('run') && !clipName.includes('running')) {
            targetClip = clip
            console.log(`Selected walking animation: "${clip.name}"`)
            break
          }
        }
        // For running, prefer "run" but exclude "walk"
        else if (currentAnimation === 'running') {
          if ((clipName.includes('run') || clipName.includes('running')) &&
            !clipName.includes('walk') && !clipName.includes('walking')) {
            targetClip = clip
            console.log(`Selected running animation: "${clip.name}"`)
            break
          }
        }
      }

      // If no specific animation found, try the first one
      if (!targetClip && animations.length > 0) {
        targetClip = animations[0]
        console.log('Using first available animation:', targetClip.name)
      }

      if (targetClip) {
        const action = mixer.clipAction(targetClip)
        action.reset()
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.play()
        console.log('Playing animation:', targetClip.name)
      }
    } else {
      // Stop all animations
      mixer.stopAllAction()
    }

    // Cleanup
    return () => {
      if (mixer) {
        mixer.stopAllAction()
        mixerRef.current = null
      }
    }
  }, [avatar, avatarClone, isLoaded, isAnimationPlaying, currentAnimation, animationGltf])

  // Animation update loop  
  const frameCountRef = useRef(0)
  useFrame((state, delta) => {
    if (mixerRef.current && isAnimationPlaying && currentAnimation !== 'tpose') {
      mixerRef.current.update(delta)

      // Log every 60 frames to avoid spam
      frameCountRef.current++
      if (frameCountRef.current % 60 === 0) {
        console.log('Animation updating...', currentAnimation)
      }
    }
  })

  if (!avatarClone || !armorClone) return null

  return (
    <group position={[0, 0, 0]}>
      {/* Label */}
      <DreiText
        position={[0, 4.5, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        Real Armor → Avatar
      </DreiText>

      <group ref={avatarRef}>
        <primitive object={avatarClone} />
      </group>

      <group ref={armorRef}>
        <primitive object={armorClone} />
      </group>
    </group>
  )
}

// Helmet Demo Component
const HelmetDemo: React.FC<{
  onReady: (avatarMesh: THREE.SkinnedMesh, helmetMesh: THREE.Mesh) => void,
  showWireframe: boolean,
  avatarPath: string,
  helmetPath: string,
  currentAnimation: 'tpose' | 'walking' | 'running',
  isAnimationPlaying: boolean,
  showHeadBounds: boolean,
  headBoundsHelperRef: React.MutableRefObject<THREE.Box3Helper | null>
}> = ({ onReady, showWireframe, avatarPath, helmetPath, currentAnimation, isAnimationPlaying, showHeadBounds, headBoundsHelperRef }) => {
  const avatarRef = useRef<THREE.Group>(null)
  const helmetRef = useRef<THREE.Group>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  const mixer = useRef<THREE.AnimationMixer>()
  const lastTime = useRef(0)
  const activeAction = useRef<THREE.AnimationAction | null>(null)
  const animationFrame = useRef<number>()

  // Check if paths are valid before attempting to load
  const hasValidPaths = avatarPath && helmetPath && avatarPath !== '' && helmetPath !== ''

  // Determine if we need a separate animation file
  const needsAnimationFile = currentAnimation !== 'tpose'

  // Construct animation file path based on the model if animation is needed
  const animationPath = useMemo(() => {
    if (needsAnimationFile && avatarPath) {
      const match = avatarPath.match(/gdd-assets\/([^\/]+)\//);
      if (match) {
        const characterName = match[1];
        const animFileName = currentAnimation === 'walking' ? 'anim_walk.glb' : 'anim_run.glb';
        return `./gdd-assets/${characterName}/${animFileName}`;
      }
    }

    return null
  }, [avatarPath, currentAnimation, needsAnimationFile])

  // Only load models if paths are valid
  const animationGltf = hasValidPaths && animationPath ? useGLTF(animationPath) : null
  const avatar = hasValidPaths ? useGLTF(avatarPath) : null
  const helmet = hasValidPaths ? useGLTF(helmetPath) : null

  // Return early if no valid paths
  if (!hasValidPaths) {
    return (
      <group>
        <Html center>
          <div style={{
            color: 'white',
            background: 'rgba(0,0,0,0.8)',
            padding: '20px 40px',
            borderRadius: '8px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: '500',
            minWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
          }}>
            Please select both an avatar and helmet from the Asset Selection panel
          </div>
        </Html>
      </group>
    )
  }

  // Clone the scenes - handle skeleton setup for avatar
  const avatarClone = useMemo(() => {
    if (!avatar) return null
    const clone = avatar.scene.clone()

    // Handle SkinnedMesh skeleton setup
    const skinnedMeshes: THREE.SkinnedMesh[] = []
    const bones: THREE.Bone[] = []

    clone.traverse((child) => {
      if (child instanceof THREE.Bone) {
        bones.push(child)
      } else if (child instanceof THREE.SkinnedMesh) {
        skinnedMeshes.push(child)
      }
    })

    // Clone materials and geometries, setup skeleton
    clone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh) {
        // Clone material and geometry
        if (child.material) {
          child.material = (child.material as THREE.Material).clone()
        }
        if (child.geometry) {
          child.geometry = child.geometry.clone()
        }

        // Create new skeleton for the cloned mesh
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
  }, [avatar, avatarPath])

  const helmetClone = useMemo(() => {
    if (!helmet) return null
    const clone = helmet.scene.clone()
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = child.material.clone()
      }
    })
    return clone
  }, [helmet, helmetPath])

  // Reset when paths change
  useEffect(() => {
    setIsLoaded(false)
  }, [avatarPath, helmetPath])

  // Update wireframe mode without re-cloning
  useEffect(() => {
    if (avatarClone) {
      avatarClone.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.SkinnedMesh) {
          if (child.material) {
            (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe
          }
        }
      })
    }
    if (helmetClone) {
      helmetClone.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.material) {
            (child.material as THREE.MeshStandardMaterial).wireframe = showWireframe
          }
        }
      })
    }
  }, [showWireframe, avatarClone, helmetClone])

  // Find meshes and call onReady
  useEffect(() => {
    if (!avatarClone || !helmetClone || isLoaded) return

    let avatarMesh: THREE.SkinnedMesh | null = null
    let helmetMesh: THREE.Mesh | null = null

    avatarClone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
        avatarMesh = child
      }
    })

    helmetClone.traverse((child) => {
      if (child instanceof THREE.Mesh && !helmetMesh) {
        helmetMesh = child
      }
    })

    if (avatarMesh && helmetMesh) {
      onReady(avatarMesh, helmetMesh)
      setIsLoaded(true)
    }
  }, [avatarClone, helmetClone, onReady, isLoaded])

  // Animation mixer ref
  const mixerRef = useRef<THREE.AnimationMixer | null>(null)

  // Handle animation playback
  useEffect(() => {
    if (!avatar || !avatarClone || !isLoaded) return

    // Find the avatar mesh
    let avatarMesh: THREE.SkinnedMesh | null = null
    avatarClone.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !avatarMesh) {
        avatarMesh = child
      }
    })

    if (!avatarMesh) return

    // Check for animations in both base model and animation file
    let animations = avatar.animations

    // If we're playing an animation and base model has no animations, check animation file
    if (isAnimationPlaying && currentAnimation !== 'tpose' && animations.length === 0 && animationGltf) {
      animations = animationGltf.animations
      console.log(`Using animations from ${currentAnimation} file:`, animations.length)
    } else {
      console.log(`Animations found in base model:`, animations.length)
    }

    if (!animations || animations.length === 0) {
      console.log('No animations found in either base model or animation file')
      return
    }

    // Create animation mixer if needed - always create new one for new model
    mixerRef.current = new THREE.AnimationMixer(avatarClone)
    const mixer = mixerRef.current

    // Handle animation state
    if (isAnimationPlaying && currentAnimation !== 'tpose') {
      // Find the specific animation by name
      let targetClip: THREE.AnimationClip | undefined

      // Try to find animation by name patterns - be more specific
      for (const clip of animations) {
        const clipName = clip.name.toLowerCase()
        console.log(`Available animation: "${clip.name}" (duration: ${clip.duration}s)`)

        // For walking, prefer "walk" but exclude "run"
        if (currentAnimation === 'walking') {
          if ((clipName.includes('walk') || clipName.includes('walking')) &&
            !clipName.includes('run') && !clipName.includes('running')) {
            targetClip = clip
            console.log(`Selected walking animation: "${clip.name}"`)
            break
          }
        }
        // For running, prefer "run" but exclude "walk"
        else if (currentAnimation === 'running') {
          if ((clipName.includes('run') || clipName.includes('running')) &&
            !clipName.includes('walk') && !clipName.includes('walking')) {
            targetClip = clip
            console.log(`Selected running animation: "${clip.name}"`)
            break
          }
        }
      }

      // If no specific animation found, try the first one
      if (!targetClip && animations.length > 0) {
        targetClip = animations[0]
        console.log('Using first available animation:', targetClip.name)
      }

      if (targetClip) {
        const action = mixer.clipAction(targetClip)
        action.reset()
        action.setLoop(THREE.LoopRepeat, Infinity)
        action.play()
        console.log('Playing animation:', targetClip.name)
      }
    } else {
      // Stop all animations
      mixer.stopAllAction()
    }

    // Cleanup
    return () => {
      if (mixer) {
        mixer.stopAllAction()
        mixerRef.current = null
      }
    }
  }, [avatar, avatarClone, isLoaded, isAnimationPlaying, currentAnimation, animationGltf])

  // Animation update loop  
  const frameCountRef = useRef(0)
  useFrame((state, delta) => {
    if (mixerRef.current && isAnimationPlaying && currentAnimation !== 'tpose') {
      mixerRef.current.update(delta)

      // Log every 60 frames to avoid spam
      frameCountRef.current++
      if (frameCountRef.current % 60 === 0) {
        console.log('Animation updating...', currentAnimation)
      }
    }
  })

  if (!avatarClone || !helmetClone) return null

  return (
    <group position={[0, 0, 0]}>
      {/* Label */}
      <DreiText
        position={[0, 4.5, 0]}
        fontSize={0.3}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        Helmet Fitting
      </DreiText>

      <group ref={avatarRef}>
        <primitive object={avatarClone} />
      </group>

      <group ref={helmetRef}>
        <primitive object={helmetClone} />
      </group>

      {/* Head Bounds Helper */}
      {showHeadBounds && headBoundsHelperRef.current && (
        <primitive object={headBoundsHelperRef.current} />
      )}
    </group>
  )
}

// Available helmets will be loaded dynamically from useAssets hook

// Shared select styling for dark theme
const selectClassName = `w-full px-3 py-2 rounded-lg bg-bg-secondary border border-white/10 text-text-primary 
  focus:border-primary focus:ring-1 focus:ring-primary transition-all
  [&>option]:bg-bg-primary [&>option]:text-text-primary
  [&>option]:py-2 [&>option:hover]:bg-primary/20`

export function MeshFittingDebugger({ onClose }: MeshFittingDebuggerProps) {
  // Get assets from the API
  const { assets, loading } = useAssets()

  // Transform assets into the format expected by the component
  const availableAvatars = React.useMemo(() => {
    return assets
      .filter(asset => asset.type === 'character' && asset.hasModel)
      .map(asset => ({
        id: asset.id,
        name: asset.name,
        path: `/api/assets/${asset.id}/model`
      }))
  }, [assets])

  const availableArmors = React.useMemo(() => {
    return assets
      .filter(asset =>
        asset.hasModel && (
          asset.type === 'armor' ||
          (asset.name.toLowerCase().includes('body') && !asset.name.toLowerCase().includes('helmet'))
        )
      )
      .map(asset => ({
        id: asset.id,
        name: asset.name,
        path: `/api/assets/${asset.id}/model`
      }))
  }, [assets])

  const availableHelmets = React.useMemo(() => {
    return assets
      .filter(asset =>
        asset.hasModel && (
          asset.name.toLowerCase().includes('helmet') ||
          asset.name.toLowerCase().includes('head')
        )
      )
      .map(asset => ({
        id: asset.id,
        name: asset.name,
        path: `/api/assets/${asset.id}/model`
      }))
  }, [assets])

  // Preload models when assets are loaded
  React.useEffect(() => {
    availableAvatars.forEach(avatar => {
      if (avatar.path) useGLTF.preload(avatar.path)
    })
    availableArmors.forEach(armor => {
      if (armor.path) useGLTF.preload(armor.path)
    })
    availableHelmets.forEach(helmet => {
      if (helmet.path) useGLTF.preload(helmet.path)
    })
  }, [availableAvatars, availableArmors, availableHelmets])

  // Get state and actions from Zustand store
  const {
    // State
    activeDemo,
    viewMode,
    showWireframe,
    selectedAvatar,
    selectedArmor,
    selectedHelmet,
    selectedAvatarPath,
    selectedArmorPath,
    selectedHelmetPath,
    currentAnimation,
    isAnimationPlaying,
    fittingParameters,
    helmetFittingMethod,
    helmetSizeMultiplier,
    helmetFitTightness,
    helmetVerticalOffset,
    helmetForwardOffset,
    helmetRotation,
    showHeadBounds,
    showCollisionDebug,
    showHull,
    showDebugArrows,
    debugArrowDensity,
    debugColorMode,
    isProcessing,
    isArmorFitted,
    isArmorBound,
    isHelmetAttached,
    lastError,

    // Actions
    setActiveDemo,
    setViewMode,
    toggleWireframe,
    setShowWireframe,
    setSelectedAvatar,
    setSelectedArmor,
    setSelectedHelmet,
    setCurrentAnimation,
    setIsAnimationPlaying,
    toggleAnimation,
    updateFittingParameters,
    resetFittingParameters,
    setHelmetFittingMethod,
    setHelmetSizeMultiplier,
    setHelmetFitTightness,
    setHelmetVerticalOffset,
    setHelmetForwardOffset,
    setHelmetRotation,
    resetHelmetSettings,
    setShowHeadBounds,
    setShowCollisionDebug,
    setShowHull,
    setShowDebugArrows,
    setDebugArrowDensity,
    setDebugColorMode,
    toggleDebugVisualization,
    setIsProcessing,
    setIsArmorFitted,
    setIsArmorBound,
    setIsHelmetAttached,
    resetProcessingStates,
    setError,
    clearError,
    resetDebugger,
    saveDebugConfiguration,
    loadDebugConfiguration,
    isReadyToFit,
    getActiveModelName,
    getCurrentDebugInfo
  } = useDebuggerStore()

  // Refs (keep these as they're for Three.js objects)
  const fittingService = useRef(new GenericMeshFittingService())
  const armorFittingService = useRef(new ArmorFittingService())
  const sceneRef = useRef<THREE.Scene | null>(null)
  const avatarMeshRef = useRef<THREE.SkinnedMesh | null>(null)
  const armorMeshRef = useRef<ExtendedMesh | null>(null)
  const helmetMeshRef = useRef<ExtendedMesh | null>(null)
  const originalArmorGeometryRef = useRef<THREE.BufferGeometry | null>(null)
  const originalHelmetTransformRef = useRef<{
    position: THREE.Vector3,
    rotation: THREE.Euler,
    scale: THREE.Vector3
  } | null>(null)
  const debugArrowGroupRef = useRef<THREE.Group | null>(null)
  const headBoundsHelperRef = useRef<THREE.Box3Helper | null>(null)
  const hullMeshRef = useRef<THREE.Mesh | null>(null)

  // Temporary state for skinned armor mesh (keep as local state for now)
  const [skinnedArmorMesh, setSkinnedArmorMesh] = useState<THREE.SkinnedMesh | null>(null)

  // Update hull visibility
  useEffect(() => {
    if (hullMeshRef.current) {
      hullMeshRef.current.visible = showHull
    }
  }, [showHull])

  // Keyboard shortcut for wireframe toggle
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'W') {
        toggleWireframe()
      }
    }

    window.addEventListener('keypress', handleKeyPress)
    return () => window.removeEventListener('keypress', handleKeyPress)
  }, [toggleWireframe])

  // Reset fitting when models change
  useEffect(() => {
    // With proper cloning, we don't need complex cleanup!
    // Each model switch gets fresh clones automatically

    // Clear refs
    avatarMeshRef.current = null
    armorMeshRef.current = null
    helmetMeshRef.current = null
    originalArmorGeometryRef.current = null

    // Clear states using Zustand actions
    resetProcessingStates()
    setSkinnedArmorMesh(null)

    // Create fresh fitting service
    fittingService.current.clearDebugArrows()
    fittingService.current = new GenericMeshFittingService()
    if (debugArrowGroupRef.current) {
      fittingService.current.setDebugArrowGroup(debugArrowGroupRef.current)
    }

    // Reset animation states when models change
    setCurrentAnimation('tpose')
    setIsAnimationPlaying(false)

    // Small delay to ensure models are loaded
    const timer = setTimeout(() => {
      resetMeshes()
    }, 100)

    return () => clearTimeout(timer)
  }, [selectedAvatar?.id, selectedArmor?.id])

  const performFitting = (direction: 'cubeToSphere' | 'sphereToCube' | 'avatarToArmor') => {
    if (!sceneRef.current) return

    // CRITICAL: Update entire scene before any calculations
    const scene = sceneRef.current
    scene.updateMatrixWorld(true)
    console.log('Updated scene matrix world before fitting')

    // Ensure we're not already processing
    if (isProcessing) {
      console.warn('Already processing a fitting operation')
      return
    }

    setIsProcessing(true)

    // For armor fitting, validate clean state
    if (direction === 'avatarToArmor') {
      if (!armorMeshRef.current || !avatarMeshRef.current) {
        console.error('Armor or avatar mesh not loaded')
        console.error('armorMeshRef.current:', armorMeshRef.current)
        console.error('avatarMeshRef.current:', avatarMeshRef.current)
        setIsProcessing(false)
        return
      }

      // Log current state for debugging
      console.log('=== PRE-FITTING STATE CHECK ===')
      console.log('Armor scale:', armorMeshRef.current.scale.clone())
      console.log('Armor position:', armorMeshRef.current.position.clone())
      console.log('Armor parent scale:', armorMeshRef.current.parent?.scale.clone())
      console.log('Has been fitted before:', armorMeshRef.current.userData.hasBeenFitted)

      // Ensure armor starts at scale 1,1,1 for consistent fitting
      if (armorMeshRef.current.scale.x !== 1 || armorMeshRef.current.scale.y !== 1 || armorMeshRef.current.scale.z !== 1) {
        console.warn('⚠️ Armor scale is not 1,1,1! Resetting scale before fitting.')
        armorMeshRef.current.scale.set(1, 1, 1)
        armorMeshRef.current.updateMatrixWorld(true)
      }
    }

    // Handle avatar/armor fitting with full hull extraction
    if (direction === 'avatarToArmor') {
      // Find avatar and armor meshes
      let avatarMesh: THREE.SkinnedMesh | undefined
      let armorMesh: THREE.Mesh | undefined
      const armorMeshes: THREE.Mesh[] = []

      sceneRef.current.traverse((obj) => {
        if (obj.userData.isAvatar && obj instanceof THREE.SkinnedMesh) {
          avatarMesh = obj
        } else if (obj.userData.isArmor && obj instanceof THREE.Mesh) {
          armorMeshes.push(obj)
          armorMesh = obj
        }
      })

      // Validate we have exactly one armor mesh
      if (armorMeshes.length > 1) {
        console.error(`Found ${armorMeshes.length} armor meshes in scene! Should only have 1`)
        console.log('Armor meshes found:', armorMeshes.map(m => ({
          name: m.name,
          scale: m.scale.clone(),
          hasBeenFitted: m.userData.hasBeenFitted
        })))
        // Use the one from our ref
        armorMesh = armorMeshRef.current || armorMeshes[0]
      }

      if (avatarMesh && armorMesh) {
        console.log('=== ARMOR TO TORSO FITTING ===')

        // Store parent references before any manipulation
        const avatarParent = avatarMesh.parent
        const armorParent = armorMesh.parent

        // CRITICAL: Check and normalize scales
        console.log('=== SCALE ANALYSIS ===')
        console.log('Avatar scale:', avatarMesh.scale)
        console.log('Armor scale:', armorMesh.scale)
        console.log('Avatar parent:', avatarMesh.parent?.name, avatarMesh.parent?.position, avatarMesh.parent?.scale)
        console.log('Armor parent:', armorMesh.parent?.name, armorMesh.parent?.position, armorMesh.parent?.scale)

        // Get the actual scales by checking world matrix
        const avatarWorldScale = new THREE.Vector3()
        const armorWorldScale = new THREE.Vector3()
        avatarMesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), avatarWorldScale)
        armorMesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), armorWorldScale)

        console.log('Avatar world scale:', avatarWorldScale)
        console.log('Armor world scale:', armorWorldScale)

        // Calculate scale ratio
        const scaleRatio = armorWorldScale.x / avatarWorldScale.x
        console.log('Scale ratio (armor/avatar):', scaleRatio)

        // Also check actual vertex bounds to detect scale issues
        const avatarGeometry = avatarMesh.geometry
        const armorGeometry = armorMesh.geometry
        avatarGeometry.computeBoundingBox()
        armorGeometry.computeBoundingBox()

        if (avatarGeometry.boundingBox && armorGeometry.boundingBox) {
          const avatarGeomSize = avatarGeometry.boundingBox.getSize(new THREE.Vector3())
          const armorGeomSize = armorGeometry.boundingBox.getSize(new THREE.Vector3())
          console.log('Avatar geometry size:', avatarGeomSize)
          console.log('Armor geometry size:', armorGeomSize)
          console.log('Geometry size ratio (armor/avatar):', armorGeomSize.y / avatarGeomSize.y)
        }

        // If there's a significant scale mismatch, normalize the armor to avatar's scale
        if (Math.abs(scaleRatio - 1.0) > 0.1) {
          console.warn(`SCALE MISMATCH DETECTED: Armor is ${scaleRatio.toFixed(1)}x the size of avatar`)

          // Get bounds before normalization
          const armorBoundsBefore = new THREE.Box3().setFromObject(armorMesh)
          const armorSizeBefore = armorBoundsBefore.getSize(new THREE.Vector3())
          console.log('Armor size BEFORE normalization:', armorSizeBefore)

          console.log('Normalizing armor scale to match avatar...')

          // Scale the armor to match avatar's scale
          const normalizationFactor = avatarWorldScale.x / armorWorldScale.x
          armorMesh.scale.multiplyScalar(normalizationFactor)
          armorMesh.updateMatrixWorld(true)

          console.log('Applied normalization factor:', normalizationFactor)
          console.log('Armor scale after normalization:', armorMesh.scale)

          // Get bounds after normalization
          const armorBoundsAfter = new THREE.Box3().setFromObject(armorMesh)
          const armorSizeAfter = armorBoundsAfter.getSize(new THREE.Vector3())
          console.log('Armor size AFTER normalization:', armorSizeAfter)
          console.log('Size reduction:', armorSizeBefore.x / armorSizeAfter.x, 'x')

          // Validate against expected values from report
          console.log('=== SCALE NORMALIZATION VALIDATION ===')
          console.log('Expected armor scale after normalization: ~0.01')
          console.log('Actual armor scale components:', armorMesh.scale)
          console.log('Expected size reduction: ~100x')
          console.log('Actual size reduction:', (armorSizeBefore.x / armorSizeAfter.x).toFixed(1) + 'x')
        } else if (avatarGeometry.boundingBox && armorGeometry.boundingBox) {
          // Secondary check: geometry size mismatch
          const geomRatio = armorGeometry.boundingBox.getSize(new THREE.Vector3()).y /
            avatarGeometry.boundingBox.getSize(new THREE.Vector3()).y

          if (geomRatio > 10) {
            console.warn(`GEOMETRY SCALE MISMATCH: Armor geometry is ${geomRatio.toFixed(1)}x larger than avatar geometry`)
            console.log('This suggests avatar mesh vertices are at a different scale than the transform')

            // Use the geometry ratio to normalize
            const geometryNormalizationFactor = 1 / geomRatio
            armorMesh.scale.multiplyScalar(geometryNormalizationFactor)
            armorMesh.updateMatrixWorld(true)

            console.log('Applied geometry-based normalization factor:', geometryNormalizationFactor)
          }
        }

        // Get avatar bounds first for reference
        const avatarBounds = new THREE.Box3().setFromObject(avatarMesh)
        const avatarSize = avatarBounds.getSize(new THREE.Vector3())
        const avatarCenter = avatarBounds.getCenter(new THREE.Vector3())
        console.log('Avatar full bounds:', avatarBounds)
        console.log('Avatar height:', avatarSize.y)
        console.log('Avatar Y range:', avatarBounds.min.y, 'to', avatarBounds.max.y)
        console.log('Avatar center:', avatarCenter)

        // BONE-BASED APPROACH: Find torso bones to get exact torso position
        console.log('=== FINDING TORSO BONES ===')

        // Log character information
        if (avatarMesh.name) {
          console.log(`Character model: ${avatarMesh.name}`)
        }

        // Try to find torso-related bones
        const torsoKeywords = ['spine', 'torso', 'chest', 'abdomen', 'waist', 'hip', 'pelvis']
        const shoulderKeywords = ['shoulder', 'clavicle', 'upperarm']
        const neckKeywords = ['neck', 'head']

        // Get skeleton from avatar
        const skeleton = avatarMesh.skeleton
        if (!skeleton) {
          console.error('Avatar has no skeleton!')
          setIsProcessing(false)
          return
        }

        // Update transforms but DON'T call skeleton.update()
        avatarMesh.updateMatrix()
        avatarMesh.updateMatrixWorld(true)
        // skeleton.update() - REMOVED! This can reset bone scales
        skeleton.bones.forEach(bone => {
          bone.updateMatrixWorld(true)
        })
        console.log('Updated avatar transforms before bone position calculations')

        // First, log all bones to see what we have
        console.log('=== ALL BONES IN SKELETON ===')
        skeleton.bones.forEach((bone, index) => {
          const boneWorldPos = new THREE.Vector3()
          bone.getWorldPosition(boneWorldPos)
          console.log(`Bone ${index}: ${bone.name} at Y: ${boneWorldPos.y.toFixed(3)}`)
        })

        // Find torso-related bones
        const torsoBoneNames = ['spine', 'spine01', 'spine02', 'chest', 'torso', 'body', 'hips', 'pelvis', 'waist', 'abdomen', 'stomach']
        const torsoBones: THREE.Bone[] = []
        const upperTorsoBones: THREE.Bone[] = []
        const lowerTorsoBones: THREE.Bone[] = []

        skeleton.bones.forEach((bone, index) => {
          const boneName = bone.name.toLowerCase()

          // Skip end bones and non-torso bones
          if (boneName.includes('end') || boneName.includes('head') || boneName.includes('neck')) {
            return
          }

          // Check for torso-related bones
          if (torsoBoneNames.some(name => boneName.includes(name))) {
            torsoBones.push(bone)
            console.log(`Found torso bone: ${bone.name} at index ${index}`)

            // Get world position of bone
            const boneWorldPos = new THREE.Vector3()
            bone.getWorldPosition(boneWorldPos)
            console.log(`  World position: ${boneWorldPos.x.toFixed(3)}, ${boneWorldPos.y.toFixed(3)}, ${boneWorldPos.z.toFixed(3)}`)

            // Categorize bones
            if (boneName.includes('hips') || boneName.includes('pelvis') || boneName.includes('waist')) {
              lowerTorsoBones.push(bone)
              console.log('  -> Lower torso bone')
            } else if (boneName.includes('spine02') || boneName.includes('chest')) {
              upperTorsoBones.push(bone)
              console.log('  -> Upper torso bone')
            }
          }
        })

        // Initialize torso variables
        let torsoCenter: THREE.Vector3
        let torsoSize: THREE.Vector3
        let torsoBounds: THREE.Box3
        let torsoTop: number = 0
        let torsoBottom: number = 0

        if (torsoBones.length === 0) {
          console.warn('No torso bones found, falling back to proportional method')
          // Fallback: use middle 40% of avatar for torso
          torsoBottom = avatarBounds.min.y + avatarSize.y * 0.35  // 35% up from feet
          torsoTop = avatarBounds.min.y + avatarSize.y * 0.65     // 65% up from feet

          torsoCenter = new THREE.Vector3(
            avatarCenter.x,
            (torsoBottom + torsoTop) / 2,
            avatarCenter.z
          )
          torsoSize = new THREE.Vector3(
            avatarSize.x * 0.6,
            torsoTop - torsoBottom,
            avatarSize.z * 0.5
          )
          torsoBounds = new THREE.Box3()
          torsoBounds.setFromCenterAndSize(torsoCenter, torsoSize)
        } else {
          // Calculate torso bounds from bone positions
          const boneBounds = new THREE.Box3()

          // If we have both upper and lower torso bones, use them to define the torso
          if (upperTorsoBones.length > 0 && lowerTorsoBones.length > 0) {
            console.log('=== Using upper and lower torso bones ===')

            // Get bounds of upper torso bones
            upperTorsoBones.forEach(bone => {
              const boneWorldPos = new THREE.Vector3()
              bone.getWorldPosition(boneWorldPos)
              boneBounds.expandByPoint(boneWorldPos)
            })

            // Get bounds of lower torso bones
            lowerTorsoBones.forEach(bone => {
              const boneWorldPos = new THREE.Vector3()
              bone.getWorldPosition(boneWorldPos)
              boneBounds.expandByPoint(boneWorldPos)
            })
          } else {
            // Use all torso bones
            console.log('=== Using all torso bones ===')
            torsoBones.forEach(bone => {
              const boneWorldPos = new THREE.Vector3()
              bone.getWorldPosition(boneWorldPos)
              boneBounds.expandByPoint(boneWorldPos)
            })
          }

          const boneCenter = boneBounds.getCenter(new THREE.Vector3())
          const boneSize = boneBounds.getSize(new THREE.Vector3())

          console.log('=== BONE-BASED TORSO CALCULATION ===')
          console.log('Bone bounds center:', boneCenter)
          console.log('Bone bounds size:', boneSize)
          console.log('Bone Y range:', boneBounds.min.y, 'to', boneBounds.max.y)

          // If the bone bounds are too small vertically, expand them
          let torsoHeight = boneSize.y
          if (torsoHeight < 0.4) {
            console.log('Bone height too small, expanding to minimum 0.6')
            torsoHeight = 0.6
          }

          // Create torso bounds based on bone positions
          // The torso should extend from hips to chest
          if (lowerTorsoBones.length > 0 && upperTorsoBones.length > 0) {
            // We have both upper and lower bounds - use them to define full torso
            const lowestY = boneBounds.min.y  // Hips
            const highestY = boneBounds.max.y // Spine02/Chest

            // For armor fitting, we need proper torso bounds
            // Check if we have shoulder bones to limit the upper extent
            let shoulderY = highestY  // Start with chest height
            let neckY = highestY

            skeleton.bones.forEach(bone => {
              const boneName = bone.name.toLowerCase()
              if (boneName.includes('shoulder') || boneName.includes('clavicle')) {
                const bonePos = new THREE.Vector3()
                bone.getWorldPosition(bonePos)
                // Shoulders are HIGHER (less negative) than chest, so use Math.max
                shoulderY = Math.max(shoulderY, bonePos.y)
                console.log(`Found shoulder/clavicle bone: ${bone.name} at Y: ${bonePos.y.toFixed(3)}`)
              }
              if (boneName.includes('neck')) {
                const bonePos = new THREE.Vector3()
                bone.getWorldPosition(bonePos)
                neckY = bonePos.y
                console.log(`Found neck bone: ${bone.name} at Y: ${bonePos.y.toFixed(3)}`)
              }
            })

            // Torso should go from hips up to just below shoulders
            // If we found shoulders, use them as the upper limit
            const torsoTop = shoulderY > highestY ? shoulderY - 0.1 : highestY  // Stop 10cm below shoulders
            const torsoBottom = lowestY

            // Add small padding for comfort fit
            const paddedBottom = torsoBottom - 0.05  // 5cm below hips
            const paddedTop = torsoTop  // Top is already adjusted for shoulders

            torsoHeight = paddedTop - paddedBottom

            // Calculate torso size first (we need it for bounds calculation)
            torsoSize = new THREE.Vector3(
              Math.max(boneSize.x + 0.4, avatarSize.x * 0.6), // Add padding or use 60% of avatar width
              torsoHeight,
              Math.max(boneSize.z + 0.4, avatarSize.z * 0.5)  // Add padding or use 50% of avatar depth
            )

            // Ensure minimum torso height for proper armor fitting
            const minTorsoHeight = avatarSize.y * 0.3  // At least 30% of avatar height
            if (torsoHeight < minTorsoHeight) {
              console.log(`Torso height ${torsoHeight.toFixed(3)} too small, using minimum ${minTorsoHeight.toFixed(3)}`)
              torsoHeight = minTorsoHeight
              torsoSize.y = torsoHeight  // Update the height in torsoSize
              // Recenter based on new height
              torsoCenter = new THREE.Vector3(
                boneCenter.x,
                (paddedBottom + paddedTop) / 2,  // Keep original center method
                boneCenter.z
              )
            } else {
              torsoCenter = new THREE.Vector3(
                boneCenter.x,
                (paddedBottom + paddedTop) / 2,
                boneCenter.z
              )
            }

            console.log('Full torso calculation:')
            console.log('  Hips Y:', lowestY.toFixed(3))
            console.log('  Chest Y:', highestY.toFixed(3))
            console.log('  Shoulder Y:', shoulderY.toFixed(3))
            console.log('  Using torso top:', torsoTop.toFixed(3))
            console.log('  Neck Y:', neckY.toFixed(3))
            console.log('  Torso bottom:', paddedBottom.toFixed(3))
            console.log('  Torso top:', paddedTop.toFixed(3))
            console.log('  Torso height:', torsoHeight.toFixed(3))
            console.log('  Torso center Y:', torsoCenter.y.toFixed(3))
          } else if (upperTorsoBones.length > 0 && lowerTorsoBones.length === 0) {
            // If we only found upper torso bones, extend downward
            console.log('Only upper torso bones found, extending torso downward')
            const currentTop = boneBounds.max.y
            const extendedBottom = currentTop - torsoHeight
            torsoCenter = new THREE.Vector3(
              boneCenter.x,
              (currentTop + extendedBottom) / 2,
              boneCenter.z
            )
            // Define torsoSize for this branch
            torsoSize = new THREE.Vector3(
              Math.max(boneSize.x + 0.4, avatarSize.x * 0.6),
              torsoHeight,
              Math.max(boneSize.z + 0.4, avatarSize.z * 0.5)
            )
          } else {
            // Use all bones as-is
            torsoCenter = boneCenter.clone()
            // Define torsoSize for this branch  
            torsoSize = new THREE.Vector3(
              Math.max(boneSize.x + 0.4, avatarSize.x * 0.6),
              torsoHeight,
              Math.max(boneSize.z + 0.4, avatarSize.z * 0.5)
            )
          }

          // Ensure minimum torso dimensions for proper armor fitting
          const minTorsoWidth = 0.8  // Minimum 80cm width
          const minTorsoDepth = 0.6  // Minimum 60cm depth

          if (torsoSize.x < minTorsoWidth) {
            console.log(`Torso width ${torsoSize.x.toFixed(3)} too small, using minimum ${minTorsoWidth}`)
            torsoSize.x = minTorsoWidth
          }
          if (torsoSize.z < minTorsoDepth) {
            console.log(`Torso depth ${torsoSize.z.toFixed(3)} too small, using minimum ${minTorsoDepth}`)
            torsoSize.z = minTorsoDepth
          }

          torsoBounds = new THREE.Box3()
          torsoBounds.setFromCenterAndSize(torsoCenter, torsoSize)
        }

        console.log('Torso center from bones:', torsoCenter)
        console.log('Torso size:', torsoSize)
        console.log('Torso bounds:', torsoBounds)
        console.log('Torso actual Y range:', torsoBounds.min.y.toFixed(3), 'to', torsoBounds.max.y.toFixed(3))

        const torsoYPercent = (torsoCenter.y - avatarBounds.min.y) / avatarSize.y
        console.log('Torso Y percentage (0=bottom, 1=top):', torsoYPercent.toFixed(3))

        // Variables for anatomy detection (needed in multiple blocks)
        let headY: number | null = null
        let shoulderY: number | null = null
        let chestY: number | null = null
        let isHunchedCharacter = false

        // ALTERNATIVE: Use simple proportional calculation (uncomment to use)
        const USE_SIMPLE_PROPORTIONS = true  // Use simple proportions for more reliable torso detection
        if (USE_SIMPLE_PROPORTIONS) {
          console.log('=== USING SIMPLE PROPORTIONAL TORSO ===')

          // First, detect character anatomy type
          let neckY: number | null = null

          if (skeleton) {
            skeleton.bones.forEach(bone => {
              const boneName = bone.name.toLowerCase()
              const bonePos = new THREE.Vector3()
              bone.getWorldPosition(bonePos)

              if (boneName.includes('head') && !boneName.includes('end')) {
                if (headY === null || bonePos.y > headY) {
                  headY = bonePos.y
                }
              }
              if (boneName.includes('shoulder') || boneName.includes('clavicle')) {
                if (shoulderY === null || bonePos.y > shoulderY) {
                  shoulderY = bonePos.y
                }
              }
              if (boneName.includes('spine02') || boneName.includes('chest')) {
                chestY = bonePos.y
              }
              if (boneName.includes('neck')) {
                neckY = bonePos.y
              }
            })
          }

          // Detect if character has non-standard anatomy
          if (headY !== null && shoulderY !== null) {
            const headShoulderDiff = Math.abs(headY - shoulderY)
            isHunchedCharacter = headShoulderDiff < 0.1 // Less than 10cm difference
            console.log(`Head Y: ${(headY as number).toFixed(3)}, Shoulder Y: ${(shoulderY as number).toFixed(3)}, Difference: ${headShoulderDiff.toFixed(3)}`)
            if (isHunchedCharacter) {
              console.log('⚠️ Detected hunched character anatomy - using chest-based positioning')
            }
          }

          // Now torsoTop and torsoBottom are already declared above

          if (isHunchedCharacter && chestY !== null) {
            // For hunched characters, use chest as reference
            torsoTop = chestY + 0.05 // Slightly above chest
            torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15 // 15% up from feet
            console.log('Using chest-based torso for hunched character: bottom', torsoBottom.toFixed(3), 'top', torsoTop.toFixed(3))
          } else if (shoulderY !== null && !isHunchedCharacter) {
            // For normal characters, use shoulder alignment
            const shoulderYValue = shoulderY as number
            console.log('Found shoulder at Y:', shoulderYValue.toFixed(3))
            torsoTop = shoulderYValue
            torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15  // 15% up from feet (was 20%)
            console.log('Using shoulder-based torso: bottom', torsoBottom.toFixed(3), 'top', torsoTop.toFixed(3))
          } else {
            // Fallback to proportional method
            torsoBottom = avatarBounds.min.y + avatarSize.y * 0.15  // 15% up from feet (was 20%)
            torsoTop = avatarBounds.min.y + avatarSize.y * 0.6     // 60% up from feet
            console.log('Using proportional torso fallback')
          }

          torsoCenter = new THREE.Vector3(
            avatarCenter.x,
            (torsoBottom + torsoTop) / 2,
            avatarCenter.z
          )
          torsoSize = new THREE.Vector3(
            avatarSize.x * 0.6,   // 60% of avatar width
            torsoTop - torsoBottom, // Height from bottom to shoulders
            avatarSize.z * 0.5    // 50% of avatar depth
          )
          torsoBounds.setFromCenterAndSize(torsoCenter, torsoSize)

          console.log('Simple torso Y range:', torsoBounds.min.y.toFixed(3), 'to', torsoBounds.max.y.toFixed(3))
          console.log('Simple torso center:', torsoCenter)
          console.log('Simple torso size:', torsoSize)
        } // End of USE_SIMPLE_PROPORTIONS

        // OPTION: Use simple direct positioning (comment out to use complex approach)
        const USE_SIMPLE_POSITIONING = true

        if (USE_SIMPLE_POSITIONING) {
          console.log('=== USING SIMPLE DIRECT POSITIONING ===')

          // Get armor bounds in world space (AFTER scale normalization)
          const armorBounds = new THREE.Box3().setFromObject(armorMesh)
          const armorSize = armorBounds.getSize(new THREE.Vector3())
          const armorCenter = armorBounds.getCenter(new THREE.Vector3())

          console.log('Initial armor center (after normalization):', armorCenter)
          console.log('Initial armor size (after normalization):', armorSize)
          console.log('Target torso center:', torsoCenter)
          console.log('Target torso size:', torsoSize)

          // Calculate scale to make armor fit properly over torso
          // Based on report, armor should be: 1.16x width, 1.27x height, 2.54x depth
          // But we'll use a more conservative height to ensure shoulders align
          const targetScale = Math.min(
            torsoSize.x * 1.16 / armorSize.x,    // 16% larger width (report: 1.16x)
            torsoSize.y * 1.0 / armorSize.y,     // Same height as torso to align shoulders
            torsoSize.z * 2.54 / armorSize.z     // 154% larger depth (report: 2.54x)
          )

          // Apply minimum scale constraint to prevent tiny armor
          const minScale = 0.5  // Minimum 50% of original size
          const finalScale = Math.max(targetScale, minScale)

          console.log('Target scale factor:', targetScale.toFixed(3))
          console.log('Min scale constraint:', minScale)
          console.log('Final scale to use:', finalScale.toFixed(3))

          if (targetScale < minScale) {
            console.warn(`Scale ${targetScale.toFixed(3)} was too small, using minimum ${minScale}`)
          }

          // Get character-specific adjustments
          const getCharacterProfile = (avatarName: string) => {
            const name = avatarName.toLowerCase()
            if (name.includes('goblin') || name.includes('imp')) {
              return {
                scaleBoost: 0.7,      // Make armor smaller for tiny characters
                iterations: 3,         // Less aggressive fitting
                stepSize: 0.05,       // Gentler movements
                targetOffset: 0.02,   // Smaller offset
                preserveStructure: true
              }
            } else if (name.includes('troll')) {
              return {
                scaleBoost: 1.1,      // Slightly larger
                iterations: 5,
                stepSize: 0.1,
                targetOffset: 0.08,   // Larger offset
                preserveStructure: false
              }
            }
            return {
              scaleBoost: 1.0,
              iterations: fittingParameters.iterations,
              stepSize: fittingParameters.stepSize,
              targetOffset: fittingParameters.targetOffset,
              preserveStructure: false
            }
          }

          const characterProfile = getCharacterProfile(avatarMesh.name || selectedAvatar?.name || 'thug')

          // IMPROVED: Volume-based scaling for better fit
          const armorVolume = armorSize.x * armorSize.y * armorSize.z
          const torsoVolume = torsoSize.x * torsoSize.y * torsoSize.z
          const volumeRatio = Math.pow(torsoVolume / armorVolume, 1 / 3)
          const armorHeightRatio = torsoSize.y / armorSize.y

          // Blend volume and height ratios for better scaling
          const improvedTargetScale = ((volumeRatio * 0.7) + (armorHeightRatio * 0.3)) * characterProfile.scaleBoost
          const improvedFinalScale = Math.max(improvedTargetScale, minScale)

          console.log('Volume-based scale:', volumeRatio.toFixed(3))
          console.log('Height-based scale:', armorHeightRatio.toFixed(3))
          console.log('Character scale boost:', characterProfile.scaleBoost)
          console.log('Improved final scale:', improvedFinalScale.toFixed(3))

          // CRITICAL: Ensure we're starting with original geometry
          // If the armor has been fitted before, restore original geometry first
          if (originalArmorGeometryRef.current && armorMesh.userData.hasBeenFitted) {
            console.log('Restoring original geometry before scaling')
            armorMesh.geometry.dispose()
            armorMesh.geometry = originalArmorGeometryRef.current.clone()
            armorMesh.geometry.computeVertexNormals()
          }

          // Apply scale first
          armorMesh.scale.multiplyScalar(improvedFinalScale)
          armorMesh.updateMatrixWorld(true)

          // Get new bounds after scaling
          const scaledBounds = new THREE.Box3().setFromObject(armorMesh)
          const scaledCenter = scaledBounds.getCenter(new THREE.Vector3())

          console.log('Scaled armor center:', scaledCenter)

          // === SMART CENTER-BASED POSITIONING ===
          // Center armor on torso center - this is more robust than top-alignment
          const targetArmorCenter = torsoCenter.clone()

          // CRITICAL FIX: The armor geometry is not centered at origin!
          // When we move the mesh, the bounds center moves differently than the mesh position
          // We need to account for this geometry offset

          // First, get the current mesh position and bounds center
          const currentMeshPos = armorMesh.position.clone()
          const currentBoundsCenter = scaledCenter.clone()

          // Calculate the geometry's center offset from the mesh origin
          const geometryOffset = currentBoundsCenter.clone().sub(currentMeshPos)
          console.log('Armor geometry offset from origin:', geometryOffset)

          // To position the BOUNDS CENTER at the target, we need:
          // targetCenter = meshPosition + geometryOffset
          // Therefore: meshPosition = targetCenter - geometryOffset
          const targetMeshPosition = targetArmorCenter.clone().sub(geometryOffset)

          // Calculate the offset from current position to target position
          const centerOffset = targetMeshPosition.clone().sub(currentMeshPos)

          // Smart adjustments based on armor/torso size relationship
          const scaledArmorHeight = scaledBounds.max.y - scaledBounds.min.y
          const armorCenterY = scaledCenter.y + centerOffset.y
          const armorTopY = armorCenterY + scaledArmorHeight / 2
          const armorBottomY = armorCenterY - scaledArmorHeight / 2

          // Check if armor would extend beyond torso bounds
          let verticalAdjustment = 0
          if (armorTopY > torsoTop + 0.1) { // Allow slight extension above
            // Armor too tall for torso - shift down
            const overhang = armorTopY - (torsoTop + 0.1)
            verticalAdjustment = -overhang
            console.log('Armor would extend above torso by', overhang.toFixed(3), '- adjusting down')
          } else if (armorBottomY < torsoBottom - 0.05) { // Allow slight extension below
            // Armor positioned too low - shift up
            const underhang = (torsoBottom - 0.05) - armorBottomY
            verticalAdjustment = underhang
            console.log('Armor would extend below torso by', underhang.toFixed(3), '- adjusting up')
          }

          // Apply vertical adjustment to center offset
          centerOffset.y += verticalAdjustment

          const offset = centerOffset

          console.log('Position offset:', offset)
          console.log('Target mesh position:', targetMeshPosition)
          console.log('This should center bounds at torso Y:', targetArmorCenter.y.toFixed(3))

          // Apply position offset
          armorMesh.position.add(offset)
          armorMesh.updateMatrixWorld(true)

          // Check if vertical adjustment is needed
          const currentBounds = new THREE.Box3().setFromObject(armorMesh)
          const currentCenter = currentBounds.getCenter(new THREE.Vector3())
          const yError = Math.abs(currentCenter.y - torsoCenter.y)

          // No longer apply the fixed offset since we're aligning shoulders properly
          // const VERTICAL_OFFSET_CORRECTION = 0.00854  // 8.54mm upward adjustment
          // armorMesh.position.y += VERTICAL_OFFSET_CORRECTION
          // armorMesh.updateMatrixWorld(true)
          // console.log('Applied vertical offset correction from report:', VERTICAL_OFFSET_CORRECTION)

          // Debug: Check position after offset
          const afterOffsetBounds = new THREE.Box3().setFromObject(armorMesh)
          const afterOffsetCenter = afterOffsetBounds.getCenter(new THREE.Vector3())
          console.log('Armor center after positioning:', afterOffsetCenter)
          console.log('Target torso center:', torsoCenter)
          console.log('Center Y error:', (afterOffsetCenter.y - torsoCenter.y).toFixed(4))

          // Verify the fix worked
          if (Math.abs(afterOffsetCenter.y - torsoCenter.y) < 0.01) {
            console.log('✅ Armor correctly centered at torso!')
          } else {
            console.warn('⚠️ Armor center Y error:', afterOffsetCenter.y - torsoCenter.y)
          }

          // Verify final position
          const finalBounds = new THREE.Box3().setFromObject(armorMesh)
          const finalCenter = finalBounds.getCenter(new THREE.Vector3())
          const finalSize = finalBounds.getSize(new THREE.Vector3())

          console.log('=== SIMPLE POSITIONING COMPLETE ===')
          console.log('Final armor center:', finalCenter)
          console.log('Final armor size:', finalSize)
          console.log('Distance from torso center:', finalCenter.distanceTo(torsoCenter))
          console.log('Y difference:', Math.abs(finalCenter.y - torsoCenter.y))

          // Check if armor extends past torso bounds
          console.log('=== BOUNDS CHECK ===')
          console.log('Torso Y range:', torsoBounds.min.y.toFixed(3), 'to', torsoBounds.max.y.toFixed(3))
          console.log('Armor Y range:', finalBounds.min.y.toFixed(3), 'to', finalBounds.max.y.toFixed(3))

          // Validate against report expectations
          const heightRatio = finalSize.y / torsoSize.y
          const widthRatio = finalSize.x / torsoSize.x
          const depthRatio = finalSize.z / torsoSize.z

          console.log('=== DIMENSION RATIOS (Armor/Torso) ===')
          console.log('Height ratio:', heightRatio.toFixed(2) + 'x (expected: ~1.0x for shoulder alignment)')
          console.log('Width ratio:', widthRatio.toFixed(2) + 'x (expected: ~1.16x)')
          console.log('Depth ratio:', depthRatio.toFixed(2) + 'x (expected: ~2.54x)')

          if (finalBounds.max.y > torsoBounds.max.y) {
            console.warn(`⚠️ Armor extends ${(finalBounds.max.y - torsoBounds.max.y).toFixed(3)} above torso (past shoulders)!`)
          } else {
            console.log('✅ Armor top is within torso bounds (below shoulders)')
          }

          if (finalBounds.min.y < torsoBounds.min.y) {
            console.warn(`⚠️ Armor extends ${(torsoBounds.min.y - finalBounds.min.y).toFixed(3)} below torso!`)
          } else {
            console.log('✅ Armor bottom is within torso bounds')
          }

          // ========================================
          // STEP 2: ITERATIVE SHRINKWRAPPING
          // ========================================
          console.log('\n=== STEP 2: ITERATIVE SHRINKWRAPPING ===')
          console.log('Armor is now properly scaled and positioned.')
          console.log('Starting shrinkwrap to conform armor to body shape...')

          // Store the properly scaled/positioned armor state
          const scaledArmorGeometry = armorMesh.geometry.clone()
          armorMesh.userData.scaledGeometry = scaledArmorGeometry

          // Apply the iterative mesh fitting algorithm
          try {
            // Use the fitting parameters from the UI
            const shrinkwrapParams = {
              ...fittingParameters,
              // Use character-specific overrides
              iterations: Math.min(characterProfile.iterations || fittingParameters.iterations, 10),  // Cap at 10 for performance
              stepSize: characterProfile.stepSize || fittingParameters.stepSize,
              targetOffset: characterProfile.targetOffset || 0.01, // Much smaller offset for shrinkwrap
              sampleRate: 1.0,  // Full sampling for accuracy
              smoothingStrength: characterProfile.preserveStructure ? 0.5 : 0.2,  // More smoothing for structure preservation
              useImprovedShrinkwrap: false  // Keep it simple for now
            }

            console.log('Shrinkwrap parameters:', shrinkwrapParams)

            // Perform the shrinkwrap
            fittingService.current.fitMeshToTarget(armorMesh, avatarMesh, shrinkwrapParams)

            console.log('✅ Shrinkwrapping complete!')

            // Mark armor as fitted to detect if reset is needed
            armorMesh.userData.hasBeenFitted = true

            // Ensure armor is visible and properly updated
            armorMesh.visible = true
            armorMesh.updateMatrix()
            armorMesh.updateMatrixWorld(true)

            // Force scene update
            if (sceneRef.current) {
              sceneRef.current.updateMatrixWorld(true)
            }

            // Get final armor state
            const shrinkwrappedBounds = new THREE.Box3().setFromObject(armorMesh)
            const shrinkwrappedSize = shrinkwrappedBounds.getSize(new THREE.Vector3())
            const shrinkwrappedCenter = shrinkwrappedBounds.getCenter(new THREE.Vector3())

            // Check if armor has collapsed
            if (shrinkwrappedSize.x < 0.01 || shrinkwrappedSize.y < 0.01 || shrinkwrappedSize.z < 0.01) {
              console.error('⚠️ ARMOR HAS COLLAPSED!', shrinkwrappedSize)
              console.error('Armor scale:', armorMesh.scale.clone())
              console.error('Armor position:', armorMesh.position.clone())
              console.error('Armor bounds min:', shrinkwrappedBounds.min)
              console.error('Armor bounds max:', shrinkwrappedBounds.max)
            }

            console.log('=== FINAL ARMOR STATE ===')
            console.log('Armor visible:', armorMesh.visible)
            console.log('Armor position:', armorMesh.position.clone())
            console.log('Armor scale:', armorMesh.scale.clone())
            console.log('Final center:', shrinkwrappedCenter)
            console.log('Final size:', shrinkwrappedSize)
            console.log('Armor parent:', armorMesh.parent?.name || 'No parent')
            console.log('Armor world matrix:', armorMesh.matrixWorld.elements.slice(12, 15))
            console.log('Size change from scaling:', {
              x: ((shrinkwrappedSize.x - finalSize.x) / finalSize.x * 100).toFixed(1) + '%',
              y: ((shrinkwrappedSize.y - finalSize.y) / finalSize.y * 100).toFixed(1) + '%',
              z: ((shrinkwrappedSize.z - finalSize.z) / finalSize.z * 100).toFixed(1) + '%'
            })
          } catch (error) {
            console.error('Error during shrinkwrapping:', error)
            // Restore the scaled geometry if shrinkwrap fails
            if (armorMesh.userData.scaledGeometry) {
              armorMesh.geometry = armorMesh.userData.scaledGeometry
              armorMesh.geometry.computeVertexNormals()
            }
          }

          // Ensure armor is visible after all operations
          armorMesh.visible = true
          if (armorMesh.material instanceof THREE.Material) {
            armorMesh.material.opacity = 1.0
            armorMesh.material.transparent = false
          }

          // Mark armor as successfully fitted
          setIsArmorFitted(true)
          setIsArmorBound(false) // Reset bound state since we just fitted new geometry

          // Ensure meshes are properly attached to their original parents
          if (avatarParent && !avatarMesh.parent) {
            avatarParent.add(avatarMesh)
          }
          if (armorParent && !armorMesh.parent) {
            armorParent.add(armorMesh)
          }

          setTimeout(() => setIsProcessing(false), 100)
          return
        }

        // Visualize torso box if debug enabled
        if (showHull && sceneRef.current) {
          // Create torso box wireframe
          const torsoBoxGeometry = new THREE.BoxGeometry(torsoSize.x, torsoSize.y, torsoSize.z)
          const torsoBoxMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.8
          })
          const torsoBoxMesh = new THREE.Mesh(torsoBoxGeometry, torsoBoxMaterial)
          torsoBoxMesh.position.copy(torsoCenter)
          torsoBoxMesh.name = 'TorsoDebugBox'

          // Create center sphere to mark exact torso center
          const centerSphereGeometry = new THREE.SphereGeometry(0.05, 16, 16)
          const centerSphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00  // Yellow
          })
          const centerSphereMesh = new THREE.Mesh(centerSphereGeometry, centerSphereMaterial)
          centerSphereMesh.position.copy(torsoCenter)
          centerSphereMesh.name = 'TorsoCenterSphere'

          // Create bone position markers
          const boneSphereGeometry = new THREE.SphereGeometry(0.03, 8, 8)
          const boneSphereGroup = new THREE.Group()
          boneSphereGroup.name = 'BoneMarkers'

          torsoBones.forEach((bone, index) => {
            const boneWorldPos = new THREE.Vector3()
            bone.getWorldPosition(boneWorldPos)

            const boneSphere = new THREE.Mesh(
              boneSphereGeometry,
              new THREE.MeshBasicMaterial({ color: 0x00ffff }) // Cyan for bones
            )
            boneSphere.position.copy(boneWorldPos)
            boneSphereGroup.add(boneSphere)
          })

          // Add horizontal plane at torso top to visualize shoulder limit
          const topPlaneGeometry = new THREE.PlaneGeometry(torsoSize.x * 1.5, torsoSize.z * 1.5)
          const topPlaneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide
          })
          const topPlaneMesh = new THREE.Mesh(topPlaneGeometry, topPlaneMaterial)
          topPlaneMesh.position.set(torsoCenter.x, torsoBounds.max.y, torsoCenter.z)
          topPlaneMesh.rotation.x = Math.PI / 2  // Make it horizontal
          topPlaneMesh.name = 'TorsoTopPlane'

          // Remove any existing debug objects
          const existingBox = sceneRef.current.getObjectByName('TorsoDebugBox')
          const existingSphere = sceneRef.current.getObjectByName('TorsoCenterSphere')
          const existingBoneMarkers = sceneRef.current.getObjectByName('BoneMarkers')
          const existingTopPlane = sceneRef.current.getObjectByName('TorsoTopPlane')
          if (existingBox) sceneRef.current.remove(existingBox)
          if (existingSphere) sceneRef.current.remove(existingSphere)
          if (existingBoneMarkers) sceneRef.current.remove(existingBoneMarkers)
          if (existingTopPlane) sceneRef.current.remove(existingTopPlane)

          // Add new debug objects
          sceneRef.current.add(torsoBoxMesh)
          sceneRef.current.add(centerSphereMesh)
          sceneRef.current.add(boneSphereGroup)
          sceneRef.current.add(topPlaneMesh)

          console.log('Debug visualization: Red box = torso, Yellow = center, Cyan = bone positions, Green plane = torso top')
        }
      } else {
        console.error('Could not find avatar or armor mesh')
      }

      setTimeout(() => setIsProcessing(false), 100)
      return
    }

    // Original cube/sphere fitting code
    // Find source and target meshes based on direction
    let sourceMesh: THREE.Mesh | undefined
    let targetMesh: THREE.Mesh | undefined

    sceneRef.current.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.geometry) {
        if (direction === 'cubeToSphere') {
          // For cube to sphere: source is cube, target is sphere
          if (obj.userData.isSource && obj.geometry instanceof THREE.BoxGeometry) {
            sourceMesh = obj
          } else if (obj.userData.isTarget && obj.geometry instanceof THREE.SphereGeometry) {
            targetMesh = obj
          }
        } else {
          // For sphere to cube: source is sphere, target is cube  
          if (obj.userData.isSource && obj.geometry instanceof THREE.SphereGeometry) {
            sourceMesh = obj
          } else if (obj.userData.isTarget && obj.geometry instanceof THREE.BoxGeometry) {
            targetMesh = obj
          }
        }
      }
    })

    if (sourceMesh && targetMesh) {
      // Store parent to restore later
      const sourceParent = sourceMesh.parent
      const targetParent = targetMesh.parent

      // Get world positions before detaching
      const sourceWorldPos = new THREE.Vector3()
      const targetWorldPos = new THREE.Vector3()
      sourceMesh.getWorldPosition(sourceWorldPos)
      targetMesh.getWorldPosition(targetWorldPos)

      // Temporarily add meshes directly to scene for proper world transforms
      sceneRef.current.add(sourceMesh)
      sceneRef.current.add(targetMesh)

      // Apply world positions
      sourceMesh.position.copy(sourceWorldPos)
      targetMesh.position.copy(targetWorldPos)

      // Update matrices
      sourceMesh.updateMatrixWorld(true)
      targetMesh.updateMatrixWorld(true)

      console.log('Starting fitting:', direction)
      console.log('Source mesh position:', sourceMesh.position)
      console.log('Target mesh position:', targetMesh.position)

      // Log initial bounds
      const sourceBounds = new THREE.Box3().setFromObject(sourceMesh)
      const targetBounds = new THREE.Box3().setFromObject(targetMesh)
      console.log('Source bounds:', sourceBounds.min, sourceBounds.max)
      console.log('Target bounds:', targetBounds.min, targetBounds.max)

      // Automatically enable feature preservation for sphere-to-cube
      const fittingParams = { ...fittingParameters }
      if (direction === 'sphereToCube') {
        fittingParams.preserveFeatures = true
        fittingParams.useImprovedShrinkwrap = true // Ensure improved algorithm is used
        console.log('Automatically enabling feature preservation and improved shrinkwrap for sphere-to-cube fitting')
      }

      // Perform the fitting
      // For sphere-to-cube with improved shrinkwrap, consider using uniform pressure
      if (direction === 'sphereToCube' && fittingParams.useImprovedShrinkwrap) {
        // You can switch between methods here if needed
        fittingService.current.fitMeshToTarget(sourceMesh, targetMesh, fittingParams)
      } else {
        fittingService.current.fitMeshToTarget(sourceMesh, targetMesh, fittingParams)
      }

      // Restore original parents and local positions
      if (sourceParent && targetParent) {
        // Calculate local positions
        const sourceLocalPos = sourceParent.worldToLocal(sourceMesh.position.clone())
        const targetLocalPos = targetParent.worldToLocal(targetMesh.position.clone())

        sourceParent.add(sourceMesh)
        targetParent.add(targetMesh)

        sourceMesh.position.copy(sourceLocalPos)
        targetMesh.position.copy(targetLocalPos)
      }
    } else {
      console.error('Could not find source or target mesh for direction:', direction)
    }

    setTimeout(() => setIsProcessing(false), 100)
  }

  const bindArmorToSkeleton = () => {
    if (!sceneRef.current || !avatarMeshRef.current || !armorMeshRef.current) {
      console.error('Scene, avatar, or armor not available for binding')
      return
    }

    console.log('=== BINDING ARMOR TO SKELETON ===')
    setIsProcessing(true)

    try {
      // Store the current armor mesh reference
      const currentArmorMesh = armorMeshRef.current
      console.log('Current armor mesh:', currentArmorMesh.name, 'Parent:', currentArmorMesh.parent?.name)

      // Get parents
      const armorParent = currentArmorMesh.parent
      const avatarParent = avatarMeshRef.current.parent

      // Store the current world transform of the fitted armor
      currentArmorMesh.updateMatrixWorld(true)
      const perfectWorldPosition = currentArmorMesh.getWorldPosition(new THREE.Vector3())

      const perfectWorldQuaternion = currentArmorMesh.getWorldQuaternion(new THREE.Quaternion())
      const perfectWorldScale = currentArmorMesh.getWorldScale(new THREE.Vector3())

      console.log('=== FITTED ARMOR WORLD TRANSFORM ===')
      console.log('World position:', perfectWorldPosition)
      console.log('World rotation:', perfectWorldQuaternion)
      console.log('World scale:', perfectWorldScale)
      console.log('Local position:', currentArmorMesh.position.clone())
      console.log('Local scale:', currentArmorMesh.scale.clone())

      // Ensure armor's world matrix is up to date before binding
      currentArmorMesh.updateMatrixWorld(true)

      // Debug: Check avatar's parent
      console.log('Avatar parent:', avatarMeshRef.current.parent)
      console.log('Avatar parent name:', avatarMeshRef.current.parent?.name)
      console.log('Avatar parent type:', avatarMeshRef.current.parent?.type)

      // Create the skinned mesh with transform baked into geometry
      const skinnedArmor = armorFittingService.current.bindArmorToSkeleton(
        currentArmorMesh,
        avatarMeshRef.current,
        {
          searchRadius: 0.3, // Search radius in avatar local space
          applyGeometryTransform: true // Bake transform for cleaner result
        }
      )

      console.log('Skinned armor created:')
      console.log('- Initial position:', skinnedArmor.position.clone())
      console.log('- Initial scale:', skinnedArmor.scale.clone())
      console.log('- Bind matrix:', skinnedArmor.bindMatrix)
      console.log('- Bind matrix inverse:', skinnedArmor.bindMatrixInverse)

      // Copy material settings
      if (skinnedArmor.material && currentArmorMesh.material) {
        const skinnedMat = skinnedArmor.material as THREE.MeshStandardMaterial
        const currentMat = currentArmorMesh.material as THREE.MeshStandardMaterial
        skinnedMat.wireframe = currentMat.wireframe
        skinnedMat.transparent = currentMat.transparent
        skinnedMat.opacity = currentMat.opacity
      }

      // Remove old mesh first
      if (armorParent) {
        armorParent.remove(currentArmorMesh)
      } else {
        sceneRef.current.remove(currentArmorMesh)
      }

      // The skinned armor needs to be added to the Armature for proper skinning
      const armature = avatarMeshRef.current.parent

      if (armature && (armature.name === 'Armature' || armature.name.toLowerCase().includes('armature'))) {
        console.log('Adding skinned armor to Armature')

        // Since we've baked the transform into geometry, the skinned mesh
        // should have zero transform and can be added directly to the armature
        armature.add(skinnedArmor)

        console.log('Added skinned armor with baked geometry transform')
        console.log('- Position:', skinnedArmor.position)
        console.log('- Scale:', skinnedArmor.scale)

        // Verify world position after adding to armature
        skinnedArmor.updateMatrixWorld(true)
        const finalWorldPos = skinnedArmor.getWorldPosition(new THREE.Vector3())
        const finalWorldScale = skinnedArmor.getWorldScale(new THREE.Vector3())

        console.log('Final verification:')
        console.log('- World position:', finalWorldPos)
        console.log('- World scale:', finalWorldScale)
        console.log('- Original fitted position:', perfectWorldPosition)

        // Since we baked the transform, the armor should still be at the fitted position
        const positionDrift = finalWorldPos.distanceTo(perfectWorldPosition)
        console.log('- Position drift from fitted:', positionDrift)

        if (positionDrift > 0.01) {
          console.warn('⚠️ Skinned armor position drifted from fitted position!')
          console.warn('Expected:', perfectWorldPosition)
          console.warn('Actual:', finalWorldPos)
        }
      } else {
        console.log('No Armature found, adding to scene')
        sceneRef.current.add(skinnedArmor)
      }

      skinnedArmor.updateMatrixWorld(true)

      console.log('Added skinned armor with transform:')
      console.log('- Local position:', skinnedArmor.position)
      console.log('- Local scale:', skinnedArmor.scale)
      console.log('- World position:', skinnedArmor.getWorldPosition(new THREE.Vector3()))



      // Update world matrix after attachment
      skinnedArmor.updateMatrixWorld(true)

      // Verify the skinned armor is in the correct position
      const finalWorldPos = skinnedArmor.getWorldPosition(new THREE.Vector3())
      const finalWorldScale = skinnedArmor.getWorldScale(new THREE.Vector3())

      console.log('=== FINAL ARMOR POSITION ===')
      console.log('Original fitted position:', perfectWorldPosition)
      console.log('Final skinned position:', finalWorldPos)
      console.log('Position difference:', finalWorldPos.distanceTo(perfectWorldPosition))
      console.log('Final world scale:', finalWorldScale)

      // The position should match the original fitted position
      if (finalWorldPos.distanceTo(perfectWorldPosition) > 0.01) {
        console.warn('WARNING: Skinned armor position differs from fitted position!')
        console.warn('Expected:', perfectWorldPosition)
        console.warn('Actual:', finalWorldPos)
        console.warn('Difference:', finalWorldPos.distanceTo(perfectWorldPosition))
      } else {
        console.log('✅ Skinned armor is at the correct fitted position!')
      }

      // Check for extreme scales (similar to helmet)
      const armatureScale = skinnedArmor.parent?.getWorldScale(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1)
      if (armatureScale.x < 0.1) {
        console.log('Armature has extreme scale - may need visibility workaround')
        console.log('Armature world scale:', armatureScale)
        console.log('Skinned armor local scale:', skinnedArmor.scale)

        // For now, ensure frustum culling is disabled
        skinnedArmor.frustumCulled = false
        skinnedArmor.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.frustumCulled = false
          }
        })
      }

      console.log('Replaced armor mesh with skinned version')
      console.log('Skinned armor local position:', skinnedArmor.position)
      console.log('Skinned armor local scale:', skinnedArmor.scale)

      // Update world matrix for the new mesh
      skinnedArmor.updateMatrix()
      skinnedArmor.updateMatrixWorld(true)

      // Update references
      setSkinnedArmorMesh(skinnedArmor)
      armorMeshRef.current = skinnedArmor as ExtendedMesh

      // Also update the armor mesh in the scene to ensure it's the only armor
      let armorCount = 0
      sceneRef.current.traverse((obj) => {
        if (obj.userData.isArmor && obj instanceof THREE.Mesh) {
          armorCount++
          if (obj !== skinnedArmor) {
            console.warn('Found extra armor mesh, removing:', obj.name)
            if (obj.parent) obj.parent.remove(obj)
          }
        }
      })
      console.log('Total armor meshes in scene after binding:', armorCount)

      // Update state
      setIsArmorBound(true)

      console.log('✅ Armor successfully bound to skeleton!')
      console.log('Skinned armor position:', skinnedArmor.position)
      console.log('Skinned armor scale:', skinnedArmor.scale)

      // Force scene update
      sceneRef.current.updateMatrixWorld(true)

    } catch (error) {
      console.error('Failed to bind armor to skeleton:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const performHelmetFitting = async () => {
    if (!avatarMeshRef.current || !helmetMeshRef.current) {
      console.error('Avatar or helmet mesh not loaded')
      return
    }

    console.log('=== STARTING HELMET FITTING ===')
    console.log('Avatar mesh:', avatarMeshRef.current)
    console.log('Helmet mesh:', helmetMeshRef.current)

    // Log all bones in the avatar
    const bones: Array<{ name: string, depth: number, path: string }> = []
    const getBonePath = (bone: THREE.Object3D): string => {
      const path: string[] = []
      let current: THREE.Object3D | null = bone
      while (current) {
        path.unshift(current.name || 'unnamed')
        current = current.parent
      }
      return path.join(' > ')
    }

    const collectBones = (obj: THREE.Object3D, depth: number = 0) => {
      if (obj instanceof THREE.Bone) {
        bones.push({
          name: obj.name,
          depth,
          path: getBonePath(obj)
        })
      }
      obj.children.forEach(child => collectBones(child, depth + 1))
    }

    // First check if it's a SkinnedMesh with skeleton
    if (avatarMeshRef.current instanceof THREE.SkinnedMesh && avatarMeshRef.current.skeleton) {
      console.log('Found SkinnedMesh with skeleton containing', avatarMeshRef.current.skeleton.bones.length, 'bones')
      avatarMeshRef.current.skeleton.bones.forEach((bone, index) => {
        bones.push({
          name: bone.name || `bone_${index}`,
          depth: 0,
          path: `skeleton.bones[${index}]`
        })
      })
    } else {
      // Fallback to traversal
      collectBones(avatarMeshRef.current)
    }

    console.log(`\n=== BONE HIERARCHY (${bones.length} bones) ===`)
    if (bones.length === 0) {
      console.log('No bones found! Checking avatar structure...')
      console.log('Avatar type:', avatarMeshRef.current.type)
      console.log('Has skeleton?', avatarMeshRef.current instanceof THREE.SkinnedMesh ? avatarMeshRef.current.skeleton : 'Not a SkinnedMesh')
    } else {
      bones.forEach(({ name, depth, path }) => {
        const indent = '  '.repeat(depth)
        console.log(`${indent}${name || 'unnamed'} (path: ${path})`)
      })
    }
    console.log('================================\n')

    setIsProcessing(true)

    try {
      const result = await fittingService.current.fitHelmetToHead(
        helmetMeshRef.current,
        avatarMeshRef.current,
        {
          method: helmetFittingMethod,
          sizeMultiplier: helmetSizeMultiplier,
          fitTightness: helmetFitTightness,
          verticalOffset: helmetVerticalOffset,
          forwardOffset: helmetForwardOffset,
          rotation: new THREE.Euler(
            helmetRotation.x * Math.PI / 180,
            helmetRotation.y * Math.PI / 180,
            helmetRotation.z * Math.PI / 180
          ),
          attachToHead: false,
          showHeadBounds: showHeadBounds,
          showCollisionDebug: showCollisionDebug
        }
      )

      console.log('Helmet fitting complete:', result)
    } catch (error) {
      console.error('Helmet fitting failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const attachHelmetToHead = () => {
    if (!avatarMeshRef.current || !helmetMeshRef.current) {
      console.error('Avatar or helmet mesh not loaded')
      alert('Please load both avatar and helmet first')
      return
    }

    // Find head bone
    const headInfo = fittingService.current.detectHeadRegion(avatarMeshRef.current)

    if (!headInfo.headBone) {
      console.error('No head bone found - attaching to avatar root instead')

      // Show alert with bone list
      const message = `No head bone found in the model. The system looked for common head bone names but couldn't find any.\n\n` +
        `You can either:\n` +
        `1. Attach the helmet to the avatar root (it won't follow head animations)\n` +
        `2. Cancel and manually parent the helmet in your 3D software\n\n` +
        `Would you like to attach to the avatar root?`

      if (confirm(message)) {
        // Simple parent without transform changes
        const avatarRoot = avatarMeshRef.current.parent || avatarMeshRef.current
        avatarRoot.attach(helmetMeshRef.current) // attach() preserves world transform

        setIsHelmetAttached(true)
        console.log('Helmet attached to avatar root')
        alert('Helmet attached to avatar root. Note: It will follow body movement but not specific head animations.')
      }
      return
    }

    // Debug: Log transforms before attachment
    console.log('=== BEFORE ATTACHMENT ===')
    console.log('Helmet world position:', helmetMeshRef.current.getWorldPosition(new THREE.Vector3()))
    console.log('Helmet world scale:', helmetMeshRef.current.getWorldScale(new THREE.Vector3()))
    console.log('Helmet local scale:', helmetMeshRef.current.scale.clone())
    console.log('Head bone world position:', headInfo.headBone.getWorldPosition(new THREE.Vector3()))
    console.log('Head bone world scale:', headInfo.headBone.getWorldScale(new THREE.Vector3()))
    console.log('Head bone local scale:', headInfo.headBone.scale.clone())

    // Store exact world transform before attachment
    const originalWorldPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
    const originalWorldQuat = helmetMeshRef.current.getWorldQuaternion(new THREE.Quaternion())
    const originalWorldScale = helmetMeshRef.current.getWorldScale(new THREE.Vector3())

    console.log('=== STORING EXACT WORLD TRANSFORM ===')
    console.log('Position:', originalWorldPos)
    console.log('Rotation:', originalWorldQuat)
    console.log('Scale:', originalWorldScale)

    // Check bone scale
    const boneScale = headInfo.headBone.getWorldScale(new THREE.Vector3())
    console.log('Head bone world scale:', boneScale)

    if (boneScale.x < 0.1) {
      console.log('Bone has extreme scale - applying visibility workaround')

      // The attachment will work but Three.js has rendering issues with extreme scales
      // So we'll force some rendering settings

      // First do the attachment
      headInfo.headBone.attach(helmetMeshRef.current)

      // Ensure world transform is exactly preserved
      const newPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
      const newQuat = helmetMeshRef.current.getWorldQuaternion(new THREE.Quaternion())

      if (newPos.distanceTo(originalWorldPos) > 0.001 || originalWorldQuat.angleTo(newQuat) > 0.001) {
        console.log('Correcting transform drift for extreme scale case...')

        const parentInverse = new THREE.Matrix4().copy(headInfo.headBone.matrixWorld).invert()
        const originalWorldMatrix = new THREE.Matrix4().compose(
          originalWorldPos,
          originalWorldQuat,
          originalWorldScale
        )
        const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, originalWorldMatrix)

        const localPos = new THREE.Vector3()
        const localQuat = new THREE.Quaternion()
        const localScale = new THREE.Vector3()
        localMatrix.decompose(localPos, localQuat, localScale)

        helmetMeshRef.current.position.copy(localPos)
        helmetMeshRef.current.quaternion.copy(localQuat)
        helmetMeshRef.current.scale.copy(localScale)
      }

      // Force specific material settings that work better with extreme scales
      helmetMeshRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.Material
          mat.side = THREE.DoubleSide
          mat.depthWrite = true
          mat.depthTest = true

          // Force material to update
          mat.needsUpdate = true

          // If it's a standard material, adjust some settings
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.metalness = 0.5
            mat.roughness = 0.5
          }
        }
      })

      // Force matrix updates
      helmetMeshRef.current.updateMatrix()
      helmetMeshRef.current.updateMatrixWorld(true)

      // CRITICAL: Create a helper object to make the helmet visible
      // Three.js has issues rendering meshes with local scale > 20
      // We'll create a normalized clone that renders properly

      const helmetHelper = helmetMeshRef.current.clone()
      helmetHelper.name = 'HelmetRenderHelper'

      // Add helper to scene at exact world transform
      const worldPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
      const worldQuat = helmetMeshRef.current.getWorldQuaternion(new THREE.Quaternion())
      const worldScale = helmetMeshRef.current.getWorldScale(new THREE.Vector3())

      helmetHelper.position.copy(worldPos)
      helmetHelper.quaternion.copy(worldQuat)
      helmetHelper.scale.set(worldScale.x, worldScale.y, worldScale.z)
      helmetHelper.visible = true

      // Ensure helper renders
      helmetHelper.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = false
        }
      })

      sceneRef.current?.add(helmetHelper)

      // Hide the original (it has extreme local scale)
      if (helmetMeshRef.current) {
        helmetMeshRef.current.visible = false
        // Also ensure all children are hidden
        helmetMeshRef.current.traverse((child) => {
          child.visible = false
        })
      }

      // Store reference for cleanup
      if (helmetMeshRef.current) {
        helmetMeshRef.current.renderHelper = helmetHelper
      }

      // Make helper follow the original helmet's world position
      const updateHelper = () => {
        if (helmetMeshRef.current && helmetHelper.parent) {
          const newWorldPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
          const newWorldQuat = helmetMeshRef.current.getWorldQuaternion(new THREE.Quaternion())
          helmetHelper.position.copy(newWorldPos)
          helmetHelper.quaternion.copy(newWorldQuat)
        }
      }

      // Store update function for animation frame
      if (helmetMeshRef.current) {
        helmetMeshRef.current.updateHelper = updateHelper
      }

      console.log('Created render helper with normal scale')
      console.log('Helper will follow head bone animations')
    } else {
      // Normal attachment
      console.log('Using standard attachment')

      // Clean up any existing render helper first
      const existingHelper = helmetMeshRef.current?.renderHelper
      if (existingHelper && existingHelper.parent) {
        existingHelper.parent.remove(existingHelper)
        if ('geometry' in existingHelper && existingHelper.geometry) {
          existingHelper.geometry.dispose()
        }
        if ('material' in existingHelper && existingHelper.material) {
          if (Array.isArray(existingHelper.material)) {
            existingHelper.material.forEach((mat: THREE.Material) => mat.dispose())
          } else {
            existingHelper.material.dispose()
          }
        }
        if (helmetMeshRef.current) {
          delete helmetMeshRef.current.renderHelper
          delete helmetMeshRef.current.updateHelper
        }
      }

      // Make sure original helmet is visible
      if (helmetMeshRef.current) {
        helmetMeshRef.current.visible = true
      }
      helmetMeshRef.current.traverse((child) => {
        child.visible = true
      })

      headInfo.headBone.attach(helmetMeshRef.current)

      // Verify world transform is preserved
      const newWorldPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
      const newWorldQuat = helmetMeshRef.current.getWorldQuaternion(new THREE.Quaternion())

      console.log('=== AFTER ATTACHMENT ===')
      console.log('New world position:', newWorldPos)
      console.log('New world rotation:', newWorldQuat)
      console.log('Position drift:', newWorldPos.distanceTo(originalWorldPos))
      console.log('Rotation drift:', originalWorldQuat.angleTo(newWorldQuat))

      // If there's any drift, correct it
      if (newWorldPos.distanceTo(originalWorldPos) > 0.001 || originalWorldQuat.angleTo(newWorldQuat) > 0.001) {
        console.log('Detected transform drift - correcting...')

        // Convert world transform to local transform relative to new parent
        const parentWorldMatrix = new THREE.Matrix4()
        headInfo.headBone.matrixWorld.decompose(
          new THREE.Vector3(),
          new THREE.Quaternion(),
          new THREE.Vector3()
        )

        const parentInverse = new THREE.Matrix4().copy(headInfo.headBone.matrixWorld).invert()

        // Create matrix from original world transform
        const originalWorldMatrix = new THREE.Matrix4().compose(
          originalWorldPos,
          originalWorldQuat,
          originalWorldScale
        )

        // Get local matrix that will produce the original world transform
        const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, originalWorldMatrix)

        // Apply local transform
        const localPos = new THREE.Vector3()
        const localQuat = new THREE.Quaternion()
        const localScale = new THREE.Vector3()
        localMatrix.decompose(localPos, localQuat, localScale)

        helmetMeshRef.current.position.copy(localPos)
        helmetMeshRef.current.quaternion.copy(localQuat)
        helmetMeshRef.current.scale.copy(localScale)
      }
    }

    // Force update matrices
    helmetMeshRef.current.updateMatrixWorld(true)

    // IMPORTANT: For skinned meshes, we need to ensure the helmet follows bone transforms
    // Set matrixAutoUpdate to true to ensure it updates with the bone
    helmetMeshRef.current.matrixAutoUpdate = true

    // Debug: Log transforms after attachment
    console.log('=== AFTER ATTACHMENT ===')
    console.log('Helmet world position:', helmetMeshRef.current.getWorldPosition(new THREE.Vector3()))
    console.log('Helmet world scale:', helmetMeshRef.current.getWorldScale(new THREE.Vector3()))
    console.log('Helmet local scale:', helmetMeshRef.current.scale.clone())
    console.log('Helmet parent:', helmetMeshRef.current.parent?.name)
    console.log('Helmet matrix auto update:', helmetMeshRef.current.matrixAutoUpdate)

    // Check if helmet is visible and properly set up
    console.log('Helmet visible:', helmetMeshRef.current.visible)
    console.log('Helmet material:', helmetMeshRef.current.material)
    console.log('Helmet geometry:', helmetMeshRef.current.geometry)
    console.log('Helmet render order:', helmetMeshRef.current.renderOrder)
    console.log('Helmet frustum culled:', helmetMeshRef.current.frustumCulled)

    // Ensure helmet is set to render
    helmetMeshRef.current.visible = true
    // IMPORTANT: Disable frustum culling for objects with extreme scales
    // as it can cause them to disappear incorrectly
    helmetMeshRef.current.frustumCulled = false
    helmetMeshRef.current.renderOrder = 0

    // Also update the matrix to ensure bounds are correct
    helmetMeshRef.current.updateMatrix()
    helmetMeshRef.current.updateMatrixWorld(true)

    // Disable frustum culling for the helmet AND all children
    // Also ensure materials render both sides (in case normals are flipped)
    const disableFrustumCulling = (obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        obj.frustumCulled = false
        obj.visible = true

        // Ensure material renders both sides
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => {
              mat.side = THREE.DoubleSide
              mat.needsUpdate = true
            })
          } else {
            obj.material.side = THREE.DoubleSide
            obj.material.needsUpdate = true
          }
        }
      }

      // Process children
      obj.children.forEach(child => disableFrustumCulling(child))
    }

    // Apply to helmet and all descendants
    disableFrustumCulling(helmetMeshRef.current)

    // Double-check it stuck
    console.log('After disabling frustum culling:', helmetMeshRef.current.frustumCulled)

    // Add debug visualization to see where the helmet actually is
    const finalHelmetWorldPos = helmetMeshRef.current.getWorldPosition(new THREE.Vector3())
    const finalHelmetBounds = new THREE.Box3().setFromObject(helmetMeshRef.current)
    console.log('=== FINAL HELMET STATE ===')
    console.log('World position:', finalHelmetWorldPos)
    console.log('World bounds:', finalHelmetBounds.min, 'to', finalHelmetBounds.max)
    console.log('Bounds size:', finalHelmetBounds.getSize(new THREE.Vector3()))

    // Log final state
    console.log('=== ATTACHMENT COMPLETE ===')
    console.log('Helmet local position:', helmetMeshRef.current.position)
    console.log('Helmet local scale:', helmetMeshRef.current.scale)
    console.log('Helmet parent:', helmetMeshRef.current.parent?.name)
    console.log('Helmet visible:', helmetMeshRef.current.visible)
    console.log('Helmet frustum culled:', helmetMeshRef.current.frustumCulled)

    setIsHelmetAttached(true)
    console.log('✓ Helmet successfully attached to head bone:', headInfo.headBone.name)
    console.log('The helmet will now follow head animations while maintaining its position')

    // Final check on frustum culling
    console.log('=== FINAL FRUSTUM CULLING CHECK ===')
    console.log('Helmet frustum culled:', helmetMeshRef.current.frustumCulled)
    helmetMeshRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        console.log(`Child ${child.name} frustum culled:`, child.frustumCulled)
      }
    })

    // Additional check: Make sure helmet scale isn't too small
    const finalWorldScale = helmetMeshRef.current.getWorldScale(new THREE.Vector3())
    if (finalWorldScale.x < 0.01 || finalWorldScale.y < 0.01 || finalWorldScale.z < 0.01) {
      console.error('WARNING: Helmet scale is extremely small after attachment!', finalWorldScale)
      console.error('This might make the helmet invisible. Consider adjusting the bone hierarchy or helmet scale.')

      // Try to compensate by adjusting local scale
      const boneScale = headInfo.headBone.getWorldScale(new THREE.Vector3())
      const compensationScale = new THREE.Vector3(
        0.214 / boneScale.x,
        0.214 / boneScale.y,
        0.214 / boneScale.z
      )
      console.log('Attempting to compensate with scale:', compensationScale)
      helmetMeshRef.current.scale.copy(compensationScale)
      helmetMeshRef.current.updateMatrixWorld(true)
    }
  }

  const detachHelmetFromHead = () => {
    if (!helmetMeshRef.current) {
      console.error('No helmet to detach')
      return
    }

    // Clean up render helper if it exists
    const renderHelper = helmetMeshRef.current?.renderHelper
    if (renderHelper && renderHelper.parent) {
      // Remove helper from scene
      renderHelper.parent.remove(renderHelper)
      if ('geometry' in renderHelper && renderHelper.geometry) {
        renderHelper.geometry.dispose()
      }
      if ('material' in renderHelper && renderHelper.material) {
        if (Array.isArray(renderHelper.material)) {
          renderHelper.material.forEach((mat: THREE.Material) => mat.dispose())
        } else {
          renderHelper.material.dispose()
        }
      }

      // Clean up references
      if (helmetMeshRef.current) {
        delete helmetMeshRef.current.renderHelper
        delete helmetMeshRef.current.updateHelper
      }
    }

    // Make original helmet visible again
    helmetMeshRef.current.visible = true
    helmetMeshRef.current.traverse((child) => {
      child.visible = true
    })

    // Remove from parent and add back to scene
    if (helmetMeshRef.current.parent) {
      const scene = sceneRef.current
      if (scene) {
        // Use attach() which preserves world transform
        scene.attach(helmetMeshRef.current)

        setIsHelmetAttached(false)
        console.log('Helmet detached from head')
      }
    }
  }

  const resetMeshes = () => {
    // IMPORTANT: This function ONLY resets what was changed during fitting
    // With fresh clones on every model switch, reset only needs to:
    // 1. Reset armor transforms (scale/position changed during fitting)
    // 2. Reset armor material properties
    // 3. Clear debug visualizations
    // 4. Reset animation states
    // That's it! Everything else is already fresh from cloning

    const scene = sceneRef.current
    if (!scene) return

    console.log('=== RESETTING MESH FITTING STATE ===')
    console.log('Reset logic version: FRESH_CLONE_MINIMAL')

    // Reset animation states
    setCurrentAnimation('tpose')
    setIsAnimationPlaying(false)

    // Reset armor fitting/binding states
    setIsArmorFitted(false)
    setIsArmorBound(false)
    setSkinnedArmorMesh(null)

    // Clear debug arrows first
    fittingService.current.clearDebugArrows()

    // Remove ALL debug visualization groups
    const debugGroups = scene.children.filter(child =>
      child.name === 'debugArrows' ||
      child.userData.isDebug ||
      child === debugArrowGroupRef.current
    )
    debugGroups.forEach(group => {
      scene.remove(group)
      group.traverse((child: THREE.Object3D) => {
        if ('geometry' in child && child.geometry) {
          (child.geometry as THREE.BufferGeometry).dispose()
        }
        if ('material' in child && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.forEach((m: THREE.Material) => m.dispose())
        }
      })
    })

    // Clear debug arrow group children
    if (debugArrowGroupRef.current) {
      while (debugArrowGroupRef.current.children.length > 0) {
        const child = debugArrowGroupRef.current.children[0]
        debugArrowGroupRef.current.remove(child)
        if ('geometry' in child && child.geometry) {
          (child.geometry as THREE.BufferGeometry).dispose()
        }
        if ('material' in child && child.material) {
          (child.material as THREE.Material).dispose()
        }
      }
    }

    // Create a new fitting service instance to ensure clean state
    fittingService.current = new GenericMeshFittingService()
    if (debugArrowGroupRef.current) {
      fittingService.current.setDebugArrowGroup(debugArrowGroupRef.current)
    }

    // Remove all debug objects
    const debugObjects = [
      'TorsoDebugBox',
      'TorsoCenterSphere',
      'TorsoCenterPlane',
      'BodyHullMesh',
      'BoneMarkers',
      'TorsoTopPlane'
    ]

    debugObjects.forEach(name => {
      const obj = scene.getObjectByName(name)
      if (obj) {
        if (obj.parent) obj.parent.remove(obj)
        scene.remove(obj)
        if (obj instanceof THREE.Mesh && obj.geometry) {
          obj.geometry.dispose()
        }
        if (obj instanceof THREE.Mesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose())
          } else {
            obj.material.dispose()
          }
        }
      }
    })

    // Reset all source meshes (spheres/cubes)
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.isSource && !obj.userData.isArmor) {
        const originalGeo = obj.userData.originalGeometry?.current
        if (originalGeo) {
          obj.geometry.dispose()
          obj.geometry = originalGeo.clone()
          obj.geometry.computeVertexNormals()
          obj.geometry.computeBoundingBox()
          obj.geometry.computeBoundingSphere()
        }
      }
    })

    // With fresh clones, armor reset is simple
    if (armorMeshRef.current) {
      const armorMesh = armorMeshRef.current
      console.log('Resetting armor mesh transforms')

      // If this is a skinned mesh that we created, remove it
      if (armorMesh.userData.isSkinned && skinnedArmorMesh) {
        console.log('Removing skinned armor mesh')
        if (skinnedArmorMesh.parent) {
          skinnedArmorMesh.parent.remove(skinnedArmorMesh)
        }
        if (skinnedArmorMesh.geometry) {
          skinnedArmorMesh.geometry.dispose()
        }
        setSkinnedArmorMesh(null)
        // The armor ref will be replaced by fresh clone on next render
      } else {
        // Since we're working with clones, we only need to reset transforms
        // The geometry is already fresh from cloning

        // Reset ONLY the armor mesh's LOCAL transforms
        armorMesh.position.set(0, 0, 0)
        armorMesh.scale.set(1, 1, 1)
        armorMesh.rotation.set(0, 0, 0)
        armorMesh.updateMatrix()
        armorMesh.updateMatrixWorld(true)

        // Clear any cached data (though it shouldn't persist with clones)
        delete armorMesh.userData.scaledGeometry
        delete armorMesh.userData.fittedGeometry
        delete armorMesh.userData.hasBeenFitted

        // Reset material to initial state
        if (armorMesh.material) {
          const material = armorMesh.material as THREE.MeshStandardMaterial
          material.color.set('#4472C4')
          material.wireframe = showWireframe
          material.transparent = true
          material.opacity = 0.8
          material.needsUpdate = true
        }

        // Ensure armor is visible after reset
        armorMesh.visible = true
      }
    }

    // Reset avatar mesh material (in case opacity changed)
    if (avatarMeshRef.current) {
      const avatarMesh = avatarMeshRef.current
      if (avatarMesh.material) {
        const material = avatarMesh.material as THREE.MeshStandardMaterial
        material.transparent = true
        material.opacity = 0.7
        material.needsUpdate = true
      }

      // That's it for avatar! Don't touch anything else!
      // No skeleton updates - they reset bone scales
      // No transform updates - avatar is already positioned correctly
    }

    // Clear any stored fitting data
    setIsProcessing(false)

    // Double force scene update
    scene.updateMatrixWorld(true)
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.updateMatrix()
        obj.updateMatrixWorld(true)
      }
    })

    console.log('=== RESET COMPLETE ===')



    // Wait one frame to ensure all updates have propagated
    requestAnimationFrame(() => {
      scene.updateMatrixWorld(true)
      console.log('Scene fully updated after reset')

      // Re-find and update armor ref to ensure it's current
      if (viewMode === 'avatarArmor') {
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.userData.isArmor) {
            armorMeshRef.current = obj
            console.log('Re-assigned armor ref after reset:', obj.name)
          }
        })
      }
    })
  }

  // Show loading state if assets are still loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-bg-primary rounded-2xl border border-white/10 p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-text-primary">Loading assets...</p>
        </div>
      </div>
    )
  }


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-bg-primary rounded-2xl border border-white/10 w-[90%] max-w-6xl h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Play className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Mesh Fitting Debugger</h2>
              <p className="text-sm text-text-secondary mt-0.5">
                {viewMode === 'sphereCube'
                  ? 'Test iterative fitting algorithm with simple shapes'
                  : 'Test armor fitting on avatar with shrinkwrapping'}
              </p>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              <button
                onClick={() => {
                  setViewMode('sphereCube')
                  // Reset animation when switching modes
                  setCurrentAnimation('tpose')
                  setIsAnimationPlaying(false)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  viewMode === 'sphereCube'
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                )}
              >
                Sphere/Cube
              </button>
              <button
                onClick={() => {
                  setViewMode('avatarArmor')
                  // Reset animation when switching modes
                  setCurrentAnimation('tpose')
                  setIsAnimationPlaying(false)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  viewMode === 'avatarArmor'
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                )}
              >
                Avatar/Armor
              </button>
              <button
                onClick={() => {
                  setViewMode('helmetFitting')
                  // Reset animation when switching modes
                  setCurrentAnimation('tpose')
                  setIsAnimationPlaying(false)
                }}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                  viewMode === 'helmetFitting'
                    ? "bg-primary text-white"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                )}
              >
                Helmet Fitting
              </button>
            </div>

            {/* Wireframe Toggle */}
            <button
              onClick={() => setShowWireframe(!showWireframe)}
              className={cn(
                "p-2.5 rounded-lg transition-all duration-200 group",
                showWireframe
                  ? "bg-primary/20 hover:bg-primary/30"
                  : "hover:bg-white/10"
              )}
              title={showWireframe ? "Hide wireframe (W)" : "Show wireframe (W)"}
            >
              <Grid3x3 className={cn(
                "w-5 h-5 transition-colors",
                showWireframe
                  ? "text-primary"
                  : "text-text-secondary group-hover:text-text-primary"
              )} />
            </button>

            <button
              onClick={onClose}
              className="p-2.5 rounded-lg hover:bg-white/10 transition-all duration-200 group"
            >
              <X className="w-5 h-5 text-text-secondary group-hover:text-text-primary transition-colors" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* 3D View */}
          <div className="flex-1 relative bg-bg-secondary/20">
            <div className="absolute inset-0">
              <Canvas
                camera={{ position: [5, 5, 5], fov: 50 }}
                onCreated={({ scene }) => { sceneRef.current = scene }}
              >
                <Scene
                  fittingService={fittingService}
                  isProcessing={isProcessing}
                  showWireframe={showWireframe}
                  viewMode={viewMode}
                  selectedAvatarPath={selectedAvatar?.path || selectedAvatarPath}
                  selectedArmorPath={selectedArmor?.path || selectedArmorPath}
                  selectedHelmetPath={selectedHelmet?.path || selectedHelmetPath}
                  avatarMeshRef={avatarMeshRef}
                  armorMeshRef={armorMeshRef}
                  helmetMeshRef={helmetMeshRef}
                  originalArmorGeometryRef={originalArmorGeometryRef}
                  originalHelmetTransformRef={originalHelmetTransformRef}
                  debugArrowGroupRef={debugArrowGroupRef}
                  headBoundsHelperRef={headBoundsHelperRef}
                  currentAnimation={currentAnimation}
                  isAnimationPlaying={isAnimationPlaying}
                  showHeadBounds={showHeadBounds}
                />
              </Canvas>
            </div>

            {/* Wireframe Indicator */}
            {showWireframe && (
              <div className="absolute top-4 left-4 bg-bg-primary/80 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-primary" />
                <span className="text-xs text-text-secondary">Wireframe</span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-3 z-10 max-w-[90%]">
              {viewMode === 'sphereCube' ? (
                <>
                  <button
                    onClick={() => performFitting('cubeToSphere')}
                    disabled={isProcessing}
                    className={cn(
                      "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                      "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    <span>Wrap Cube → Sphere</span>
                  </button>

                  <button
                    onClick={() => performFitting('sphereToCube')}
                    disabled={isProcessing}
                    className={cn(
                      "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                      "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    <span>Wrap Sphere → Cube</span>
                  </button>
                </>
              ) : viewMode === 'avatarArmor' ? (
                <>
                  <button
                    onClick={() => performFitting('avatarToArmor')}
                    disabled={isProcessing || isArmorBound}
                    className={cn(
                      "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                      "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                      (isProcessing || isArmorBound) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    <span>Fit Armor to Avatar</span>
                  </button>

                  {isArmorFitted && !isArmorBound && (
                    <button
                      onClick={bindArmorToSkeleton}
                      disabled={isProcessing}
                      className={cn(
                        "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                        "bg-green-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                        "animate-in fade-in slide-in-from-bottom-2 duration-300",
                        isProcessing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Link className="w-4 h-4" />
                      <span>Bind to Skeleton</span>
                    </button>
                  )}

                  {isArmorBound && (
                    <div className="px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg text-green-400 text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      <span>Armor Bound to Skeleton</span>
                    </div>
                  )}
                </>
              ) : viewMode === 'helmetFitting' ? (
                <>
                  <button
                    onClick={() => performHelmetFitting()}
                    disabled={isProcessing}
                    className={cn(
                      "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                      "bg-primary text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                      isProcessing && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Play className="w-4 h-4" />
                    <span>Auto-Fit Helmet</span>
                  </button>

                  <button
                    onClick={() => isHelmetAttached ? detachHelmetFromHead() : attachHelmetToHead()}
                    disabled={isProcessing || !helmetMeshRef.current}
                    className={cn(
                      "px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5",
                      isHelmetAttached
                        ? "bg-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                        : "bg-green-600 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]",
                      (isProcessing || !helmetMeshRef.current) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Link className="w-4 h-4" />
                    <span>{isHelmetAttached ? 'Detach from Head' : 'Attach to Head'}</span>
                  </button>

                  {isHelmetAttached && (
                    <div className="px-4 py-2 bg-green-600/20 border border-green-600/30 rounded-lg text-green-400 text-sm font-medium flex items-center gap-2">
                      <Link className="w-4 h-4" />
                      <span>Helmet Attached</span>
                    </div>
                  )}
                </>
              ) : null}

              <button
                onClick={resetMeshes}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2.5
                  bg-bg-primary/80 backdrop-blur-sm border border-white/10 text-text-primary
                  hover:bg-bg-secondary hover:border-white/20 hover:scale-105
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            </div>

            {/* Animation Controls - Show in avatar/armor and helmet fitting modes */}
            {(viewMode === 'avatarArmor' || viewMode === 'helmetFitting') && (
              <div className="absolute bottom-28 left-4 right-4 max-w-md mx-auto bg-bg-primary/90 backdrop-blur-sm rounded-lg p-3 border border-white/10 shadow-xl z-10">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-text-primary">Animations</span>
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => {
                        setCurrentAnimation('tpose')
                        setIsAnimationPlaying(false)
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                        currentAnimation === 'tpose'
                          ? "bg-primary text-white"
                          : "bg-bg-secondary/60 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                      )}
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>T-Pose</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentAnimation === 'walking' && isAnimationPlaying) {
                          setIsAnimationPlaying(false)
                        } else {
                          setCurrentAnimation('walking')
                          setIsAnimationPlaying(true)
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                        currentAnimation === 'walking' && isAnimationPlaying
                          ? "bg-primary text-white"
                          : "bg-bg-secondary/60 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                      )}
                    >
                      {currentAnimation === 'walking' && isAnimationPlaying ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      <span>Walking</span>
                    </button>

                    <button
                      onClick={() => {
                        if (currentAnimation === 'running' && isAnimationPlaying) {
                          setIsAnimationPlaying(false)
                        } else {
                          setCurrentAnimation('running')
                          setIsAnimationPlaying(true)
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5",
                        currentAnimation === 'running' && isAnimationPlaying
                          ? "bg-primary text-white"
                          : "bg-bg-secondary/60 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                      )}
                    >
                      {currentAnimation === 'running' && isAnimationPlaying ? (
                        <Pause className="w-3 h-3" />
                      ) : (
                        <Play className="w-3 h-3" />
                      )}
                      <span>Running</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Parameters Panel */}
          <div className="w-96 border-l border-white/10 bg-bg-secondary/30 overflow-y-auto">
            <div className="p-6">
              {/* Model Selection Section - Only show for avatar/armor mode */}
              {viewMode === 'avatarArmor' && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Box className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Model Selection</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Choose avatar and armor</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {/* Avatar Dropdown */}
                    <div className="space-y-2">
                      <label className="label">Avatar</label>
                      <select
                        value={selectedAvatar?.id || ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const avatar = availableAvatars.find(a => a.id === e.target.value)
                          if (avatar) setSelectedAvatar(avatar)
                        }}
                        className={selectClassName}
                      >
                        {availableAvatars.map(avatar => (
                          <option key={avatar.id} value={avatar.id}>
                            {avatar.name}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">{selectedAvatar?.name || 'No avatar selected'} character model</p>
                    </div>

                    {/* Armor Dropdown */}
                    <div className="space-y-2">
                      <label className="label">Armor</label>
                      <select
                        value={selectedArmor?.id || ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const armor = availableArmors.find(a => a.id === e.target.value)
                          if (armor) setSelectedArmor(armor)
                        }}
                        className={selectClassName}
                      >
                        {availableArmors.map(armor => (
                          <option key={armor.id} value={armor.id}>
                            {armor.name}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">{selectedArmor?.name || 'No armor selected'} armor variant</p>
                    </div>

                    {/* Adaptive anatomy info */}
                    {selectedAvatar?.id === 'troll' && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-4">
                        <p className="text-xs text-blue-400">
                          <span className="font-semibold">Note:</span> Troll has non-standard anatomy.
                          The system will automatically use chest-based positioning instead of shoulder-based
                          to avoid placing armor on the head.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10 my-6"></div>

                  {/* Skeleton Binding Info */}
                  {isArmorFitted && (
                    <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-4 mb-6 animate-in fade-in duration-300">
                      <div className="flex items-start gap-3">
                        <Link className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-green-400">Skeleton Binding Available</h4>
                          <p className="text-xs text-green-300/80 leading-relaxed">
                            The armor has been fitted to the avatar's shape. Click "Bind to Skeleton" to make
                            the armor follow character animations by transferring bone weights from the avatar.
                          </p>
                          {isArmorBound && (
                            <p className="text-xs text-green-400 font-medium mt-2">
                              ✓ Armor is now bound and will deform with animations!
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Helmet Fitting Section */}
              {viewMode === 'helmetFitting' && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Box className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Helmet Fitting</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Position helmet on head</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    {/* Avatar Dropdown */}
                    <div className="space-y-2">
                      <label className="label">Avatar</label>
                      <select
                        value={selectedAvatar?.id || ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const avatar = availableAvatars.find(a => a.id === e.target.value)
                          if (avatar) setSelectedAvatar(avatar)
                        }}
                        className={selectClassName}
                      >
                        {availableAvatars.map(avatar => (
                          <option key={avatar.id} value={avatar.id}>
                            {avatar.name}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">{selectedAvatar?.name || 'No avatar selected'} character model</p>
                    </div>

                    {/* Helmet Dropdown */}
                    <div className="space-y-2">
                      <label className="label">Helmet</label>
                      <select
                        value={selectedHelmet?.id || ''}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          const helmet = availableHelmets.find(h => h.id === e.target.value)
                          if (helmet) setSelectedHelmet(helmet)
                        }}
                        className={selectClassName}
                      >
                        {availableHelmets.map(helmet => (
                          <option key={helmet.id} value={helmet.id}>
                            {helmet.name}
                          </option>
                        ))}
                      </select>
                      <p className="helper-text">{selectedHelmet?.name || 'No helmet selected'}</p>
                    </div>

                    {/* Fitting Method */}
                    <div className="space-y-2">
                      <label className="label">Fitting Method</label>
                      <select
                        value={helmetFittingMethod}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setHelmetFittingMethod(e.target.value as 'auto' | 'manual')}
                        className={selectClassName}
                      >
                        <option value="auto">Automatic</option>
                        <option value="manual">Manual</option>
                      </select>
                      <p className="helper-text">{helmetFittingMethod === 'auto' ? 'AI-powered placement' : 'Manual adjustment'}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 my-6"></div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary">Adjustments</h4>

                    {/* Size */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Size</label>
                        <span className="text-xs font-mono text-primary">{(helmetSizeMultiplier * 100).toFixed(0)}%</span>
                      </div>
                      <RangeInput
                        min="0.8"
                        max="1.2"
                        step="0.01"
                        value={helmetSizeMultiplier}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHelmetSizeMultiplier(Number(e.target.value))}
                      />
                    </div>

                    {/* Fit Tightness */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Fit Tightness</label>
                        <span className="text-xs font-mono text-primary">{(helmetFitTightness * 100).toFixed(0)}%</span>
                      </div>
                      <RangeInput
                        min="0.7"
                        max="1.0"
                        step="0.01"
                        value={helmetFitTightness}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHelmetFitTightness(Number(e.target.value))}
                      />
                      <p className="text-xs text-text-tertiary">How snug the helmet fits (lower = tighter)</p>
                    </div>

                    {/* Vertical Offset */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Vertical Offset</label>
                        <span className="text-xs font-mono text-primary">{helmetVerticalOffset.toFixed(1)}</span>
                      </div>
                      <RangeInput
                        min="-0.1"
                        max="0.1"
                        step="0.005"
                        value={helmetVerticalOffset}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHelmetVerticalOffset(Number(e.target.value))}
                      />
                    </div>

                    {/* Forward Offset */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Forward Offset</label>
                        <span className="text-xs font-mono text-primary">{helmetForwardOffset.toFixed(1)}</span>
                      </div>
                      <RangeInput
                        min="-0.05"
                        max="0.05"
                        step="0.005"
                        value={helmetForwardOffset}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHelmetForwardOffset(Number(e.target.value))}
                      />
                    </div>

                    {/* Rotation */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-text-primary">Rotation</h5>

                      {/* Pitch */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-text-secondary">Pitch</label>
                          <span className="text-xs font-mono text-primary">{helmetRotation.x}°</span>
                        </div>
                        <RangeInput
                          min="-30"
                          max="30"
                          step="1"
                          value={helmetRotation.x}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setHelmetRotation({ ...helmetRotation, x: Number(e.target.value) })}
                        />
                      </div>

                      {/* Yaw */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-text-secondary">Yaw</label>
                          <span className="text-xs font-mono text-primary">{helmetRotation.y}°</span>
                        </div>
                        <RangeInput
                          min="-30"
                          max="30"
                          step="1"
                          value={helmetRotation.y}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setHelmetRotation({ ...helmetRotation, y: Number(e.target.value) })}
                        />
                      </div>

                      {/* Roll */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-xs text-text-secondary">Roll</label>
                          <span className="text-xs font-mono text-primary">{helmetRotation.z}°</span>
                        </div>
                        <RangeInput
                          min="-30"
                          max="30"
                          step="1"
                          value={helmetRotation.z}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setHelmetRotation({ ...helmetRotation, z: Number(e.target.value) })}
                        />
                      </div>
                    </div>

                    {/* Debug Options */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showHeadBounds}
                          onChange={(e) => setShowHeadBounds(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary"
                        />
                        <span className="text-sm text-text-primary">Show Head Bounds</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showCollisionDebug}
                          onChange={(e) => setShowCollisionDebug(e.target.checked)}
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary"
                        />
                        <span className="text-sm text-text-primary">Show Collision Debug</span>
                      </label>

                      <button
                        onClick={() => {
                          if (avatarMeshRef.current) {
                            const bones: string[] = []

                            // Check skeleton bones first
                            if (avatarMeshRef.current instanceof THREE.SkinnedMesh && avatarMeshRef.current.skeleton) {
                              avatarMeshRef.current.skeleton.bones.forEach(bone => {
                                bones.push(bone.name || 'unnamed')
                              })
                            }

                            // Also check hierarchy
                            avatarMeshRef.current.traverse(child => {
                              if (child instanceof THREE.Bone && !bones.includes(child.name)) {
                                bones.push(child.name)
                              }
                            })

                            console.log('=== Bone List ===')
                            console.log('Total bones:', bones.length)
                            bones.forEach(name => console.log(`  - ${name}`))
                            console.log('=================')

                            // Also test head detection
                            const headInfo = fittingService.current.detectHeadRegion(avatarMeshRef.current)
                            console.log('Head detection result:', headInfo.headBone ? `Found: ${headInfo.headBone.name}` : 'Not found')

                            alert(`Found ${bones.length} bones in the model. Head bone: ${headInfo.headBone ? headInfo.headBone.name : 'Not detected'}. Check the console for details.`)
                          }
                        }}
                        className="px-3 py-1.5 bg-bg-secondary/60 rounded-lg text-xs text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-all"
                      >
                        Show Bone List
                      </button>
                    </div>
                  </div>
                </>
              )}

              {viewMode !== 'helmetFitting' && (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Sliders className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-text-primary">Fitting Parameters</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Adjust algorithm behavior</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Iterations</label>
                        <span className="text-xs font-mono text-primary">{fittingParameters.iterations}</span>
                      </div>
                      <RangeInput
                        min="1"
                        max="50"
                        step="1"
                        value={fittingParameters.iterations}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, iterations: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Number of fitting iterations</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Step Size</label>
                        <span className="text-xs font-mono text-primary">{(fittingParameters.stepSize * 100).toFixed(0)}%</span>
                      </div>
                      <RangeInput
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={fittingParameters.stepSize}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, stepSize: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Movement per iteration</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Smoothing Radius</label>
                        <span className="text-xs font-mono text-primary">{fittingParameters.smoothingRadius.toFixed(2)}</span>
                      </div>
                      <RangeInput
                        min="0.1"
                        max="2.0"
                        step="0.1"
                        value={fittingParameters.smoothingRadius}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, smoothingRadius: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Gaussian smoothing range</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Smoothing Strength</label>
                        <span className="text-xs font-mono text-primary">{(fittingParameters.smoothingStrength * 100).toFixed(0)}%</span>
                      </div>
                      <RangeInput
                        min="0"
                        max="1"
                        step="0.1"
                        value={fittingParameters.smoothingStrength}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, smoothingStrength: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Influence on neighbors</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Target Offset</label>
                        <span className="text-xs font-mono text-primary">{(fittingParameters.targetOffset * 100).toFixed(1)}cm</span>
                      </div>
                      <RangeInput
                        min="0"
                        max="0.1"
                        step="0.005"
                        value={fittingParameters.targetOffset}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, targetOffset: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Distance from surface</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Sample Rate</label>
                        <span className="text-xs font-mono text-primary">{(fittingParameters.sampleRate! * 100).toFixed(0)}%</span>
                      </div>
                      <RangeInput
                        min="0.1"
                        max="1.0"
                        step="0.1"
                        value={fittingParameters.sampleRate || 0.5}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, sampleRate: Number(e.target.value) })}
                      />
                      <p className="text-xs text-text-tertiary">Vertices processed per iteration</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Preserve Features</label>
                        <input
                          type="checkbox"
                          checked={fittingParameters.preserveFeatures}
                          onChange={(e) => updateFittingParameters({ ...fittingParameters, preserveFeatures: e.target.checked })}
                          className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                        />
                      </div>
                      <p className="text-xs text-text-tertiary">
                        Preserve sharp edges and flat surfaces during smoothing
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-text-primary">Improved Shrinkwrap</label>
                        <input
                          type="checkbox"
                          checked={fittingParameters.useImprovedShrinkwrap}
                          onChange={(e) => updateFittingParameters({ ...fittingParameters, useImprovedShrinkwrap: e.target.checked })}
                          className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                        />
                      </div>
                      <p className="text-xs text-text-tertiary">
                        Use improved shrinkwrap algorithm with surface relaxation
                      </p>
                    </div>

                    {viewMode === 'avatarArmor' && (
                      <>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-text-primary">Show Body Hull</label>
                            <input
                              type="checkbox"
                              checked={showHull}
                              onChange={(e) => setShowHull(e.target.checked)}
                              className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-text-tertiary">
                            Display the extracted body hull during armor fitting
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-text-primary">Armor Wireframe</label>
                            <input
                              type="checkbox"
                              checked={showWireframe}
                              onChange={(e) => setShowWireframe(e.target.checked)}
                              className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-text-tertiary">
                            Toggle wireframe display for armor mesh
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-text-primary">Preserve Openings</label>
                            <input
                              type="checkbox"
                              checked={fittingParameters.preserveOpenings}
                              onChange={(e) => updateFittingParameters({ ...fittingParameters, preserveOpenings: e.target.checked })}
                              className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-text-tertiary">
                            Lock vertices around neck and arm regions to preserve armor openings
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-text-primary">Push Interior Vertices</label>
                            <input
                              type="checkbox"
                              checked={fittingParameters.pushInteriorVertices}
                              onChange={(e) => updateFittingParameters({ ...fittingParameters, pushInteriorVertices: e.target.checked })}
                              className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                            />
                          </div>
                          <p className="text-xs text-text-tertiary">
                            Restore vertices that end up inside the avatar back to their pre-shrinkwrap positions
                          </p>
                        </div>

                        <div className="space-y-2 border-t border-white/10 pt-4 mt-4">
                          <h4 className="text-sm font-semibold text-primary">Debug Visualization</h4>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-sm font-medium text-text-primary">Show Debug Arrows</label>
                              <input
                                type="checkbox"
                                checked={fittingParameters.showDebugArrows}
                                onChange={(e) => updateFittingParameters({ ...fittingParameters, showDebugArrows: e.target.checked })}
                                className="w-4 h-4 text-primary focus:ring-primary border-white/10 rounded-sm cursor-pointer"
                              />
                            </div>
                            <p className="text-xs text-text-tertiary">
                              Display arrows showing vertex movement direction and magnitude
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Arrow Density</label>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-text-secondary">All</span>
                              <RangeInput
                                min="1"
                                max="20"
                                step="1"
                                value={fittingParameters.debugArrowDensity || 10}
                                onChange={(e) => updateFittingParameters({ ...fittingParameters, debugArrowDensity: parseInt(e.target.value) })}
                                disabled={!fittingParameters.showDebugArrows}
                              />
                              <span className="text-xs text-text-secondary">1/{fittingParameters.debugArrowDensity || 10}</span>
                            </div>
                            <p className="text-xs text-text-tertiary">
                              Show every Nth vertex (lower = more arrows)
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">Color Mode</label>
                            <select
                              value={fittingParameters.debugColorMode || 'direction'}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateFittingParameters({ ...fittingParameters, debugColorMode: e.target.value as 'direction' | 'magnitude' | 'sidedness' })}
                              disabled={!fittingParameters.showDebugArrows}
                              className={`${selectClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              <option value="direction">Movement Direction</option>
                              <option value="magnitude">Movement Magnitude</option>
                              <option value="sidedness">Vertex Sidedness</option>
                            </select>
                            <p className="text-xs text-text-tertiary">
                              How to color-code the debug visualization
                            </p>
                          </div>

                          {fittingParameters.showDebugArrows && (
                            <div className="space-y-2 mt-4 p-3 bg-white/5 rounded-lg">
                              <h5 className="text-xs font-semibold text-text-primary mb-2">Arrow Color Legend</h5>
                              {fittingParameters.debugColorMode === 'direction' ? (
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Forward (bad for back vertices)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Backward (good for back vertices)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Up/Down</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Sideways</span>
                                  </div>
                                </div>
                              ) : fittingParameters.debugColorMode === 'magnitude' ? (
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Small movement</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Medium movement</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Large movement</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1 text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Front vertices</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Back vertices</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Left side vertices</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div>
                                    <span className="text-text-secondary">Right side vertices</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {fittingParameters.preserveFeatures && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-sm font-medium text-text-primary">Feature Angle</label>
                          <span className="text-xs font-mono text-primary">{fittingParameters.featureAngleThreshold}°</span>
                        </div>
                        <RangeInput
                          min="10"
                          max="90"
                          step="5"
                          value={fittingParameters.featureAngleThreshold}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFittingParameters({ ...fittingParameters, featureAngleThreshold: Number(e.target.value) })}
                        />
                        <p className="text-xs text-text-tertiary">Angle threshold for edge detection</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10">
                    <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Algorithm Info</h4>
                    <p className="text-xs text-text-tertiary leading-relaxed">
                      This debugger demonstrates the iterative mesh fitting algorithm.
                      The algorithm samples vertices, raycasts to find the target surface,
                      then gradually moves vertices with gaussian smoothing applied to neighbors.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MeshFittingDebugger