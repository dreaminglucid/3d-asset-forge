import React, { useRef } from 'react'
import { ErrorNotification, EmptyState } from '../components/common'
import { cn } from '../styles'
import { Bug, Download, Upload, Package } from 'lucide-react'
import { useAssets } from '../hooks/useAssets'
import { useArmorFittingStore } from '../store/useArmorFittingStore'
import {
  ArmorFittingViewer,
  ArmorFittingViewerRef,
  ArmorFittingControls,
  ArmorAssetList,
  ViewportControls,
  UndoRedoControls,
  FittingProgress,
  MeshFittingDebugger
} from '../components/ArmorFitting'

export const ArmorFittingPage: React.FC = () => {
  const { assets, loading } = useAssets()
  const viewerRef = useRef<ArmorFittingViewerRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get state and actions from Zustand store
  const {
    // State
    selectedAvatar,
    selectedArmor,
    assetTypeFilter,
    fittingConfig,
    armorTransform,
    enableWeightTransfer,
    equipmentSlot,
    visualizationMode,
    selectedBone,
    showWireframe,
    isFitting,
    fittingProgress,
    showDebugger,
    lastError,
    isExporting,

    // Actions
    handleAssetSelect,
    setAssetTypeFilter,
    updateFittingConfig,
    updateArmorTransform,
    setEnableWeightTransfer,
    setEquipmentSlot,
    setVisualizationMode,
    setShowWireframe,
    setBodyRegions,
    setCollisions,
    setShowDebugger,
    performFitting,
    resetFitting,
    exportFittedArmor,
    exportEquippedAvatar,
    saveConfiguration,
    loadConfiguration,
    clearError,
    undo,
    redo,
    canUndo,
    canRedo,
    isReadyToFit,
    currentProgress
  } = useArmorFittingStore()

  const handleLoadConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await loadConfiguration(file)
      // Clear the input value so the same file can be selected again
      e.target.value = ''
    }
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo()) undo()
      }
      // Redo: Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'y')
      ) {
        e.preventDefault()
        if (canRedo()) redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, canUndo, canRedo])

  return (
    <div className="page-container">
      {/* Error Toast */}
      {lastError && (
        <ErrorNotification error={lastError} onClose={clearError} />
      )}

      {/* Left Panel - Asset Selection */}
      <div className="card overflow-hidden w-80 flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
        <ArmorAssetList
          assets={assets}
          loading={loading}
          assetType={assetTypeFilter}
          selectedAsset={assetTypeFilter === 'avatar' ? selectedAvatar : selectedArmor}
          selectedAvatar={selectedAvatar}
          selectedArmor={selectedArmor}
          onAssetSelect={handleAssetSelect}
          onAssetTypeChange={setAssetTypeFilter}
        />
      </div>

      {/* Center - 3D Viewport */}
      <div className="flex-1 flex flex-col">
        <div className="overflow-hidden flex-1 relative bg-gradient-to-br from-bg-primary to-bg-secondary rounded-xl">
          {selectedAvatar || selectedArmor ? (
            <>
              <ArmorFittingViewer
                ref={viewerRef}
                avatarUrl={selectedAvatar?.hasModel ? `/api/assets/${selectedAvatar.id}/model` : undefined}
                armorUrl={selectedArmor?.hasModel ? `/api/assets/${selectedArmor.id}/model` : undefined}
                armorTransform={armorTransform}
                showWireframe={showWireframe}
                visualizationMode={visualizationMode}
                selectedBone={selectedBone}
                equipmentSlot={equipmentSlot}
                onBodyRegionsComputed={setBodyRegions}
                onCollisionsDetected={setCollisions}
              />

              {/* Viewport Controls */}
              <ViewportControls
                showWireframe={showWireframe}
                onToggleWireframe={() => setShowWireframe(!showWireframe)}
                onResetCamera={() => viewerRef.current?.resetCamera?.()}
              />

              {/* Undo/Redo Controls */}
              <UndoRedoControls
                canUndo={canUndo()}
                canRedo={canRedo()}
                onUndo={undo}
                onRedo={redo}
              />

              {/* Fitting Progress */}
              {isFitting && (
                <FittingProgress
                  progress={fittingProgress}
                  message={currentProgress()}
                />
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={Package}
                title="No Preview Available"
                description="Select an avatar and armor piece to begin fitting"
              />
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Fitting Controls */}
      <div className="card overflow-hidden w-96 flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
        <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
          <h2 className="text-lg font-semibold text-text-primary">Fitting Controls</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <ArmorFittingControls
              fittingConfig={fittingConfig}
              onFittingConfigChange={updateFittingConfig}
              armorTransform={armorTransform}
              onArmorTransformChange={updateArmorTransform}
              enableWeightTransfer={enableWeightTransfer}
              onEnableWeightTransferChange={setEnableWeightTransfer}
              showWireframe={showWireframe}
              onShowWireframeChange={setShowWireframe}
              equipmentSlot={equipmentSlot}
              onEquipmentSlotChange={setEquipmentSlot}
              visualizationMode={visualizationMode}
              onVisualizationModeChange={setVisualizationMode}
              onPerformFitting={() => performFitting(viewerRef)}
              onResetFitting={resetFitting}
              onExportArmor={() => exportFittedArmor(viewerRef)}
              onSaveConfiguration={saveConfiguration}
              isFitting={isFitting}
              fittingProgress={fittingProgress}
              canFit={isReadyToFit()}
            />

            {/* Config Management */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleLoadConfig}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 
                  bg-bg-secondary border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary"
              >
                <Upload size={18} />
                <span>Load Configuration</span>
              </button>
            </div>

            {/* Debug Button */}
            <button
              onClick={() => setShowDebugger(true)}
              className="w-full px-4 py-2 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 
                  bg-bg-secondary border border-white/10 hover:border-white/20 text-text-secondary hover:text-text-primary"
            >
              <Bug size={18} />
              <span>Open Debug Tools</span>
            </button>

            {/* Export Equipped Avatar */}
            <button
              onClick={() => exportEquippedAvatar(viewerRef)}
              disabled={!selectedAvatar || !selectedArmor || isExporting}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2",
                "bg-bg-secondary/50 border border-white/10 text-text-primary",
                "hover:bg-bg-secondary/70 hover:border-white/20",
                (!selectedAvatar || !selectedArmor || isExporting) && "opacity-50 cursor-not-allowed"
              )}
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download size={14} />
                  <span>Export Equipped Avatar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Debug Window */}
      {showDebugger && (
        <MeshFittingDebugger onClose={() => setShowDebugger(false)} />
      )}
    </div>
  )
}

export default ArmorFittingPage