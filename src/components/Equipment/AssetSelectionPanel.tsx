import React from 'react'
import { Badge, Input } from '../common'
import { cn } from '../../styles'
import { Search, ChevronRight, User, Sword, Box, Loader2 } from 'lucide-react'
import { Asset } from '../../types'

interface AssetSelectionPanelProps {
  assets: Asset[]
  loading: boolean
  selectedAvatar: Asset | null
  selectedEquipment: Asset | null
  onSelectAvatar: (asset: Asset) => void
  onSelectEquipment: (asset: Asset) => void
}

export const AssetSelectionPanel: React.FC<AssetSelectionPanelProps> = ({
  assets,
  loading,
  selectedAvatar,
  selectedEquipment,
  onSelectAvatar,
  onSelectEquipment
}) => {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [assetTypeFilter, setAssetTypeFilter] = React.useState<'avatar' | 'equipment'>('avatar')
  
  // Filter assets
  const avatarAssets = assets.filter(a => a.type === 'character')
  const equipmentAssets = assets.filter(a => ['weapon', 'armor', 'shield'].includes(a.type))
  
  const filteredAssets = assetTypeFilter === 'avatar' 
    ? avatarAssets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : equipmentAssets.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
  
  return (
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
                      onSelectAvatar(asset)
                    } else {
                      onSelectEquipment(asset)
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
  )
} 