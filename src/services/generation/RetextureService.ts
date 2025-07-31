/**
 * Unified Retexture Service
 * Frontend service that communicates with the server API for retexturing operations
 */

import { MaterialPreset } from '../../types/index'
import { AssetMetadata, BaseAssetMetadata, VariantAssetMetadata, isBaseAsset } from '../../types/AssetMetadata'

export interface RetextureOptions {
  baseAssetId: string
  materialPreset: MaterialPreset
  outputName?: string
}

export interface RetextureResult {
  success: boolean
  assetId: string
  message: string
  asset?: VariantAssetMetadata
  error?: string
}

export interface BatchRetextureOptions {
  assets: string[]
  materialPresets: MaterialPreset[]
  onProgress?: (assetId: string, status: string, progress: number) => void
}

export interface BatchRetextureResult {
  totalAssets: number
  totalVariants: number
  successful: number
  failed: number
  results: Array<{
    assetId: string
    variants: Array<{
      materialId: string
      success: boolean
      variantId?: string
      error?: string
    }>
  }>
}

export class RetextureService {
  private apiBaseUrl: string
  
  constructor(apiBaseUrl: string = '') {
    this.apiBaseUrl = apiBaseUrl || window.location.origin
  }
  
  /**
   * Retexture a single asset with a material preset
   */
  async retextureAsset(options: RetextureOptions): Promise<RetextureResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/retexture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('Retexture failed:', error)
      return {
        success: false,
        assetId: options.baseAssetId,
        message: 'Retexturing failed',
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
  
  /**
   * Batch retexture multiple assets
   */
  async batchRetexture(options: BatchRetextureOptions): Promise<BatchRetextureResult> {
    const result: BatchRetextureResult = {
      totalAssets: options.assets.length,
      totalVariants: options.assets.length * options.materialPresets.length,
      successful: 0,
      failed: 0,
      results: []
    }
    
    // Process each asset
    for (const assetId of options.assets) {
      const assetResult = {
        assetId,
        variants: [] as Array<{
          materialId: string
          success: boolean
          variantId?: string
          error?: string
        }>
      }
      
      // Process each material preset
      for (const preset of options.materialPresets) {
        if (options.onProgress) {
          options.onProgress(assetId, `Processing ${preset.displayName}`, 0)
        }
        
        const retextureResult = await this.retextureAsset({
          baseAssetId: assetId,
          materialPreset: preset
        })
        
        if (retextureResult.success) {
          result.successful++
          assetResult.variants.push({
            materialId: preset.id,
            success: true,
            variantId: retextureResult.assetId
          })
        } else {
          result.failed++
          assetResult.variants.push({
            materialId: preset.id,
            success: false,
            error: retextureResult.error
          })
        }
        
        if (options.onProgress) {
          options.onProgress(assetId, `Completed ${preset.displayName}`, 100)
        }
      }
      
      result.results.push(assetResult)
    }
    
    return result
  }
  
  /**
   * Get retexturing status for an asset
   */
  async getAssetStatus(assetId: string): Promise<{
    canRetexture: boolean
    reason?: string
    metadata?: AssetMetadata
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/assets/${assetId}`)
      
      if (!response.ok) {
        return {
          canRetexture: false,
          reason: 'Asset not found'
        }
      }
      
      const asset = await response.json()
      const metadata = asset.metadata as AssetMetadata
      
      if (!isBaseAsset(metadata)) {
        return {
          canRetexture: false,
          reason: 'Only base models can be retextured',
          metadata
        }
      }
      
      if (!metadata.meshyTaskId) {
        return {
          canRetexture: false,
          reason: 'Asset is missing meshyTaskId required for retexturing',
          metadata
        }
      }
      
      if (metadata.isPlaceholder) {
        return {
          canRetexture: false,
          reason: 'Placeholder assets cannot be retextured',
          metadata
        }
      }
      
      return {
        canRetexture: true,
        metadata
      }
    } catch (error) {
      return {
        canRetexture: false,
        reason: 'Failed to check asset status'
      }
    }
  }
  
  /**
   * Get recommended material presets for an asset type
   */
  getRecommendedPresets(assetType: string, assetSubtype: string): string[] {
    const recommendations: Record<string, string[]> = {
      'weapon-sword': ['bronze', 'steel', 'mithril', 'adamant', 'rune'],
      'weapon-bow': ['wood', 'oak', 'willow', 'yew', 'magic'],
      'weapon-shield': ['bronze', 'steel', 'mithril', 'adamant', 'rune'],
      'armor-helmet': ['bronze', 'steel', 'mithril', 'leather', 'hard-leather'],
      'armor-body': ['bronze', 'steel', 'mithril', 'leather', 'hard-leather'],
      'armor-legs': ['bronze', 'steel', 'mithril', 'leather', 'hard-leather'],
      'tool-hatchet': ['bronze', 'steel', 'mithril', 'adamant', 'rune'],
      'tool-pickaxe': ['bronze', 'steel', 'mithril', 'adamant', 'rune']
    }
    
    const key = `${assetType}-${assetSubtype}`
    return recommendations[key] || []
  }
}

// Export singleton instance
export const retextureService = new RetextureService() 