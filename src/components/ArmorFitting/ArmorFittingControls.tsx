import React from 'react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '../common'
import { FittingConfig } from '../../services/fitting/armor/ArmorFittingService'
import { cn } from '../../styles'
import { 
  Sliders, Save, Download, RefreshCw, Eye, EyeOff,
  Move, Maximize2, Activity, Shield, Sparkles,
  Grid3X3, Box, Wand2, Zap, Target, Hand, 
  HardHat, Package, Info, Layers
} from 'lucide-react'

interface ArmorFittingControlsProps {
  // Fitting config
  fittingConfig: FittingConfig
  onFittingConfigChange: (updates: Partial<FittingConfig>) => void
  
  // Transform controls
  armorTransform: {
    position: { x: number; y: number; z: number }
    scale: number
  }
  onArmorTransformChange: (updates: Partial<ArmorFittingControlsProps['armorTransform']>) => void
  
  // Options
  enableWeightTransfer: boolean
  onEnableWeightTransferChange: (enabled: boolean) => void
  showWireframe: boolean
  onShowWireframeChange: (show: boolean) => void
  equipmentSlot: string
  onEquipmentSlotChange: (slot: string) => void
  
  // Visualization
  visualizationMode: 'none' | 'regions' | 'collisions' | 'weights' | 'hull'
  onVisualizationModeChange: (mode: ArmorFittingControlsProps['visualizationMode']) => void
  
  // Actions
  onPerformFitting: () => void
  onResetFitting: () => void
  onExportArmor: () => void
  onSaveConfiguration: () => void
  
  // State
  isFitting: boolean
  fittingProgress: number
  canFit: boolean
}

const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
  return (
    <input
      type="range"
      className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
      {...props}
    />
  )
}

const FITTING_METHODS = {
  hull: {
    name: 'Hull-Based',
    description: 'Fit to actual body shape',
    icon: <Wand2 size={18} />,
    color: 'text-green-400'
  },
  collision: {
    name: 'Collision-Based',
    description: 'Resolve intersections',
    icon: <Zap size={18} />,
    color: 'text-orange-400'
  },
  smooth: {
    name: 'Smooth Deform',
    description: 'Shape-preserving fit',
    icon: <Sparkles size={18} />,
    color: 'text-purple-400'
  },
  boundingBox: {
    name: 'Bounding Box',
    description: 'Fast initial fit',
    icon: <Box size={18} />,
    color: 'text-blue-400'
  }
}

const EQUIPMENT_SLOTS = [
  { id: 'Head', name: 'Helmet', icon: <HardHat size={20} />, description: 'Head armor' },
  { id: 'Spine2', name: 'Chestplate', icon: <Shield size={20} />, description: 'Body armor' },
  { id: 'Hips', name: 'Legs', icon: <Package size={20} />, description: 'Leg armor' },
  { id: 'Hand_R', name: 'Right Hand', icon: <Hand size={20} className="scale-x-[-1]" />, description: 'Weapons' },
  { id: 'Hand_L', name: 'Left Hand', icon: <Hand size={20} />, description: 'Shields' }
]

