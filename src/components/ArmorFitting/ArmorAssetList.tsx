import React, { useState, useMemo } from 'react'
import { Card, CardContent, Badge, Input } from '../common'
import { cn } from '../../styles'
import { Search, User, Shield, ChevronRight } from 'lucide-react'
import { Asset } from '../../types'

interface ArmorAssetListProps {
  assets: Asset[]
  loading: boolean
  assetType: 'avatar' | 'armor'
  selectedAsset: Asset | null
  selectedAvatar?: Asset | null
  selectedArmor?: Asset | null
  onAssetSelect: (asset: Asset) => void
  onAssetTypeChange: (type: 'avatar' | 'armor') => void
}

export const ArmorAssetList: React.FC<ArmorAssetListProps> = ({
  assets,
  loading,
  assetType,
  selectedAsset,
  selectedAvatar,
  selectedArmor,
  onAssetSelect,
  onAssetTypeChange
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  // Filter assets
  const avatarAssets = useMemo(() => 
    assets.filter(a => a.type === 'character'),
    [assets]
  )
  
  const armorAssets = useMemo(() => 
    assets.filter(a => 
      a.type === 'armor' || 
      (a.type === 'weapon' && a.name.toLowerCase().includes('shield')) ||
      a.name.toLowerCase().includes('helmet') ||
      a.name.toLowerCase().includes('chest') ||
      a.name.toLowerCase().includes('legs') ||
      a.name.toLowerCase().includes('body')
    ),
    [assets]
  )

  const filteredAssets = useMemo(() => {
    const baseAssets = assetType === 'avatar' ? avatarAssets : armorAssets
    return baseAssets.filter(a => 
      a.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [assetType, avatarAssets, armorAssets, searchTerm])

  // Group armor by slot
  const groupedArmorAssets = useMemo(() => {
    if (assetType !== 'armor') return {}
    
    const groups: Record<string, Asset[]> = {
      helmet: [],
      chest: [],
      legs: [],
      other: []
    }
    
    filteredAssets.forEach(asset => {
      const name = asset.name.toLowerCase()
      if (name.includes('helmet') || name.includes('head')) {
        groups.helmet.push(asset)
      } else if (name.includes('chest') || name.includes('body') || name.includes('torso')) {
        groups.chest.push(asset)
      } else if (name.includes('leg') || name.includes('legs')) {
        groups.legs.push(asset)
      } else {
        groups.other.push(asset)
      }
    })
    
    return groups
  }, [assetType, filteredAssets])

  return (
    <div className="h-full flex flex-col">
      {/* Asset Type Selector */}
      <div className="p-4 border-b border-border-primary">
        <div className="flex gap-2">
          <button
            onClick={() => onAssetTypeChange('avatar')}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all",
              "flex items-center justify-center gap-2",
              assetType === 'avatar'
                ? "bg-primary text-primary-foreground"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            )}
          >
            <User size={16} />
            Avatars ({avatarAssets.length})
          </button>
          <button
            onClick={() => onAssetTypeChange('armor')}
            className={cn(
              "flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all",
              "flex items-center justify-center gap-2",
              assetType === 'armor'
                ? "bg-primary text-primary-foreground"
                : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
            )}
          >
            <Shield size={16} />
            Armor ({armorAssets.length})
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border-primary">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-4 h-4" />
          <Input
            type="text"
            placeholder={`Search ${assetType}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary">Loading assets...</div>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-text-secondary text-center">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No {assetType} found</p>
              {searchTerm && (
                <p className="text-sm mt-1">Try adjusting your search</p>
              )}
            </div>
          </div>
        ) : assetType === 'avatar' ? (
          // Avatar list
          <div className="grid gap-2">
            {filteredAssets.map(asset => (
              <Card
                key={asset.id}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedAsset?.id === asset.id && "ring-2 ring-primary"
                )}
                onClick={() => onAssetSelect(asset)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                      <User className="w-5 h-5 text-text-secondary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{asset.name}</div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        Character Model
                      </div>
                    </div>
                    {selectedAsset?.id === asset.id && (
                      <ChevronRight className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Armor list grouped by slot
          <div className="space-y-6">
            {Object.entries(groupedArmorAssets).map(([slot, slotAssets]) => {
              if (slotAssets.length === 0) return null
              
              return (
                <div key={slot}>
                  <h3 className="text-sm font-medium text-text-secondary mb-3 capitalize">
                    {slot} ({slotAssets.length})
                  </h3>
                  <div className="grid gap-2">
                    {slotAssets.map(asset => (
                      <Card
                        key={asset.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          selectedAsset?.id === asset.id && "ring-2 ring-primary"
                        )}
                        onClick={() => onAssetSelect(asset)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                              <Shield className="w-5 h-5 text-text-secondary" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{asset.name}</div>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="secondary" className="text-xs">
                                  {asset.type}
                                </Badge>
                                {asset.metadata?.tier && (
                                  <Badge variant="secondary" className="text-xs">
                                    {asset.metadata.tier}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {selectedAsset?.id === asset.id && (
                              <ChevronRight className="w-4 h-4 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Selected Assets Summary */}
      <div className="p-4 border-t border-border-primary bg-bg-primary bg-opacity-30">
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
              <Shield size={16} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-text-tertiary">Armor</p>
              <p className="text-sm font-medium text-text-primary">
                {selectedArmor?.name || 'None selected'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 