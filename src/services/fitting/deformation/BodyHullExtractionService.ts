import * as THREE from 'three'
import { Vector3, BufferGeometry, BufferAttribute, SkinnedMesh, Bone, Skeleton, Mesh, MeshBasicMaterial } from 'three'

export interface BodyHullResult {
  mesh: Mesh
  vertices: Vector3[]
  indices: number[]
  bounds: THREE.Box3
  center: Vector3
}

export class BodyHullExtractionService {
  /**
   * Extract body hull mesh from avatar based on bone weights
   * @param avatarMesh - The skinned mesh of the avatar
   * @param boneNames - Array of bone names to include (e.g., spine, chest bones)
   * @param weightThreshold - Minimum weight to include a vertex (0-1)
   */
  extractBodyHull(
    avatarMesh: SkinnedMesh,
    boneNames: string[],
    weightThreshold: number = 0.3
  ): BodyHullResult | null {
    console.log('🎯 BodyHullExtractionService: Extracting body hull for bones:', boneNames)
    
    const geometry = avatarMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    const skinIndex = geometry.attributes.skinIndex as BufferAttribute
    const skinWeight = geometry.attributes.skinWeight as BufferAttribute
    const skeleton = avatarMesh.skeleton
    
    if (!skeleton || !skinIndex || !skinWeight) {
      console.error('❌ BodyHullExtractionService: Missing skeleton or skin attributes')
      return null
    }
    
    // Find bone indices for the target bones
    const targetBoneIndices = new Set<number>()
    const boneMap = new Map<string, number>()
    
    skeleton.bones.forEach((bone, index) => {
      boneMap.set(bone.name, index)
      // Check if this bone name matches any of our targets
      if (boneNames.some(name => bone.name.includes(name))) {
        targetBoneIndices.add(index)
        console.log(`  Found bone: ${bone.name} at index ${index}`)
      }
    })
    
    if (targetBoneIndices.size === 0) {
      console.error('❌ BodyHullExtractionService: No matching bones found')
      return null
    }
    
    // Extract vertices that are influenced by target bones
    const hullVertices: Vector3[] = []
    const vertexIndices: number[] = []
    const vertexMap = new Map<number, number>() // original index -> hull index
    
    for (let i = 0; i < position.count; i++) {
      let totalWeight = 0
      
      // Check all 4 potential bone influences
      for (let j = 0; j < 4; j++) {
        const boneIndex = skinIndex.getComponent(i, j)
        const weight = skinWeight.getComponent(i, j)
        
        if (targetBoneIndices.has(boneIndex)) {
          totalWeight += weight
        }
      }
      
      // Include vertex if it has sufficient influence from target bones
      if (totalWeight >= weightThreshold) {
        const vertex = new Vector3()
        vertex.fromBufferAttribute(position, i)
        
        // Transform to world space
        vertex.applyMatrix4(avatarMesh.matrixWorld)
        
        const hullIndex = hullVertices.length
        hullVertices.push(vertex)
        vertexIndices.push(i)
        vertexMap.set(i, hullIndex)
      }
    }
    
    console.log(`🎯 BodyHullExtractionService: Extracted ${hullVertices.length} vertices from ${position.count} total`)
    
    if (hullVertices.length < 4) {
      console.error('❌ BodyHullExtractionService: Not enough vertices for hull')
      return null
    }
    
    // Create hull geometry
    const hullGeometry = new BufferGeometry()
    const hullPositions = new Float32Array(hullVertices.length * 3)
    
    hullVertices.forEach((vertex, i) => {
      hullPositions[i * 3] = vertex.x
      hullPositions[i * 3 + 1] = vertex.y
      hullPositions[i * 3 + 2] = vertex.z
    })
    
    hullGeometry.setAttribute('position', new BufferAttribute(hullPositions, 3))
    
    // Create indices if the original mesh had them
    if (geometry.index) {
      const originalIndices = geometry.index.array
      const hullIndices: number[] = []
      
      // Find triangles where all vertices are in the hull
      for (let i = 0; i < originalIndices.length; i += 3) {
        const v0 = originalIndices[i]
        const v1 = originalIndices[i + 1]
        const v2 = originalIndices[i + 2]
        
        if (vertexMap.has(v0) && vertexMap.has(v1) && vertexMap.has(v2)) {
          hullIndices.push(
            vertexMap.get(v0)!,
            vertexMap.get(v1)!,
            vertexMap.get(v2)!
          )
        }
      }
      
      if (hullIndices.length > 0) {
        hullGeometry.setIndex(hullIndices)
      }
    }
    
    // Compute normals
    hullGeometry.computeVertexNormals()
    
    // Calculate bounds and center
    const bounds = new THREE.Box3().setFromPoints(hullVertices)
    const center = bounds.getCenter(new Vector3())
    
    // Create mesh for visualization/computation
    const hullMesh = new Mesh(
      hullGeometry,
      new MeshBasicMaterial({ 
        color: 0xff0000, 
        transparent: true, 
        opacity: 0.3,
        side: THREE.DoubleSide 
      })
    )
    
    return {
      mesh: hullMesh,
      vertices: hullVertices,
      indices: vertexIndices,
      bounds,
      center
    }
  }
  
  /**
   * Extract torso-specific hull with proper bone filtering
   */
  extractTorsoHull(avatarMesh: SkinnedMesh): BodyHullResult | null {
    // Define torso bone patterns - be inclusive but exclude extremities
    const torsoBonePatterns = [
      'Spine', 'spine',
      'Chest', 'chest',
      'Torso', 'torso',
      'UpperChest', 'upperchest',
      'Abdomen', 'abdomen',
      'Waist', 'waist',
      'Ribcage', 'ribcage',
      'Spine01', 'Spine02', 'Spine03'
    ]
    
    // Bones to explicitly exclude
    const excludePatterns = [
      'Neck', 'neck',
      'Head', 'head',
      'Shoulder', 'shoulder',
      'Arm', 'arm',
      'Hand', 'hand',
      'Leg', 'leg',
      'Foot', 'foot',
      'Hip', 'hip', // Often includes leg connections
      'Thigh', 'thigh'
    ]
    
    // Get all bone names and filter
    const skeleton = avatarMesh.skeleton
    const torsoBones: string[] = []
    
    skeleton.bones.forEach(bone => {
      const boneName = bone.name
      
      // Check if it matches torso patterns
      const isTorso = torsoBonePatterns.some(pattern => 
        boneName.toLowerCase().includes(pattern.toLowerCase())
      )
      
      // Check if it should be excluded
      const isExcluded = excludePatterns.some(pattern => 
        boneName.toLowerCase().includes(pattern.toLowerCase())
      )
      
      if (isTorso && !isExcluded) {
        torsoBones.push(boneName)
      }
    })
    
    console.log('🎯 BodyHullExtractionService: Found torso bones:', torsoBones)
    
    return this.extractBodyHull(avatarMesh, torsoBones, 0.5) // Higher threshold for cleaner hull
  }
} 