export const ArmorFittingControls: React.FC<ArmorFittingControlsProps> = ({
  fittingConfig,
  onFittingConfigChange,
  armorTransform,
  onArmorTransformChange,
  enableWeightTransfer,
  onEnableWeightTransferChange,
  showWireframe,
  onShowWireframeChange,
  equipmentSlot,
  onEquipmentSlotChange,
  visualizationMode,
  onVisualizationModeChange,
  onPerformFitting,
  onResetFitting,
  onExportArmor,
  onSaveConfiguration,
  isFitting,
  fittingProgress,
  canFit
}) => {
  return (
    <div className="space-y-3">
      {/* Equipment Slot Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" />
            Equipment Slot
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2">
            {EQUIPMENT_SLOTS.slice(0, 3).map((slot) => (
              <button
                key={slot.id}
                onClick={() => onEquipmentSlotChange(slot.id)}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1.5",
                  equipmentSlot === slot.id
                    ? "bg-primary/10 border-primary"
                    : "bg-bg-secondary/40 border-white/10 hover:border-white/20"
                )}
              >
                <div className={cn(equipmentSlot === slot.id ? 'text-primary' : 'text-text-secondary')}>
                  {slot.icon}
                </div>
                <span className={cn("text-xs font-medium", equipmentSlot === slot.id ? 'text-primary' : 'text-text-primary')}>
                  {slot.name}
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {EQUIPMENT_SLOTS.slice(3).map((slot) => (
              <button
                key={slot.id}
                onClick={() => onEquipmentSlotChange(slot.id)}
                className={cn(
                  "p-3 rounded-lg border transition-all duration-200 flex flex-col items-center gap-1.5",
                  equipmentSlot === slot.id
                    ? "bg-primary/10 border-primary"
                    : "bg-bg-secondary/40 border-white/10 hover:border-white/20"
                )}
              >
                <div className={cn(equipmentSlot === slot.id ? 'text-primary' : 'text-text-secondary')}>
                  {slot.icon}
                </div>
                <span className={cn("text-xs font-medium", equipmentSlot === slot.id ? 'text-primary' : 'text-text-primary')}>
                  {slot.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fitting Method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wand2 className="w-4 h-4" />
            Fitting Method
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(FITTING_METHODS).map(([key, method]) => (
              <button
                key={key}
                onClick={() => onFittingConfigChange({ method: key as 'boundingBox' | 'collision' | 'smooth' | 'iterative' | 'hull' })}
                className={cn(
                  "p-2.5 rounded-lg border transition-all text-left",
                  fittingConfig.method === key
                    ? "border-primary bg-primary/10"
                    : "border-border-primary hover:border-border-secondary bg-bg-secondary/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn("flex-shrink-0", method.color)}>
                    {method.icon}
                  </div>
                  <div className="min-w-0">
                    <div className={cn("font-medium text-xs", fittingConfig.method === key && "text-primary")}>
                      {method.name}
                    </div>
                    <div className="text-[10px] text-text-tertiary truncate">
                      {method.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Fitting Parameters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sliders className="w-4 h-4" />
            Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* Method-specific parameters */}
          {fittingConfig.method === 'hull' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Target Offset</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {(fittingConfig.hullTargetOffset || 0.02).toFixed(3)}m
                  </span>
                </div>
                <RangeInput
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={fittingConfig.hullTargetOffset || 0.02}
                  onChange={(e) => onFittingConfigChange({ 
                    hullTargetOffset: parseFloat(e.target.value) 
                  })}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Iterations</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {fittingConfig.hullIterations || 5}
                  </span>
                </div>
                <RangeInput
                  min="1"
                  max="20"
                  step="1"
                  value={fittingConfig.hullIterations || 5}
                  onChange={(e) => onFittingConfigChange({ 
                    hullIterations: parseInt(e.target.value) 
                  })}
                />
              </div>
            </>
          )}

          {(fittingConfig.method === 'collision' || fittingConfig.method === 'smooth') && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium">Margin</label>
                  <span className="text-[10px] text-text-secondary font-mono">
                    {fittingConfig.margin.toFixed(3)}m
                  </span>
                </div>
                <RangeInput
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={fittingConfig.margin}
                  onChange={(e) => onFittingConfigChange({ 
                    margin: parseFloat(e.target.value) 
                  })}
                />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Stiffness</label>
              <span className="text-[10px] text-text-secondary font-mono">
                {fittingConfig.stiffness.toFixed(2)}
              </span>
            </div>
            <RangeInput
              min="0"
              max="1"
              step="0.01"
              value={fittingConfig.stiffness}
              onChange={(e) => onFittingConfigChange({ 
                stiffness: parseFloat(e.target.value) 
              })}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={enableWeightTransfer}
              onChange={(e) => onEnableWeightTransferChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border-primary text-primary focus:ring-primary"
            />
            <span className="text-xs font-medium">Enable Weight Transfer</span>
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              Beta
            </Badge>
          </label>
        </CardContent>
      </Card>

      {/* Transform Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Move className="w-4 h-4" />
            Manual Adjust
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Scale</label>
              <span className="text-[10px] text-text-secondary font-mono">
                {armorTransform.scale.toFixed(2)}x
              </span>
            </div>
            <RangeInput
              min="0.5"
              max="2"
              step="0.01"
              value={armorTransform.scale}
              onChange={(e) => onArmorTransformChange({ 
                scale: parseFloat(e.target.value) 
              })}
            />
          </div>

          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">Position {axis.toUpperCase()}</label>
                <span className="text-[10px] text-text-secondary font-mono">
                  {armorTransform.position[axis].toFixed(3)}m
                </span>
              </div>
              <RangeInput
                min="-0.5"
                max="0.5"
                step="0.01"
                value={armorTransform.position[axis]}
                onChange={(e) => onArmorTransformChange({ 
                  position: {
                    ...armorTransform.position,
                    [axis]: parseFloat(e.target.value)
                  }
                })}
              />
            </div>
          ))}
          
          <Button
            onClick={() => onArmorTransformChange({ 
              position: { x: 0, y: 0, z: 0 }, 
              scale: 1.0 
            })}
            variant="secondary"
            size="sm"
            className="w-full mt-2"
          >
            <RefreshCw className="w-3 h-3 mr-1.5" />
            Reset Transform
          </Button>
        </CardContent>
      </Card>

      {/* Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="w-4 h-4" />
            Visualization
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            {[
              { mode: 'none', label: 'None', icon: <EyeOff className="w-3 h-3" /> },
              { mode: 'regions', label: 'Regions', icon: <Layers className="w-3 h-3" /> },
              { mode: 'collisions', label: 'Collisions', icon: <Zap className="w-3 h-3" /> },
              { mode: 'weights', label: 'Weights', icon: <Activity className="w-3 h-3" /> },
              { mode: 'hull', label: 'Hull', icon: <Box className="w-3 h-3" /> }
            ].filter(({ mode }) => mode === 'none' || mode !== 'hull').map(({ mode, label, icon }) => (
              <button
                key={mode}
                onClick={() => onVisualizationModeChange(mode as 'none' | 'regions' | 'collisions' | 'weights' | 'hull')}
                className={cn(
                  "px-2 py-1.5 text-[11px] rounded-md transition-colors flex items-center gap-1.5 justify-center",
                  visualizationMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => onShowWireframeChange(!showWireframe)}
            variant="secondary"
            size="sm"
            className="w-full"
          >
            <Grid3X3 className="w-3 h-3 mr-1.5" />
            {showWireframe ? 'Hide' : 'Show'} Wireframe
          </Button>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          onClick={onPerformFitting}
          disabled={!canFit || isFitting}
          variant="primary"
          className="w-full"
        >
          {isFitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              Fitting... {Math.round(fittingProgress)}%
            </>
          ) : (
            <>
              <Activity className="w-4 h-4 mr-2" />
              Perform Fitting
            </>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onExportArmor}
            disabled={!canFit}
            variant="secondary"
            size="sm"
          >
            <Download className="w-3 h-3 mr-1.5" />
            Export
          </Button>

          <Button
            onClick={onSaveConfiguration}
            disabled={!canFit}
            variant="secondary"
            size="sm"
          >
            <Save className="w-3 h-3 mr-1.5" />
            Save Config
          </Button>
        </div>

        <Button
          onClick={onResetFitting}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          <RefreshCw className="w-3 h-3 mr-1.5" />
          Reset Fitting
        </Button>
      </div>
    </div>
  )
} 