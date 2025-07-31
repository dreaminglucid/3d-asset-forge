import React, { useState, useEffect, useRef } from 'react'
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge, Input, Textarea, Select, Progress, Modal, ModalHeader, 
  ModalBody, ModalFooter, ModalSection
} from '../common'
import { cn, animations, theme } from '../../styles'
import { 
  ChevronRight, CheckCircle, AlertCircle, Upload, Download, Sparkles,
  Image as ImageIcon, Box, Palette, Grid3x3, Settings,
  FileText, Brain, Camera, Layers, Eye, Plus, Trash2,
  Package, X, Zap, FileImage, Layout, ChevronDown, Info, XCircle, 
  Sword, Play, Pause, RefreshCw, Check, Clock, Loader2, Edit2, User
} from 'lucide-react'
import { GenerationConfig } from '../../types/generation'
import { MaterialPreset, GeneratedAsset, GenerationAssetMetadata, PipelineStage as IPipelineStage, BaseAssetMetadata, hasAnimations, AssetType } from '../../types'
import { GenerationAPIClient } from '../../services/api/GenerationAPIClient'
import { Asset } from '../../services/api/AssetService'
import ThreeViewer, { ThreeViewerRef } from '../shared/ThreeViewer'
import { spriteGeneratorClient } from '../../utils/sprite-generator-client'
import { GenerationTypeSelector } from './GenerationTypeSelector'
import { AnimationPlayer } from '../shared/AnimationPlayer'
import { useGenerationStore } from '../../store'
import type { PipelineStage } from '../../store'

interface GenerationDashboardProps {
  onClose?: () => void
}

