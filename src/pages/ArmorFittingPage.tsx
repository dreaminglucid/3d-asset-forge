import React, { useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../components/common'
import { cn } from '../styles'
import { Bug, Download, Camera, Grid3X3, Package, Undo, Redo, Upload, AlertCircle, X } from 'lucide-react'
import { useAssets } from '../hooks/useAssets'
import { useArmorFittingStore } from '../store/useArmorFittingStore'
import { ArmorFittingViewer, ArmorFittingViewerRef } from '../components/ArmorFitting/ArmorFittingViewer'
import { ArmorFittingControls } from '../components/ArmorFitting/ArmorFittingControls'
import { ArmorAssetList } from '../components/ArmorFitting/ArmorAssetList'
import MeshFittingDebugger from '../components/ArmorFitting/MeshFittingDebugger'

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
    bodyRegions,
    collisions,
    isFitting,
    fittingProgress,
    showDebugger,
    lastError,
    isExporting,
    isSavingConfig,
    
    // Actions
    handleAssetSelect,
    setAssetTypeFilter,
    updateFittingConfig,
    updateArmorTransform,
    resetTransform,
    setEnableWeightTransfer,
    setEquipmentSlot,
    setVisualizationMode,
    setSelectedBone,
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
    <div className="flex h-[calc(100vh-60px)] bg-gradient-to-br from-bg-primary to-bg-secondary p-4 gap-4">
      {/* Error Toast */}
      {lastError && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <Card className="bg-red-500/10 border-red-500/20 backdrop-blur-md">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-400" />
                <p className="text-sm text-red-200">{lastError}</p>
                <button
                  onClick={clearError}
                  className="ml-2 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <X size={16} className="text-red-300" />
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
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
        <div className="card overflow-hidden flex-1 relative">
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
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={() => setShowWireframe(!showWireframe)}
                  className={cn(
                    "p-2 rounded-lg backdrop-blur-sm transition-all",
                    showWireframe
                      ? "bg-primary/20 text-primary"
                      : "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
                  )}
                  title="Toggle wireframe"
                >
                  <Grid3X3 size={18} />
                </button>
                <button
                  onClick={() => viewerRef.current?.resetCamera?.()}
                  className="p-2 rounded-lg bg-bg-tertiary/50 text-text-secondary hover:text-text-primary backdrop-blur-sm transition-all"
                  title="Reset camera"
                >
                  <Camera size={18} />
                </button>
              </div>
              
              {/* Undo/Redo Controls */}
              <div className="absolute top-4 left-4 flex gap-2">
                <button
                  onClick={undo}
                  disabled={!canUndo()}
                  className={cn(
                    "p-2 rounded-lg backdrop-blur-sm transition-all",
                    canUndo()
                      ? "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
                      : "bg-bg-tertiary/20 text-text-muted cursor-not-allowed"
                  )}
                  title="Undo (Ctrl+Z)"
                >
                  <Undo size={18} />
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo()}
                  className={cn(
                    "p-2 rounded-lg backdrop-blur-sm transition-all",
                    canRedo()
                      ? "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary"
                      : "bg-bg-tertiary/20 text-text-muted cursor-not-allowed"
                  )}
                  title="Redo (Ctrl+Y)"
                >
                  <Redo size={18} />
                </button>
              </div>
              
              {/* Fitting Progress */}
              {isFitting && (
                <div className="absolute bottom-4 left-4 right-4">
                  <Card className="bg-bg-tertiary/80 backdrop-blur-md border border-white/10">
                    <CardContent className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            {currentProgress()}
                          </p>
                          <div className="mt-2 h-2 bg-bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${fittingProgress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm font-mono text-primary">{fittingProgress}%</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-bg-primary to-bg-secondary">
              <div className="text-center p-8 animate-fade-in">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
                  <Package size={80} className="text-text-muted mb-6 mx-auto relative z-10 animate-float" />
                </div>
                <h3 className="text-2xl font-semibold text-text-primary mb-2">No Preview Available</h3>
                <p className="text-text-tertiary text-lg max-w-md mx-auto">
                  Select an avatar and armor piece to begin fitting
                </p>
              </div>
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

// Add custom styles
const style = document.createElement('style')
style.textContent = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }
  
  @keyframes slide-down {
    from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  
  .animate-slide-down {
    animation: slide-down 0.3s ease-out;
  }
`
document.head.appendChild(style)









