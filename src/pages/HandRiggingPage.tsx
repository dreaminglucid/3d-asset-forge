import React, { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Badge, Progress, Input, Modal, ModalHeader, ModalBody, ModalFooter
} from '../components/common'
import { cn, animations, theme } from '../styles'
import { 
  Upload, Hand, Loader2, CheckCircle, AlertCircle, 
  Download, Eye, RotateCw, Grid3X3, Play, 
  ChevronRight, Info, Camera, Wand2, Box, Search, Activity,
  Sparkles, FileText, Brain, Settings, Zap, ArrowRight,
  X, Layers, Image as ImageIcon, Palette, Check, Package
} from 'lucide-react'
import ThreeViewer, { ThreeViewerRef } from '../components/shared/ThreeViewer'
import { HandRiggingService, HandRiggingResult } from '../services/hand-rigging/HandRiggingService'
import type { HandRiggingResultWithDebug } from '../types/hand-rigging'
import { SimpleHandRiggingService, SimpleHandRiggingResult } from '../services/hand-rigging/SimpleHandRiggingService'
import { useHandRiggingStore } from '../store'
import type { ProcessingStage } from '../store'
import { HandAvatarSelector, HandProcessingSteps, HandRiggingControls } from '../components/HandRigging'

export function HandRiggingPage() {
  const viewerRef = useRef<ThreeViewerRef>(null)
  const handRiggingService = useRef<HandRiggingService | null>(null)
  const simpleHandRiggingService = useRef<SimpleHandRiggingService | null>(null)
  
  // Get state and actions from store
  const {
    selectedAvatar,
    selectedFile,
    modelUrl,
    processingStage,
    leftHandData,
    rightHandData,
    error,
    showSkeleton,
    modelInfo,
    riggingResult,
    serviceInitialized,
    debugImages,
    showDebugImages,
    useSimpleMode,
    showExportModal,
    setSelectedAvatar,
    setSelectedFile,
    setModelUrl,
    setProcessingStage,
    setLeftHandData,
    setRightHandData,
    setError,
    setShowSkeleton,
    setModelInfo,
    setRiggingResult,
    setServiceInitialized,
    setDebugImages,
    setShowDebugImages,
    setUseSimpleMode,
    setShowExportModal,
    reset,
    toggleSkeleton,
    toggleDebugImages,
    updateProcessingProgress,
    getProcessingSteps,
    isProcessing,
    canStartProcessing,
    canExport
  } = useHandRiggingStore()
  
  // Get processing steps with icons
  const processingSteps = getProcessingSteps(useSimpleMode).map((step) => ({
    ...step,
    icon: step.id === 'detecting-wrists' ? <Search className="w-4 h-4" /> :
          step.id === 'creating-bones' ? (useSimpleMode ? <Wand2 className="w-4 h-4" /> : <Camera className="w-4 h-4" />) :
          <Activity className="w-4 h-4" />
  }))
  
  // Initialize services
  useEffect(() => {
    const initServices = async () => {
      try {
        console.log('Initializing hand rigging services...')
        
        if (useSimpleMode) {
          simpleHandRiggingService.current = new SimpleHandRiggingService()
        } else {
          const service = new HandRiggingService()
          await service.initialize()
          handRiggingService.current = service
        }
        
        setServiceInitialized(true)
        console.log('Hand rigging services initialized')
      } catch (err) {
        console.error('Failed to initialize services:', err)
        setError('Failed to initialize hand rigging service. Please refresh the page.')
      }
    }
    
    initServices()
    
    return () => {
      if (handRiggingService.current) {
        handRiggingService.current.dispose()
      }
    }
  }, [useSimpleMode, setServiceInitialized, setError])

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (modelUrl && modelUrl.startsWith('blob:')) {
        URL.revokeObjectURL(modelUrl)
      }
    }
  }, [modelUrl])

  const handleStartProcessing = async () => {
    if (!selectedAvatar || !modelUrl || (!handRiggingService.current && !simpleHandRiggingService.current)) {
      setError('Please select an avatar first')
      return
    }
    
    setError(null)
    setProcessingStage('idle')
    setLeftHandData(null)
    setRightHandData(null)
    setDebugImages({})
    
    // Artificial delay to show UI state
    await new Promise(resolve => setTimeout(resolve, 500))
    
    try {
      // Fetch the model data from the already set modelUrl (which points to t-pose if available)
      const response = await fetch(modelUrl)
      if (!response.ok) {
        throw new Error('Failed to fetch avatar model')
      }
      
      const modelBlob = await response.blob()
      const modelFile = new File([modelBlob], `${selectedAvatar.name}.glb`, { type: 'model/gltf-binary' })
      
      // Update stages
      const updateStage = (stage: ProcessingStage) => {
        setProcessingStage(stage)
        return new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Simulate stage progression based on service events
      // In a real implementation, the service would emit events
      updateStage('detecting-wrists')
      
      let result: HandRiggingResult | SimpleHandRiggingResult
      
      if (useSimpleMode && simpleHandRiggingService.current) {
        // Run the simple rigging process
        result = await simpleHandRiggingService.current.rigHands(modelFile, {
          debugMode: true,
          palmBoneLength: 0.05,    // 5cm palm (reduced from 8cm)
          fingerBoneLength: 0.08   // 8cm fingers (reduced from 10cm)
        })
        
        // Update UI for simple mode
        updateStage('creating-bones')
        await new Promise(resolve => setTimeout(resolve, 1500))
        updateStage('applying-weights')
        await new Promise(resolve => setTimeout(resolve, 1500))
        
      } else if (handRiggingService.current) {
        // Run the complex AI-based rigging process
        result = await handRiggingService.current.rigHands(modelFile, {
          debugMode: true,
          minConfidence: 0.7,
          smoothingIterations: 3,
          captureResolution: 512,
          viewerRef: viewerRef  // Pass the viewer reference for better captures
        })
        
        if ('debugCaptures' in result && result.debugCaptures) {
          setDebugImages(result.debugCaptures as { left?: string; right?: string; [key: string]: string | undefined })
        }
        
        // Update hand data for complex mode
        if ('leftHand' in result && result.leftHand) {
          setLeftHandData({
            fingerCount: result.leftHand.detectionConfidence > 0 ? 5 : 0,
            confidence: result.leftHand.detectionConfidence,
            bonesAdded: result.leftHand.bones ? Object.keys(result.leftHand.bones).length : 0
          })
        }
        
        if ('rightHand' in result && result.rightHand) {
          setRightHandData({
            fingerCount: result.rightHand.detectionConfidence > 0 ? 5 : 0,
            confidence: result.rightHand.detectionConfidence,
            bonesAdded: result.rightHand.bones ? Object.keys(result.rightHand.bones).length : 0
          })
        }
      } else {
        throw new Error('No service available')
      }
      
      setRiggingResult(result)
      
      // Update the model in the viewer with the rigged version
      if (result.riggedModel) {
        const blob = new Blob([result.riggedModel], { type: 'model/gltf-binary' })
        const newUrl = URL.createObjectURL(blob)
        setModelUrl(newUrl)
        
        // If skeleton was visible, turn it off and on to refresh with new bones
        if (showSkeleton && viewerRef.current) {
          console.log('Refreshing skeleton view to show new bones...')
          // Wait a bit for the model to load, then refresh skeleton
          setTimeout(() => {
            if (viewerRef.current && viewerRef.current.refreshSkeleton) {
              viewerRef.current.refreshSkeleton()
            }
          }, 500)
        }
      }
      
      updateStage('complete')
      
    } catch (err) {
      console.error('Hand rigging failed:', err)
      setError(err instanceof Error ? err.message : 'Hand rigging failed')
      setProcessingStage('error')
    }
  }

  const handleReset = () => {
    reset()
  }

  const handleModelLoad = useCallback((info: { vertices: number; faces: number; materials: number }) => {
    setModelInfo(info)
  }, [setModelInfo])

  const handleToggleSkeleton = () => {
    if (viewerRef.current) {
      viewerRef.current.toggleSkeleton()
      toggleSkeleton()
    }
  }

  const handleExport = () => {
    if (!riggingResult || !riggingResult.riggedModel) return
    
    // Create download link
    const blob = new Blob([riggingResult.riggedModel], { type: 'model/gltf-binary' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // Generate a proper filename
    let filename = 'rigged_model.glb'
    if (selectedAvatar) {
      const baseName = selectedAvatar.name
      // Remove any existing rigged suffix
      const nameWithoutRigged = baseName.replace(/[-_]?rigged$/i, '')
      // Add _rigged suffix and .glb extension
      filename = `${nameWithoutRigged}_rigged.glb`
    }
    
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    setShowExportModal(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-primary via-bg-secondary to-bg-tertiary p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Configuration */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Upload Card with Controls */}
            <HandAvatarSelector />
              
              {selectedAvatar && (
              <HandRiggingControls onStartProcessing={handleStartProcessing} />
            )}



            {/* Processing Pipeline */}
            <HandProcessingSteps />
          </div>

          {/* Center - 3D Viewer */}
          <div className="lg:col-span-8 space-y-6">
            <Card className={cn("h-[700px] overflow-hidden", "animate-scale-in")}>
              <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Box className="w-5 h-5 text-primary" />
                      3D Model Preview
                    </CardTitle>
                    <CardDescription>
                      Interactive view with real-time updates
                    </CardDescription>
                  </div>
                  {modelUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleToggleSkeleton}
                        className={cn(
                          "transition-all duration-200",
                          showSkeleton && "bg-primary text-white shadow-lg"
                        )}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {showSkeleton ? 'Hide' : 'Show'} Skeleton
                      </Button>
                      {canExport() && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setShowExportModal(true)}
                          className="shadow-lg"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Export Model
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="h-[calc(100%-88px)] p-0 relative">
                {modelUrl ? (
                  <div className="w-full h-full bg-gradient-to-br from-bg-primary to-bg-secondary">
                    <ThreeViewer
                      ref={viewerRef}
                      modelUrl={modelUrl}
                      showGroundPlane={true}
                      onModelLoad={handleModelLoad}
                      assetInfo={{
                        name: selectedAvatar?.name || 'Model',
                        type: 'character',
                        format: 'GLB'
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-bg-primary to-bg-secondary">
                    <div className="text-center p-8 animate-fade-in">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary opacity-20 blur-3xl animate-pulse" />
                        <Package size={80} className="text-text-muted mb-6 mx-auto relative z-10 animate-float" />
                      </div>
                      <h3 className="text-2xl font-semibold text-text-primary mb-2">No model loaded</h3>
                      <p className="text-text-tertiary text-lg max-w-md mx-auto">
                        Upload a file to begin
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Overlay Results */}
                {processingStage === 'complete' && (leftHandData || rightHandData) && (
                  <div className="absolute top-4 left-4 space-y-2">
                    {leftHandData && leftHandData.bonesAdded > 0 && (
                      <Badge variant="success" className={cn("shadow-lg", "animate-slide-in-left", "text-white")}>
                        <Hand className="w-3.5 h-3.5 mr-2" />
                        Left Hand: {leftHandData.bonesAdded} bones added
                      </Badge>
                    )}
                    {rightHandData && rightHandData.bonesAdded > 0 && (
                      <Badge variant="success" className={cn("shadow-lg", "animate-slide-in-left", "text-white")} style={{ animationDelay: '0.1s' }}>
                        <Hand className="w-3.5 h-3.5 mr-2" />
                        Right Hand: {rightHandData.bonesAdded} bones added
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Model Stats */}
            {modelInfo && (
              <div className="grid grid-cols-3 gap-4">
                <Card className={cn("p-4", "animate-fade-in")}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-text-primary">
                        {modelInfo.vertices.toLocaleString()}
                      </p>
                      <p className="text-sm text-text-secondary">Vertices</p>
                    </div>
                    <Grid3X3 className="w-8 h-8 text-primary/20" />
                  </div>
                </Card>
                <Card className={cn("p-4", "animate-fade-in")} style={{ animationDelay: '0.1s' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-text-primary">
                        {modelInfo.faces.toLocaleString()}
                      </p>
                      <p className="text-sm text-text-secondary">Faces</p>
                    </div>
                    <Layers className="w-8 h-8 text-primary/20" />
                  </div>
                </Card>
                <Card className={cn("p-4", "animate-fade-in")} style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-text-primary">
                        {modelInfo.materials}
                      </p>
                      <p className="text-sm text-text-secondary">Materials</p>
                    </div>
                    <Palette className="w-8 h-8 text-primary/20" />
                  </div>
                </Card>
              </div>
            )}

            {/* Results Card */}
            {riggingResult && (
              <Card className={cn("overflow-hidden", "animate-slide-in-up")}>
                <CardHeader className="bg-gradient-to-r from-success/10 to-success/5 border-b border-success/20">
                  <CardTitle className="flex items-center gap-2 text-success">
                    <CheckCircle className="w-5 h-5" />
                    Rigging Complete!
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-text-primary">
                        {riggingResult.metadata.originalBoneCount}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">Original Bones</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-success">
                        +{riggingResult.metadata.addedBoneCount}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">Added Bones</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-text-primary">
                        {riggingResult.metadata.originalBoneCount + riggingResult.metadata.addedBoneCount}
                      </p>
                      <p className="text-sm text-text-secondary mt-1">Total Bones</p>
                    </div>
                  </div>
                  {'processingTime' in riggingResult.metadata && (
                    <div className="mt-6 pt-6 border-t border-border-primary text-center">
                      <p className="text-sm text-text-secondary">
                        Processing completed in{' '}
                        <span className="font-semibold text-text-primary">
                          {(riggingResult.metadata.processingTime / 1000).toFixed(1)}s
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Debug Images */}
        {showDebugImages && Object.keys(debugImages).length > 0 && (
          <Card className={cn("mt-6 overflow-hidden", "animate-fade-in")}>
            <CardHeader className="bg-gradient-to-r from-bg-secondary to-bg-tertiary">
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                AI Debug Captures
              </CardTitle>
              <CardDescription>
                View angles used for hand detection
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {Object.entries(debugImages).map(([key, dataUrl]) => (
                  <div key={key} className="group relative">
                    <img 
                      src={dataUrl as string} 
                      alt={key} 
                      className="w-full aspect-square object-cover rounded-lg border-2 border-border-primary group-hover:border-primary transition-all duration-200 group-hover:scale-105"
                    />
                    <p className="text-xs text-text-secondary text-center mt-2 font-medium">
                      {key.charAt(0).toUpperCase() + key.slice(1)} View
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card className={cn("mt-6 overflow-hidden", "animate-fade-in")}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <Info className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-text-primary mb-2">
                    How Hand Rigging Works
                  </h3>
                  <p className="text-sm text-text-secondary">
                    This tool automatically adds hand bones to 3D character models that don't have them. 
                    {useSimpleMode 
                      ? ' Simple mode creates 2 bones per hand (palm and fingers) for basic grab animations.'
                      : ' AI mode uses computer vision to detect hand poses and create detailed finger bones.'}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Zap className="w-4 h-4 text-primary" />
                      {useSimpleMode ? 'Simple Mode Features' : 'AI Mode Features'}
                    </h4>
                    <ul className="space-y-1.5">
                      {useSimpleMode ? (
                        <>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Works with any hand pose (open, closed, fist)</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Fast processing in 5-10 seconds</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Perfect for grab and hold animations</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>No AI detection required</span>
                          </li>
                        </>
                      ) : (
                        <>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Individual control for each finger</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>AI-powered hand pose detection</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Supports complex hand gestures</span>
                          </li>
                          <li className="flex items-start gap-2 text-sm text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <span>Best with open hands in T-pose</span>
                          </li>
                        </>
                      )}
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Tips for Best Results
                    </h4>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                        <span>Use models exported from Meshy.ai or similar tools</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                        <span>Ensure the model has a proper skeleton hierarchy</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                        <span>Check that wrist bones are properly named</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm text-text-secondary">
                        <ArrowRight className="w-4 h-4 text-primary/60 mt-0.5 flex-shrink-0" />
                        <span>Export will normalize model to standard size</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Modal */}
      <Modal open={showExportModal} onClose={() => setShowExportModal(false)}>
        <ModalHeader>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Export Rigged Model
          </h3>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-text-primary font-medium mb-2">
                Your model is ready for export!
              </p>
              <p className="text-xs text-text-secondary">
                The exported model includes all original bones plus the newly added hand bones,
                ready for use in game engines or animation software.
              </p>
            </div>
            
            {selectedAvatar && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-primary">Export Details:</p>
                <div className="space-y-1 text-xs text-text-secondary">
                  <div className="flex justify-between">
                    <span>Original Avatar:</span>
                    <span className="font-mono">{selectedAvatar.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Export Format:</span>
                    <span className="font-mono">.glb</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Bones:</span>
                    <span className="font-mono">
                      {riggingResult ? riggingResult.metadata.originalBoneCount + riggingResult.metadata.addedBoneCount : 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Download Model
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

// Add custom animation
const style = document.createElement('style')
style.textContent = `
  @keyframes progress {
    0% { width: 0%; }
    100% { width: 100%; }
  }
  
  .animate-progress {
    animation: progress 2s ease-in-out infinite;
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
`
document.head.appendChild(style) 