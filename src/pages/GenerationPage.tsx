import React, { useState, useEffect } from 'react'
import {
  Button
} from '../components/common'
import {
  ChevronRight, Sparkles,
  Box, Grid3x3,
  FileText, Brain, Camera, Layers,
  X, Loader2, User
} from 'lucide-react'
import { MaterialPreset } from '../types'
import { GenerationAPIClient } from '../services/api/GenerationAPIClient'
import { Asset } from '../services/api/AssetService'
import { spriteGeneratorClient } from '../utils/sprite-generator-client'
import { useGenerationStore } from '../store'
import type { PipelineStage } from '../store'
import { usePipelineStatus } from '../hooks/usePipelineStatus'
import { useMaterialPresets } from '../hooks/useMaterialPresets'
import { buildGenerationConfig } from '../utils/generationConfigBuilder'

// Import all Generation components from single location
import {
  AssetDetailsCard,
  PipelineOptionsCard,
  AdvancedPromptsCard,
  MaterialVariantsCard,
  AvatarRiggingOptionsCard,
  GenerationTypeSelector,
  TabNavigation,
  GeneratedAssetsList,
  AssetPreviewCard,
  MaterialVariantsDisplay,
  SpritesDisplay,
  PipelineProgressCard,
  EditMaterialPresetModal,
  DeleteConfirmationModal,
  GenerationInfoCard,
  GenerationTimeline,
  AssetActionsCard,
  NoAssetSelected
} from '../components/Generation'

interface GenerationPageProps {
  onClose?: () => void
  onNavigateToAssets?: () => void
  onNavigateToAsset?: (assetId: string) => void
}

