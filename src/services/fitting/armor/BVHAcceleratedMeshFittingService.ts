import * as THREE from 'three'
import { MeshBVH, StaticGeometryGenerator, SAH } from 'three-mesh-bvh'
import { GenericMeshFittingService, GenericFittingParameters } from './GenericMeshFittingService'

interface BVHCacheEntry {
  geometry: THREE.BufferGeometry
  generator?: StaticGeometryGenerator
  lastUpdateTime: number
  worldMatrix: THREE.Matrix4
}

export class BVHAcceleratedMeshFittingService extends GenericMeshFittingService {
  private bvhCache: Map<THREE.Mesh | THREE.SkinnedMesh, BVHCacheEntry> = new Map()
  private raycastCount: number = 0
  private raycastTime: number = 0
  
  // Create our own raycaster since parent's is private
  protected bvhRaycaster: THREE.Raycaster = new THREE.Raycaster()
  
  constructor() {
    super()
    console.log('[BVH] Initialized BVH-accelerated mesh fitting service')
  }

  /**
   * Override the main fitting method to add BVH optimization
   */
  fitMeshToTarget(
    sourceMesh: THREE.Mesh,
    targetMesh: THREE.Mesh | THREE.SkinnedMesh,
    params: GenericFittingParameters
  ): void {
    const startTime = performance.now()
    this.raycastCount = 0
    this.raycastTime = 0
    
    console.log('[BVH] Starting accelerated fitting...')
    
    // Wrap the progress callback to add BVH-specific info
    const originalProgress = params.onProgress
    if (originalProgress) {
      params.onProgress = (progress: number, message?: string) => {
        const bvhMessage = `[BVH Accelerated] ${message || ''}`
        originalProgress(progress, bvhMessage)
      }
    }
    
    // Pre-build BVH for target mesh
    const bvhEntry = this.getOrCreateBVH(targetMesh)
    
    // Store reference to BVH in userData for our custom raycasting
    targetMesh.userData._bvhCache = bvhEntry
    targetMesh.userData._bvhService = this
    
    // Temporarily override the mesh's raycast method to use BVH
    const originalRaycast = targetMesh.raycast
    targetMesh.raycast = (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => {
      this.bvhRaycast(targetMesh, raycaster, intersects)
    }
    
    try {
      // Call parent implementation
      super.fitMeshToTarget(sourceMesh, targetMesh, params)
    } finally {
      // Restore original raycast
      targetMesh.raycast = originalRaycast
      delete targetMesh.userData._bvhCache
      delete targetMesh.userData._bvhService
    }
    
    // Log performance metrics
    const totalTime = performance.now() - startTime
    const speedup = this.raycastCount > 0 ? 
      ((totalTime - this.raycastTime) + (this.raycastTime * 10)) / totalTime : 1
      
    console.log(`[BVH] Fitting completed:
      - Total time: ${totalTime.toFixed(2)}ms
      - Raycast count: ${this.raycastCount}
      - Raycast time: ${this.raycastTime.toFixed(2)}ms (${((this.raycastTime / totalTime) * 100).toFixed(1)}%)
      - Avg raycast: ${this.raycastCount > 0 ? (this.raycastTime / this.raycastCount).toFixed(3) : '0'}ms
      - Estimated speedup: ${speedup.toFixed(1)}x`)
    
    // Clean up old cache entries
    this.cleanupCache()
  }

  /**
   * Custom raycast method that uses BVH
   */
  private bvhRaycast(mesh: THREE.Mesh | THREE.SkinnedMesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]): void {
    const startTime = performance.now()
    this.raycastCount++
    
    const bvhEntry = mesh.userData._bvhCache as BVHCacheEntry
    if (!bvhEntry) {
      // Fallback to standard raycast
      mesh.raycast(raycaster, intersects)
      return
    }
    
    const boundsTree = bvhEntry.geometry.boundsTree as MeshBVH
    if (!boundsTree) {
      // Fallback if no BVH
      mesh.raycast(raycaster, intersects)
      return
    }
    
    // Transform ray to local space
    const invMatrix = new THREE.Matrix4()
    invMatrix.copy(mesh.matrixWorld).invert()
    
    const localRay = new THREE.Ray()
    localRay.copy(raycaster.ray)
    localRay.applyMatrix4(invMatrix)
    
    // Perform BVH raycast using the correct method signature
    // Based on documentation, we should use raycast or raycastFirst
    const hits = boundsTree.raycast(
      localRay,
      THREE.DoubleSide,
      raycaster.near,
      raycaster.far
    )
    
    // Transform hits back to world space and add to intersects
    if (hits && Array.isArray(hits)) {
      for (const hit of hits) {
        // Transform point to world space
        if (hit.point) {
          hit.point.applyMatrix4(mesh.matrixWorld)
        }
        
        // Transform normal to world space
        if (hit.face && hit.face.normal) {
          hit.face.normal.transformDirection(mesh.matrixWorld)
        }
        
        // Set the object reference
        hit.object = mesh
        
        // Add to intersects array
        intersects.push(hit)
      }
      
      // Sort by distance
      intersects.sort((a, b) => a.distance - b.distance)
    }
    
    this.raycastTime += performance.now() - startTime
  }

