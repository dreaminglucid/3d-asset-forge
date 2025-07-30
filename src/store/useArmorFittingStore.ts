import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { Asset } from '../types'
import { FittingConfig, BodyRegion, CollisionPoint } from '../services/fitting/armor/ArmorFittingService'
import { ArmorFittingViewerRef } from '../components/ArmorFitting/ArmorFittingViewer'

interface ArmorTransform {
  position: { x: number; y: number; z: number }
  scale: number
}

interface HistoryEntry {
  fittingConfig: FittingConfig
  armorTransform: ArmorTransform
  timestamp: number
}

interface ArmorFittingState {
  // Selected items
  selectedAvatar: Asset | null
  selectedArmor: Asset | null
  assetTypeFilter: 'avatar' | 'armor'
  
  // Fitting configuration
  fittingConfig: FittingConfig
  
  // Manual transform controls
  armorTransform: ArmorTransform
  
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
  
  // UI state
  showDebugger: boolean
  
  // Error handling
  lastError: string | null
  
  // History for undo/redo
  history: HistoryEntry[]
  historyIndex: number
  
  // Loading states for specific operations
  isExporting: boolean
  isSavingConfig: boolean
}

interface ArmorFittingActions {
  // Asset selection
  setSelectedAvatar: (avatar: Asset | null) => void
  setSelectedArmor: (armor: Asset | null) => void
  setAssetTypeFilter: (type: 'avatar' | 'armor') => void
  handleAssetSelect: (asset: Asset) => void
  
  // Fitting configuration
  setFittingConfig: (config: FittingConfig) => void
  updateFittingConfig: (updates: Partial<FittingConfig>) => void
  
  // Transform controls
  setArmorTransform: (transform: ArmorTransform) => void
  updateArmorTransform: (updates: Partial<ArmorTransform>) => void
  resetTransform: () => void
  
  // Options
  setEnableWeightTransfer: (enabled: boolean) => void
  setEquipmentSlot: (slot: string) => void
  
  // Visualization
  setVisualizationMode: (mode: ArmorFittingState['visualizationMode']) => void
  setSelectedBone: (bone: number) => void
  setShowWireframe: (show: boolean) => void
  
  // Fitting results
  setBodyRegions: (regions: Map<string, BodyRegion> | null) => void
  setCollisions: (collisions: CollisionPoint[] | null) => void
  setIsFitting: (fitting: boolean) => void
  setFittingProgress: (progress: number) => void
  
  // UI state
  setShowDebugger: (show: boolean) => void
  
  // Error handling
  setLastError: (error: string | null) => void
  clearError: () => void
  
  // History management
  saveToHistory: () => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  
  // Complex actions
  performFitting: (viewerRef: React.RefObject<ArmorFittingViewerRef>) => Promise<void>
  resetFitting: () => void
  exportFittedArmor: (viewerRef: React.RefObject<ArmorFittingViewerRef>) => Promise<void>
  exportEquippedAvatar: (viewerRef: React.RefObject<ArmorFittingViewerRef>) => Promise<void>
  saveConfiguration: () => Promise<void>
  loadConfiguration: (file: File) => Promise<void>
  
  // Reset everything
  resetAll: () => void
}

// Selectors for commonly used derived state
interface ArmorFittingSelectors {
  isReadyToFit: () => boolean
  hasUnsavedChanges: () => boolean
  fittingMethod: () => FittingConfig['method']
  currentProgress: () => string
}

type ArmorFittingStore = ArmorFittingState & ArmorFittingActions & ArmorFittingSelectors