export const GenerationPage: React.FC<GenerationPageProps> = ({ onClose }) => {
  const [apiClient] = useState(() => new GenerationAPIClient())

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

    // Avatar Configuration
    enableRigging,
    characterHeight,

    // Material Configuration
    selectedMaterials,
    customMaterials,
    materialPromptOverrides,

    // Pipeline State
    isGenerating,
    isGeneratingSprites,
    pipelineStages,

    // Results State
    generatedAssets,
    selectedAsset,

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
    setUseGPT4Enhancement,
    setEnableRetexturing,
    setEnableSprites,
    setEnableRigging,
    setCharacterHeight,
    setSelectedMaterials,
    setCustomMaterials,
    setMaterialPromptOverrides,
    addCustomMaterial,
    toggleMaterialSelection,
    setIsGenerating,
    setCurrentPipelineId,
    setIsGeneratingSprites,
    setModelLoadError,
    setIsModelLoading,
    setPipelineStages,
    setGeneratedAssets,
    setSelectedAsset,
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

  // Use the pipeline status hook
  usePipelineStatus({ apiClient })

  // Use the material presets hook
  const { handleSaveCustomMaterials, handleUpdatePreset, handleDeletePreset } = useMaterialPresets()

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

    // Get the appropriate asset type prompt
    const currentAssetTypePrompt = customAssetTypePrompt ||
      assetTypePrompts[assetType] ||
      customAssetTypes.find(t => t.name.toLowerCase() === assetType)?.prompt ||
      ''

    const config = buildGenerationConfig({
      assetName,
      assetType,
      description,
      generationType,
      gameStyle,
      customStyle,
      customGamePrompt,
      customAssetTypePrompt: currentAssetTypePrompt,
      enableRetexturing,
      enableSprites,
      enableRigging,
      characterHeight,
      selectedMaterials,
      materialPresets,
      materialPromptOverrides
    })

    console.log('Starting generation with config:', config)
    console.log('Material variants to generate:', config.materialPresets)

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
            <TabNavigation
              activeView={activeView}
              generatedAssetsCount={generatedAssets.length}
              onTabChange={setActiveView}
            />

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
                  <AssetDetailsCard
                    generationType={generationType}
                    assetName={assetName}
                    assetType={assetType}
                    description={description}
                    gameStyle={gameStyle}
                    customStyle={customStyle}
                    customAssetTypes={customAssetTypes}
                    onAssetNameChange={setAssetName}
                    onAssetTypeChange={setAssetType}
                    onDescriptionChange={setDescription}
                    onGameStyleChange={setGameStyle}
                    onCustomStyleChange={setCustomStyle}
                    onBack={() => {
                      setGenerationType(undefined)
                      setActiveView('config')
                      resetForm()
                      resetPipeline()
                    }}
                  />

                  {/* Advanced Prompts Card */}
                  <AdvancedPromptsCard
                    showAdvancedPrompts={showAdvancedPrompts}
                    showAssetTypeEditor={showAssetTypeEditor}
                    generationType={generationType}
                    customGamePrompt={customGamePrompt}
                    customAssetTypePrompt={customAssetTypePrompt}
                    assetTypePrompts={assetTypePrompts}
                    customAssetTypes={customAssetTypes}
                    onToggleAdvancedPrompts={() => setShowAdvancedPrompts(!showAdvancedPrompts)}
                    onToggleAssetTypeEditor={() => setShowAssetTypeEditor(!showAssetTypeEditor)}
                    onCustomGamePromptChange={setCustomGamePrompt}
                    onCustomAssetTypePromptChange={setCustomAssetTypePrompt}
                    onAssetTypePromptsChange={setAssetTypePrompts}
                    onCustomAssetTypesChange={setCustomAssetTypes}
                    onAddCustomAssetType={addCustomAssetType}
                  />

                  {/* Additional Info Card */}
                  <GenerationInfoCard />
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                  {/* Pipeline Options */}
                  <PipelineOptionsCard
                    generationType={generationType}
                    useGPT4Enhancement={useGPT4Enhancement}
                    enableRetexturing={enableRetexturing}
                    enableSprites={enableSprites}
                    enableRigging={enableRigging}
                    onUseGPT4EnhancementChange={setUseGPT4Enhancement}
                    onEnableRetexturingChange={setEnableRetexturing}
                    onEnableSpritesChange={setEnableSprites}
                    onEnableRiggingChange={setEnableRigging}
                  />

                  {/* Material Variants */}
                  {enableRetexturing && generationType === 'item' && (
                    <MaterialVariantsCard
                      gameStyle={gameStyle}
                      isLoadingMaterials={isLoadingMaterials}
                      materialPresets={materialPresets}
                      selectedMaterials={selectedMaterials}
                      customMaterials={customMaterials}
                      materialPromptOverrides={materialPromptOverrides}
                      editMaterialPrompts={editMaterialPrompts}
                      onToggleMaterialSelection={toggleMaterialSelection}
                      onEditMaterialPromptsToggle={() => setEditMaterialPrompts(!editMaterialPrompts)}
                      onMaterialPromptOverride={(materialId, prompt) => {
                        setMaterialPromptOverrides({
                          ...materialPromptOverrides,
                          [materialId]: prompt
                        })
                      }}
                      onAddCustomMaterial={addCustomMaterial}
                      onUpdateCustomMaterial={(index, material) => {
                        const updated = [...customMaterials]
                        updated[index] = material
                        setCustomMaterials(updated)
                      }}
                      onRemoveCustomMaterial={(index) => {
                        setCustomMaterials(customMaterials.filter((_, i) => i !== index))
                      }}
                      onSaveCustomMaterials={handleSaveCustomMaterials}
                      onEditPreset={setEditingPreset}
                      onDeletePreset={setShowDeleteConfirm}
                    />
                  )}

                  {/* Avatar Rigging Options */}
                  {generationType === 'avatar' && enableRigging && (
                    <AvatarRiggingOptionsCard
                      characterHeight={characterHeight}
                      onCharacterHeightChange={setCharacterHeight}
                    />
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
              <PipelineProgressCard
                pipelineStages={pipelineStages}
                generationType={generationType}
                isGenerating={isGenerating}
                onBackToConfig={() => setActiveView('config')}
                onBack={() => {
                  setGenerationType(undefined)
                  setActiveView('config')
                  resetForm()
                  resetPipeline()
                }}
              />

              {/* Additional Progress Info */}
              <GenerationTimeline />
            </div>
          )}

          {/* Results View */}
          {activeView === 'results' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Asset List */}
                <GeneratedAssetsList
                  generatedAssets={generatedAssets}
                  selectedAsset={selectedAsset}
                  onAssetSelect={setSelectedAsset}
                  onBack={() => {
                    setGenerationType(undefined)
                    setActiveView('config')
                    resetForm()
                    resetPipeline()
                  }}
                />

                {/* Asset Details */}
                <div className="lg:col-span-3 space-y-8">
                  {selectedAsset ? (
                    <>
                      {/* 3D Preview */}
                      <AssetPreviewCard
                        selectedAsset={selectedAsset}
                        generationType={generationType}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Material Variants */}
                        {generationType === 'item' && selectedAsset.variants && (
                          <MaterialVariantsDisplay variants={selectedAsset.variants} />
                        )}

                        {/* 2D Sprites */}
                        {generationType === 'item' && (
                          <SpritesDisplay
                            selectedAsset={selectedAsset}
                            isGeneratingSprites={isGeneratingSprites}
                            onGenerateSprites={handleGenerateSprites}
                          />
                        )}
                      </div>

                      {/* Actions */}
                      <AssetActionsCard
                        onGenerateNew={() => {
                          setActiveView('config')
                          setAssetName('')
                          setDescription('')
                        }}
                      />
                    </>
                  ) : (
                    <NoAssetSelected />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Material Preset Modal */}
      {editingPreset && (
        <EditMaterialPresetModal
          editingPreset={editingPreset}
          onClose={() => setEditingPreset(null)}
          onSave={handleUpdatePreset}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <DeleteConfirmationModal
          showDeleteConfirm={showDeleteConfirm}
          materialPresets={materialPresets}
          onClose={() => setShowDeleteConfirm(null)}
          onConfirm={handleDeletePreset}
        />
      )}
    </div>
  )
}

export default GenerationPage 