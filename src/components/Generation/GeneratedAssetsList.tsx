import React from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '../common'
import { CheckCircle, ChevronRight } from 'lucide-react'
import { cn } from '../../styles'
import { GeneratedAsset } from '../../types'

interface GeneratedAssetsListProps {
  generatedAssets: GeneratedAsset[]
  selectedAsset: GeneratedAsset | null
  onAssetSelect: (asset: GeneratedAsset) => void
  onBack: () => void
}

export const GeneratedAssetsList: React.FC<GeneratedAssetsListProps> = ({
  generatedAssets,
  selectedAsset,
  onAssetSelect,
  onBack
}) => {
  const formatAssetName = (name: string) => {
    return name
      .replace('-base', '')
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleTimeString()
  }

  return (
    <Card className="lg:col-span-1 h-fit lg:sticky lg:top-20 shadow-xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle>Generated Assets</CardTitle>
            <CardDescription>{generatedAssets.length} assets created</CardDescription>
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
      <CardContent className="p-2">
        <div className="space-y-2 max-h-[calc(100vh-16rem)] overflow-y-auto custom-scrollbar">
          {generatedAssets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => onAssetSelect(asset)}
              className={cn(
                "w-full p-4 rounded-lg text-left transition-all duration-200 hover:scale-[1.02]",
                selectedAsset?.id === asset.id
                  ? "bg-gradient-to-r from-primary/20 to-primary/10 border border-primary shadow-md"
                  : "hover:bg-bg-secondary border border-transparent"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-text-primary">
                    {formatAssetName(asset.name)}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1">
                    {formatDate(asset.createdAt)}
                  </p>
                </div>
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default GeneratedAssetsList 