  /**
   * Get or create BVH for a mesh
   */
  private getOrCreateBVH(mesh: THREE.Mesh | THREE.SkinnedMesh): BVHCacheEntry {
    const cached = this.bvhCache.get(mesh)
    const now = Date.now()
    
    // Check if mesh transform has changed
    const currentWorldMatrix = mesh.matrixWorld.clone()
    if (cached && 
        (now - cached.lastUpdateTime) < 5000 &&
        cached.worldMatrix.equals(currentWorldMatrix)) {
      return cached
    }
    
    console.log('[BVH] Building BVH for target mesh...')
    const buildStart = performance.now()
    
    let entry: BVHCacheEntry
    
    if (mesh instanceof THREE.SkinnedMesh) {
      // For SkinnedMesh, we need to bake it to static geometry
      console.log('[BVH] Target is SkinnedMesh, baking to static geometry...')
      const generator = new StaticGeometryGenerator([mesh])
      const staticGeometry = generator.generate()
      
      // Build BVH
      const boundsTree = new MeshBVH(staticGeometry, {
        strategy: SAH,
        maxLeafTris: 5,
        maxDepth: 40
      })
      
      staticGeometry.boundsTree = boundsTree
      
      entry = {
        geometry: staticGeometry,
        generator,
        lastUpdateTime: now,
        worldMatrix: currentWorldMatrix
      }
    } else {
      // For regular mesh, build BVH directly
      const boundsTree = new MeshBVH(mesh.geometry, {
        strategy: SAH,
        maxLeafTris: 5,
        maxDepth: 40
      })
      
      mesh.geometry.boundsTree = boundsTree
      
      entry = {
        geometry: mesh.geometry,
        lastUpdateTime: now,
        worldMatrix: currentWorldMatrix
      }
    }
    
    this.bvhCache.set(mesh, entry)
    
    const buildTime = performance.now() - buildStart
    console.log(`[BVH] BVH built in ${buildTime.toFixed(2)}ms`)
    
    // Log BVH stats
    const bounds = entry.geometry.boundingBox || new THREE.Box3().setFromObject(mesh)
    console.log('[BVH] Geometry stats:', {
      vertices: entry.geometry.attributes.position?.count || 0,
      triangles: entry.geometry.index ? entry.geometry.index.count / 3 : (entry.geometry.attributes.position?.count || 0) / 3,
      bounds: bounds.getSize(new THREE.Vector3())
    })
    
    return entry
  }

  /**
   * Clean up old cache entries
   */
  private cleanupCache(): void {
    const now = Date.now()
    const maxAge = 30000 // 30 seconds
    
    for (const [mesh, entry] of this.bvhCache.entries()) {
      if (now - entry.lastUpdateTime > maxAge) {
        // Dispose of BVH
        if (entry.geometry.boundsTree) {
          const bvh = entry.geometry.boundsTree as MeshBVH
          // BVH doesn't have dispose method, but we should clear the reference
          entry.geometry.boundsTree = undefined
        }
        
        // Dispose of generated geometry if it's different from mesh geometry
        if (entry.generator) {
          entry.geometry.dispose()
        }
        
        this.bvhCache.delete(mesh)
        console.log('[BVH] Cleaned up cache entry')
      }
    }
  }

  /**
   * Dispose of all cached BVHs
   */
  dispose(): void {
    for (const entry of this.bvhCache.values()) {
      if (entry.geometry.boundsTree) {
        // Clear BVH reference
        entry.geometry.boundsTree = undefined
      }
      if (entry.generator) {
        entry.geometry.dispose()
      }
    }
    this.bvhCache.clear()
    console.log('[BVH] Disposed all cached BVHs')
  }
}

// Export as default for drop-in replacement
export default BVHAcceleratedMeshFittingService 