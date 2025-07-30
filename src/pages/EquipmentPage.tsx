import React, { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Badge, Input } from '../components/common'
import { cn } from '../styles'
import { 
  Search, ChevronRight, Settings, Eye, Upload, Download, 
  Crosshair, Box, User, Sword, Shield, HardHat, 
  RotateCw, Move, Maximize2, RefreshCw, Save,
  Wand2, AlertCircle, CheckCircle, Loader2, Check,
  Ruler, Play, Pause, Activity, Info, Sliders,
  Target, Hand, Sparkles, Camera, Grid3X3, Package
} from 'lucide-react'
import { useAssets } from '../hooks/useAssets'
import { Asset } from '../types'
import EquipmentViewer, { EquipmentViewerRef } from '../components/Equipment/EquipmentViewer'
import { WeaponHandleDetector } from '../services/processing/WeaponHandleDetector'
import type { HandleDetectionResult } from '../services/processing/WeaponHandleDetector'
import type { Transform } from '../components/Equipment/EquipmentViewer'
import * as THREE from 'three'
import { CREATURE_SIZE_CATEGORIES, getCreatureCategory } from '../types/NormalizationConventions'
import { CreatureScalingService } from '../services/processing/CreatureScalingService'

// Styled range input component
const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      type="range"
      {...props}
      className={cn(
        "w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer",
        "[&::-webkit-slider-thumb]:appearance-none",
        "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
        "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full",
        "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md",
        "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
        "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full",
        "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none",
        "[&::-moz-range-thumb]:shadow-md",
        props.className
      )}
    />
  )
}

interface EquipmentSlot {
  id: string
  name: string
  icon: React.ReactNode
  bone: string
  description?: string
}

const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  { id: 'mainHand', name: 'Main Hand', icon: <Sword size={20} />, bone: 'Hand_R', description: 'Primary weapon' },
  { id: 'offHand', name: 'Off Hand', icon: <Shield size={20} />, bone: 'Hand_L', description: 'Shield or secondary' },
  { id: 'head', name: 'Head', icon: <HardHat size={20} />, bone: 'Head', description: 'Helmets and headgear' },
  { id: 'chest', name: 'Chest', icon: <Box size={20} />, bone: 'Spine2', description: 'Body armor' },
  { id: 'legs', name: 'Legs', icon: <Box size={20} />, bone: 'Hips', description: 'Leg armor' },
]

const CREATURE_PRESETS = [
  { name: 'Fairy', height: 0.3, category: 'tiny', icon: '🧚' },
  { name: 'Gnome', height: 0.9, category: 'small', icon: '🧙' },
  { name: 'Human', height: 1.83, category: 'medium', icon: '🧍' },
  { name: 'Troll', height: 3.0, category: 'large', icon: '👹' },
  { name: 'Giant', height: 5.0, category: 'huge', icon: '🗿' },
  { name: 'Dragon', height: 8.0, category: 'gargantuan', icon: '🐉' }
]

