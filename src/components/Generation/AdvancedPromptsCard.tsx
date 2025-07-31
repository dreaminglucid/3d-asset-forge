import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Textarea } from '../common'
import { Brain, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { cn } from '../../styles'
import { CustomAssetType } from '../../types/generation'

interface AdvancedPromptsCardProps {
  showAdvancedPrompts: boolean
  showAssetTypeEditor: boolean
  generationType: 'item' | 'avatar' | undefined
  customGamePrompt: string
  customAssetTypePrompt: string
  assetTypePrompts: Record<string, string>
  customAssetTypes: CustomAssetType[]
  onToggleAdvancedPrompts: () => void
  onToggleAssetTypeEditor: () => void
  onCustomGamePromptChange: (value: string) => void
  onCustomAssetTypePromptChange: (value: string) => void
  onAssetTypePromptsChange: (prompts: Record<string, string>) => void
  onCustomAssetTypesChange: (types: CustomAssetType[]) => void
  onAddCustomAssetType: (type: CustomAssetType) => void
}

export const AdvancedPromptsCard: React.FC<AdvancedPromptsCardProps> = ({
  showAdvancedPrompts,
  showAssetTypeEditor,
  generationType,
  customGamePrompt,
  customAssetTypePrompt,
  assetTypePrompts,
  customAssetTypes,
  onToggleAdvancedPrompts,
  onToggleAssetTypeEditor,
  onCustomGamePromptChange,
  onCustomAssetTypePromptChange,
  onAssetTypePromptsChange,
  onCustomAssetTypesChange,
  onAddCustomAssetType
}) => {
  const defaultAssetTypes = generationType === 'avatar' 
    ? ['character', 'humanoid', 'npc', 'creature'] 
    : ['weapon', 'armor', 'tool', 'building', 'consumable', 'resource']

  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
      <CardHeader 
        className="cursor-pointer hover:bg-bg-secondary transition-colors"
        onClick={onToggleAdvancedPrompts}
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
              onChange={(e) => onCustomGamePromptChange(e.target.value)}
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
                onClick={onToggleAssetTypeEditor}
              >
                {showAssetTypeEditor ? 'Hide' : 'Manage'} Types
              </Button>
            </div>
            <Textarea
              value={customAssetTypePrompt}
              onChange={(e) => onCustomAssetTypePromptChange(e.target.value)}
              placeholder={generationType === 'avatar' 
                ? "e.g., Show the full character in T-pose, front view on neutral background"
                : "e.g., Show the full weapon clearly on a neutral background"
              }
              rows={3}
              className="w-full resize-none"
            />
          </div>
          
          {showAssetTypeEditor && (
            <AssetTypeEditor
              generationType={generationType}
              defaultAssetTypes={defaultAssetTypes}
              assetTypePrompts={assetTypePrompts}
              customAssetTypes={customAssetTypes}
              onAssetTypePromptsChange={onAssetTypePromptsChange}
              onCustomAssetTypesChange={onCustomAssetTypesChange}
              onAddCustomAssetType={onAddCustomAssetType}
            />
          )}
        </CardContent>
      )}
    </Card>
  )
}

// Sub-component for asset type editor
const AssetTypeEditor: React.FC<{
  generationType: 'item' | 'avatar' | undefined
  defaultAssetTypes: string[]
  assetTypePrompts: Record<string, string>
  customAssetTypes: CustomAssetType[]
  onAssetTypePromptsChange: (prompts: Record<string, string>) => void
  onCustomAssetTypesChange: (types: CustomAssetType[]) => void
  onAddCustomAssetType: (type: CustomAssetType) => void
}> = ({
  generationType,
  defaultAssetTypes,
  assetTypePrompts,
  customAssetTypes,
  onAssetTypePromptsChange,
  onCustomAssetTypesChange,
  onAddCustomAssetType
}) => {
  return (
    <div className="p-4 bg-bg-tertiary rounded-lg space-y-4 animate-fade-in max-h-96 overflow-y-auto custom-scrollbar">
      <div className="space-y-3">
        <p className="text-sm font-medium text-text-secondary">
          {generationType === 'avatar' ? 'Default Character Types' : 'Default Asset Types'}
        </p>
        {defaultAssetTypes.map(type => (
          <div key={type} className="space-y-1">
            <label className="text-xs text-text-tertiary capitalize">{type}</label>
            <Textarea
              value={assetTypePrompts[type] || ''}
              onChange={(e) => {
                onAssetTypePromptsChange({
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
                  onCustomAssetTypesChange(updated)
                }}
                className="w-32"
              />
              <Input
                placeholder={generationType === 'avatar' ? "Character type prompt" : "Type-specific prompt"}
                value={type.prompt}
                onChange={(e) => {
                  const updated = [...customAssetTypes]
                  updated[index].prompt = e.target.value
                  onCustomAssetTypesChange(updated)
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCustomAssetTypesChange(customAssetTypes.filter((_, i) => i !== index))
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAddCustomAssetType({ name: '', prompt: '' })}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            {generationType === 'avatar' ? 'Add Character Type' : 'Add Custom Type'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AdvancedPromptsCard 