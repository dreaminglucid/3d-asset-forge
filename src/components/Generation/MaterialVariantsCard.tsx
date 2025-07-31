import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Textarea } from '../common'
import { Palette, Edit2, Trash2, Plus, Download, Loader2 } from 'lucide-react'
import { cn } from '../../styles'
import { MaterialPreset } from '../../types'

interface CustomMaterial {
  name: string
  displayName?: string
  prompt: string
  color?: string
}

interface MaterialVariantsCardProps {
  gameStyle: 'runescape' | 'custom'
  isLoadingMaterials: boolean
  materialPresets: MaterialPreset[]
  selectedMaterials: string[]
  customMaterials: CustomMaterial[]
  materialPromptOverrides: Record<string, string>
  editMaterialPrompts: boolean
  onToggleMaterialSelection: (materialId: string) => void
  onEditMaterialPromptsToggle: () => void
  onMaterialPromptOverride: (materialId: string, prompt: string) => void
  onAddCustomMaterial: (material: CustomMaterial) => void
  onUpdateCustomMaterial: (index: number, material: CustomMaterial) => void
  onRemoveCustomMaterial: (index: number) => void
  onSaveCustomMaterials: () => void
  onEditPreset: (preset: MaterialPreset) => void
  onDeletePreset: (presetId: string) => void
}

export const MaterialVariantsCard: React.FC<MaterialVariantsCardProps> = ({
  gameStyle,
  isLoadingMaterials,
  materialPresets,
  selectedMaterials,
  customMaterials,
  materialPromptOverrides,
  editMaterialPrompts,
  onToggleMaterialSelection,
  onEditMaterialPromptsToggle,
  onMaterialPromptOverride,
  onAddCustomMaterial,
  onUpdateCustomMaterial,
  onRemoveCustomMaterial,
  onSaveCustomMaterials,
  onEditPreset,
  onDeletePreset
}) => {
  return (
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
                onClick={onEditMaterialPromptsToggle}
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
                  <MaterialPresetItem
                    key={preset.id}
                    preset={preset}
                    isSelected={selectedMaterials.includes(preset.id)}
                    onToggle={() => onToggleMaterialSelection(preset.id)}
                    onEdit={() => onEditPreset(preset)}
                    onDelete={() => onDeletePreset(preset.id)}
                    showEditDelete={preset.category === 'custom'}
                  />
                ))
              )}
            </div>
            
            {editMaterialPrompts && selectedMaterials.length > 0 && (
              <MaterialPromptOverrides
                selectedMaterials={selectedMaterials}
                materialPresets={materialPresets}
                materialPromptOverrides={materialPromptOverrides}
                onPromptOverride={onMaterialPromptOverride}
              />
            )}
          </>
        )}
        
        {/* Custom Materials */}
        <CustomMaterialsSection
          gameStyle={gameStyle}
          customMaterials={customMaterials}
          onAddCustomMaterial={onAddCustomMaterial}
          onUpdateCustomMaterial={onUpdateCustomMaterial}
          onRemoveCustomMaterial={onRemoveCustomMaterial}
          onSaveCustomMaterials={onSaveCustomMaterials}
        />
      </CardContent>
    </Card>
  )
}

// Sub-component for material preset item
const MaterialPresetItem: React.FC<{
  preset: MaterialPreset
  isSelected: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  showEditDelete: boolean
}> = ({ preset, isSelected, onToggle, onEdit, onDelete, showEditDelete }) => {
  return (
    <div
      className={cn(
        "relative group p-3 rounded-lg border-2 transition-all duration-200",
        isSelected
          ? "border-primary bg-primary bg-opacity-10"
          : "border-border-primary hover:border-primary hover:bg-bg-secondary"
      )}
    >
      <button
        onClick={onToggle}
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
            onEdit()
          }}
          className="p-1 hover:bg-bg-tertiary rounded transition-colors"
          title="Edit preset"
        >
          <Edit2 className="w-3 h-3 text-text-secondary hover:text-text-primary" />
        </button>
        {showEditDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 hover:bg-error hover:bg-opacity-20 rounded transition-colors"
            title="Delete preset"
          >
            <Trash2 className="w-3 h-3 text-text-secondary hover:text-error" />
          </button>
        )}
      </div>
    </div>
  )
}

// Sub-component for material prompt overrides
const MaterialPromptOverrides: React.FC<{
  selectedMaterials: string[]
  materialPresets: MaterialPreset[]
  materialPromptOverrides: Record<string, string>
  onPromptOverride: (materialId: string, prompt: string) => void
}> = ({ selectedMaterials, materialPresets, materialPromptOverrides, onPromptOverride }) => {
  return (
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
              onChange={(e) => onPromptOverride(matId, e.target.value)}
              placeholder="Enter custom prompt..."
              rows={2}
              className="text-xs font-mono"
            />
          </div>
        )
      })}
    </div>
  )
}

// Sub-component for custom materials section
const CustomMaterialsSection: React.FC<{
  gameStyle: 'runescape' | 'custom'
  customMaterials: CustomMaterial[]
  onAddCustomMaterial: (material: CustomMaterial) => void
  onUpdateCustomMaterial: (index: number, material: CustomMaterial) => void
  onRemoveCustomMaterial: (index: number) => void
  onSaveCustomMaterials: () => void
}> = ({ 
  gameStyle, 
  customMaterials, 
  onAddCustomMaterial, 
  onUpdateCustomMaterial, 
  onRemoveCustomMaterial,
  onSaveCustomMaterials 
}) => {
  return (
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
                  onUpdateCustomMaterial(index, { ...mat, name: e.target.value })
                }}
                className="w-24 text-sm"
              />
              <Input
                placeholder="Display Name"
                value={mat.displayName || ''}
                onChange={(e) => {
                  onUpdateCustomMaterial(index, { ...mat, displayName: e.target.value })
                }}
                className="flex-1 text-sm"
              />
              <input
                type="color"
                value={mat.color || '#888888'}
                onChange={(e) => {
                  onUpdateCustomMaterial(index, { ...mat, color: e.target.value })
                }}
                className="w-10 h-10 border border-border-primary rounded cursor-pointer"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveCustomMaterial(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <Textarea
              placeholder="Material texture prompt"
              value={mat.prompt}
              onChange={(e) => {
                onUpdateCustomMaterial(index, { ...mat, prompt: e.target.value })
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
              onAddCustomMaterial({ name: '', prompt: '', color: '#888888' })
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
              onClick={onSaveCustomMaterials}
              className="flex-1"
            >
              <Download className="w-4 h-4 mr-2" />
              Save to Presets
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MaterialVariantsCard 