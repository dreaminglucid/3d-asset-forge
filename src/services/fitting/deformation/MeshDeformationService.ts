import * as THREE from 'three'
import { Vector3, Mesh, BufferGeometry, BufferAttribute, Matrix4 } from 'three'

export interface ControlPoint {
  source: Vector3
  target: Vector3
  weight?: number
}

export interface DeformationOptions {
  preserveVolume: boolean
  stiffness: number // 0-1, higher = more rigid
  influence: number // radius of influence for control points
}

export class MeshDeformationService {
  /**
   * Apply Radial Basis Function (RBF) deformation
   */
  applyRBFDeformation(
    mesh: Mesh,
    controlPoints: ControlPoint[],
    options: Partial<DeformationOptions> = {}
  ): void {
    const opts: DeformationOptions = {
      preserveVolume: true,
      stiffness: 0.7,
      influence: 0.5,
      ...options
    }
    
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    
    // Compute RBF weights
    const rbfWeights = this.computeRBFWeights(controlPoints)
    
    // Apply deformation to each vertex
    const newPositions: number[] = []
    
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Compute RBF interpolation
      const displacement = this.evaluateRBF(vertex, controlPoints, rbfWeights, opts.influence)
      
      // Apply stiffness factor
      displacement.multiplyScalar(1.0 - opts.stiffness * 0.5)
      
      // Apply displacement
      vertex.add(displacement)
      
      newPositions.push(vertex.x, vertex.y, vertex.z)
    }
    