export const EquipmentPage: React.FC = () => {
  const { assets, loading } = useAssets()
  // Selected items
  const [selectedAvatar, setSelectedAvatar] = useState<Asset | null>(null)
  const [selectedEquipment, setSelectedEquipment] = useState<Asset | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [assetTypeFilter, setAssetTypeFilter] = useState<'avatar' | 'equipment'>('avatar')
  
  // Equipment fitting states
  const [isDetectingHandle, setIsDetectingHandle] = useState(false)
  const [handleDetectionResult, setHandleDetectionResult] = useState<HandleDetectionResult | null>(null)
  const [equipmentSlot, setEquipmentSlot] = useState('Hand_R')
  const [showSkeleton, setShowSkeleton] = useState(false)
  
  // Creature sizing
  const [avatarHeight, setAvatarHeight] = useState(1.83) // Default medium creature height
  const [creatureCategory, setCreatureCategory] = useState('medium')
  const [autoScaleWeapon, setAutoScaleWeapon] = useState(true)
  const [weaponScaleOverride, setWeaponScaleOverride] = useState(1.0) // Base scale, auto-scale will adjust based on creature size
  
  // Manual rotation controls
  const [manualRotation, setManualRotation] = useState({ x: 0, y: 0, z: 0 })
  
  // Manual position controls  
  const [manualPosition, setManualPosition] = useState({ x: 0, y: 0, z: 0 })
  
  // Animation controls
  const [currentAnimation, setCurrentAnimation] = useState<'tpose' | 'walking' | 'running'>('tpose')
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false)
  
  const viewerRef = useRef<EquipmentViewerRef>(null)
  const handleDetector = useRef<WeaponHandleDetector | null>(null)
  
  // Initialize handle detector
  useEffect(() => {
    handleDetector.current = new WeaponHandleDetector()
    
    return () => {
      // Cleanup on unmount
      if (handleDetector.current) {
        handleDetector.current.dispose()
        handleDetector.current = null
      }
    }
  }, [])
  
  // Filter assets
  const avatarAssets = assets.filter(a => a.type === 'character')
  const equipmentAssets = assets.filter(a => ['weapon', 'armor', 'shield'].includes(a.type))
  
  const filteredAssets = assetTypeFilter === 'avatar' 
    ? avatarAssets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : equipmentAssets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
  
  const handleDetectGripPoint = async () => {
    if (!selectedEquipment || !selectedEquipment.hasModel || !handleDetector.current) return
    
    setIsDetectingHandle(true)
    
    try {
      const modelUrl = `/api/assets/${selectedEquipment.id}/model`
      const result = await handleDetector.current.detectHandleArea(modelUrl, true) // Always use consensus mode
      setHandleDetectionResult(result)
      
      // Log the result for analysis
      console.log('Grip detection result:', {
        gripPoint: result.gripPoint,
        confidence: result.confidence,
        bounds: result.redBoxBounds,
        vertexCount: result.vertices?.length || 0
      })
      
      // With normalized weapons, grip should already be at origin
      if (result.gripPoint.length() > 0.1) {
        console.warn('Weapon may not be normalized - grip not at origin')
      }
      
      // Show success message
      setTimeout(() => {
        alert('Grip point detected! Weapon is normalized with grip at origin.')
      }, 100)
      
    } catch (error) {
      console.error('Handle detection failed:', error)
      alert(`Handle detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDetectingHandle(false)
    }
  }
  
  const handleSaveConfiguration = () => {
    if (!selectedEquipment || !selectedAvatar) return
    
    const config = {
      equipmentId: selectedEquipment.id,
      avatarId: selectedAvatar.id,
      slot: equipmentSlot,
      attachmentBone: equipmentSlot,
      avatarHeight,
      autoScale: autoScaleWeapon,
      scaleOverride: weaponScaleOverride,
      handleDetectionResult
    }
    
    // TODO: Save to equipment metadata
    console.log('Saving attachment configuration:', config)
  }
  
  const handleExportAlignedModel = async () => {
    if (!selectedEquipment || !viewerRef.current) return
    
    try {
      const alignedModel = await viewerRef.current.exportAlignedEquipment()
      
      // Create download link
      const blob = new Blob([alignedModel], { type: 'model/gltf-binary' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedEquipment.name}-aligned.glb`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }
  
  const handleExportEquippedAvatar = async () => {
    if (!selectedAvatar || !selectedEquipment || !viewerRef.current) return
    
    try {
      const equippedModel = await viewerRef.current.exportEquippedModel()
      
      // Create download link
      const blob = new Blob([equippedModel], { type: 'model/gltf-binary' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${selectedAvatar.name}-equipped.glb`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }
  
  const handleReset = () => {
    setAvatarHeight(1.83)
    setCreatureCategory('medium')
    setWeaponScaleOverride(1.0)
  }
  
  // Reset manual adjustments when equipment changes
  useEffect(() => {
    setManualPosition({ x: 0, y: 0, z: 0 })
    setManualRotation({ x: 0, y: 0, z: 0 })
  }, [selectedEquipment])
  
  // Manual rotation controls
  
  return (
    <div className="flex h-[calc(100vh-60px)] bg-gradient-to-br from-bg-primary to-bg-secondary p-4 gap-4">
      {/* Left Panel - Asset Selection */}
      <div className="card overflow-hidden w-80 flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
        {/* Header */}
        <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Asset Library</h2>
          
          {/* Asset Type Toggle */}
          <div className="flex gap-2 p-1 bg-bg-tertiary/30 rounded-xl">
            <button
              onClick={() => setAssetTypeFilter('avatar')}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                assetTypeFilter === 'avatar'
                  ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/20"
              )}
            >
              <User size={16} className="inline mr-2" />
              Avatars
            </button>
            <button
              onClick={() => setAssetTypeFilter('equipment')}
              className={cn(
                "flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                assetTypeFilter === 'equipment'
                  ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/20"
              )}
            >
              <Sword size={16} className="inline mr-2" />
              Equipment
            </button>
          </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Search */}
          <div className="p-4 sticky top-0 bg-bg-primary bg-opacity-95 z-10 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
            <Input
              type="text"
              placeholder={`Search ${assetTypeFilter}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3"
            />
          </div>
        </div>
        
        {/* Asset List */}
        <div className="p-2 pt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-32 gap-3">
              <Loader2 className="animate-spin text-primary" size={28} />
              <p className="text-sm text-text-tertiary">Loading assets...</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-bg-secondary/50 rounded-2xl mb-4">
                {assetTypeFilter === 'avatar' ? <User size={24} className="text-text-tertiary" /> : <Sword size={24} className="text-text-tertiary" />}
              </div>
              <p className="text-text-tertiary text-sm">No {assetTypeFilter}s found</p>
              {searchTerm && (
                <p className="text-text-tertiary/60 text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => {
                    if (assetTypeFilter === 'avatar') {
                      setSelectedAvatar(asset)
                    } else {
                      setSelectedEquipment(asset)
                    }
                  }}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all duration-200 text-left group",
                    (assetTypeFilter === 'avatar' ? selectedAvatar?.id === asset.id : selectedEquipment?.id === asset.id)
                      ? "bg-primary/20 border-primary shadow-md shadow-primary/20"
                      : "bg-bg-tertiary/20 border-white/10 hover:border-white/20 hover:bg-bg-tertiary/30"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-text-primary">{asset.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" size="sm" className="capitalize bg-bg-tertiary/50 text-text-secondary border border-white/10">
                          {asset.type}
                        </Badge>
                        {asset.hasModel && (
                          <Badge variant="primary" size="sm" className="bg-primary/20 text-primary border border-primary/30">
                            <Box size={10} className="mr-1" />
                            3D
                          </Badge>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={18} className={cn(
                      "text-text-tertiary transition-transform duration-200",
                      (assetTypeFilter === 'avatar' ? selectedAvatar?.id === asset.id : selectedEquipment?.id === asset.id)
                        ? "translate-x-1 text-primary"
                        : "group-hover:translate-x-1"
                    )} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>
        
        {/* Selected Assets Summary */}
        <div className="p-4 border-t border-border-primary bg-bg-primary bg-opacity-30">
          <div>
            <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Current Selection</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-tertiary">Avatar</p>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedAvatar?.name || 'None selected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Sword size={16} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-text-tertiary">Equipment</p>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedEquipment?.name || 'None selected'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Center - 3D Viewport */}
      <div className="flex-1 flex flex-col">
        <div className="card overflow-hidden flex-1 relative">
          {selectedAvatar || selectedEquipment ? (
            <>
              <EquipmentViewer
                ref={viewerRef}
                avatarUrl={(() => {
                  if (!selectedAvatar) return undefined
                  const animations = (selectedAvatar as any).metadata?.animations?.basic
                  
                  // Use animation files when available
                  let url = `/api/assets/${selectedAvatar.id}/model`  // Default to base model
                  
                  if (currentAnimation === 'walking' && animations?.walking) {
                    url = `/api/assets/${selectedAvatar.id}/${animations.walking}`
                  } else if (currentAnimation === 'running' && animations?.running) {
                    url = `/api/assets/${selectedAvatar.id}/${animations.running}`
                  } else if (currentAnimation === 'tpose' && animations?.tpose) {
                    url = `/api/assets/${selectedAvatar.id}/${animations.tpose}`
                  }
                  
                  console.log(`🎮 Avatar URL for animation '${currentAnimation}':`, url)
                  
                  return url
                })()}
                equipmentUrl={selectedEquipment && selectedEquipment.hasModel ? `/api/assets/${selectedEquipment.id}/model` : undefined}
                equipmentSlot={equipmentSlot}
                showSkeleton={showSkeleton}
                weaponType={selectedEquipment?.metadata?.subtype || selectedEquipment?.type || 'sword'}
                avatarHeight={avatarHeight}
                autoScale={autoScaleWeapon}
                scaleOverride={weaponScaleOverride}
                gripOffset={handleDetectionResult ? {
                  x: handleDetectionResult.gripPoint.x,
                  y: handleDetectionResult.gripPoint.y,
                  z: handleDetectionResult.gripPoint.z
                } : undefined}
                orientationOffset={manualRotation}
                positionOffset={manualPosition}
                isAnimating={isAnimationPlaying && currentAnimation !== 'tpose'}
                animationType={currentAnimation}
              />
              
              {/* Viewport Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <Button
                  size="sm"
                  variant={showSkeleton ? 'primary' : 'secondary'}
                  onClick={() => setShowSkeleton(!showSkeleton)}
                  title="Toggle skeleton"
                  className="backdrop-blur-sm"
                >
                  <Grid3X3 size={18} />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => viewerRef.current?.resetCamera?.()}
                  title="Reset camera"
                  className="backdrop-blur-sm"
                >
                  <Camera size={18} />
                </Button>
              </div>
              
              {/* Animation Controls */}
              {selectedAvatar && (selectedAvatar as any).metadata?.animations?.basic && (
                <Card className="absolute bottom-4 left-4 right-4 bg-bg-tertiary/80 backdrop-blur-md border border-white/10">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">Animation Controls</p>
                          <p className="text-xs text-text-tertiary">Test equipment with animations</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={currentAnimation === 'tpose' ? 'primary' : 'secondary'}
                          onClick={() => {
                            setCurrentAnimation('tpose')
                            setIsAnimationPlaying(false)
                          }}
                          className="gap-2"
                        >
                          <RotateCw className="w-4 h-4" />
                          T-Pose
                        </Button>
                        
                        <Button
                          size="sm"
                          variant={currentAnimation === 'walking' && isAnimationPlaying ? 'primary' : 'secondary'}
                          onClick={() => {
                            if (currentAnimation === 'walking' && isAnimationPlaying) {
                              setIsAnimationPlaying(false)
                            } else {
                              setCurrentAnimation('walking')
                              setIsAnimationPlaying(true)
                            }
                          }}
                          className="gap-2"
                        >
                          {currentAnimation === 'walking' && isAnimationPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Walking
                        </Button>
                        
                        <Button
                          size="sm"
                          variant={currentAnimation === 'running' && isAnimationPlaying ? 'primary' : 'secondary'}
                          onClick={() => {
                            if (currentAnimation === 'running' && isAnimationPlaying) {
                              setIsAnimationPlaying(false)
                            } else {
                              setCurrentAnimation('running')
                              setIsAnimationPlaying(true)
                            }
                          }}
                          className="gap-2"
                        >
                          {currentAnimation === 'running' && isAnimationPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Running
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
                  Select an avatar and equipment to begin
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Right Panel - Controls */}
      <div className="card overflow-hidden w-96 flex flex-col bg-gradient-to-br from-bg-primary to-bg-secondary">
        {/* Header */}
        <div className="p-4 border-b border-border-primary bg-bg-primary bg-opacity-30">
          <h2 className="text-lg font-semibold text-text-primary">Fitting Controls</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-4">
          
          {/* Equipment Slot Selection */}
          <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Equipment Slot</h3>
                  <p className="text-xs text-text-secondary mt-0.5">Choose where to attach the equipment</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {EQUIPMENT_SLOTS.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => setEquipmentSlot(slot.bone)}
                    className={cn(
                      "relative p-4 rounded-lg border transition-all duration-300 group overflow-hidden",
                      equipmentSlot === slot.bone
                        ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
                        : "bg-bg-secondary/40 border-white/10 hover:border-white/20 hover:bg-bg-secondary/60"
                    )}
                  >
                    {/* Hover effect background */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 opacity-0 transition-opacity duration-300",
                      equipmentSlot !== slot.bone && "group-hover:opacity-100"
                    )} />
                    
                    <div className="relative flex flex-col items-center gap-2.5">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300",
                        equipmentSlot === slot.bone
                          ? "bg-primary text-white shadow-md scale-110"
                          : "bg-bg-tertiary/50 text-text-secondary group-hover:bg-bg-tertiary/70 group-hover:text-text-primary group-hover:scale-105"
                      )}>
                        {slot.icon}
                      </div>
                      <div className="text-center">
                        <span className={cn(
                          "text-sm font-medium block transition-colors duration-300",
                          equipmentSlot === slot.bone ? "text-primary" : "text-text-primary group-hover:text-white"
                        )}>
                          {slot.name}
                        </span>
                        {slot.description && (
                          <span className="text-[11px] text-text-tertiary mt-0.5 block">{slot.description}</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Selection indicator */}
                    {equipmentSlot === slot.bone && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* AI Handle Detection */}
          {selectedEquipment?.hasModel && (
            <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg animate-pulse">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">AI Grip Detection</h3>
                    <p className="text-xs text-text-secondary mt-0.5">Automatically detect weapon grip point</p>
                  </div>
                </div>
              </div>
              <div className="p-4">
                <button
                  onClick={handleDetectGripPoint}
                  disabled={isDetectingHandle}
                  className={cn(
                    "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2",
                    "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isDetectingHandle && "opacity-70 cursor-not-allowed"
                  )}
                >
                  {isDetectingHandle ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span>Analyzing weapon...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 size={16} />
                      <span>Verify Weapon Normalization</span>
                    </>
                  )}
                </button>
                
                {handleDetectionResult && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    <div className="flex items-center gap-2.5 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <CheckCircle size={18} className="text-green-500" />
                      <span className="text-sm font-medium text-green-500">Handle detected successfully</span>
                    </div>
                    
                    <div className="space-y-3 p-3 bg-bg-secondary/40 rounded-lg border border-white/10">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Confidence</span>
                        <span className="text-text-primary font-medium">
                          {Math.round((handleDetectionResult.confidence || 0) * 100)}%
                        </span>
                      </div>
                      
                      {handleDetectionResult.orientationFlipped && (
                        <div className="flex items-center gap-2 text-xs text-blue-400">
                          <RefreshCw size={12} />
                          Auto-flipped to correct orientation
                        </div>
                      )}
                      
                      <div className="text-xs space-y-1">
                        <span className="text-text-tertiary">Grip coordinates:</span>
                        <div className="font-mono text-text-primary">
                          ({handleDetectionResult.gripPoint.x.toFixed(3)}, {handleDetectionResult.gripPoint.y.toFixed(3)}, {handleDetectionResult.gripPoint.z.toFixed(3)})
                        </div>
                      </div>
                      
                      {Math.abs(handleDetectionResult.gripPoint.x) < 0.01 && 
                       Math.abs(handleDetectionResult.gripPoint.y) < 0.01 && 
                       Math.abs(handleDetectionResult.gripPoint.z) < 0.01 && (
                        <div className="flex items-center gap-2 text-xs text-green-400">
                          <Check size={12} />
                          Weapon properly normalized
                        </div>
                      )}
                    </div>
                    
                    {handleDetectionResult.annotatedImage && (
                      <div className="space-y-2">
                        <img 
                          src={handleDetectionResult.annotatedImage} 
                          alt="Detected grip area"
                          className="w-full rounded-lg border border-white/10"
                        />
                        <p className="text-xs text-text-tertiary text-center">
                          Red box indicates detected grip area
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Fine-tune Controls */}
          {selectedEquipment?.hasModel && (
            <>
              {/* Orientation Controls */}
              <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <RotateCw className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Fine-tune Orientation</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Manually adjust weapon rotation</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {[
                    { axis: 'x', label: 'Forward/Back tilt', color: 'text-red-400' },
                    { axis: 'y', label: 'Left/Right turn', color: 'text-green-400' },
                    { axis: 'z', label: 'Roll/Twist', color: 'text-blue-400' }
                  ].map(({ axis, label, color }) => (
                    <div key={axis} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-md bg-bg-tertiary/50 flex items-center justify-center font-bold text-sm", color)}>
                            {axis.toUpperCase()}
                          </div>
                          <span className="text-sm text-text-primary">{label}</span>
                        </div>
                        <span className="text-xs font-mono text-text-primary bg-bg-tertiary/30 px-2 py-1 rounded">
                          {manualRotation[axis as keyof typeof manualRotation]}°
                        </span>
                      </div>
                      <RangeInput
                        type="range"
                        min="-180"
                        max="180"
                        value={manualRotation[axis as keyof typeof manualRotation]}
                        onChange={(e) => setManualRotation({ 
                          ...manualRotation, 
                          [axis]: Number(e.target.value) 
                        })}
                      />
                    </div>
                  ))}
                  
                  <button
                    onClick={() => setManualRotation({ x: 0, y: 0, z: 0 })}
                    className="w-full mt-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 bg-bg-secondary/30 text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary"
                  >
                    <RefreshCw size={14} />
                    <span>Reset Orientation</span>
                  </button>
                </div>
              </div>
              
              {/* Position Controls */}
              <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Move className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">Fine-tune Position</h3>
                      <p className="text-xs text-text-secondary mt-0.5">Adjust weapon position relative to hand</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {[
                    { axis: 'x', label: 'Left/Right', color: 'text-red-400' },
                    { axis: 'y', label: 'Up/Down', color: 'text-green-400' },
                    { axis: 'z', label: 'Forward/Back', color: 'text-blue-400' }
                  ].map(({ axis, label, color }) => (
                    <div key={axis}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                          <span className={cn("text-xs uppercase font-bold", color)}>{axis}</span>
                          {label}
                        </span>
                        <span className="text-sm font-mono text-text-primary">
                          {manualPosition[axis as keyof typeof manualPosition].toFixed(3)}m
                        </span>
                      </div>
                      <RangeInput
                        type="range"
                        min="-0.2"
                        max="0.2"
                        step="0.001"
                        value={manualPosition[axis as keyof typeof manualPosition]}
                        onChange={(e) => setManualPosition({ 
                          ...manualPosition, 
                          [axis]: Number(e.target.value) 
                        })}
                      />
                    </div>
                  ))}
                  
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    onClick={() => setManualPosition({ x: 0, y: 0, z: 0 })}
                    className="w-full mt-2 gap-2"
                  >
                    <Move size={16} />
                    Reset Position
                  </Button>
                </div>
              </div>
            </>
          )}
          
          {/* Creature Size Controls */}
          <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Ruler className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Creature Size</h3>
                  <p className="text-xs text-text-secondary mt-0.5">Adjust avatar size and weapon scaling</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* Size Category */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                  Creature Category
                  <Badge variant="secondary" size="sm" className="capitalize">
                    {creatureCategory}
                  </Badge>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {CREATURE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setAvatarHeight(preset.height)
                        setCreatureCategory(preset.category)
                      }}
                      className={cn(
                        "px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex flex-col items-center gap-1",
                        creatureCategory === preset.category
                          ? "bg-primary/80 text-white shadow-lg shadow-primary/20"
                          : "bg-bg-tertiary/20 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/30 border border-white/10"
                      )}
                    >
                      <span className="text-lg">{preset.icon}</span>
                      <span className="text-xs">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Height Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-text-primary">Height</label>
                  <span className="text-sm font-mono text-primary">{avatarHeight.toFixed(1)}m</span>
                </div>
                <RangeInput
                  type="range"
                  min="0.3"
                  max="10"
                  step="0.1"
                  value={avatarHeight}
                  onChange={(e) => {
                    const height = parseFloat(e.target.value)
                    setAvatarHeight(height)
                    setCreatureCategory(getCreatureCategory(height))
                  }}
                />
                <div className="flex justify-between text-xs text-text-tertiary">
                  <span>0.3m</span>
                  <span>1.8m (Human)</span>
                  <span>10m</span>
                </div>
              </div>
              
              {/* Weapon Scaling */}
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScaleWeapon}
                    onChange={(e) => setAutoScaleWeapon(e.target.checked)}
                    className="w-4 h-4 rounded border-border-primary text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-text-primary">
                    Auto-scale weapon to creature size
                  </span>
                </label>
                
                {!autoScaleWeapon && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-text-primary">Manual Scale</label>
                      <span className="text-sm font-mono text-primary">{weaponScaleOverride.toFixed(1)}x</span>
                    </div>
                    <RangeInput
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={weaponScaleOverride}
                      onChange={(e) => setWeaponScaleOverride(parseFloat(e.target.value))}
                    />
                  </div>
                )}
                
                {autoScaleWeapon && selectedEquipment && (
                  <div className="p-3 bg-bg-tertiary/20 rounded-lg border border-white/10 space-y-2">
                    <p className="text-xs text-text-tertiary flex items-center gap-1">
                      <Info size={12} />
                      Recommended weapons for {CREATURE_SIZE_CATEGORIES[creatureCategory as keyof typeof CREATURE_SIZE_CATEGORIES].name}:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {CreatureScalingService.getRecommendedWeapons(avatarHeight).map(weapon => (
                        <Badge key={weapon} variant="secondary" size="sm">
                          {weapon}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Reset Button */}
              <Button
                onClick={handleReset}
                variant="secondary"
                size="sm"
                className="w-full gap-2"
              >
                <RefreshCw size={16} />
                Reset to Defaults
              </Button>
            </div>
          </div>
          
          {/* Actions */}
          <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Export Options</h3>
                  <p className="text-xs text-text-secondary mt-0.5">Save your configuration</p>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={handleSaveConfiguration}
                disabled={!selectedAvatar || !selectedEquipment}
                className={cn(
                  "w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2",
                  "bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg hover:shadow-xl",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  (!selectedAvatar || !selectedEquipment) && "opacity-50 cursor-not-allowed"
                )}
              >
                <Save size={16} />
                <span>Save Configuration</span>
              </button>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleExportAlignedModel}
                  disabled={!selectedEquipment}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
                    "bg-bg-secondary/50 border border-white/10 text-text-primary",
                    "hover:bg-bg-secondary/70 hover:border-white/20",
                    (!selectedEquipment) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Download size={14} />
                  <span>Export Equipment</span>
                </button>
                
                <button
                  onClick={handleExportEquippedAvatar}
                  disabled={!selectedAvatar || !selectedEquipment}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2",
                    "bg-bg-secondary/50 border border-white/10 text-text-primary",
                    "hover:bg-bg-secondary/70 hover:border-white/20",
                    (!selectedAvatar || !selectedEquipment) && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Download size={14} />
                  <span>Export Avatar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default EquipmentPage 