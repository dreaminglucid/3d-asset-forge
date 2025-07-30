import * as THREE from 'three'
import { Vector3, Mesh, SkinnedMesh, BufferGeometry, BufferAttribute, Raycaster } from 'three'
import { BodyHullExtractionService, BodyHullResult } from '../deformation/BodyHullExtractionService'
import { SmoothMeshDeformationService, DeformationParameters } from '../deformation/SmoothMeshDeformationService'

export interface HullFittingParameters {
  targetOffset: number // Distance to maintain from hull surface (e.g., 0.02m)
  iterations: number
  stepSize: number // 0-1, how much to move per iteration
  smoothInfluence: number // Edge connections for smoothing (e.g., 5)
  smoothStrength: number // Gaussian smoothing strength
  maxDisplacement: number // Max displacement per iteration
  preserveVolume: boolean
  maintainPosition: boolean // Keep armor centered after fitting
}

export class HullBasedFittingService {
  private hullService = new BodyHullExtractionService()
  private smoothDeformService = new SmoothMeshDeformationService()
  private raycaster = new Raycaster()
  
  /**
   * Fit armor to body hull with smooth deformation
   */
  async fitArmorToBodyHull(
    armorMesh: Mesh,
    avatarMesh: SkinnedMesh,
    parameters: HullFittingParameters
  ): Promise<void> {
    console.log('🎯 HullBasedFittingService: Starting hull-based fitting')
    
    // Step 1: Extract body hull
    const bodyHull = this.hullService.extractTorsoHull(avatarMesh)
    if (!bodyHull) {
      console.error('❌ HullBasedFittingService: Failed to extract body hull')
      return
    }
    
    console.log(`🎯 HullBasedFittingService: Body hull has ${bodyHull.vertices.length} vertices`)
    
    // Store initial armor position for restoration
    const initialArmorPosition = armorMesh.position.clone()
    const armorBounds = new THREE.Box3().setFromObject(armorMesh)
    const initialArmorCenter = armorBounds.getCenter(new Vector3())
    
    // Step 2: Log current position but don't reposition
    // The armor should already be positioned correctly by the bounding box fit
    const hullCenter = bodyHull.center
    const currentArmorCenter = armorBounds.getCenter(new Vector3())
    const distanceFromHull = currentArmorCenter.distanceTo(hullCenter)
    
    console.log('🎯 HullBasedFittingService: Initial armor position:', 
      armorMesh.position.x.toFixed(3), 
      armorMesh.position.y.toFixed(3), 
      armorMesh.position.z.toFixed(3))
    console.log('🎯 HullBasedFittingService: Armor center:', 
      currentArmorCenter.x.toFixed(3), 
      currentArmorCenter.y.toFixed(3), 
      currentArmorCenter.z.toFixed(3))
    console.log('🎯 HullBasedFittingService: Hull center:', 
      hullCenter.x.toFixed(3), 
      hullCenter.y.toFixed(3), 
      hullCenter.z.toFixed(3))
    console.log('🎯 HullBasedFittingService: Distance from hull center:', distanceFromHull.toFixed(3))
    
    // Don't reposition - trust the bounding box fit positioning
    
    // Step 3: Precompute connectivity for smooth deformation
    const armorGeometry = armorMesh.geometry as BufferGeometry
    this.smoothDeformService.precomputeConnectivity(armorGeometry, parameters.smoothInfluence)
    
    // Step 4: Iterative shrinkwrap fitting
    const position = armorGeometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    // Add hull mesh to scene temporarily for raycasting
    const tempScene = new THREE.Scene()
    tempScene.add(bodyHull.mesh)
    bodyHull.mesh.updateMatrixWorld(true)
    
    for (let iteration = 0; iteration < parameters.iterations; iteration++) {
      console.log(`🎯 HullBasedFittingService: Iteration ${iteration + 1}/${parameters.iterations}`)
      
      const displacements = new Map<number, Vector3>()
      let totalDisplacement = 0
      let displacedVertices = 0
      
      // For each armor vertex
      for (let i = 0; i < vertexCount; i++) {
        const vertex = new Vector3()
        vertex.fromBufferAttribute(position, i)
        vertex.applyMatrix4(armorMesh.matrixWorld) // To world space
        
        // Find nearest point on hull surface
        const toHullCenter = bodyHull.center.clone().sub(vertex).normalize()
        
        // Cast ray toward hull center
        this.raycaster.set(vertex, toHullCenter)
        this.raycaster.near = 0
        this.raycaster.far = vertex.distanceTo(bodyHull.center) * 2
        
        const intersections = this.raycaster.intersectObject(bodyHull.mesh, false)
        
        if (intersections.length > 0) {
          const hitPoint = intersections[0].point
          const hitNormal = intersections[0].face!.normal.clone()
          hitNormal.transformDirection(bodyHull.mesh.matrixWorld)
          
          // Calculate desired position (with offset from surface)
          const desiredPosition = hitPoint.clone().add(
            hitNormal.multiplyScalar(parameters.targetOffset)
          )
          
          // Calculate displacement
          const displacement = desiredPosition.clone().sub(vertex)
          const distance = displacement.length()
          
          if (distance > 0.001) {
            // Apply step size
            displacement.multiplyScalar(parameters.stepSize)
            
            // Transform to local space
            const localDisplacement = displacement.clone()
            const inverseMatrix = armorMesh.matrixWorld.clone().invert()
            localDisplacement.transformDirection(inverseMatrix)
            
            displacements.set(i, localDisplacement)
            totalDisplacement += distance
            displacedVertices++
          }
        } else {
          // Try reverse ray from hull
          const reverseRay = toHullCenter.clone().negate()
          this.raycaster.set(vertex, reverseRay)
          this.raycaster.far = 1.0 // Look behind up to 1m
          
          const backIntersections = this.raycaster.intersectObject(bodyHull.mesh, false)
          
          if (backIntersections.length > 0) {
            // Vertex is inside hull - push it out
            const hitPoint = backIntersections[0].point
            const hitNormal = backIntersections[0].face!.normal.clone()
            hitNormal.transformDirection(bodyHull.mesh.matrixWorld)
            hitNormal.negate() // Flip normal since we hit from inside
            
            const desiredPosition = hitPoint.clone().add(
              hitNormal.multiplyScalar(parameters.targetOffset)
            )
            
            const displacement = desiredPosition.clone().sub(vertex)
            displacement.multiplyScalar(parameters.stepSize * 2) // Move faster when inside
            
            const localDisplacement = displacement.clone()
            const inverseMatrix = armorMesh.matrixWorld.clone().invert()
            localDisplacement.transformDirection(inverseMatrix)
            
            displacements.set(i, localDisplacement)
            totalDisplacement += displacement.length()
            displacedVertices++
          }
        }
      }
      
      console.log(`  Displaced ${displacedVertices} vertices, avg displacement: ${(totalDisplacement / displacedVertices).toFixed(4)}`)
      
      // Apply smooth deformation
      const deformParams: DeformationParameters = {
        influenceRadius: parameters.smoothInfluence,
        gaussianSigma: 0, // Computed automatically
        maxDisplacement: parameters.maxDisplacement,
        preserveVolume: parameters.preserveVolume
      }
      
      this.smoothDeformService.applySmoothedDeformation(armorMesh, displacements, deformParams)
      armorMesh.updateMatrixWorld(true)
      
      // Early exit if converged
      if (totalDisplacement / displacedVertices < 0.001) {
        console.log('🎯 HullBasedFittingService: Converged early')
        break
      }
    }
    
    // Step 5: Restore position if requested
    if (parameters.maintainPosition) {
      // Restore the armor to its initial position
      // The deformation should have happened in place, so we just need to ensure
      // the armor stays where it was initially positioned (by bounding box fit)
      armorMesh.position.copy(initialArmorPosition)
      armorMesh.updateMatrixWorld(true)
      
      console.log('🎯 HullBasedFittingService: Restored initial position:', 
        initialArmorPosition.x.toFixed(3), 
        initialArmorPosition.y.toFixed(3), 
        initialArmorPosition.z.toFixed(3))
    }
    
    // Clean up
    tempScene.remove(bodyHull.mesh)
    bodyHull.mesh.geometry.dispose()
    this.smoothDeformService.clearConnectivity()
    
    console.log('🎯 HullBasedFittingService: Fitting complete')
  }
  
  /**
   * Visualize the body hull for debugging
   */
  createHullVisualization(avatarMesh: SkinnedMesh): Mesh | null {
    const bodyHull = this.hullService.extractTorsoHull(avatarMesh)
    if (!bodyHull) return null
    
    // Change material for better visualization
    bodyHull.mesh.material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    })
    
    return bodyHull.mesh
  }
} 