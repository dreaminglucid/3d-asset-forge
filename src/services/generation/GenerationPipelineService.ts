/**
 * Unified Generation Pipeline Service
 * Orchestrates the complete asset generation workflow from description to final assets
 */

import { EventEmitter } from 'events'
import { AICreationService } from '../core/AICreationService'
import { retextureService } from './RetextureService'
import { MaterialPreset } from '../../types/index'
import { AssetMetadata, BaseAssetMetadata } from '../../types/AssetMetadata'

export interface GenerationConfig {
  name: string
  type: string  // Now flexible to support any game type
  subtype: string
  description: string
  style?: string  // Now flexible to support any art style
  assetId?: string
  tier?: string
  metadata?: Record<string, any>
  
  // Generation type
  generationType?: 'item' | 'avatar'
  
  // Pipeline stages control
  enableGeneration?: boolean
  enableRetexturing?: boolean
  enableSprites?: boolean
  enableVertexColors?: boolean
  enableRigging?: boolean
  
  // Rigging options
  riggingOptions?: {
    heightMeters?: number
  }
  
  // Legacy fields for backward compatibility
  generateVariants?: boolean
  variantMaterials?: string[]
  generateSprites?: boolean
  extractVertexColors?: boolean
  
  // New configuration options
  materialPresets?: Array<{
    id: string
    name: string
    displayName: string
    category: string
    tier: number
    color: string
    stylePrompt: string
  }>
  spriteConfig?: {
    angles: number
    resolution: number
    backgroundColor: string
  }
  
  // Custom prompts
  customPrompts?: {
    gameStyle?: string
    assetType?: string
  }
}

export interface PipelineStage {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message?: string
  error?: string
  startTime?: Date
  endTime?: Date
}

export interface PipelineResult {
  id: string
  config: GenerationConfig
  stages: PipelineStage[]
  baseAsset?: BaseAssetMetadata
  variants?: AssetMetadata[]
  sprites?: SpriteResult[]
  vertexColors?: VertexColorData
  status: 'running' | 'completed' | 'failed'
  createdAt: Date
  completedAt?: Date
}

export interface SpriteResult {
  angle: string
  imageUrl: string
  width: number
  height: number
}

export interface VertexColorData {
  dominantColor: string
  colorPalette: string[]
  colorMap?: Record<string, number> // color -> vertex count
}

export interface PipelineServiceConfig {
  openaiApiKey?: string
  meshyApiKey?: string
  imageServerBaseUrl?: string
}

export class GenerationPipelineService extends EventEmitter {
  private aiService: AICreationService
  private activePipelines: Map<string, PipelineResult> = new Map()
  
  constructor(config?: PipelineServiceConfig) {
    super()
    
    // Use provided config or fall back to environment variables
    const openaiApiKey = config?.openaiApiKey || 
      (typeof process !== 'undefined' && process.env?.VITE_OPENAI_API_KEY) || 
      (typeof window !== 'undefined' && (window as any).env?.VITE_OPENAI_API_KEY) || 
      ''
    const meshyApiKey = config?.meshyApiKey || 
      (typeof process !== 'undefined' && process.env?.VITE_MESHY_API_KEY) || 
      (typeof window !== 'undefined' && (window as any).env?.VITE_MESHY_API_KEY) || 
      ''
    const imageServerBaseUrl = config?.imageServerBaseUrl || 
      (typeof process !== 'undefined' && process.env?.VITE_IMAGE_SERVER_URL) || 
      (typeof window !== 'undefined' && (window as any).env?.VITE_IMAGE_SERVER_URL)
    
    if (!openaiApiKey || !meshyApiKey) {
      console.warn('⚠️ API keys not configured. Generation features will not work.')
      console.warn('Set VITE_OPENAI_API_KEY and VITE_MESHY_API_KEY in your .env file')
    }
    
    this.aiService = new AICreationService({
      openai: {
        apiKey: openaiApiKey,
        model: 'gpt-image-1',
        imageServerBaseUrl: imageServerBaseUrl
      },
      meshy: {
        apiKey: meshyApiKey,
        baseUrl: 'https://api.meshy.ai'
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 500
      },
      output: {
        directory: 'gdd-assets',
        format: 'glb'
      }
    })
  }
  
  /**
   * Start a complete generation pipeline
   */
  async startPipeline(config: GenerationConfig): Promise<string> {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const pipeline: PipelineResult = {
      id: pipelineId,
      config,
      stages: this.createStages(config),
      status: 'running',
      createdAt: new Date()
    }
    
    this.activePipelines.set(pipelineId, pipeline)
    this.emit('pipeline:started', { pipelineId, config })
    
    // Run pipeline asynchronously
    this.runPipeline(pipelineId).catch(error => {
      console.error(`Pipeline ${pipelineId} failed:`, error)
      this.updatePipelineStatus(pipelineId, 'failed')
    })
    
    return pipelineId
  }
  
  /**
   * Get pipeline status
   */
  getPipelineStatus(pipelineId: string): PipelineResult | null {
    return this.activePipelines.get(pipelineId) || null
  }
  
  /**
   * Get all active pipelines
   */
  getActivePipelines(): PipelineResult[] {
    return Array.from(this.activePipelines.values())
  }
  
