import * as THREE from 'three'

export type FitStyle = 'skin-tight' | 'athletic' | 'comfortable' | 'loose'
export type Quality = 'instant' | 'balanced' | 'perfect'

export interface IntuitiveFittingOptions {
  fitStyle?: FitStyle
  quality?: Quality
  preview?: boolean
  debugMode?: boolean
}

export interface FittingResult {
  success: boolean
  mesh?: THREE.SkinnedMesh
  error?: Error
  metadata?: {
    executionTime: number
    avatarUnits?: string
    armorUnits?: string
    normalized?: boolean
  }
}

export interface IntuitiveFittingProgress {
  stage: string
  progress: number
  message: string
} 