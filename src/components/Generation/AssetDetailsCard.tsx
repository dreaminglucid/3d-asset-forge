import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Textarea } from '../common'
import { FileText, Layers, Package, User, ChevronRight, Settings, Sword } from 'lucide-react'
import { CustomAssetType } from '../../types/generation'

interface AssetDetailsCardProps {
  generationType: 'item' | 'avatar' | undefined
  assetName: string
  assetType: string
  description: string
  gameStyle: 'runescape' | 'custom'
  customStyle: string
  customAssetTypes: CustomAssetType[]
  onAssetNameChange: (value: string) => void
  onAssetTypeChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onGameStyleChange: (style: 'runescape' | 'custom') => void
  onCustomStyleChange: (value: string) => void
  onBack: () => void
}

export const AssetDetailsCard: React.FC<AssetDetailsCardProps> = ({
  generationType,
  assetName,
  assetType,
  description,
  gameStyle,
  customStyle,
  customAssetTypes,
  onAssetNameChange,
  onAssetTypeChange,
  onDescriptionChange,
  onGameStyleChange,
  onCustomStyleChange,
  onBack
}) => {
  return (
    <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {generationType === 'avatar' ? (
                <>
                  <User className="w-5 h-5" />
                  Avatar Details
                </>
              ) : (
                <>
                  <Package className="w-5 h-5" />
                  Asset Details
                </>
              )}
            </CardTitle>
            <CardDescription>Define what you want to create</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary"
            title="Back to generation type selection"
          >
            <ChevronRight className="w-4 h-4 rotate-180 mr-1" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {generationType === 'avatar' ? 'Avatar Name' : 'Asset Name'}
            </label>
            <Input
              value={assetName}
              onChange={(e) => onAssetNameChange(e.target.value)}
              placeholder={generationType === 'avatar' ? "e.g., Goblin Warrior" : "e.g., Dragon Sword"}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Asset Type
            </label>
            {generationType === 'avatar' ? (
              <div className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-lg text-text-primary">
                👤 Character (Humanoid)
              </div>
            ) : (
              <select
                value={assetType}
                onChange={(e) => onAssetTypeChange(e.target.value)}
                className="w-full px-4 py-2 bg-bg-secondary border border-border-primary rounded-lg text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-20 transition-all"
              >
                <option value="weapon">⚔️ Weapon</option>
                <option value="armor">🛡️ Armor</option>
                <option value="tool">🔨 Tool</option>
                <option value="building">🏰 Building</option>
                <option value="consumable">🧪 Consumable</option>
                <option value="resource">💎 Resource</option>
                {customAssetTypes.filter(t => t.name).map(type => (
                  <option key={type.name} value={type.name.toLowerCase()}>
                    ✨ {type.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe your asset in detail..."
            rows={4}
            className="w-full resize-none"
          />
        </div>
        
        {/* Game Style Selection */}
        <GameStyleSelector
          gameStyle={gameStyle}
          customStyle={customStyle}
          onGameStyleChange={onGameStyleChange}
          onCustomStyleChange={onCustomStyleChange}
        />
      </CardContent>
    </Card>
  )
}

// Sub-component for game style selection
const GameStyleSelector: React.FC<{
  gameStyle: 'runescape' | 'custom'
  customStyle: string
  onGameStyleChange: (style: 'runescape' | 'custom') => void
  onCustomStyleChange: (value: string) => void
}> = ({ gameStyle, customStyle, onGameStyleChange, onCustomStyleChange }) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-text-primary">
        Game Style
      </label>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onGameStyleChange('runescape')}
          className={`relative p-6 rounded-xl border-2 transition-all duration-200 overflow-hidden group hover:scale-[1.02] ${
            gameStyle === 'runescape' 
              ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg" 
              : "border-border-primary hover:border-border-secondary bg-bg-secondary"
          }`}
        >
          <div className="relative z-10">
            <Sword className="w-8 h-8 mx-auto mb-3 text-primary" />
            <p className="font-semibold text-text-primary">RuneScape 2007</p>
            <p className="text-xs text-text-secondary mt-1">Classic low-poly style</p>
          </div>
          {gameStyle === 'runescape' && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent animate-pulse" />
          )}
        </button>
        
        <button
          onClick={() => onGameStyleChange('custom')}
          className={`relative p-6 rounded-xl border-2 transition-all duration-200 overflow-hidden group hover:scale-[1.02] ${
            gameStyle === 'custom' 
              ? "border-primary bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg" 
              : "border-border-primary hover:border-border-secondary bg-bg-secondary"
          }`}
        >
          <div className="relative z-10">
            <Settings className="w-8 h-8 mx-auto mb-3 text-primary" />
            <p className="font-semibold text-text-primary">Custom Style</p>
            <p className="text-xs text-text-secondary mt-1">Define your own</p>
          </div>
          {gameStyle === 'custom' && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent animate-pulse" />
          )}
        </button>
      </div>
      
      {gameStyle === 'custom' && (
        <div className="animate-slide-up">
          <Input
            value={customStyle}
            onChange={(e) => onCustomStyleChange(e.target.value)}
            placeholder="e.g., realistic medieval, cartoon, sci-fi"
            className="w-full"
          />
        </div>
      )}
    </div>
  )
}

export default AssetDetailsCard 