import * as THREE from 'three'
import { Vector3, BufferGeometry, BufferAttribute, Mesh } from 'three'

export interface VertexConnection {
  index: number
  distance: number
  weight: number
  level: number // How many edges away
}

export interface VertexConnectivity {
  vertex: number
  connections: VertexConnection[]
  maxDistance: number
}

export interface DeformationParameters {
  influenceRadius: number // In edge connections (e.g., 5)
  gaussianSigma: number // Controls falloff
  maxDisplacement: number // Maximum displacement per iteration
  preserveVolume: boolean
}

export class SmoothMeshDeformationService {
  private connectivity: Map<number, VertexConnectivity> = new Map()
  
  /**
   * Precompute vertex connectivity for smooth deformation
   * @param geometry - The mesh geometry
   * @param maxLevels - Maximum edge distance to consider (default 5)
   */
  precomputeConnectivity(geometry: BufferGeometry, maxLevels: number = 5): void {
    console.log('🎯 SmoothMeshDeformationService: Computing vertex connectivity...')
    
    const position = geometry.attributes.position as BufferAttribute
    const vertexCount = position.count
    
    // First, build adjacency list from triangles
    const adjacency = new Map<number, Set<number>>()
    
    // Initialize adjacency lists
    for (let i = 0; i < vertexCount; i++) {
      adjacency.set(i, new Set<number>())
    }
    
    // Build adjacency from indices
    if (geometry.index) {
      const indices = geometry.index.array
      for (let i = 0; i < indices.length; i += 3) {
        const v0 = indices[i]
        const v1 = indices[i + 1]
        const v2 = indices[i + 2]
        
        // Add bidirectional edges
        adjacency.get(v0)!.add(v1)
        adjacency.get(v0)!.add(v2)
        adjacency.get(v1)!.add(v0)
        adjacency.get(v1)!.add(v2)
        adjacency.get(v2)!.add(v0)
        adjacency.get(v2)!.add(v1)
      }
    } else {
      // Non-indexed geometry - assume triangle soup
      for (let i = 0; i < vertexCount; i += 3) {
        adjacency.get(i)!.add(i + 1)
        adjacency.get(i)!.add(i + 2)
        adjacency.get(i + 1)!.add(i)
        adjacency.get(i + 1)!.add(i + 2)
        adjacency.get(i + 2)!.add(i)
        adjacency.get(i + 2)!.add(i + 1)
      }
    }
    
    // Now compute multi-level connectivity using BFS
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const connections: VertexConnection[] = []
      const visited = new Set<number>()
      const queue: Array<{index: number, level: number}> = []
      
      // Start BFS from current vertex
      queue.push({index: vertexIndex, level: 0})
      visited.add(vertexIndex)
      
      const vertexPos = new Vector3()
      vertexPos.fromBufferAttribute(position, vertexIndex)
      
      while (queue.length > 0) {
        const {index: currentIndex, level} = queue.shift()!
        
        if (level > maxLevels) continue
        
        // Add to connections if not the starting vertex
        if (currentIndex !== vertexIndex) {
          const connectedPos = new Vector3()
          connectedPos.fromBufferAttribute(position, currentIndex)
          
          const distance = vertexPos.distanceTo(connectedPos)
          
          connections.push({
            index: currentIndex,
            distance,
            weight: 0, // Will be computed later
            level
          })
        }
        
        // Add neighbors to queue
        const neighbors = adjacency.get(currentIndex)!
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push({index: neighbor, level: level + 1})
          }
        }
      }
      
      // Compute Gaussian weights based on distance
      const maxDistance = Math.max(...connections.map(c => c.distance))
      
      // Compute sigma based on wanting ~5% at max distance
      // For Gaussian: exp(-d²/2σ²) = 0.05 when d = maxDistance
      // -d²/2σ² = ln(0.05) ≈ -3
      // σ² = d²/6
      // σ = d/√6 ≈ d/2.45
      const sigma = maxDistance / 2.45
      
      // Apply Gaussian weights
      connections.forEach(conn => {
        conn.weight = Math.exp(-(conn.distance * conn.distance) / (2 * sigma * sigma))
      })
      
      // Normalize weights
      const totalWeight = connections.reduce((sum, c) => sum + c.weight, 0)
      if (totalWeight > 0) {
        connections.forEach(conn => {
          conn.weight /= totalWeight
        })
      }
      
      this.connectivity.set(vertexIndex, {
        vertex: vertexIndex,
        connections,
        maxDistance
      })
    }
    
    console.log(`🎯 SmoothMeshDeformationService: Computed connectivity for ${vertexCount} vertices`)
  }
  
  /**
   * Apply smooth deformation to mesh
   * @param mesh - The mesh to deform
   * @param displacements - Map of vertex index to displacement vector
   * @param parameters - Deformation parameters
   */
  applySmoothedDeformation(
    mesh: Mesh,
    displacements: Map<number, Vector3>,
    parameters: DeformationParameters
  ): void {
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const positions = position.array as Float32Array
    
    // If connectivity not computed, compute it now
    if (this.connectivity.size === 0) {
      this.precomputeConnectivity(geometry, parameters.influenceRadius)
    }
    
    // Create smoothed displacements
    const smoothedDisplacements = new Map<number, Vector3>()
    
    // For each vertex with a displacement
    displacements.forEach((displacement, vertexIndex) => {
      const connectivity = this.connectivity.get(vertexIndex)
      if (!connectivity) return
      
      // Apply displacement to connected vertices with Gaussian falloff
      connectivity.connections.forEach(conn => {
        if (!smoothedDisplacements.has(conn.index)) {
          smoothedDisplacements.set(conn.index, new Vector3())
        }
        
        // Add weighted contribution
        const contribution = displacement.clone().multiplyScalar(conn.weight)
        smoothedDisplacements.get(conn.index)!.add(contribution)
      })
      
      // Also apply to the vertex itself
      if (!smoothedDisplacements.has(vertexIndex)) {
        smoothedDisplacements.set(vertexIndex, displacement.clone())
      } else {
        smoothedDisplacements.get(vertexIndex)!.add(displacement)
      }
    })
    
    // Apply smoothed displacements
    smoothedDisplacements.forEach((displacement, vertexIndex) => {
      // Limit displacement magnitude
      if (displacement.length() > parameters.maxDisplacement) {
        displacement.normalize().multiplyScalar(parameters.maxDisplacement)
      }
      
      positions[vertexIndex * 3] += displacement.x
      positions[vertexIndex * 3 + 1] += displacement.y
      positions[vertexIndex * 3 + 2] += displacement.z
    })
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
    
    // Volume preservation (optional)
    if (parameters.preserveVolume) {
      this.preserveVolume(mesh)
    }
  }
  
  /**
   * Compute mesh volume using divergence theorem
   */
  private computeVolume(mesh: Mesh): number {
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    let volume = 0
    
    if (geometry.index) {
      const indices = geometry.index.array
      for (let i = 0; i < indices.length; i += 3) {
        const v0 = new Vector3().fromBufferAttribute(position, indices[i])
        const v1 = new Vector3().fromBufferAttribute(position, indices[i + 1])
        const v2 = new Vector3().fromBufferAttribute(position, indices[i + 2])
        
        // Signed volume of tetrahedron with origin
        volume += v0.dot(v1.cross(v2)) / 6
      }
    }
    
    return Math.abs(volume)
  }
  
  /**
   * Scale mesh to preserve volume
   */
  private preserveVolume(mesh: Mesh): void {
    const currentVolume = this.computeVolume(mesh)
    
    if (!mesh.userData.originalVolume) {
      mesh.userData.originalVolume = currentVolume
      return
    }
    
    const targetVolume = mesh.userData.originalVolume
    const scaleFactor = Math.pow(targetVolume / currentVolume, 1/3)
    
    // Apply uniform scale to preserve volume
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const positions = position.array as Float32Array
    
    // Get center of mass
    const center = new Vector3()
    const bounds = geometry.boundingBox || geometry.computeBoundingBox()
    bounds!.getCenter(center)
    
    // Scale around center
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      )
      
      vertex.sub(center).multiplyScalar(scaleFactor).add(center)
      
      positions[i * 3] = vertex.x
      positions[i * 3 + 1] = vertex.y
      positions[i * 3 + 2] = vertex.z
    }
    
    position.needsUpdate = true
  }
  
  /**
   * Clear precomputed connectivity data
   */
  clearConnectivity(): void {
    this.connectivity.clear()
  }
} 