const GenerationDashboard: React.FC<GenerationDashboardProps> = ({ onClose }) => {
  const [apiClient] = useState(() => new GenerationAPIClient())
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Get all state and actions from the store
  const {
    // UI State
    generationType,
    activeView,
    showAdvancedPrompts,
    showAssetTypeEditor,
    editMaterialPrompts,
    showDeleteConfirm,
    
    // Material State
    materialPresets,
    isLoadingMaterials,
    editingPreset,
    
    // Form State
    assetName,
    assetType,
    description,
    gameStyle,
    customStyle,
    
    // Custom Prompts
    customGamePrompt,
    customAssetTypePrompt,
    
    // Asset Type Management
    customAssetTypes,
    assetTypePrompts,
    
    // Pipeline Configuration
    useGPT4Enhancement,
    enableRetexturing,
    enableSprites,
    enableVertexColors,
    
    // Avatar Configuration
    enableRigging,
    characterHeight,
    
    // Material Configuration
    selectedMaterials,
    customMaterials,
    materialPromptOverrides,
    
    // Pipeline State
    isGenerating,
    currentPipelineId,
    isGeneratingSprites,
    modelLoadError,
    isModelLoading,
    pipelineStages,
    
    // Results State
    generatedAssets,
    selectedAsset,
    selectedStageResult,
    
    // Actions
    setGenerationType,
    setActiveView,
    setShowAdvancedPrompts,
    setShowAssetTypeEditor,
    setEditMaterialPrompts,
    setShowDeleteConfirm,
    setMaterialPresets,
    setIsLoadingMaterials,
    setEditingPreset,
    setAssetName,
    setAssetType,
    setDescription,
    setGameStyle,
    setCustomStyle,
    setCustomGamePrompt,
    setCustomAssetTypePrompt,
    setCustomAssetTypes,
    setAssetTypePrompts,
    addCustomAssetType,
    removeCustomAssetType,
    setUseGPT4Enhancement,
    setEnableRetexturing,
    setEnableSprites,
    setEnableVertexColors,
    setEnableRigging,
    setCharacterHeight,
    setSelectedMaterials,
    setCustomMaterials,
    setMaterialPromptOverrides,
    addCustomMaterial,
    removeCustomMaterial,
    toggleMaterialSelection,
    setIsGenerating,
    setCurrentPipelineId,
    setIsGeneratingSprites,
    setModelLoadError,
    setIsModelLoading,
    setPipelineStages,
    updatePipelineStage,
    setGeneratedAssets,
    setSelectedAsset,
    setSelectedStageResult,
    addGeneratedAsset,
    updateGeneratedAsset,
    resetForm,
    resetPipeline,
    initializePipelineStages
  } = useGenerationStore()
  
  // Set asset type based on generation type
  useEffect(() => {
    if (generationType === 'avatar') {
      setAssetType('character')
    }
  }, [generationType])

  // Update pipeline stages based on configuration and generation type
  useEffect(() => {
    // Initialize pipeline stages
    initializePipelineStages()
  }, [generationType, useGPT4Enhancement, enableRetexturing, enableSprites, enableRigging, initializePipelineStages])
  
  // Add icons to stages after they're initialized
  useEffect(() => {
    if (pipelineStages.length === 0) return
    
    const stagesWithIcons = pipelineStages.map(stage => ({
      ...stage,
      icon: stage.id === 'text-input' ? <FileText className="w-4 h-4" /> :
            stage.id === 'gpt4-enhancement' ? <Brain className="w-4 h-4" /> :
            stage.id === 'image-generation' ? <Camera className="w-4 h-4" /> :
            stage.id === 'image-to-3d' ? <Box className="w-4 h-4" /> :
            stage.id === 'rigging' ? <User className="w-4 h-4" /> :
            stage.id === 'retexturing' ? <Layers className="w-4 h-4" /> :
            stage.id === 'sprites' ? <Grid3x3 className="w-4 h-4" /> : 
            <Sparkles className="w-4 h-4" /> // Default icon
    }))
    
    // Only update if icons have changed
    const needsUpdate = stagesWithIcons.some((stage, index) => 
      stage.icon !== pipelineStages[index]?.icon
    )
    
    if (needsUpdate) {
      setPipelineStages(stagesWithIcons)
    }
  }, [pipelineStages.length]) // Only depend on length to avoid infinite loops

  // Handle model loading state when selected asset changes
  useEffect(() => {
    if (selectedAsset?.modelUrl || selectedAsset?.hasModel) {
      setIsModelLoading(false)  // Don't show loading state, let ThreeViewer handle it
      setModelLoadError(null)
    }
  }, [selectedAsset])

  // Load material presets from JSON file
  useEffect(() => {
    const loadMaterialPresets = async () => {
      try {
        const response = await fetch('/api/material-presets')
        const data = await response.json()
        setMaterialPresets(data)
        
        // Set default selected materials based on what's available
        const defaultMaterials = ['bronze', 'steel', 'mithril']
        const availableMaterials = defaultMaterials.filter(mat => 
          data.some((preset: MaterialPreset) => preset.id === mat)
        )
        
        // Only update if no materials have been selected yet
        if (selectedMaterials.length === 0 || selectedMaterials.every(m => defaultMaterials.includes(m))) {
          setSelectedMaterials(availableMaterials)
        }
        
        setIsLoadingMaterials(false)
      } catch (error) {
        console.error('Failed to load material presets:', error)
        setIsLoadingMaterials(false)
      }
    }
    loadMaterialPresets()
  }, [])
  
  // Load existing assets when Results tab is accessed
  useEffect(() => {
    if (activeView === 'results' && generatedAssets.length === 0) {
      const loadExistingAssets = async () => {
        try {
          const response = await fetch('/api/assets')
          const assets = await response.json()
          
          // Transform API assets to match the expected format
          const transformedAssets = assets.map((asset: Asset) => ({
            id: asset.id,
            name: asset.name,
            type: asset.type,
            status: 'completed',
            hasModel: asset.hasModel,
            modelUrl: asset.hasModel ? `/api/assets/${asset.id}/model` : undefined,
            conceptArtUrl: `/api/assets/${asset.id}/concept-art.png`,
            variants: ('variants' in asset.metadata && asset.metadata.variants) ? asset.metadata.variants : [],
            metadata: asset.metadata || {},
            createdAt: asset.generatedAt || asset.metadata?.generatedAt
          }))
          
          setGeneratedAssets(transformedAssets)
          
          // Select the first asset if none selected
          if (transformedAssets.length > 0 && !selectedAsset) {
            setSelectedAsset(transformedAssets[0])
          }
        } catch (error) {
          console.error('Failed to load existing assets:', error)
        }
      }
      
      loadExistingAssets()
    }
  }, [activeView, generatedAssets.length, selectedAsset])
  
  // Listen for status updates
  useEffect(() => {
    console.log('Pipeline status effect triggered. currentPipelineId:', currentPipelineId)
    if (!currentPipelineId) return
    
    const stageMapping: Record<string, string> = {
      'textInput': 'text-input',
      'promptOptimization': 'gpt4-enhancement',
      'imageGeneration': 'image-generation',
      'image3D': 'image-to-3d',
      'baseModel': 'image-to-3d',
      'textureGeneration': 'retexturing',
      'spriteGeneration': 'sprites',
      'rigging': 'rigging'
    }
    
    intervalRef.current = setInterval(async () => {
      try {
        console.log('Fetching pipeline status for:', currentPipelineId)
        const status = await apiClient.fetchPipelineStatus(currentPipelineId)
        console.log('Received status:', status)
        
        if (status) {
          // Update pipeline stages
          Object.entries(status.stages || {}).forEach(([stageName, stageData]) => {
            console.log('Processing stage:', stageName, stageData)
            const uiStageId = stageMapping[stageName]
            if (uiStageId) {
              let uiStatus = stageData.status === 'processing' ? 'active' : stageData.status
              
              // Check configuration overrides
              if (uiStageId === 'gpt4-enhancement' && !useGPT4Enhancement) uiStatus = 'skipped'
              if (uiStageId === 'retexturing' && !enableRetexturing) uiStatus = 'skipped'
              if (uiStageId === 'sprites' && !enableSprites) uiStatus = 'skipped'
              
              // Use updatePipelineStage to update individual stage
              updatePipelineStage(uiStageId, uiStatus)
            }
          })
          
          // Handle completion
          if (status.status === 'completed') {
            setIsGenerating(false)
            const results = status.results
            const config = status.config
            const baseAssetId = config.assetId || assetName.toLowerCase().replace(/\s+/g, '-')
            
            // Debug logging
            console.log('Pipeline completed with results:', results)
            console.log('Rigging results:', results.rigging)
            
            const finalAsset: GeneratedAsset = {
              id: baseAssetId,
              name: config.name || assetName,
              description: config.description || `${config.type || assetType} asset`,
              type: config.type || assetType,
              pipelineId: currentPipelineId,
              status: 'completed',
              modelUrl: (results.image3D?.localPath || results.rigging?.localPath) ? `/api/assets/${baseAssetId}/model` : undefined,
              conceptArtUrl: `/api/assets/${baseAssetId}/concept-art.png`,
              variants: results.textureGeneration?.variants || [],
              hasSpriteMetadata: results.spriteGeneration?.status === 'metadata_created' || 
                                 Boolean(config.enableSprites && results.image3D?.localPath),
              hasSprites: false,
              sprites: null,
              hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
              modelFile: results.rigging?.localPath || results.image3D?.localPath,
              createdAt: new Date().toISOString(),
              generatedAt: new Date().toISOString(),
              metadata: {
                id: baseAssetId,
                gameId: baseAssetId,
                name: config.name,
                description: config.description,
                type: config.type as AssetType,
                subtype: config.subtype || '',
                isBaseModel: true,
                meshyTaskId: '', // Not available from pipeline results
                generationMethod: 'gpt-image-meshy' as const,
                variants: [],
                variantCount: 0,
                modelPath: results.rigging?.localPath || results.image3D?.localPath || '',
                hasModel: !!(results.image3D?.localPath || results.rigging?.localPath),
                hasConceptArt: true,
                workflow: 'ai-generation',
                gddCompliant: true,
                isPlaceholder: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                generatedAt: new Date().toISOString(),
                // Extended properties
                isRigged: !!results.rigging && !!results.rigging?.localPath,
                animations: results.rigging?.localPath ? {} : undefined,
                riggedModelPath: results.rigging?.localPath,
                characterHeight: generationType === 'avatar' ? characterHeight : undefined
              } as BaseAssetMetadata & GenerationAssetMetadata
            }
            

            
            // Only add if not already exists
            const exists = generatedAssets.some(asset => asset.id === baseAssetId)
            if (!exists) {
              setGeneratedAssets([...generatedAssets, finalAsset])
            }
            setSelectedAsset(finalAsset)
            setActiveView('results')
            
            // Clear the interval
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          } else if (status.status === 'failed') {
            setIsGenerating(false)
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
              intervalRef.current = null
            }
          }
        }
      } catch (error) {
        console.error('Failed to get pipeline status:', error)
      }
    }, 500)
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [currentPipelineId, apiClient, useGPT4Enhancement, enableRetexturing, enableSprites, assetName, updatePipelineStage])

  const handleGenerateSprites = async (assetId: string) => {
    try {
      setIsGeneratingSprites(true)
      
      const sprites = await spriteGeneratorClient.generateSpritesForAsset(assetId, {
        angles: 8,
        resolution: 256,
        backgroundColor: 'transparent'
      })
      
      // Update the generated assets with the new sprite URLs
      const updatedAssets = generatedAssets.map(asset => 
        asset.id === assetId 
          ? { ...asset, sprites, hasSprites: true }
          : asset
      )
      setGeneratedAssets(updatedAssets)
      
      if (selectedAsset?.id === assetId) {
        setSelectedAsset({ ...selectedAsset, sprites, hasSprites: true })
      }
      
    } catch (error) {
      console.error('Failed to generate sprites:', error)
      alert('Failed to generate sprites. Please check the console for details.')
    } finally {
      setIsGeneratingSprites(false)
    }
  }
  
  const handleSaveCustomMaterials = async () => {
    try {
      // Convert custom materials to the MaterialPreset format
      const newMaterials = customMaterials
        .filter(m => m.name && m.prompt)
        .map(mat => ({
          id: mat.name.toLowerCase().replace(/\s+/g, '-'),
          name: mat.name.toLowerCase().replace(/\s+/g, '-'),
          displayName: mat.displayName || mat.name,
          category: 'custom',
          tier: materialPresets.length + 1,
          color: mat.color || '#888888',
          stylePrompt: mat.prompt,
          description: 'Custom material'
        }))
      
      // Merge with existing presets
      const updatedPresets = [...materialPresets, ...newMaterials]
      
      // Save to JSON file
      const response = await fetch('/api/material-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPresets)
      })
      
      if (response.ok) {
        setMaterialPresets(updatedPresets)
        setCustomMaterials([])
        alert('Custom materials saved successfully!')
      } else {
        throw new Error('Failed to save materials')
      }
    } catch (error) {
      console.error('Failed to save custom materials:', error)
      alert('Failed to save custom materials. Note: This requires a backend endpoint to be implemented.')
    }
  }
  
  const handleUpdatePreset = async (updatedPreset: MaterialPreset) => {
    try {
      const updatedPresets = materialPresets.map(preset => 
        preset.id === updatedPreset.id ? updatedPreset : preset
      )
      
      const response = await fetch('/api/material-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPresets)
      })
      
      if (response.ok) {
        setMaterialPresets(updatedPresets)
        setEditingPreset(null)
        alert('Material preset updated successfully!')
      } else {
        throw new Error('Failed to update preset')
      }
    } catch (error) {
      console.error('Failed to update preset:', error)
      alert('Failed to update material preset.')
    }
  }
  
  const handleDeletePreset = async (presetId: string) => {
    try {
      const updatedPresets = materialPresets.filter(preset => preset.id !== presetId)
      
      const response = await fetch('/api/material-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPresets)
      })
      
      if (response.ok) {
        setMaterialPresets(updatedPresets)
        setSelectedMaterials(selectedMaterials.filter(id => id !== presetId))
        setShowDeleteConfirm(null)
        alert('Material preset deleted successfully!')
      } else {
        throw new Error('Failed to delete preset')
      }
    } catch (error) {
      console.error('Failed to delete preset:', error)
      alert('Failed to delete material preset.')
    }
  }
  
  const handleStartGeneration = async () => {
    if (!assetName || !description) {
      alert('Please fill in all required fields')
      return
    }
    
    setIsGenerating(true)
    setActiveView('progress')
    const updatedPipelineStages = pipelineStages.map(stage => ({
      ...stage,
      status: (stage.id === 'text-input' ? 'active' : 
              stage.id === 'gpt4-enhancement' && !useGPT4Enhancement ? 'skipped' :
              stage.id === 'retexturing' && !enableRetexturing ? 'skipped' :
              stage.id === 'sprites' && !enableSprites ? 'skipped' :
              'idle') as PipelineStage['status']
    }))
    setPipelineStages(updatedPipelineStages)
    
    // Prepare material presets
    let materialVariants = []
    
      if (gameStyle === 'runescape') {
        // RuneScape material presets
        materialVariants = selectedMaterials.map((materialId, index) => {
          const preset = materialPresets.find(p => p.id === materialId)
          return {
            id: materialId,
            name: materialId,
            displayName: preset?.displayName || materialId.charAt(0).toUpperCase() + materialId.slice(1).replace(/-/g, ' '),
            category: preset?.category || (materialId.includes('leather') ? 'leather' : 
                    ['wood', 'oak', 'willow'].includes(materialId) ? 'wood' : 
                    'metal'),
          tier: index + 1,
            color: preset?.color || '#888888',
            stylePrompt: materialPromptOverrides[materialId] || preset?.stylePrompt || `${materialId} texture, low-poly RuneScape style`
          }
        })
      } else {
      // Custom game materials - only use selected materials
        materialVariants = selectedMaterials.map((materialId, index) => {
          const preset = materialPresets.find(p => p.id === materialId)
          return {
            id: materialId,
            name: materialId,
            displayName: preset?.displayName || materialId.charAt(0).toUpperCase() + materialId.slice(1).replace(/-/g, ' '),
            category: preset?.category || 'custom',
            tier: index + 1,
            color: preset?.color || '#888888',
            stylePrompt: materialPromptOverrides[materialId] || preset?.stylePrompt || `${materialId} texture`
          }
        })
    }
    
    // Get the appropriate asset type prompt
    const currentAssetTypePrompt = customAssetTypePrompt || 
      assetTypePrompts[assetType] || 
      customAssetTypes.find(t => t.name.toLowerCase() === assetType)?.prompt || 
      ''
    
    const config: GenerationConfig = {
      name: assetName,
      type: generationType === 'avatar' ? 'character' : assetType,
      subtype: generationType === 'avatar' ? 'humanoid' : assetType,
      description,
      style: gameStyle === 'runescape' ? 'runescape2007' : customStyle,
      assetId: assetName.toLowerCase().replace(/\s+/g, '-'),
      generationType: generationType,
      metadata: {
        gameStyle,
        customGamePrompt: gameStyle === 'custom' ? customGamePrompt : undefined,
        customAssetTypePrompt: currentAssetTypePrompt
      },
      materialPresets: generationType === 'item' ? materialVariants.map(mat => ({
        id: mat.id,
        name: mat.name,
        displayName: mat.displayName,
        category: mat.category,
        tier: mat.tier,
        color: mat.color,
        stylePrompt: mat.stylePrompt
      })) : [],
      enableGeneration: true,
      enableRetexturing: generationType === 'item' ? enableRetexturing : false,
      enableSprites,
      enableRigging: generationType === 'avatar' ? enableRigging : false,
      riggingOptions: generationType === 'avatar' && enableRigging ? {
        heightMeters: characterHeight
      } : undefined,
      spriteConfig: enableSprites ? {
        angles: 8,
        resolution: 512,
        backgroundColor: 'transparent'
      } : undefined,
      customPrompts: {
        gameStyle: gameStyle === 'custom' ? customGamePrompt : undefined,
        assetType: currentAssetTypePrompt
      }
    }
    
    console.log('Starting generation with config:', config)
    console.log('Material variants to generate:', materialVariants)
    console.log('Material presets in config:', config.materialPresets)
    
    try {
      const pipelineId = await apiClient.startPipeline(config)
      setCurrentPipelineId(pipelineId)
    } catch (error) {
      console.error('Failed to start generation:', error)
      setIsGenerating(false)
      alert('Failed to start generation. Please check the console.')
    }
  }

  React.useEffect(() => {
    // Enable smooth scrolling on the body with hidden scrollbar
    const ensureScrollable = () => {
      document.body.style.overflow = 'auto'
      document.documentElement.style.overflow = 'auto'
      document.body.classList.add('hide-scrollbar')
      document.documentElement.classList.add('hide-scrollbar')
    }
    
    // Initial setup
    ensureScrollable()
    
    // Re-apply on any click to ensure scrolling isn't lost
    const handleClick = () => {
      // Small delay to ensure any other handlers have run first
      setTimeout(ensureScrollable, 0)
    }
    
    document.addEventListener('click', handleClick)
    
    return () => {
      document.removeEventListener('click', handleClick)
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.classList.remove('hide-scrollbar')
      document.documentElement.classList.remove('hide-scrollbar')
    }
  }, [])
    
  // Show generation type selector first
  if (!generationType) {
    return (
      <div className="fixed inset-0 overflow-hidden">
        <GenerationTypeSelector onSelectType={setGenerationType} />
      </div>
    )
  }
    
    return (
    <div className="fixed inset-0 bg-bg-primary bg-opacity-95 backdrop-blur-xl z-50 overflow-y-auto animate-fade-in scrollbar-hide">
      {/* Main container with hidden scrollbar for clean appearance while maintaining scroll functionality */}
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-bg-primary backdrop-blur-xl bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 sm:py-4 flex items-center justify-between gap-4">
            {/* Tab Navigation */}
            <div className="flex-1 flex gap-2">
              {[
                { id: 'config', label: 'Configuration', icon: Settings },
                { id: 'progress', label: 'Pipeline', icon: Zap },
                { id: 'results', label: 'Results', icon: Package }
              ].map((tab) => {
                const Icon = tab.icon
                const count = tab.id === 'results' ? generatedAssets.length : 0
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveView(tab.id as 'config' | 'progress' | 'results')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
                      activeView === tab.id
                        ? "bg-bg-secondary text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary hover:bg-opacity-50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {count > 0 && (
                      <span className="ml-1.5 px-2 py-0.5 bg-primary bg-opacity-20 text-primary text-xs rounded-full font-semibold">
                        {count}
                </span>
              )}
                  </button>
                )
              })}
          </div>
          
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Back to type selection */}
              {generationType && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setGenerationType(undefined)
                    setActiveView('config')
                    resetForm()
                    resetPipeline()
                  }}
                  className="text-text-secondary hover:text-text-primary"
                  title="Back to generation type selection"
                >
                  <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                  Back
                </Button>
              )}
          
            {/* Close button only if provided */}
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
            </Button>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24">
          {/* Configuration Form View */}
          {activeView === 'config' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Asset Details Card */}
                  <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border-primary">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2">
                            {generationType === 'avatar' ? (
                              <>
                                <User className="w-5 h-5" />
                                Avatar Details
                              </>
                            ) : (
                              <>
                                <Package className="w-5 h-5" />
                                Asset Details
                              </>
                            )}
                          </CardTitle>
                          <CardDescription>Define what you want to create</CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGenerationType(undefined)
                            setActiveView('config')
                            resetForm()
                            resetPipeline()
                          }}
                          className="text-text-secondary hover:text-text-primary"
                          title="Back to generation type selection"
                        >
                          <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                          Back
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" />
                            {generationType === 'avatar' ? 'Avatar Name' : 'Asset Name'}
              </label>
              <Input
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
                            placeholder={generationType === 'avatar' ? "e.g., Goblin Warrior" : "e.g., Dragon Sword"}
                className="w-full"
              />
            </div>
            
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                Asset Type
              </label>
                          {generationType === 'avatar' ? (
                            <div className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary">
                              👤 Character (Humanoid)
                            </div>
                          ) : (
                          <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                            className="w-full px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all"
                          >
                            <option value="weapon">⚔️ Weapon</option>
                            <option value="armor">🛡️ Armor</option>
                            <option value="tool">🔨 Tool</option>
                            <option value="building">🏰 Building</option>
                            <option value="consumable">🧪 Consumable</option>
                            <option value="resource">💎 Resource</option>
                            {customAssetTypes.filter(t => t.name).map(type => (
                              <option key={type.name} value={type.name.toLowerCase()}>
                                ✨ {type.name}
                              </option>
                            ))}
                          </select>
                          )}
                        </div>
            </div>
            
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe your asset in detail..."
                          rows={4}
                          className="w-full resize-none"
              />
            </div>
            
                      {/* Game Style Selection */}
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-text-primary">
                Game Style
              </label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                  onClick={() => setGameStyle('runescape')}
                            className={cn(
                              "relative p-6 rounded-xl border-2 transition-all duration-200 overflow-hidden group hover:scale-[1.02]",
                              gameStyle === 'runescape' 
                                ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg" 
                                : "border-border-primary hover:border-border-secondary bg-bg-secondary"
                            )}
                          >
                            <div className="relative z-10">
                              <Sword className="w-8 h-8 mx-auto mb-3 text-primary" />
                              <p className="font-semibold text-text-primary">RuneScape 2007</p>
                              <p className="text-xs text-text-secondary mt-1">Classic low-poly style</p>
                            </div>
                            {gameStyle === 'runescape' && (
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent animate-pulse" />
                            )}
                          </button>
                          
                          <button
                  onClick={() => setGameStyle('custom')}
                            className={cn(
                              "relative p-6 rounded-xl border-2 transition-all duration-200 overflow-hidden group hover:scale-[1.02]",
                              gameStyle === 'custom' 
                                ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg" 
                                : "border-border-primary hover:border-border-secondary bg-bg-secondary"
                            )}
                          >
                            <div className="relative z-10">
                              <Settings className="w-8 h-8 mx-auto mb-3 text-primary" />
                              <p className="font-semibold text-text-primary">Custom Style</p>
                              <p className="text-xs text-text-secondary mt-1">Define your own</p>
              </div>
                            {gameStyle === 'custom' && (
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent animate-pulse" />
                            )}
                          </button>
            </div>
            
            {gameStyle === 'custom' && (
                          <div className="animate-slide-up">
                <Input
                  value={customStyle}
                  onChange={(e) => setCustomStyle(e.target.value)}
                              placeholder="e.g., realistic medieval, cartoon, sci-fi"
                  className="w-full"
                />
              </div>
            )}
          </div>
                    </CardContent>
                  </Card>

                  {/* Advanced Prompts Card */}
                  <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
                    <CardHeader 
                      className="cursor-pointer hover:bg-bg-secondary transition-colors"
                      onClick={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                    >
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Brain className="w-5 h-5" />
                          Advanced Prompts
                        </span>
                        <ChevronRight className={cn(
                          "w-5 h-5 transition-transform text-text-tertiary",
                          showAdvancedPrompts && "rotate-90"
                        )} />
                      </CardTitle>
                      <CardDescription>Fine-tune AI generation prompts</CardDescription>
                    </CardHeader>
                    
                    {showAdvancedPrompts && (
                      <CardContent className="p-6 space-y-6 animate-slide-down">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary">
                            Game Style Prompt
                          </label>
                          <Textarea
                            value={customGamePrompt}
                            onChange={(e) => setCustomGamePrompt(e.target.value)}
                            placeholder="e.g., low-poly 3D game asset style with flat shading"
                            rows={3}
                            className="w-full resize-none"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-text-primary">
                              {generationType === 'avatar' ? 'Character Type Specific Prompt' : 'Asset Type Specific Prompt'}
            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowAssetTypeEditor(!showAssetTypeEditor)}
                            >
                              {showAssetTypeEditor ? 'Hide' : 'Manage'} Types
                            </Button>
                          </div>
                          <Textarea
                            value={customAssetTypePrompt}
                            onChange={(e) => setCustomAssetTypePrompt(e.target.value)}
                            placeholder={generationType === 'avatar' 
                              ? "e.g., Show the full character in T-pose, front view on neutral background"
                              : "e.g., Show the full weapon clearly on a neutral background"
                            }
                            rows={3}
                            className="w-full resize-none"
                          />
                        </div>
                        
                        {showAssetTypeEditor && (
                          <div className="p-4 bg-bg-tertiary rounded-lg space-y-4 animate-fade-in max-h-96 overflow-y-auto custom-scrollbar">
                            <div className="space-y-3">
                              <p className="text-sm font-medium text-text-secondary">
                                {generationType === 'avatar' ? 'Default Character Types' : 'Default Asset Types'}
                              </p>
                              {(generationType === 'avatar' 
                                ? ['character', 'humanoid', 'npc', 'creature'] 
                                : ['weapon', 'armor', 'tool', 'building', 'consumable', 'resource']
                              ).map(type => (
                                <div key={type} className="space-y-1">
                                  <label className="text-xs text-text-tertiary capitalize">{type}</label>
                                  <Textarea
                                    value={assetTypePrompts[type] || ''}
                                    onChange={(e) => {
                                      setAssetTypePrompts({
                                        ...assetTypePrompts,
                                        [type]: e.target.value
                                      })
                                    }}
                                    placeholder={generationType === 'avatar' 
                                      ? `Default ${type} character prompt...`
                                      : `Default ${type} prompt...`
                                    }
                                    rows={2}
                                    className="w-full text-sm resize-none"
                                  />
                                </div>
                              ))}
                            </div>
                            
                            <div className="border-t border-border-primary pt-4">
                              <p className="text-sm font-medium text-text-secondary mb-3">
                                {generationType === 'avatar' ? 'Custom Character Types' : 'Custom Asset Types'}
                              </p>
                              <div className="space-y-2">
                                {customAssetTypes.map((type, index) => (
                                  <div key={index} className="flex gap-2">
                                    <Input
                                      placeholder={generationType === 'avatar' ? "Character type" : "Type name"}
                                      value={type.name}
                                      onChange={(e) => {
                                        const updated = [...customAssetTypes]
                                        updated[index].name = e.target.value
                                        setCustomAssetTypes(updated)
                                      }}
                                      className="w-32"
                                    />
                                    <Input
                                      placeholder={generationType === 'avatar' ? "Character type prompt" : "Type-specific prompt"}
                                      value={type.prompt}
                                      onChange={(e) => {
                                        const updated = [...customAssetTypes]
                                        updated[index].prompt = e.target.value
                                        setCustomAssetTypes(updated)
                                      }}
                                      className="flex-1"
                                    />
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setCustomAssetTypes(customAssetTypes.filter((_, i) => i !== index))
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    addCustomAssetType({ name: '', prompt: '' })
                                  }}
                                  className="w-full"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  {generationType === 'avatar' ? 'Add Character Type' : 'Add Custom Type'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>

                  {/* Additional Info Card */}
                  <Card className="overflow-hidden shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Info className="w-5 h-5" />
                        Generation Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <h4 className="font-medium text-text-primary mb-2">What happens next?</h4>
                        <ul className="space-y-2 text-sm text-text-secondary">
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>AI will enhance your prompts for better results</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Concept art will be generated based on your description</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>3D model will be created from the concept art</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary mt-0.5">•</span>
                            <span>Material variants and sprites can be generated</span>
                          </li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  {/* Pipeline Options */}
                  <Card className="shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5" />
                        Pipeline Options
                      </CardTitle>
                      <CardDescription>Configure generation features</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[
                        {
                          id: 'gpt4',
                          label: 'GPT-4 Enhancement',
                          description: 'Improve prompts with AI',
                          checked: useGPT4Enhancement,
                          onChange: setUseGPT4Enhancement,
                          icon: Brain
                        },
                        ...(generationType === 'avatar' ? [{
                          id: 'rigging',
                          label: 'Auto-Rigging',
                          description: 'Add skeleton & animations',
                          checked: enableRigging,
                          onChange: setEnableRigging,
                          icon: User
                        }] : []),
                        ...(generationType === 'item' ? [
                          {
                            id: 'retexture',
                            label: 'Material Variants',
                            description: 'Generate multiple textures',
                            checked: enableRetexturing,
                            onChange: setEnableRetexturing,
                            icon: Palette
                          },
                          {
                            id: 'sprites',
                            label: '2D Sprites',
                            description: 'Generate 8-directional sprites',
                            checked: enableSprites,
                            onChange: setEnableSprites,
                            icon: Grid3x3
                          }
                        ] : [])
                      ].map((option) => {
                        const Icon = option.icon
                        return (
                          <label 
                            key={option.id}
                            className="flex items-start gap-3 cursor-pointer group p-3 rounded-lg hover:bg-bg-secondary transition-colors"
                          >
              <input
                type="checkbox"
                              checked={option.checked}
                              onChange={(e) => option.onChange(e.target.checked)}
                              className="mt-1 w-4 h-4 rounded border-border-primary text-primary focus:ring-primary focus:ring-offset-0"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4 text-primary" />
                                <span className="font-medium text-text-primary group-hover:text-primary transition-colors">
                                  {option.label}
              </span>
          </div>
                              <p className="text-xs text-text-tertiary mt-0.5">{option.description}</p>
        </div>
                          </label>
                        )
                      })}
                    </CardContent>
                  </Card>
        
                  {/* Material Variants */}
        {enableRetexturing && generationType === 'item' && (
                    <Card className="animate-fade-in shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Palette className="w-5 h-5" />
                          Material Variants
                        </CardTitle>
                        <CardDescription>Select materials for your asset</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {gameStyle === 'runescape' && (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-text-secondary">
                                Preset Materials
                              </p>
                    <Button
                                variant="ghost"
                      size="sm"
                                onClick={() => setEditMaterialPrompts(!editMaterialPrompts)}
                              >
                                {editMaterialPrompts ? 'Hide' : 'Edit'}
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              {isLoadingMaterials ? (
                                <div className="col-span-3 flex items-center justify-center py-8">
                                  <Loader2 className="w-6 h-6 animate-spin text-text-secondary" />
                                  <span className="ml-2 text-sm text-text-secondary">Loading materials...</span>
                                </div>
                              ) : materialPresets.length === 0 ? (
                                <div className="col-span-3 text-center py-8 text-sm text-text-secondary">
                                  No material presets available
                                </div>
                              ) : (
                                materialPresets.map(preset => (
                                  <div
                                    key={preset.id}
                                    className={cn(
                                      "relative group p-3 rounded-lg border-2 transition-all duration-200",
                                      selectedMaterials.includes(preset.id)
                                        ? "border-primary bg-primary bg-opacity-10"
                                        : "border-border-primary hover:border-primary hover:bg-bg-secondary"
                                    )}
                                  >
                                    <button
                      onClick={() => {
                        toggleMaterialSelection(preset.id)
                                      }}
                                      className="w-full text-left"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-4 h-4 rounded-full flex-shrink-0"
                                          style={{ backgroundColor: preset.color }}
                                        />
                                        <span className="truncate text-sm font-medium">
                                          {preset.displayName}
                                        </span>
                </div>
                                    </button>
                                    
                                    {/* Edit and Delete buttons */}
                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setEditingPreset(preset)
                                        }}
                                        className="p-1 hover:bg-bg-tertiary rounded transition-colors"
                                        title="Edit preset"
                                      >
                                        <Edit2 className="w-3 h-3 text-text-secondary hover:text-text-primary" />
                                      </button>
                                      {preset.category === 'custom' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setShowDeleteConfirm(preset.id)
                                          }}
                                          className="p-1 hover:bg-error hover:bg-opacity-20 rounded transition-colors"
                                          title="Delete preset"
                                        >
                                          <Trash2 className="w-3 h-3 text-text-secondary hover:text-error" />
                                        </button>
                                      )}
              </div>
                                  </div>
                                ))
                              )}
                </div>
                            
                            {editMaterialPrompts && selectedMaterials.length > 0 && (
                              <div className="space-y-3 p-4 bg-bg-tertiary rounded-lg animate-fade-in">
                                {selectedMaterials.map(matId => {
                                  const preset = materialPresets.find(p => p.id === matId)
                                  return (
                                    <div key={matId} className="space-y-1">
                                      <label className="text-xs font-medium text-text-tertiary">
                                        {preset?.displayName || matId.replace(/-/g, ' ')}
                                      </label>
                                      <Textarea
                                        value={materialPromptOverrides[matId] || preset?.stylePrompt || ''}
                                        onChange={(e) => {
                                          setMaterialPromptOverrides({
                                            ...materialPromptOverrides,
                                            [matId]: e.target.value
                                          })
                                        }}
                                        placeholder="Enter custom prompt..."
                                        rows={2}
                                        className="text-xs font-mono"
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Custom Materials */}
                        <div>
                          <p className="text-sm font-medium text-text-secondary mb-3">
                            {gameStyle === 'runescape' ? 'Additional' : 'Custom'} Materials
                          </p>
                          <div className="space-y-2">
                {customMaterials.map((mat, index) => (
                              <div key={index} className="p-3 bg-bg-tertiary rounded-lg space-y-2">
                                <div className="flex gap-2">
                    <Input
                                    placeholder="ID"
                      value={mat.name}
                      onChange={(e) => {
                        const updated = [...customMaterials]
                        updated[index].name = e.target.value
                        setCustomMaterials(updated)
                      }}
                                    className="w-24 text-sm"
                    />
                    <Input
                                    placeholder="Display Name"
                                    value={mat.displayName || ''}
                      onChange={(e) => {
                        const updated = [...customMaterials]
                                      updated[index].displayName = e.target.value
                        setCustomMaterials(updated)
                      }}
                                    className="flex-1 text-sm"
                                  />
                                  <input
                                    type="color"
                                    value={mat.color || '#888888'}
                                    onChange={(e) => {
                                      const updated = [...customMaterials]
                                      updated[index].color = e.target.value
                                      setCustomMaterials(updated)
                                    }}
                                    className="w-10 h-10 border border-border-primary rounded cursor-pointer"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCustomMaterials(customMaterials.filter((_, i) => i !== index))
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                                </div>
                                <Textarea
                                  placeholder="Material texture prompt"
                                  value={mat.prompt}
                                  onChange={(e) => {
                                    const updated = [...customMaterials]
                                    updated[index].prompt = e.target.value
                                    setCustomMaterials(updated)
                                  }}
                                  rows={2}
                                  className="w-full text-sm resize-none"
                                />
                  </div>
                ))}
                <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                      addCustomMaterial({ name: '', prompt: '', color: '#888888' })
                  }}
                    className="flex-1"
                >
                    <Plus className="w-4 h-4 mr-2" />
                  Add Material
                </Button>
                  {customMaterials.filter(m => m.name && m.prompt).length > 0 && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveCustomMaterials}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Save to Presets
                    </Button>
            )}
          </div>
      </div>
          </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Avatar Rigging Options */}
                  {generationType === 'avatar' && enableRigging && (
                    <Card className="animate-fade-in shadow-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="w-5 h-5" />
                          Rigging Options
                        </CardTitle>
                        <CardDescription>Configure character rigging</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-text-primary">
                            Character Height (meters)
                          </label>
                          <Input
                            type="number"
                            value={characterHeight}
                            onChange={(e) => setCharacterHeight(parseFloat(e.target.value) || 1.7)}
                            min="0.5"
                            max="3.0"
                            step="0.1"
                            className="w-full"
                          />
                          <p className="text-xs text-text-tertiary">
                            Standard human height is 1.7m
                          </p>
                        </div>
                        
                        <div className="p-3 bg-bg-tertiary rounded-lg space-y-2">
                          <p className="text-sm font-medium text-text-primary">
                            Included Animations:
                          </p>
                          <ul className="text-sm text-text-secondary space-y-1">
                            <li className="flex items-center gap-2">
                              <span className="text-primary">•</span>
                              Walking animation
                            </li>
                            <li className="flex items-center gap-2">
                              <span className="text-primary">•</span>
                              Running animation
                            </li>
                          </ul>
                        </div>
                        
                        <div className="p-3 bg-warning bg-opacity-10 border border-warning border-opacity-20 rounded-lg">
                          <p className="text-xs text-warning">
                            ⚠️ Auto-rigging works best with humanoid characters that have clearly defined limbs
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Start Generation Button */}
            <Button
              onClick={handleStartGeneration}
                    disabled={!assetName || !description || isGenerating}
                    className="w-full h-14 text-base font-semibold shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                    size="lg"
            >
              {isGenerating ? (
                <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                        <Sparkles className="w-5 h-5 mr-2" />
                  Start Generation
                </>
              )}
            </Button>
          </div>
        </div>
          </div>
          )}

          {/* Progress View */}
          {activeView === 'progress' && (
            <div className="animate-fade-in space-y-8">
              <Card className="overflow-hidden shadow-xl">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border-primary">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl">Generation Pipeline</CardTitle>
                      <CardDescription>Tracking your asset creation progress</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setGenerationType(undefined)
                        setActiveView('config')
                        resetForm()
                        resetPipeline()
                      }}
                      className="text-text-secondary hover:text-text-primary"
                      title="Back to generation type selection"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                      Back
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="space-y-6">
                    {pipelineStages
                      .filter(stage => {
                        // Hide material variants and sprites for avatar generation
                        if (generationType === 'avatar') {
                          return stage.id !== 'retexturing' && stage.id !== 'sprites'
                        }
                        return true
                      })
                      .map((stage, index) => {
                      const isActive = stage.status === 'active'
                      const isComplete = stage.status === 'completed'
                      const isFailed = stage.status === 'failed'
                      const isSkipped = stage.status === 'skipped'
                
                return (
                        <div key={stage.id} className="relative">
                          <div className={cn(
                            "flex items-center gap-4 p-5 rounded-xl border-2 transition-all duration-300 hover:scale-[1.01]",
                            isActive && "border-primary bg-gradient-to-r from-primary/10 to-primary/5 shadow-lg animate-pulse",
                            isComplete && "border-success bg-gradient-to-r from-success/10 to-success/5",
                            isFailed && "border-error bg-gradient-to-r from-error/10 to-error/5",
                            isSkipped && "opacity-50 border-border-secondary",
                            !isActive && !isComplete && !isFailed && !isSkipped && "border-border-primary hover:border-border-secondary"
                          )}>
                            <div className={cn(
                              "flex items-center justify-center w-12 h-12 rounded-full transition-all",
                              isActive && "bg-primary text-white shadow-lg scale-110",
                              isComplete && "bg-success text-white",
                              isFailed && "bg-error text-white",
                              isSkipped && "bg-bg-tertiary text-text-muted",
                              !isActive && !isComplete && !isFailed && !isSkipped && "bg-bg-tertiary text-text-tertiary"
                            )}>
                              {isActive ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                              ) : isComplete ? (
                                <CheckCircle className="w-6 h-6" />
                              ) : isFailed ? (
                                <XCircle className="w-6 h-6" />
                              ) : stage.icon ? (
                                React.cloneElement(stage.icon as React.ReactElement, {
                                  className: "w-6 h-6"
                                })
                              ) : (
                                <Sparkles className="w-6 h-6" />
                              )}
                    </div>
                    
                            <div className="flex-1">
                              <h4 className="font-semibold text-text-primary text-lg">{stage.name}</h4>
                              <p className="text-sm text-text-secondary mt-1">{stage.description}</p>
                        </div>
                            
                            {isActive && (
                              <div className="flex items-center gap-3">
                                <Progress value={50} className="w-32" />
                                <span className="text-sm font-medium text-primary animate-pulse">
                                  Processing...
                                </span>
                      </div>
                    )}
                    
                            {isComplete && (
                              <Badge variant="success" className="text-sm">
                                Complete
                              </Badge>
                    )}
                  </div>
                          
                          {index < pipelineStages.length - 1 && (
                            <div className={cn(
                              "absolute left-7 top-full w-0.5 h-6 -translate-x-1/2 transition-all",
                              (isComplete || isActive) ? "bg-primary" : "bg-border-primary"
                            )} />
        )}
      </div>
                      )
                    })}
        </div>
        
                  <div className="mt-8 flex justify-center">
                    <Button 
                      variant="secondary" 
                      onClick={() => setActiveView('config')}
                      disabled={isGenerating}
                      size="lg"
                      className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                      Back to Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>

              {/* Additional Progress Info */}
              <Card className="shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Generation Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
                      <span className="text-sm text-text-secondary">Started</span>
                      <span className="text-sm font-medium text-text-primary">
                        {new Date().toLocaleTimeString()}
                      </span>
              </div>
                    <div className="flex justify-between items-center p-4 bg-bg-secondary rounded-lg">
                      <span className="text-sm text-text-secondary">Estimated completion</span>
                      <span className="text-sm font-medium text-text-primary">
                        ~5-10 minutes
                      </span>
            </div>
        </div>
                </CardContent>
              </Card>
      </div>
          )}

          {/* Results View */}
          {activeView === 'results' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Asset List */}
                <Card className="lg:col-span-1 h-fit lg:sticky lg:top-20 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <CardTitle>Generated Assets</CardTitle>
                        <CardDescription>{generatedAssets.length} assets created</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGenerationType(undefined)
                          setActiveView('config')
                          resetForm()
                          resetPipeline()
                        }}
                        className="text-text-secondary hover:text-text-primary"
                        title="Back to generation type selection"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
                        Back
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
                      {generatedAssets.map((asset) => (
                        <button
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className={cn(
                            "w-full p-4 rounded-lg text-left transition-all duration-200 hover:scale-[1.02]",
                            selectedAsset?.id === asset.id
                              ? "bg-gradient-to-r from-primary/20 to-primary/10 border border-primary shadow-md"
                              : "hover:bg-bg-secondary border border-transparent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                      <div>
                              <p className="font-medium text-text-primary">
                                {asset.name.replace('-base', '').split('-').map((word: string) => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                              </p>
                              <p className="text-xs text-text-tertiary mt-1">
                                {asset.createdAt ? new Date(asset.createdAt).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>
                            <CheckCircle className="w-5 h-5 text-success" />
                          </div>
                        </button>
                          ))}
                        </div>
                  </CardContent>
                </Card>

                {/* Asset Details */}
                <div className="lg:col-span-3 space-y-8">
                  {selectedAsset ? (
                    <>
                      {/* 3D Preview */}
                      <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
                        <CardHeader>
                          <CardTitle>3D Preview</CardTitle>
                          <CardDescription>Interactive model viewer</CardDescription>
                        </CardHeader>
                                                <CardContent className="p-0">
                          <div className="aspect-video bg-gradient-to-br from-bg-secondary to-bg-tertiary relative">
                            {(selectedAsset.hasModel || selectedAsset.modelUrl) ? (
                              <>
                                {(generationType === 'avatar' && selectedAsset && 
                                  'isRigged' in selectedAsset.metadata && selectedAsset.metadata.isRigged && 
                                  'animations' in selectedAsset.metadata && selectedAsset.metadata.animations) ? (
                                  <AnimationPlayer
                                    modelUrl={selectedAsset.modelUrl || `/api/assets/${selectedAsset.id}/model`}
                                    animations={
                                      hasAnimations(selectedAsset) ? selectedAsset.metadata.animations : { basic: {} }
                                    }
                                    assetId={selectedAsset.id}
                                    className="w-full h-full"
                                  />
                                ) : (
                                  <ThreeViewer
                                    modelUrl={selectedAsset.modelUrl || `/api/assets/${selectedAsset.id}/model`}
                                    assetInfo={{
                                      name: selectedAsset.name,
                                      type: selectedAsset.type || 'character'
                                    }}
                                  />
                                )}
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                  <Box className="w-16 h-16 text-text-muted mx-auto mb-4" />
                                  <p className="text-text-secondary">No 3D model available</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                        {(selectedAsset.modelUrl || selectedAsset.hasModel || selectedAsset.metadata?.hasModel) && (
                          <CardFooter className="bg-bg-secondary">
                            <a
                              href={selectedAsset.modelUrl || `/api/assets/${selectedAsset.id}/model`}
                              download={`${selectedAsset.id}.glb`}
                              className="inline-flex items-center gap-2 text-primary hover:text-primary-hover transition-colors"
                            >
                              <Download className="w-4 h-4" />
                                Download GLB Model
                              </a>
                          </CardFooter>
                        )}
                      </Card>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Material Variants */}
                        {generationType === 'item' && (
                          <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
                          <CardHeader>
                            <CardTitle>Material Variants</CardTitle>
                            <CardDescription>
                              {selectedAsset.variants?.length || 0} variants generated
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                              {selectedAsset.variants?.map((variant, i) => {
                                const materialName = ('id' in variant && variant.id ? variant.id.split('-').pop() : 'name' in variant ? variant.name : undefined) || `Variant ${i + 1}`
                                const materialColors: Record<string, string> = {
                                  bronze: '#CD7F32',
                                  steel: '#C0C0C0',
                                  mithril: '#3D5D8F',
                                  wood: '#DEB887',
                                  oak: '#BC9A6A',
                                  willow: '#F5DEB3',
                                  leather: '#8B4513',
                                  'hard-leather': '#654321',
                                  'studded-leather': '#4A4A4A'
                                }
                                const color = materialColors[materialName.toLowerCase()] || '#888888'
                                
                                return (
                                  <div key={i} className="group cursor-pointer">
                                    <div className="aspect-square bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded-xl p-6 relative overflow-hidden transition-all hover:shadow-xl hover:scale-105">
                                      <div 
                                        className="absolute inset-0 opacity-30"
                                        style={{ backgroundColor: color }}
                                      />
                                      <Box className="w-full h-full text-text-tertiary relative z-10" />
                                      {'success' in variant && (variant as { success?: boolean }).success && (
                                        <CheckCircle className="absolute top-3 right-3 w-5 h-5 text-success" />
                              )}
                            </div>
                                    <p className="text-sm font-medium text-center mt-3 capitalize">
                                      {materialName}
                                    </p>
                          </div>
                  )
                              })}
                        </div>
                          </CardContent>
                        </Card>
                        )}

                        {/* 2D Sprites */}
                        {generationType === 'item' && (
                          <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow">
                          <CardHeader>
                            <CardTitle>2D Sprites</CardTitle>
                            <CardDescription>
                              8-directional sprite sheet
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            {selectedAsset.sprites ? (
                              <div className="grid grid-cols-4 gap-3">
                                {selectedAsset.sprites.map((sprite: { angle: number; imageUrl: string }, i: number) => (
                                  <div key={i} className="group relative aspect-square">
                                    <div className="w-full h-full bg-bg-tertiary rounded-lg p-2 overflow-hidden hover:shadow-lg transition-all hover:scale-105">
                                      <img 
                                        src={sprite.imageUrl} 
                                        alt={`${sprite.angle}°`}
                                        className="w-full h-full object-contain"
                                      />
                                      <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <a
                                          href={sprite.imageUrl}
                                          download={`${selectedAsset.id}-${sprite.angle}deg.png`}
                                          className="p-2 bg-primary rounded-lg text-white hover:bg-primary-hover transition-colors"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Download className="w-5 h-5" />
                                        </a>
                      </div>
                          </div>
                                    <p className="text-xs text-text-tertiary mt-2 text-center">{sprite.angle}°</p>
                          </div>
                        ))}
                      </div>
                            ) : (
                              <div className="text-center py-12">
                                <Grid3x3 className="w-12 h-12 text-text-muted mx-auto mb-4" />
                                <p className="text-text-secondary mb-4">
                                  {selectedAsset.hasSpriteMetadata ? 'Ready to generate sprites' : 'Sprite generation not enabled'}
                                </p>
                                {selectedAsset.hasSpriteMetadata && (
                                  <Button
                                    onClick={() => handleGenerateSprites(selectedAsset.id)}
                                    disabled={isGeneratingSprites}
                                    className="shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                                  >
                                    {isGeneratingSprites ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Generating...
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Sprites
                                      </>
                                    )}
                                  </Button>
                                )}
                          </div>
                        )}
                          </CardContent>
                        </Card>
                        )}
                      </div>

                      {/* Actions */}
                      <Card className="shadow-xl">
                        <CardContent className="p-6">
                          <div className="flex flex-wrap gap-4">
                            <Button variant="secondary" className="hover:scale-[1.02] transition-all">
                              <Download className="w-4 h-4 mr-2" />
                              Download All Assets
                            </Button>
                            <Button variant="secondary" className="hover:scale-[1.02] transition-all">
                              <Palette className="w-4 h-4 mr-2" />
                              Add More Variants
                            </Button>
                            <Button variant="secondary" className="hover:scale-[1.02] transition-all">
                              <Eye className="w-4 h-4 mr-2" />
                              Open in Asset Browser
                            </Button>
                            <Button 
                              variant="secondary"
                              onClick={() => {
                                setActiveView('config')
                                setAssetName('')
                                setDescription('')
                              }}
                              className="hover:scale-[1.02] transition-all"
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Generate New Asset
                            </Button>
                    </div>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card className="h-96 flex items-center justify-center shadow-xl">
                      <div className="text-center">
                        <Package className="w-20 h-20 text-text-muted mx-auto mb-6" />
                        <h3 className="text-xl font-semibold text-text-primary mb-3">
                          No Asset Selected
                        </h3>
                        <p className="text-text-secondary">
                          Select an asset from the list to view details
                      </p>
                              </div>
                    </Card>
                  )}
                              </div>
                            </div>
                          </div>
      )}
                      </div>
                    </div>
      
      {/* Edit Material Preset Modal */}
      {editingPreset && (
        <Modal open={!!editingPreset} onClose={() => setEditingPreset(null)}>
          <ModalHeader title="Edit Material Preset" onClose={() => setEditingPreset(null)} />
          <ModalBody>
                    <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text-secondary">ID (cannot be changed)</label>
                <Input
                  value={editingPreset.id}
                  disabled
                  className="mt-1"
                />
                            </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Display Name</label>
                <Input
                  value={editingPreset.displayName}
                  onChange={(e) => setEditingPreset({
                    ...editingPreset,
                    displayName: e.target.value
                  })}
                  placeholder="Display Name"
                  className="mt-1"
                />
                          </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Material Texture Prompt</label>
                <Textarea
                  value={editingPreset.stylePrompt}
                  onChange={(e) => setEditingPreset({
                    ...editingPreset,
                    stylePrompt: e.target.value
                  })}
                  placeholder="Material texture prompt"
                  rows={3}
                  className="mt-1"
                />
                      </div>
              <div>
                <label className="text-sm font-medium text-text-secondary">Color</label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="color"
                    value={editingPreset.color}
                    onChange={(e) => setEditingPreset({
                      ...editingPreset,
                      color: e.target.value
                    })}
                    className="w-16 h-10"
                  />
                  <Input
                    value={editingPreset.color}
                    onChange={(e) => setEditingPreset({
                      ...editingPreset,
                      color: e.target.value
                    })}
                    placeholder="#000000"
                    className="flex-1"
                  />
                    </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setEditingPreset(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => handleUpdatePreset(editingPreset)}>
              Save Changes
            </Button>
          </ModalFooter>
        </Modal>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal open={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)}>
          <ModalHeader title="Delete Material Preset" onClose={() => setShowDeleteConfirm(null)} />
          <ModalBody>
                  <div className="space-y-4">
              <p className="text-text-secondary">
                Are you sure you want to delete this material preset? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 p-4 bg-error bg-opacity-10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                <p className="text-sm">
                  Material preset <strong>{materialPresets.find(p => p.id === showDeleteConfirm)?.displayName}</strong> will be permanently deleted.
                </p>
                  </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              className="bg-error hover:bg-error-dark"
              onClick={() => handleDeletePreset(showDeleteConfirm)}
            >
              Delete Preset
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </div>
  )
}

export default GenerationDashboard 