const initialState: ArmorFittingState = {
  // Selected items
  selectedAvatar: null,
  selectedArmor: null,
  assetTypeFilter: 'avatar',
  
  // Fitting configuration
  fittingConfig: {
    method: 'hull',
    margin: 0.02,
    smoothingIterations: 3,
    collisionIterations: 2,
    preserveDetails: true,
    stiffness: 0.7,
    hullTargetOffset: 0.02,
    hullIterations: 5,
    hullStepSize: 0.5,
    hullSmoothInfluence: 5,
    hullMaxDisplacement: 0.05
  },
  
  // Manual transform controls
  armorTransform: {
    position: { x: 0, y: 0, z: 0 },
    scale: 1.0
  },
  
  // Additional options
  enableWeightTransfer: false,
  equipmentSlot: 'Spine2',
  
  // Visualization
  visualizationMode: 'none',
  selectedBone: 0,
  showWireframe: false,
  
  // Fitting results
  bodyRegions: null,
  collisions: null,
  isFitting: false,
  fittingProgress: 0,
  
  // UI state
  showDebugger: false,
  
  // Error handling
  lastError: null,
  
  // History
  history: [],
  historyIndex: -1,
  
  // Loading states
  isExporting: false,
  isSavingConfig: false
}

export const useArmorFittingStore = create<ArmorFittingStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        immer((set, get) => ({
          ...initialState,
          
          // Asset selection
          setSelectedAvatar: (avatar) => set((state) => {
            state.selectedAvatar = avatar
            state.lastError = null
          }),
          setSelectedArmor: (armor) => set((state) => {
            state.selectedArmor = armor
            state.lastError = null
          }),
          setAssetTypeFilter: (type) => set((state) => {
            state.assetTypeFilter = type
          }),
          handleAssetSelect: (asset) => {
            const { assetTypeFilter, saveToHistory } = get()
            saveToHistory()
            set((state) => {
              if (assetTypeFilter === 'avatar') {
                state.selectedAvatar = asset
              } else {
                state.selectedArmor = asset
              }
              state.lastError = null
            })
          },
          
          // Fitting configuration
          setFittingConfig: (config) => set((state) => {
            state.fittingConfig = config
          }),
          updateFittingConfig: (updates) => {
            get().saveToHistory()
            set((state) => {
              Object.assign(state.fittingConfig, updates)
            })
          },
          
          // Transform controls
          setArmorTransform: (transform) => set((state) => {
            state.armorTransform = transform
          }),
          updateArmorTransform: (updates) => {
            // Don't save every small transform change to history
            set((state) => {
              Object.assign(state.armorTransform, updates)
            })
          },
          resetTransform: () => {
            get().saveToHistory()
            set((state) => {
              state.armorTransform = {
                position: { x: 0, y: 0, z: 0 },
                scale: 1.0
              }
            })
          },
          
          // Options
          setEnableWeightTransfer: (enabled) => set((state) => {
            state.enableWeightTransfer = enabled
          }),
          setEquipmentSlot: (slot) => set((state) => {
            state.equipmentSlot = slot
          }),
          
          // Visualization
          setVisualizationMode: (mode) => set((state) => {
            state.visualizationMode = mode
          }),
          setSelectedBone: (bone) => set((state) => {
            state.selectedBone = bone
          }),
          setShowWireframe: (show) => set((state) => {
            state.showWireframe = show
          }),
          
          // Fitting results
          setBodyRegions: (regions) => set((state) => {
            state.bodyRegions = regions
          }),
          setCollisions: (collisions) => set((state) => {
            state.collisions = collisions
          }),
          setIsFitting: (fitting) => set((state) => {
            state.isFitting = fitting
          }),
          setFittingProgress: (progress) => set((state) => {
            state.fittingProgress = progress
          }),
          
          // UI state
          setShowDebugger: (show) => set((state) => {
            state.showDebugger = show
          }),
          
          // Error handling
          setLastError: (error) => set((state) => {
            state.lastError = error
          }),
          clearError: () => set((state) => {
            state.lastError = null
          }),
          
          // History management
          saveToHistory: () => set((state) => {
            const entry: HistoryEntry = {
              fittingConfig: { ...state.fittingConfig },
              armorTransform: { 
                ...state.armorTransform,
                position: { ...state.armorTransform.position }
              },
              timestamp: Date.now()
            }
            
            // Remove any entries after current index
            state.history = state.history.slice(0, state.historyIndex + 1)
            state.history.push(entry)
            state.historyIndex = state.history.length - 1
            
            // Keep history size reasonable
            if (state.history.length > 50) {
              state.history = state.history.slice(-50)
              state.historyIndex = state.history.length - 1
            }
          }),
          
          undo: () => set((state) => {
            if (state.historyIndex > 0) {
              state.historyIndex--
              const entry = state.history[state.historyIndex]
              state.fittingConfig = { ...entry.fittingConfig }
              state.armorTransform = {
                ...entry.armorTransform,
                position: { ...entry.armorTransform.position }
              }
            }
          }),
          
          redo: () => set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              state.historyIndex++
              const entry = state.history[state.historyIndex]
              state.fittingConfig = { ...entry.fittingConfig }
              state.armorTransform = {
                ...entry.armorTransform,
                position: { ...entry.armorTransform.position }
              }
            }
          }),
          
          canUndo: () => get().historyIndex > 0,
          canRedo: () => get().historyIndex < get().history.length - 1,
          
          // Complex actions
          performFitting: async (viewerRef) => {
            const { selectedAvatar, selectedArmor, fittingConfig, enableWeightTransfer } = get()
            
            if (!viewerRef.current || !selectedAvatar || !selectedArmor) {
              set((state) => {
                state.lastError = 'Missing avatar or armor selection'
              })
              return
            }
            
            set((state) => {
              state.isFitting = true
              state.fittingProgress = 0
              state.lastError = null
            })
            
            try {
              // Phase 1: Bounding box fit
              set((state) => { state.fittingProgress = 25 })
              console.log('🎯 ArmorFittingLab: Phase 1 - Bounding box fit to position armor at torso')
              viewerRef.current.performBoundingBoxFit()
              await new Promise(resolve => setTimeout(resolve, 1000))
              
              // Phase 2: Method-specific fitting
              if (fittingConfig.method === 'hull') {
                set((state) => { state.fittingProgress = 50 })
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
                set((state) => { state.fittingProgress = 75 })
              } else if (fittingConfig.method === 'collision' || fittingConfig.method === 'smooth') {
                set((state) => { state.fittingProgress = 50 })
                for (let i = 0; i < fittingConfig.collisionIterations; i++) {
                  viewerRef.current.performCollisionBasedFit()
                  await new Promise(resolve => setTimeout(resolve, 200))
                }
                
                console.log('🎯 ArmorFittingLab: Applying final smoothing pass')
                viewerRef.current.performSmoothDeformation()
                await new Promise(resolve => setTimeout(resolve, 300))
              }
              
              // Phase 3: Smooth deformation
              if (fittingConfig.method === 'smooth') {
                set((state) => { state.fittingProgress = 75 })
                viewerRef.current.performSmoothDeformation()
                await new Promise(resolve => setTimeout(resolve, 500))
              }
              
              // Phase 4: Weight transfer (optional)
              if (enableWeightTransfer) {
                set((state) => { state.fittingProgress = 90 })
                viewerRef.current.transferWeights()
                await new Promise(resolve => setTimeout(resolve, 500))
              }
              
              set((state) => { state.fittingProgress = 100 })
              
              // Save to history after successful fitting
              get().saveToHistory()
              
            } catch (error) {
              console.error('Fitting failed:', error)
              set((state) => {
                state.lastError = `Fitting failed: ${(error as Error).message}`
              })
            } finally {
              set((state) => {
                state.isFitting = false
              })
            }
          },
          
          resetFitting: () => {
            set((state) => {
              state.fittingProgress = 0
              state.isFitting = false
              state.bodyRegions = null
              state.collisions = null
              state.lastError = null
            })
          },
          
          exportFittedArmor: async (viewerRef) => {
            if (!viewerRef.current) return
            
            set((state) => {
              state.isExporting = true
              state.lastError = null
            })
            
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
              set((state) => {
                state.lastError = `Export failed: ${(error as Error).message}`
              })
            } finally {
              set((state) => {
                state.isExporting = false
              })
            }
          },
          
          exportEquippedAvatar: async (viewerRef) => {
            if (!viewerRef.current) return
            
            set((state) => {
              state.isExporting = true
              state.lastError = null
            })
            
            try {
              const arrayBuffer = await viewerRef.current.exportEquippedModel()
              const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `equipped_avatar_${Date.now()}.glb`
              a.click()
              URL.revokeObjectURL(url)
            } catch (error) {
              console.error('Export failed:', error)
              set((state) => {
                state.lastError = `Export failed: ${(error as Error).message}`
              })
            } finally {
              set((state) => {
                state.isExporting = false
              })
            }
          },
          
          saveConfiguration: async () => {
            const { selectedAvatar, selectedArmor, fittingConfig, armorTransform, enableWeightTransfer } = get()
            
            if (!selectedAvatar || !selectedArmor) {
              set((state) => {
                state.lastError = 'Please select both avatar and armor before saving'
              })
              return
            }
            
            set((state) => {
              state.isSavingConfig = true
              state.lastError = null
            })
            
            try {
              const config = {
                avatarId: selectedAvatar.id,
                armorId: selectedArmor.id,
                fittingConfig,
                armorTransform,
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
            } catch (error) {
              set((state) => {
                state.lastError = `Failed to save configuration: ${(error as Error).message}`
              })
            } finally {
              set((state) => {
                state.isSavingConfig = false
              })
            }
          },
          
          loadConfiguration: async (file: File) => {
            set((state) => {
              state.lastError = null
            })
            
            try {
              const text = await file.text()
              const config = JSON.parse(text)
              
              set((state) => {
                state.fittingConfig = config.fittingConfig
                state.armorTransform = config.armorTransform
                state.enableWeightTransfer = config.enableWeightTransfer
              })
              
              // Save to history after loading
              get().saveToHistory()
              
            } catch (error) {
              set((state) => {
                state.lastError = `Failed to load configuration: ${(error as Error).message}`
              })
            }
          },
          
          resetAll: () => {
            set({
              ...initialState,
              history: [],
              historyIndex: -1
            })
          },
          
          // Selectors
          isReadyToFit: () => {
            const { selectedAvatar, selectedArmor } = get()
            return !!(selectedAvatar && selectedArmor)
          },
          
          hasUnsavedChanges: () => {
            const { history, historyIndex } = get()
            return historyIndex < history.length - 1 || history.length > 0
          },
          
          fittingMethod: () => get().fittingConfig.method,
          
          currentProgress: () => {
            const progress = get().fittingProgress
            if (progress === 0) return 'Ready'
            if (progress === 100) return 'Complete'
            if (progress < 50) return 'Positioning...'
            if (progress < 75) return 'Fitting...'
            return 'Finalizing...'
          }
        })),
        {
          name: 'armor-fitting-storage',
          partialize: (state) => ({
            // Only persist these fields
            fittingConfig: state.fittingConfig,
            enableWeightTransfer: state.enableWeightTransfer,
            equipmentSlot: state.equipmentSlot,
            visualizationMode: state.visualizationMode,
            showWireframe: state.showWireframe
          })
        }
      ),
      {
        name: 'armor-fitting-store',
      }
    )
  )
)

// Convenient selectors to use in components
export const useIsReadyToFit = () => useArmorFittingStore((state) => state.isReadyToFit())
export const useHasUnsavedChanges = () => useArmorFittingStore((state) => state.hasUnsavedChanges())
export const useFittingMethod = () => useArmorFittingStore((state) => state.fittingMethod())
export const useCurrentProgress = () => useArmorFittingStore((state) => state.currentProgress()) 