  /**
   * Create pipeline stages based on config
   */
  private createStages(config: GenerationConfig): PipelineStage[] {
    const stages: PipelineStage[] = [
      {
        id: 'prompt-enhancement',
        name: 'Enhancing Description',
        status: 'pending',
        progress: 0
      },
      {
        id: 'concept-art',
        name: 'Generating Concept Art',
        status: 'pending',
        progress: 0
      },
      {
        id: 'model-generation',
        name: 'Creating 3D Model',
        status: 'pending',
        progress: 0
      }
    ]
    
    if (config.generateVariants) {
      stages.push({
        id: 'material-variants',
        name: 'Creating Material Variants',
        status: 'pending',
        progress: 0
      })
    }
    
    if (config.generateSprites) {
      stages.push({
        id: 'sprite-generation',
        name: 'Rendering 2D Sprites',
        status: 'pending',
        progress: 0
      })
    }
    
    if (config.extractVertexColors) {
      stages.push({
        id: 'vertex-colors',
        name: 'Extracting Vertex Colors',
        status: 'pending',
        progress: 0
      })
    }
    
    return stages
  }
  
  /**
   * Run the complete pipeline
   */
  private async runPipeline(pipelineId: string): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return
    
    try {
      // Stage 1: Enhance prompt with GPT-4
      await this.runStage(pipelineId, 'prompt-enhancement', async () => {
        const enhanced = await this.enhancePrompt(pipeline.config)
        return enhanced
      })
      
      // Stage 2: Generate concept art
      const conceptArt = await this.runStage(pipelineId, 'concept-art', async () => {
        return await this.generateConceptArt(pipeline.config)
      })
      
      // Stage 3: Generate 3D model
      const baseAsset = await this.runStage(pipelineId, 'model-generation', async () => {
        return await this.generate3DModel(pipeline.config, conceptArt)
      })
      
      pipeline.baseAsset = baseAsset
      
      // Stage 4: Generate material variants (if requested)
      if (pipeline.config.generateVariants) {
        const variants = await this.runStage(pipelineId, 'material-variants', async () => {
          return await this.generateVariants(baseAsset, pipeline.config)
        })
        pipeline.variants = variants
      }
      
      // Stage 5: Generate sprites (if requested)
      if (pipeline.config.generateSprites) {
        const sprites = await this.runStage(pipelineId, 'sprite-generation', async () => {
          return await this.generateSprites(baseAsset)
        })
        pipeline.sprites = sprites
      }
      
      // Stage 6: Extract vertex colors (if requested)
      if (pipeline.config.extractVertexColors) {
        const vertexColors = await this.runStage(pipelineId, 'vertex-colors', async () => {
          return await this.extractVertexColors(baseAsset)
        })
        pipeline.vertexColors = vertexColors
      }
      
      // Complete pipeline
      pipeline.status = 'completed'
      pipeline.completedAt = new Date()
      this.emit('pipeline:completed', { pipelineId, result: pipeline })
      
    } catch (error) {
      pipeline.status = 'failed'
      this.emit('pipeline:failed', { pipelineId, error })
      throw error
    }
  }
  
  /**
   * Run a single pipeline stage
   */
  private async runStage<T>(
    pipelineId: string, 
    stageId: string, 
    task: () => Promise<T>
  ): Promise<T> {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) throw new Error('Pipeline not found')
    
    const stage = pipeline.stages.find(s => s.id === stageId)
    if (!stage) throw new Error('Stage not found')
    
    stage.status = 'running'
    stage.startTime = new Date()
    this.emitProgress(pipelineId, stageId, 0)
    
    try {
      const result = await task()
      
      stage.status = 'completed'
      stage.progress = 100
      stage.endTime = new Date()
      this.emitProgress(pipelineId, stageId, 100)
      
      return result
    } catch (error) {
      stage.status = 'failed'
      stage.error = error instanceof Error ? error.message : 'Unknown error'
      stage.endTime = new Date()
      this.emit('stage:failed', { pipelineId, stageId, error })
      throw error
    }
  }
  
  /**
   * Emit progress update
   */
  private emitProgress(pipelineId: string, stageId: string, progress: number): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return
    
    const stage = pipeline.stages.find(s => s.id === stageId)
    if (!stage) return
    
    stage.progress = progress
    this.emit('progress', { pipelineId, stageId, progress })
  }
  
  /**
   * Update pipeline status
   */
  private updatePipelineStatus(pipelineId: string, status: 'running' | 'completed' | 'failed'): void {
    const pipeline = this.activePipelines.get(pipelineId)
    if (!pipeline) return
    
    pipeline.status = status
    if (status === 'completed' || status === 'failed') {
      pipeline.completedAt = new Date()
    }
  }
  
  // Implementation methods (these would contain the actual logic)
  
  private async enhancePrompt(config: GenerationConfig): Promise<string> {
    // Use GPT-4 to enhance the description
    // Implementation would go here
    return `Enhanced: ${config.description}`
  }
  
  private async generateConceptArt(config: GenerationConfig): Promise<string> {
    // Use GPT-Image-1 to generate concept art
    // Implementation would go here
    return 'data:image/png;base64,...'
  }
  
  private async generate3DModel(config: GenerationConfig, conceptArt: string): Promise<BaseAssetMetadata> {
    // Use Meshy to generate 3D model
    // Implementation would go here
    return {} as BaseAssetMetadata
  }
  
  private async generateVariants(baseAsset: BaseAssetMetadata, config: GenerationConfig): Promise<AssetMetadata[]> {
    // Use retexture service to generate variants
    // Implementation would go here
    return []
  }
  
  private async generateSprites(baseAsset: BaseAssetMetadata): Promise<SpriteResult[]> {
    // Render 2D sprites from 3D model
    // Implementation would go here
    return []
  }
  
  private async extractVertexColors(baseAsset: BaseAssetMetadata): Promise<VertexColorData> {
    // Extract vertex colors from textured model
    // Implementation would go here
    return {
      dominantColor: '#ffffff',
      colorPalette: []
    }
  }
}

// Export singleton instance using API client for frontend
import { GenerationAPIClient } from '../api/GenerationAPIClient'
export const generationPipeline = new GenerationAPIClient() 