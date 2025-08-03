import { useState, useCallback } from 'react'
import { Asset } from '../types'
import { FittingConfig, BodyRegion, CollisionPoint } from '../services/fitting/armor/ArmorFittingService'
import { ArmorFittingViewerRef } from '../components/ArmorFitting/ArmorFittingViewer'

export interface ArmorFittingState {
  // Selected items
  selectedAvatar: Asset | null
  selectedArmor: Asset | null
  
  // Fitting configuration
  fittingConfig: FittingConfig
  
  // Additional options
  enableWeightTransfer: boolean
  equipmentSlot: string
  
  // Visualization
  visualizationMode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull'
  selectedBone: number
  showWireframe: boolean
  
  // Fitting results
  bodyRegions: Map<string, BodyRegion> | null
  collisions: CollisionPoint[] | null
  isFitting: boolean
  fittingProgress: number
}

export interface ArmorFittingActions {
  setSelectedAvatar: (asset: Asset | null) => void
  setSelectedArmor: (asset: Asset | null) => void
  setFittingConfig: (config: FittingConfig) => void
  updateFittingConfig: (updates: Partial<FittingConfig>) => void
  setEnableWeightTransfer: (enabled: boolean) => void
  setEquipmentSlot: (slot: string) => void
  setVisualizationMode: (mode: ArmorFittingState['visualizationMode']) => void
  setSelectedBone: (bone: number) => void
  setShowWireframe: (show: boolean) => void
  performFitting: (viewerRef: React.RefObject<ArmorFittingViewerRef>) => Promise<void>
  resetFitting: () => void
  exportFittedArmor: (viewerRef: React.RefObject<ArmorFittingViewerRef>) => Promise<void>
  saveConfiguration: () => void
}

export function useArmorFitting(): ArmorFittingState & ArmorFittingActions {
  // Selected items
  const [selectedAvatar, setSelectedAvatar] = useState<Asset | null>(null)
  const [selectedArmor, setSelectedArmor] = useState<Asset | null>(null)
  
  // Fitting configuration
  const [fittingConfig, setFittingConfig] = useState<FittingConfig>({
    method: 'hull',
    margin: 0.02,
    smoothingIterations: 3,
    collisionIterations: 2,
    preserveDetails: true,
    stiffness: 0.7,
    // Hull fitting parameters
    hullTargetOffset: 0.02,
    hullIterations: 5,
    hullStepSize: 0.5,
    hullSmoothInfluence: 5,
    hullMaxDisplacement: 0.05
  })
  
  // Additional options
  const [enableWeightTransfer, setEnableWeightTransfer] = useState(false)
  const [equipmentSlot, setEquipmentSlot] = useState<string>('Spine2')
  
  // Visualization
  const [visualizationMode, setVisualizationMode] = useState<'none' | 'regions' | 'collisions' | 'weights' | 'hull'>('none')
  const [selectedBone, setSelectedBone] = useState(0)
  const [showWireframe, setShowWireframe] = useState(false)
  
  // Fitting results
  const [bodyRegions, setBodyRegions] = useState<Map<string, BodyRegion> | null>(null)
  const [collisions, setCollisions] = useState<CollisionPoint[] | null>(null)
  const [isFitting, setIsFitting] = useState(false)
  const [fittingProgress, setFittingProgress] = useState(0)

  const updateFittingConfig = useCallback((updates: Partial<FittingConfig>) => {
    setFittingConfig(prev => ({ ...prev, ...updates }))
  }, [])

  const performFitting = useCallback(async (viewerRef: React.RefObject<ArmorFittingViewerRef>) => {
    if (!viewerRef.current || !selectedAvatar || !selectedArmor) return
    
    setIsFitting(true)
    setFittingProgress(0)
    
    try {
      // Phase 1: Bounding box fit
      setFittingProgress(25)
      console.log('🎯 ArmorFittingLab: Phase 1 - Bounding box fit to position armor at torso')
      viewerRef.current.performBoundingBoxFit()
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Phase 2: Method-specific fitting
      if (fittingConfig.method === 'hull') {
        // Hull-based fitting
        setFittingProgress(50)
        const hullParams = {
          targetOffset: fittingConfig.hullTargetOffset || 0.02,
          iterations: fittingConfig.hullIterations || 5,
          stepSize: fittingConfig.hullStepSize || 0.5,
          smoothInfluence: fittingConfig.hullSmoothInfluence || 5,
          smoothStrength: 0.7,
          maxDisplacement: fittingConfig.hullMaxDisplacement || 0.05,
          preserveVolume: false,
          maintainPosition: true
        }
        console.log('🎯 ArmorFittingLab: Starting hull-based fit with params:', hullParams)
        await viewerRef.current.performHullBasedFit(hullParams)
        setFittingProgress(75)
      } else if (fittingConfig.method === 'collision' || fittingConfig.method === 'smooth') {
        // Original collision-based methods
        setFittingProgress(50)
        for (let i = 0; i < (fittingConfig.collisionIterations || 3); i++) {
          viewerRef.current.performCollisionBasedFit()
          await new Promise(resolve => setTimeout(resolve, 200))
        }
        
        // Final smoothing pass
        console.log('🎯 ArmorFittingLab: Applying final smoothing pass')
        viewerRef.current.performSmoothDeformation()
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      
      // Phase 3: Smooth deformation
      if (fittingConfig.method === 'smooth') {
        setFittingProgress(75)
        viewerRef.current.performSmoothDeformation()
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      // Phase 4: Weight transfer (optional)
      if (enableWeightTransfer) {
        setFittingProgress(90)
        viewerRef.current.transferWeights()
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      setFittingProgress(100)
      
      // Show success message
      setTimeout(() => {
        alert('Armor fitting completed successfully!')
      }, 100)
      
    } catch (error) {
      console.error('Fitting failed:', error)
      alert('Fitting failed: ' + (error as Error).message)
    } finally {
      setIsFitting(false)
    }
  }, [selectedAvatar, selectedArmor, fittingConfig, enableWeightTransfer])

  const resetFitting = useCallback(() => {
    setFittingProgress(0)
    setIsFitting(false)
    setBodyRegions(null)
    setCollisions(null)
  }, [])

  const exportFittedArmor = useCallback(async (viewerRef: React.RefObject<ArmorFittingViewerRef>) => {
    if (!viewerRef.current) return
    
    try {
      const arrayBuffer = await viewerRef.current.exportAlignedEquipment()
      const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fitted_armor_${Date.now()}.glb`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed: ' + (error as Error).message)
    }
  }, [])

  const saveConfiguration = useCallback(() => {
    if (!selectedAvatar || !selectedArmor) return
    
    const config = {
      avatarId: selectedAvatar.id,
      armorId: selectedArmor.id,
      fittingConfig,
      enableWeightTransfer,
      timestamp: new Date().toISOString()
    }
    
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `armor_fitting_config_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [selectedAvatar, selectedArmor, fittingConfig, enableWeightTransfer])

  return {
    // State
    selectedAvatar,
    selectedArmor,
    fittingConfig,
    enableWeightTransfer,
    equipmentSlot,
    visualizationMode,
    selectedBone,
    showWireframe,
    bodyRegions,
    collisions,
    isFitting,
    fittingProgress,
    
    // Actions
    setSelectedAvatar,
    setSelectedArmor,
    setFittingConfig,
    updateFittingConfig,
    setEnableWeightTransfer,
    setEquipmentSlot,
    setVisualizationMode,
    setSelectedBone,
    setShowWireframe,
    performFitting,
    resetFitting,
    exportFittedArmor,
    saveConfiguration
  }
} 