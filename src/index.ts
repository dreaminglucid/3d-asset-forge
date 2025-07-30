// Load environment variables
import 'dotenv/config'

/**
 * @fileoverview AI Creation System for Hyperscape RPG
 * Complete 3D asset generation pipeline with OpenAI and Meshy AI
 */

// Core services
export { AICreationService } from './services/core/AICreationService'
export { ImageGenerationService } from './services/generation/ImageGenerationService'
export { MeshyService } from './services/generation/MeshyService'
export { ModelAnalysisService } from './services/core/ModelAnalysisService'

// Types
export * from './types'

// Default export for convenience
export { AICreationService as default } from './services/core/AICreationService'

// Default configuration
export const defaultConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-image-1' // Updated to use gpt-image-1
  },
  meshy: {
    apiKey: process.env.MESHY_API_KEY || '',
    baseUrl: 'https://api.meshy.ai'
  },
  cache: {
    enabled: true,
    ttl: 3600, // 1 hour
    maxSize: 500 // 500MB
  },
  output: {
    directory: './gdd-assets',
    format: 'glb' as const
  }
} 