    // Update positions
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(i, newPositions[i * 3], newPositions[i * 3 + 1], newPositions[i * 3 + 2])
    }
    
    // Preserve volume if requested
    if (opts.preserveVolume) {
      this.preserveVolume(geometry)
    }
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }
  
  /**
   * Compute RBF weights using matrix inversion
   */
  private computeRBFWeights(controlPoints: ControlPoint[]): number[][] {
    const n = controlPoints.length
    const matrix: number[][] = []
    const rhs: Vector3[] = []
    
    // Build RBF matrix
    for (let i = 0; i < n; i++) {
      matrix[i] = []
      for (let j = 0; j < n; j++) {
        const distance = controlPoints[i].source.distanceTo(controlPoints[j].source)
        matrix[i][j] = this.rbfKernel(distance)
      }
      
      // Right hand side - displacement vectors
      rhs[i] = controlPoints[i].target.clone().sub(controlPoints[i].source)
    }
    
    // Solve linear system (simplified - in production use proper linear algebra library)
    const weights = this.solveLinearSystem(matrix, rhs)
    
    return weights
  }
  
  /**
   * RBF kernel function (using thin plate spline)
   */
  private rbfKernel(r: number): number {
    if (r === 0) return 0
    return r * r * Math.log(r)
  }
  
  /**
   * Evaluate RBF at a point
   */
  private evaluateRBF(
    point: Vector3,
    controlPoints: ControlPoint[],
    weights: number[][],
    influence: number
  ): Vector3 {
    const displacement = new Vector3()
    
    for (let i = 0; i < controlPoints.length; i++) {
      const distance = point.distanceTo(controlPoints[i].source)
      
      // Apply influence radius
      if (distance > influence) continue
      
      const kernel = this.rbfKernel(distance)
      const falloff = 1.0 - (distance / influence)
      
      // Apply weighted displacement
      displacement.x += weights[i][0] * kernel * falloff
      displacement.y += weights[i][1] * kernel * falloff
      displacement.z += weights[i][2] * kernel * falloff
    }
    
    return displacement
  }
  
  /**
   * Simplified linear system solver (for small systems)
   */
  private solveLinearSystem(matrix: number[][], rhs: Vector3[]): number[][] {
    const n = matrix.length
    const result: number[][] = []
    
    // For each dimension (x, y, z)
    for (let dim = 0; dim < 3; dim++) {
      const b = rhs.map(v => [v.x, v.y, v.z][dim])
      const x = this.gaussianElimination(matrix, b)
      
      for (let i = 0; i < n; i++) {
        if (!result[i]) result[i] = []
        result[i][dim] = x[i]
      }
    }
    
    return result
  }
  
  /**
   * Gaussian elimination (simplified)
   */
  private gaussianElimination(A: number[][], b: number[]): number[] {
    const n = A.length
    const augmented: number[][] = []
    
    // Create augmented matrix
    for (let i = 0; i < n; i++) {
      augmented[i] = [...A[i], b[i]]
    }
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k
        }
      }
      
      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]
      
      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        const c = augmented[k][i] / augmented[i][i]
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= c * augmented[i][j]
        }
      }
    }
    
    // Back substitution
    const x = new Array(n).fill(0)
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n]
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j]
      }
      x[i] /= augmented[i][i]
    }
    
    return x
  }
  
  /**
   * Apply cage-based deformation
   */
  applyCageDeformation(
    mesh: Mesh,
    cageVertices: Vector3[],
    cageDisplacements: Vector3[]
  ): void {
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    
    // Compute mean value coordinates for each vertex
    const newPositions: number[] = []
    
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      // Compute weights using mean value coordinates
      const weights = this.computeMeanValueCoordinates(vertex, cageVertices)
      
      // Apply cage deformation
      const deformedVertex = new Vector3()
      for (let j = 0; j < cageVertices.length; j++) {
        const cagePoint = cageVertices[j].clone().add(cageDisplacements[j])
        deformedVertex.add(cagePoint.clone().multiplyScalar(weights[j]))
      }
      
      newPositions.push(deformedVertex.x, deformedVertex.y, deformedVertex.z)
    }
    
    // Update positions
    for (let i = 0; i < position.count; i++) {
      position.setXYZ(i, newPositions[i * 3], newPositions[i * 3 + 1], newPositions[i * 3 + 2])
    }
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  /**
   * Compute mean value coordinates
   */
  private computeMeanValueCoordinates(point: Vector3, cageVertices: Vector3[]): number[] {
    const n = cageVertices.length
    const weights = new Array(n).fill(0)
    let weightSum = 0
    
    for (let i = 0; i < n; i++) {
      const v0 = cageVertices[i]
      const v1 = cageVertices[(i + 1) % n]
      
      const d0 = point.distanceTo(v0)
      const d1 = point.distanceTo(v1)
      
      if (d0 < 0.0001) {
        weights[i] = 1
        return weights
      }
      
      const edge = v1.clone().sub(v0)
      const toPoint0 = v0.clone().sub(point)
      const toPoint1 = v1.clone().sub(point)
      
      const angle = toPoint0.angleTo(toPoint1)
      const weight = Math.tan(angle / 2) / d0
      
      weights[i] += weight
      weightSum += weight
    }
    
    // Normalize weights
    if (weightSum > 0) {
      for (let i = 0; i < n; i++) {
        weights[i] /= weightSum
      }
    }
    
    return weights
  }
  
  /**
   * Apply Laplacian smoothing
   */
  applyLaplacianSmoothing(
    mesh: Mesh,
    iterations: number = 1,
    lambda: number = 0.5
  ): void {
    const geometry = mesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    
    // Build vertex adjacency
    const neighbors = this.buildVertexNeighbors(geometry)
    
    for (let iter = 0; iter < iterations; iter++) {
      const newPositions: Vector3[] = []
      
      // Compute Laplacian for each vertex
      for (let i = 0; i < position.count; i++) {
        const vertex = new Vector3(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )
        
        const neighborIndices = neighbors.get(i) || []
        if (neighborIndices.length === 0) {
          newPositions.push(vertex)
          continue
        }
        
        // Compute average of neighbors
        const laplacian = new Vector3()
        neighborIndices.forEach(ni => {
          laplacian.add(new Vector3(
            position.getX(ni),
            position.getY(ni),
            position.getZ(ni)
          ))
        })
        laplacian.divideScalar(neighborIndices.length)
        
        // Apply smoothing
        vertex.lerp(laplacian, lambda)
        newPositions.push(vertex)
      }
      
      // Update positions
      for (let i = 0; i < position.count; i++) {
        position.setXYZ(i, newPositions[i].x, newPositions[i].y, newPositions[i].z)
      }
    }
    
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }
  
  /**
   * Build vertex adjacency map
   */
  private buildVertexNeighbors(geometry: BufferGeometry): Map<number, number[]> {
    const neighbors = new Map<number, Set<number>>()
    const index = geometry.index
    
    if (index) {
      // Indexed geometry
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i)
        const b = index.getX(i + 1)
        const c = index.getX(i + 2)
        
        // Add neighbors
        if (!neighbors.has(a)) neighbors.set(a, new Set())
        if (!neighbors.has(b)) neighbors.set(b, new Set())
        if (!neighbors.has(c)) neighbors.set(c, new Set())
        
        neighbors.get(a)!.add(b).add(c)
        neighbors.get(b)!.add(a).add(c)
        neighbors.get(c)!.add(a).add(b)
      }
    }
    
    // Convert sets to arrays
    const result = new Map<number, number[]>()
    neighbors.forEach((set, key) => {
      result.set(key, Array.from(set))
    })
    
    return result
  }
  
  /**
   * Preserve volume after deformation
   */
  private preserveVolume(geometry: BufferGeometry): void {
    // Compute current volume
    const currentVolume = this.computeMeshVolume(geometry)
    
    // Store original volume (assuming first call)
    if (!(geometry as any).originalVolume) {
      (geometry as any).originalVolume = currentVolume
    }
    
    const originalVolume = (geometry as any).originalVolume
    const scale = Math.cbrt(originalVolume / currentVolume)
    
    // Scale to preserve volume
    const position = geometry.attributes.position as BufferAttribute
    const center = new Vector3()
    
    // Compute center
    for (let i = 0; i < position.count; i++) {
      center.add(new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      ))
    }
    center.divideScalar(position.count)
    
    // Scale around center
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      
      vertex.sub(center).multiplyScalar(scale).add(center)
      position.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }
  }
  
  /**
   * Compute mesh volume using divergence theorem
   */
  private computeMeshVolume(geometry: BufferGeometry): number {
    const position = geometry.attributes.position as BufferAttribute
    const index = geometry.index
    let volume = 0
    
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = new Vector3(
          position.getX(index.getX(i)),
          position.getY(index.getX(i)),
          position.getZ(index.getX(i))
        )
        const b = new Vector3(
          position.getX(index.getX(i + 1)),
          position.getY(index.getX(i + 1)),
          position.getZ(index.getX(i + 1))
        )
        const c = new Vector3(
          position.getX(index.getX(i + 2)),
          position.getY(index.getX(i + 2)),
          position.getZ(index.getX(i + 2))
        )
        
        // Signed volume of tetrahedron
        volume += a.dot(b.clone().cross(c)) / 6
      }
    }
    
    return Math.abs(volume)
  }
} 
 
 