import * as THREE from 'three'
import { 
  Mesh, 
  SkinnedMesh, 
  Vector3, 
  BufferGeometry, 
  BufferAttribute,
  Box3
} from 'three'
import { GenericMeshFittingService, GenericFittingParameters } from './GenericMeshFittingService'

export interface FittingParameters extends GenericFittingParameters {}

export class IterativeArmorFittingService {
  private genericFittingService = new GenericMeshFittingService()
  
  /**
   * Perform iterative fitting of armor to body mesh
   */
  fitArmorToBody(
    armorMesh: Mesh,
    bodyMesh: SkinnedMesh,
    targetRegion: Box3,
    parameters: FittingParameters
  ): void {
    console.log('🎯 IterativeArmorFittingService: Starting armor-specific fitting')
    
    // For armor fitting, we might want to focus on a specific region
    // so we can create a temporary mesh that represents just that region
    // For now, we'll use the entire body mesh
    
    // Use the generic fitting service
    this.genericFittingService.fitMeshToTarget(armorMesh, bodyMesh, parameters)
    
    console.log('🎯 IterativeArmorFittingService: Armor fitting complete')
  }
  

  
  /**
   * Create a debug mesh showing the target body region
   */
  createBodyRegionDebugMesh(
    bodyMesh: SkinnedMesh,
    targetRegion: Box3
  ): { boundingBoxHelper: THREE.Box3Helper, regionMesh: THREE.Mesh } {
    // Create bounding box helper
    const boundingBoxHelper = new THREE.Box3Helper(targetRegion, new THREE.Color(0x00ff00))
    
    // Create red highlight mesh for vertices in the region
    const geometry = bodyMesh.geometry as BufferGeometry
    const position = geometry.attributes.position as BufferAttribute
    
    const regionVertices: number[] = []
    const regionIndices: number[] = []
    
    // Find vertices within the target region
    for (let i = 0; i < position.count; i++) {
      const vertex = new Vector3(
        position.getX(i),
        position.getY(i),
        position.getZ(i)
      )
      vertex.applyMatrix4(bodyMesh.matrixWorld)
      
      if (targetRegion.containsPoint(vertex)) {
        regionVertices.push(
          position.getX(i),
          position.getY(i),
          position.getZ(i)
        )
      }
    }
    
    // Create geometry
    const regionGeometry = new BufferGeometry()
    regionGeometry.setAttribute('position', new BufferAttribute(new Float32Array(regionVertices), 3))
    
    // Create red semi-transparent material
    const regionMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    })
    
    // Create mesh
    const regionMesh = new THREE.Mesh(regionGeometry, regionMaterial)
    regionMesh.applyMatrix4(bodyMesh.matrixWorld)
    
    return { boundingBoxHelper, regionMesh }
  }
}

export default IterativeArmorFittingService 
 
 