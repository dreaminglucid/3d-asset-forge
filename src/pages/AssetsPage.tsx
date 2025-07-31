import React, { useRef, useCallback } from 'react'
import { useAssets } from '../hooks/useAssets'
import { useAssetsStore } from '../store'
import { Asset } from '../types'
import AssetFilters from '../components/Assets/AssetFilters'
import AssetList from '../components/Assets/AssetList'
import ThreeViewer, { ThreeViewerRef } from '../components/shared/ThreeViewer'
import { AnimationPlayer } from '../components/shared/AnimationPlayer'
import ViewerControls from '../components/Assets/ViewerControls'
import RetextureModal from '../components/Assets/RetextureModal'
import RegenerateModal from '../components/Assets/RegenerateModal'
import AssetDetailsPanel from '../components/Assets/AssetDetailsPanel'
import { AssetEditModal } from '../components/Assets/AssetEditModal'
import { Package, Activity, Edit3, Layers } from 'lucide-react'

export const AssetsPage: React.FC = () => {
  const { assets, loading, reloadAssets, forceReload } = useAssets()
  
  // Get state and actions from store
  const {
    selectedAsset,
    searchTerm,
    typeFilter,
    tierFilter,
    statusFilter,
    showGroundPlane,
    isWireframe,
    isLightBackground,
    showRetextureModal,
    showRegenerateModal,
    showDetailsPanel,
    showEditModal,
    isTransitioning,
    modelInfo,
    showAnimationView,
    setSelectedAsset,
    setSearchTerm,
    setTypeFilter,
    setTierFilter,
    setStatusFilter,
    setShowRetextureModal,
    setShowRegenerateModal,
    setShowDetailsPanel,
    setShowEditModal,
    setIsTransitioning,
    setModelInfo,
    setShowAnimationView,
    toggleGroundPlane,
    toggleWireframe,
    toggleBackground,
    toggleDetailsPanel,
    toggleAnimationView,
    handleAssetSelect,
    clearSelection,
    getFilteredAssets
  } = useAssetsStore()
  
  const viewerRef = useRef<ThreeViewerRef>(null)
  
  // Filter assets based on current filters
  const filteredAssets = getFilteredAssets(assets)
  
  const handleModelLoad = useCallback((info: { vertices: number, faces: number, materials: number, fileSize?: number }) => {
    setModelInfo(info)
  }, [setModelInfo])
  
  const handleViewerReset = () => {
    viewerRef.current?.resetCamera()
  }
  
  const handleDownload = () => {
    if (selectedAsset && selectedAsset.hasModel) {
      // Take a screenshot instead of downloading the model
      viewerRef.current?.takeScreenshot()
    }
  }
  
  const handleDeleteAsset = async (asset: Asset, includeVariants?: boolean) => {
    let deletionSuccessful = false
    
    try {
      // Clear selected asset BEFORE deletion to prevent viewer from trying to load it
      if (selectedAsset?.id === asset.id) {
        clearSelection()
      }
      
      // Close the edit modal immediately
      setShowEditModal(false)
      
      const response = await fetch(`/api/assets/${asset.id}?includeVariants=${includeVariants}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        // Even if we get a 404, the deletion might have succeeded (port mismatch issue)
        console.warn('Delete request returned error, but deletion may have succeeded')
      }
      
      deletionSuccessful = true
      
      // If deleting a variant and we had cleared the selection, select the base model
      if (!includeVariants && !selectedAsset && asset.metadata.isVariant) {
        const variantMetadata = asset.metadata as import('../types').VariantAssetMetadata
        const baseAsset = assets.find(a => a.id === variantMetadata.parentBaseModel)
        if (baseAsset) {
          setSelectedAsset(baseAsset)
        }
      }
      
    } catch (error) {
      console.error('Error deleting asset:', error)
      // Still try to reload in case the deletion succeeded on the backend
      deletionSuccessful = true
    }
    
    if (deletionSuccessful) {
      // Add a small delay to ensure the deletion is complete on the filesystem
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Force reload assets to refresh the list (clears list first)
      await forceReload()
    } else {
      // If deletion failed and we cleared the selection, restore it
      if (!selectedAsset && asset) {
        setSelectedAsset(asset)
      }
    }
  }
  
  const handleSaveAsset = async (updatedAsset: Partial<Asset>) => {
    try {
      const response = await fetch(`/api/assets/${updatedAsset.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedAsset),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update asset')
      }
      
      // Get the updated asset from the response
      const savedAsset = await response.json()
      
      // If the asset was renamed, update the selected asset
      if (savedAsset.id !== updatedAsset.id) {
        setIsTransitioning(true)
        setSelectedAsset(savedAsset)
      }
      
      // Close the edit modal after successful save
      setShowEditModal(false)
      
      // Reload assets to refresh the list
      await reloadAssets()
      
      // Clear transitioning state after a brief delay
      if (savedAsset.id !== updatedAsset.id) {
        setTimeout(() => setIsTransitioning(false), 500)
      }

      return savedAsset
    } catch (error) {
      console.error('Error updating asset:', error)
      throw error
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)] bg-gradient-to-br from-bg-primary to-bg-secondary">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto" />
          <p className="text-text-secondary text-lg">Loading assets...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-gradient-to-br from-bg-primary to-bg-secondary">
      <div className="flex-1 flex gap-4 p-4 overflow-hidden min-h-0">
        {/* Sidebar - Made narrower */}
        <div className="flex flex-col gap-3 w-72 min-w-[18rem] animate-slide-in-left">
          {/* Filters */}
          <AssetFilters
            totalAssets={assets.length}
            filteredCount={filteredAssets.length}
          />
          
          {/* Asset List */}
          <AssetList
            assets={filteredAssets}
          />
        </div>
        
        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col gap-4 min-w-0 animate-fade-in">
          <div className="flex-1 relative rounded-xl border border-border-primary shadow-2xl overflow-hidden">
            {selectedAsset ? (
              <>
                <div className="absolute inset-0">
                  {showAnimationView && selectedAsset.type === 'character' ? (
                    <AnimationPlayer
                      modelUrl={selectedAsset.hasModel ? `/api/assets/${selectedAsset.id}/model` : ''}
                      animations={selectedAsset.metadata?.animations || { basic: {} }}
                      riggedModelPath={selectedAsset.metadata?.riggedModelPath ? `/api/assets/${selectedAsset.id}/${selectedAsset.metadata.riggedModelPath}` : undefined}
                      characterHeight={selectedAsset.metadata?.characterHeight}
                      className="w-full h-full"
                    />
                  ) : (
                    <ThreeViewer
                      ref={viewerRef}
                      modelUrl={selectedAsset.hasModel ? `/api/assets/${selectedAsset.id}/model` : undefined}
                      isWireframe={isWireframe}
                      showGroundPlane={showGroundPlane}
                      isLightBackground={isLightBackground}
                      onModelLoad={handleModelLoad}
                      assetInfo={{
                        name: selectedAsset.name,
                        type: selectedAsset.type,
                        tier: selectedAsset.metadata.tier,
                        format: selectedAsset.metadata.format || 'GLB',
                        requiresAnimationStrip: selectedAsset.metadata.requiresAnimationStrip
                      }}
                    />
                  )}
                </div>
                {isTransitioning && (
                  <div className="absolute inset-0 bg-bg-primary bg-opacity-50 flex items-center justify-center z-10">
                    <div className="text-center">
                      <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3 mx-auto" />
                      <p className="text-text-secondary">Loading renamed asset...</p>
                    </div>
                  </div>
                )}

                {showAnimationView ? (
                  // Controls for animation view - positioned top-right to match asset browser layout
                  <div className="absolute top-4 right-4 flex gap-2 animate-fade-in z-10">
                    {/* Animation Toggle - furthest left */}
                    {selectedAsset.type === 'character' && (
                      <button
                        onClick={toggleAnimationView}
                        className={`group p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${
                          showAnimationView ? 'ring-2 ring-primary' : ''
                        }`}
                        title={showAnimationView ? "View 3D Model" : "View Animations"}
                      >
                        <Activity 
                          size={20} 
                          className={`transition-colors ${
                            showAnimationView 
                              ? 'text-primary' 
                              : 'text-text-secondary group-hover:text-primary'
                          }`} 
                        />
                      </button>
                    )}
                    
                    {/* Edit Button - middle */}
                    <button
                      onClick={() => setShowEditModal(true)}
                      className="group p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg"
                      title="Edit Asset"
                    >
                      <Edit3 size={20} className="text-text-secondary group-hover:text-primary transition-colors" />
                    </button>
                    
                    {/* Details Button - furthest right with Layers icon */}
                    <button
                      onClick={toggleDetailsPanel}
                      className={`p-3 bg-bg-secondary bg-opacity-90 backdrop-blur-sm rounded-xl transition-all duration-200 hover:bg-bg-tertiary hover:scale-105 shadow-lg ${
                        showDetailsPanel 
                          ? 'ring-2 ring-primary' 
                          : ''
                      }`}
                      title="Toggle Details (D)"
                    >
                      <Layers size={20} className={`transition-colors ${
                        showDetailsPanel 
                          ? 'text-primary' 
                          : 'text-text-secondary'
                      }`} />
                    </button>
                  </div>
                ) : (
                  <ViewerControls
                    onViewerReset={handleViewerReset}
                    onDownload={handleDownload}
                    assetType={selectedAsset.type}
                    canRetexture={selectedAsset.type !== 'character' && selectedAsset.type !== 'environment'}
                    hasRigging={selectedAsset.type === 'character' || !!selectedAsset.metadata?.animations}
                  />
                )}
            
            <AssetDetailsPanel
              asset={selectedAsset}
              isOpen={showDetailsPanel}
              onClose={() => setShowDetailsPanel(false)}
                  modelInfo={modelInfo}
            />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 animate-fade-in bg-gradient-to-br from-bg-primary to-bg-secondary">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
                  <Package size={80} className="text-text-muted mb-6 relative z-10 animate-float" />
                </div>
                <h3 className="text-2xl font-semibold text-text-primary mb-2">No Asset Selected</h3>
                <p className="text-text-tertiary text-lg max-w-md">
                  Select an asset from the list to view its 3D model and details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showRetextureModal && selectedAsset && (
        <RetextureModal
          asset={selectedAsset}
          onClose={() => setShowRetextureModal(false)}
          onComplete={() => {
            setShowRetextureModal(false)
            reloadAssets()
          }}
        />
      )}
      
      {showRegenerateModal && selectedAsset && (
        <RegenerateModal
          asset={selectedAsset}
          onClose={() => setShowRegenerateModal(false)}
          onComplete={() => {
            setShowRegenerateModal(false)
            reloadAssets()
          }}
        />
      )}
      
      {showEditModal && selectedAsset && (
        <AssetEditModal
          asset={selectedAsset}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveAsset}
          onDelete={handleDeleteAsset}
          hasVariants={assets.some(a => a.metadata.isVariant && a.metadata.parentBaseModel === selectedAsset.id)}
        />
      )}
    </div>
  )
}

export default AssetsPage