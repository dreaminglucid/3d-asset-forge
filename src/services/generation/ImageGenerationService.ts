/**
 * Image Generation Service
 * Generates images using gpt-image-1 model
 */

import OpenAI from 'openai'
import { AssetType, ImageGenerationResult } from '../../types/index'
import { retry } from '../../utils/helpers'

export interface ImageGenerationConfig {
  apiKey: string
  model?: string
  maxRetries?: number
  imageServerBaseUrl?: string // Base URL for image server if available
}

export class ImageGenerationService {
  private openai: OpenAI
  private config: ImageGenerationConfig

  constructor(config: ImageGenerationConfig) {
    this.config = config
    this.openai = new OpenAI({
      apiKey: config.apiKey
    })
  }

  /**
   * Generate an image from description
   */
  async generateImage(
    description: string,
    assetType: AssetType,
    style?: string,
    options?: {
      customGamePrompt?: string
      customAssetTypePrompt?: string
    }
  ): Promise<ImageGenerationResult> {
    const prompt = this.buildPrompt(description, assetType, style, options)
    
    console.log(`🎨 Generating image: ${description}`)
    
    try {
      // Map style to gpt-image-1 quality levels
      const qualityMap: Record<string, string> = {
        'realistic': 'high',
        'cartoon': 'medium',
        'low-poly': 'low',
        'stylized': 'medium'
      }
      const quality = style ? (qualityMap[style] || 'medium') : 'high'
      
      console.log(`🎯 Using gpt-image-1 with quality: ${quality}`)
      
      // Using gpt-image-1 with correct parameters
      const response = await retry(
        async () => {
          return await this.openai.images.generate({
            model: this.config.model || 'gpt-image-1',
            prompt,
            // gpt-image-1 specific parameters
            quality: quality as 'low' | 'medium' | 'high' | 'auto',
            size: '1024x1024' // Options: '1024x1024', '1024x1536', '1536x1024', 'auto'
            // Note: gpt-image-1 doesn't support n, response_format, or style parameters
          })
        },
        this.config.maxRetries || 3
      )

      if (!response.data || response.data.length === 0) {
        throw new Error('No image generated')
      }

      // gpt-image-1 returns base64 data, not URLs
      const imageData = response.data[0]
      let imageUrl: string
      
      if ('b64_json' in imageData && imageData.b64_json) {
        // Use base64 data directly
        const base64Data = imageData.b64_json
        
        // Check if we have a base URL configured
        if (this.config.imageServerBaseUrl) {
          // For server-side usage, we'd need to upload the image
          // This should be handled by the backend API
          console.warn('⚠️  Image server URL configured but image upload not implemented in frontend')
          imageUrl = `data:image/png;base64,${base64Data}`
        } else {
          // Return the base64 data URI for frontend use
          imageUrl = `data:image/png;base64,${base64Data}`
        }
        
        const sizeKB = Math.round(base64Data.length * 0.75 / 1024) // Approximate size
        console.log(`✅ Image generated (~${sizeKB}KB)`)
        
      } else if ('url' in imageData && imageData.url) {
        // Fallback for URL response (shouldn't happen with gpt-image-1)
        imageUrl = imageData.url
        console.log(`ℹ️ Received URL response (unexpected for gpt-image-1)`)
      } else {
        throw new Error('No image data returned from OpenAI')
      }

      return {
        imageUrl,
        prompt,
        metadata: {
          model: this.config.model || 'gpt-image-1',
          resolution: '1024x1024',
          quality: quality as string,
          timestamp: new Date().toISOString()
        }
      }
    } catch (error) {
      console.error('❌ Image generation failed:', error)
      throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Build optimized prompt for asset generation
   */
  private buildPrompt(
    description: string, 
    assetType: AssetType, 
    style?: string,
    options?: {
      customGamePrompt?: string
      customAssetTypePrompt?: string
    }
  ): string {
    const styleGuide = style || 'realistic'
    
    // Base prompt components
    let prompt = `Create a ${assetType} asset: ${description}. `
    
    // Add style directives
    if (options?.customGamePrompt) {
      prompt += options.customGamePrompt + ' '
    } else {
      switch (styleGuide) {
        case 'realistic':
          prompt += 'Photorealistic rendering with PBR materials. '
          break
        case 'cartoon':
          prompt += 'Cartoon style with vibrant colors and simplified forms. '
          break
        case 'low-poly':
          prompt += 'Low poly geometric style with flat shading. '
          break
        case 'stylized':
          prompt += 'Stylized artistic rendering with unique visual appeal. '
          break
        case 'runescape2007':
          prompt += 'Old School RuneScape 2007 style, low-poly with flat shading and simple textures. '
          break
      }
    }
    
    // Add asset-specific guidelines
    if (options?.customAssetTypePrompt) {
      prompt += options.customAssetTypePrompt + ' '
    } else {
      switch (assetType) {
        case 'weapon':
          prompt += 'Show the full weapon clearly on a neutral background, oriented horizontally. Include details like grips, blades, and decorative elements. '
          break
        case 'armor':
          prompt += 'Display the armor piece on a mannequin or stand, showing all angles and attachment points clearly. '
          break
        case 'character':
          prompt += 'Full body character in T-pose, neutral expression, clear anatomy for rigging. '
          break
        case 'building':
          // Add building-specific prompts
          if (description.toLowerCase().includes('bank')) {
            prompt += 'Grand bank building with columns, vault door visible, gold accents, secure appearance. Show full exterior with main entrance. '
          } else if (description.toLowerCase().includes('store') || description.toLowerCase().includes('shop')) {
            prompt += 'Shop building with display windows, merchant sign, welcoming entrance, market stall elements. Show full exterior with storefront. '
          } else {
            prompt += '3/4 isometric view of the complete structure, showing architectural details and scale. '
          }
          break
        case 'tool':
          prompt += 'Show the tool clearly with handle and working end visible, realistic wear and materials. '
          break
        case 'consumable':
          if (description.toLowerCase().includes('potion')) {
            prompt += 'Glass bottle or vial with colored liquid, cork or stopper, mystical glow effect. '
          } else if (description.toLowerCase().includes('food')) {
            prompt += 'Appetizing food item with realistic textures and colors. '
          } else {
            prompt += 'Clear view of the consumable item showing its form and purpose. '
          }
          break
        case 'resource':
          prompt += 'Raw material or resource in its natural form, showing texture and material properties clearly. '
          break
        case 'misc':
          prompt += 'Clear view of the object showing all important details and features. '
          break
        default:
          prompt += 'Clear view of the object on neutral background, showing all important details. '
      }
    }
    
    // Add technical requirements
    prompt += 'High quality, centered composition, soft lighting, no harsh shadows, suitable for 3D reconstruction.'
    
    return prompt
  }
} 