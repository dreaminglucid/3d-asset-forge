/**
 * Rigging and Animation Metadata Types
 */

export interface AnimationSet {
  walking?: string
  running?: string
  tpose?: string
  [key: string]: string | undefined  // Allow for additional animations
}

export interface RiggingMetadata {
  // Rigging status
  isRigged?: boolean
  riggingTaskId?: string
  riggingStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  riggingError?: string
  riggingAttempted?: boolean
  
  // Rig information
  rigType?: 'humanoid-standard' | 'creature' | 'custom'
  characterHeight?: number
  supportsAnimation?: boolean
  animationCompatibility?: string[]
  
  // Animation files
  animations?: {
    basic?: AnimationSet
    advanced?: AnimationSet
  }
  
  // Model paths
  riggedModelPath?: string
  tposeModelPath?: string
}

// Extended metadata that includes rigging
export interface ExtendedAssetMetadata extends RiggingMetadata {
  [key: string]: any  // Allow additional properties
} 