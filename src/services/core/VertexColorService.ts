/**
 * Vertex Color Extraction Service
 * Extracts color data from textured 3D models for optimized rendering
 */

import * as THREE from 'three'
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface VertexColorData {
  dominantColor: string
  colorPalette: string[]
  colorMap: Record<string, number>
  averageColor: string
  brightnessRange: {
    min: number
    max: number
  }
}

export interface ExtractionOptions {
  modelPath: string
  paletteSize?: number
  sampleRate?: number
}

export class VertexColorService {
  private loader: GLTFLoader
  
  constructor() {
    this.loader = new GLTFLoader()
  }
  
  /**
   * Extract vertex colors from a textured model
   */
  async extractColors(options: ExtractionOptions): Promise<VertexColorData> {
    const {
      modelPath,
      paletteSize = 8,
      sampleRate = 0.1 // Sample 10% of vertices
    } = options
    
    // Load model
    const gltf = await this.loadModel(modelPath)
    const model = gltf.scene
    
    // Collect all colors from the model
    const colors: THREE.Color[] = []
    const colorCounts = new Map<string, number>()
    
    // Traverse model and extract colors
    const meshes: THREE.Mesh[] = []
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child)
      }
    })
    
    // Process meshes
    for (const mesh of meshes) {
      const geometry = mesh.geometry
      const material = mesh.material as THREE.Material
      
      // Extract colors based on material type
      if (material instanceof THREE.MeshStandardMaterial) {
        // Sample texture if available
        if (material.map) {
          const textureColors = await this.sampleTexture(material.map, sampleRate)
          colors.push(...textureColors)
        } else {
          // Use material color
          colors.push(material.color)
        }
      } else if ('color' in material && material.color instanceof THREE.Color) {
        colors.push(material.color)
      }
      
      // Check for vertex colors
      if (geometry.attributes.color) {
        const vertexColors = this.extractVertexColors(geometry, sampleRate)
        colors.push(...vertexColors)
      }
    }
    
    // Count color occurrences
    colors.forEach(color => {
      const hex = color.getHexString()
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1)
    })
    
    // Sort colors by frequency
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([hex]) => `#${hex}`)
    
    // Get dominant color
    const dominantColor = sortedColors[0] || '#808080'
    
    // Create color palette
    const palette = this.createColorPalette(colors, paletteSize)
    
    // Calculate average color
    const averageColor = this.calculateAverageColor(colors)
    
    // Calculate brightness range
    const brightnessRange = this.calculateBrightnessRange(colors)
    
    // Create color map
    const colorMap: Record<string, number> = {}
    sortedColors.slice(0, 20).forEach(hex => {
      colorMap[hex] = colorCounts.get(hex.substring(1)) || 0
    })
    
    return {
      dominantColor,
      colorPalette: palette,
      colorMap,
      averageColor,
      brightnessRange
    }
  }
  
  /**
   * Load GLTF model
   */
  private loadModel(path: string): Promise<GLTF> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf: GLTF) => resolve(gltf),
        undefined,
        (error) => reject(error instanceof Error ? error : new Error(String(error)))
      )
    })
  }
  
  /**
   * Extract vertex colors from geometry
   */
  private extractVertexColors(
    geometry: THREE.BufferGeometry,
    sampleRate: number
  ): THREE.Color[] {
    const colors: THREE.Color[] = []
    const colorAttribute = geometry.attributes.color
    
    if (!colorAttribute) return colors
    
    const colorArray = colorAttribute.array as Float32Array
    const step = Math.max(1, Math.floor(1 / sampleRate))
    
    for (let i = 0; i < colorArray.length; i += step * 3) {
      colors.push(new THREE.Color(
        colorArray[i],
        colorArray[i + 1],
        colorArray[i + 2]
      ))
    }
    
    return colors
  }
  
  /**
   * Sample colors from a texture
   */
  private async sampleTexture(
    texture: THREE.Texture,
    sampleRate: number
  ): Promise<THREE.Color[]> {
    const colors: THREE.Color[] = []
    
    // Create canvas to read texture data
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return colors
    
    // Get texture image
    const image = texture.image
    if (!image) return colors
    
    // Set canvas size
    canvas.width = image.width
    canvas.height = image.height
    
    // Draw image to canvas
    ctx.drawImage(image, 0, 0)
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Sample pixels
    const step = Math.max(1, Math.floor(1 / sampleRate))
    
    for (let i = 0; i < data.length; i += step * 4) {
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255
      colors.push(new THREE.Color(r, g, b))
    }
    
    return colors
  }
  
  /**
   * Create a color palette using k-means clustering
   */
  private createColorPalette(
    colors: THREE.Color[],
    paletteSize: number
  ): string[] {
    if (colors.length === 0) return []
    
    // Convert colors to RGB arrays
    const rgbColors = colors.map(c => [c.r, c.g, c.b])
    
    // Simple k-means clustering
    const centroids = this.kMeansClustering(rgbColors, paletteSize)
    
    // Convert centroids back to hex colors
    return centroids.map(c => {
      const color = new THREE.Color(c[0], c[1], c[2])
      return `#${color.getHexString()}`
    })
  }
  
  /**
   * Simple k-means clustering for color palette generation
   */
  private kMeansClustering(
    points: number[][],
    k: number
  ): number[][] {
    if (points.length <= k) {
      return points
    }
    
    // Initialize centroids randomly
    const centroids: number[][] = []
    const usedIndices = new Set<number>()
    
    while (centroids.length < k) {
      const idx = Math.floor(Math.random() * points.length)
      if (!usedIndices.has(idx)) {
        centroids.push([...points[idx]])
        usedIndices.add(idx)
      }
    }
    
    // Run k-means iterations
    for (let iter = 0; iter < 10; iter++) {
      // Assign points to clusters
      const clusters: number[][][] = Array(k).fill(null).map(() => [])
      
      points.forEach(point => {
        let minDist = Infinity
        let bestCluster = 0
        
        centroids.forEach((centroid, idx) => {
          const dist = this.colorDistance(point, centroid)
          if (dist < minDist) {
            minDist = dist
            bestCluster = idx
          }
        })
        
        clusters[bestCluster].push(point)
      })
      
      // Update centroids
      clusters.forEach((cluster, idx) => {
        if (cluster.length > 0) {
          centroids[idx] = [
            cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length,
            cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length,
            cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length
          ]
        }
      })
    }
    
    return centroids
  }
  
  /**
   * Calculate distance between two colors
   */
  private colorDistance(c1: number[], c2: number[]): number {
    const dr = c1[0] - c2[0]
    const dg = c1[1] - c2[1]
    const db = c1[2] - c2[2]
    return Math.sqrt(dr * dr + dg * dg + db * db)
  }
  
  /**
   * Calculate average color
   */
  private calculateAverageColor(colors: THREE.Color[]): string {
    if (colors.length === 0) return '#808080'
    
    const avg = colors.reduce(
      (acc, color) => {
        acc.r += color.r
        acc.g += color.g
        acc.b += color.b
        return acc
      },
      { r: 0, g: 0, b: 0 }
    )
    
    avg.r /= colors.length
    avg.g /= colors.length
    avg.b /= colors.length
    
    const avgColor = new THREE.Color(avg.r, avg.g, avg.b)
    return `#${avgColor.getHexString()}`
  }
  
  /**
   * Calculate brightness range
   */
  private calculateBrightnessRange(colors: THREE.Color[]): {
    min: number
    max: number
  } {
    if (colors.length === 0) return { min: 0, max: 1 }
    
    let min = 1
    let max = 0
    
    colors.forEach(color => {
      // Calculate brightness using HSL
      const hsl = { h: 0, s: 0, l: 0 }
      color.getHSL(hsl)
      
      min = Math.min(min, hsl.l)
      max = Math.max(max, hsl.l)
    })
    
    return { min, max }
  }
}

// Export singleton instance
export const vertexColorService = new VertexColorService() 