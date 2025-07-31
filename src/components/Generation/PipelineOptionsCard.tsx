import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../common'
import { Zap, Brain, User, Palette, Grid3x3 } from 'lucide-react'

interface PipelineOption {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  icon: React.ComponentType<{ className?: string }>
}

interface PipelineOptionsCardProps {
  generationType: 'item' | 'avatar' | undefined
  useGPT4Enhancement: boolean
  enableRetexturing: boolean
  enableSprites: boolean
  enableRigging: boolean
  onUseGPT4EnhancementChange: (checked: boolean) => void
  onEnableRetexturingChange: (checked: boolean) => void
  onEnableSpritesChange: (checked: boolean) => void
  onEnableRiggingChange: (checked: boolean) => void
}

export const PipelineOptionsCard: React.FC<PipelineOptionsCardProps> = ({
  generationType,
  useGPT4Enhancement,
  enableRetexturing,
  enableSprites,
  enableRigging,
  onUseGPT4EnhancementChange,
  onEnableRetexturingChange,
  onEnableSpritesChange,
  onEnableRiggingChange
}) => {
  const options: PipelineOption[] = [
    {
      id: 'gpt4',
      label: 'GPT-4 Enhancement',
      description: 'Improve prompts with AI',
      checked: useGPT4Enhancement,
      onChange: onUseGPT4EnhancementChange,
      icon: Brain
    },
    ...(generationType === 'avatar' ? [{
      id: 'rigging',
      label: 'Auto-Rigging',
      description: 'Add skeleton & animations',
      checked: enableRigging,
      onChange: onEnableRiggingChange,
      icon: User
    }] : []),
    ...(generationType === 'item' ? [
      {
        id: 'retexture',
        label: 'Material Variants',
        description: 'Generate multiple textures',
        checked: enableRetexturing,
        onChange: onEnableRetexturingChange,
        icon: Palette
      },
      {
        id: 'sprites',
        label: '2D Sprites',
        description: 'Generate 8-directional sprites',
        checked: enableSprites,
        onChange: onEnableSpritesChange,
        icon: Grid3x3
      }
    ] : [])
  ]

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Pipeline Options
        </CardTitle>
        <CardDescription>Configure generation features</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.map((option) => {
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
  )
}

export default PipelineOptionsCard 