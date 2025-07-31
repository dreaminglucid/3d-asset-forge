// /**
//  * Vertex Color Service for Server
//  * Extracts color data from GLB models by analyzing materials and textures
//  */

// import fs from 'fs/promises'
// import path from 'path'

// export class VertexColorService {
//   constructor() {
//     console.log('[VertexColorService] Initialized (server version)')
//   }
  
//   /**
//    * Extract colors from a model file
//    * Analyzes the GLB file structure to extract color information
//    */
//   async extractColors(modelPath) {
//     console.log(`[VertexColorService] Extracting colors from: ${modelPath}`)
    
//     try {
//       // Read the model file
//       const fileBuffer = await fs.readFile(modelPath)
      
//       // GLB file structure: 
//       // - 12 bytes: Header (magic, version, length)
//       // - Chunks: JSON chunk (scene data) and BIN chunk (binary data)
      
//       // Extract material information from the model
//       const materials = await this.extractMaterialsFromGLB(fileBuffer)
      
//       // Determine colors based on materials and model name
//       const colors = this.analyzeMaterialColors(materials, modelPath)
      
//       return colors
      
//     } catch (error) {
//       console.error('Error extracting colors:', error)
      
//       // Fallback to intelligent defaults based on filename
//       return this.getDefaultColors(modelPath)
//     }
//   }
  
//   /**
//    * Extract material information from GLB file
//    */
//   async extractMaterialsFromGLB(buffer) {
//     try {
//       // GLB header is 12 bytes
//       const header = buffer.slice(0, 12)
//       const magic = header.toString('utf8', 0, 4)
      
//       if (magic !== 'glTF') {
//         throw new Error('Not a valid GLB file')
//       }
      
//       // First chunk starts at byte 12
//       const chunkHeader = buffer.slice(12, 20)
//       const chunkLength = chunkHeader.readUInt32LE(0)
//       const chunkType = chunkHeader.readUInt32LE(4)
      
//       // JSON chunk type is 0x4E4F534A
//       if (chunkType === 0x4E4F534A) {
//         const jsonData = buffer.slice(20, 20 + chunkLength)
//         const gltf = JSON.parse(jsonData.toString('utf8'))
        
//         // Extract materials
//         if (gltf.materials) {
//           return gltf.materials.map(material => ({
//             name: material.name || 'Unnamed',
//             baseColor: material.pbrMetallicRoughness?.baseColorFactor || [0.5, 0.5, 0.5, 1],
//             metallic: material.pbrMetallicRoughness?.metallicFactor || 0,
//             roughness: material.pbrMetallicRoughness?.roughnessFactor || 1
//           }))
//         }
//       }
      
//       return []
//     } catch (error) {
//       console.error('Error parsing GLB:', error)
//       return []
//     }
//   }
  
//   /**
//    * Analyze materials to extract color palette
//    */
//   analyzeMaterialColors(materials, modelPath) {
//     const colorPalette = []
//     const colorMap = {}
    
//     // Extract colors from materials
//     materials.forEach(material => {
//       const [r, g, b] = material.baseColor
//       const hex = this.rgbToHex(r, g, b)
      
//       if (!colorMap[hex]) {
//         colorMap[hex] = 0
//       }
//       colorMap[hex]++
      
//       if (!colorPalette.includes(hex)) {
//         colorPalette.push(hex)
//       }
//     })
    
//     // If no materials found, use intelligent defaults
//     if (colorPalette.length === 0) {
//       return this.getDefaultColors(modelPath)
//     }
    
//     // Calculate dominant color
//     const dominantColor = colorPalette[0] || '#888888'
    
//     // Calculate average color
//     let totalR = 0, totalG = 0, totalB = 0
//     materials.forEach(material => {
//       const [r, g, b] = material.baseColor
//       totalR += r
//       totalG += g
//       totalB += b
//     })
    
//     const avgR = totalR / materials.length
//     const avgG = totalG / materials.length
//     const avgB = totalB / materials.length
//     const averageColor = this.rgbToHex(avgR, avgG, avgB)
    
//     return {
//       dominantColor,
//       colorPalette,
//       colorMap,
//       averageColor,
//       brightnessRange: {
//         min: 0.2,
//         max: 0.8
//       }
//     }
//   }
  
//   /**
//    * Get default colors based on asset type from filename
//    */
//   getDefaultColors(modelPath) {
//     const materialColors = {
//       // Metals
//       bronze: ['#CD7F32', '#B87333', '#A0522D', '#8B4513'],
//       iron: ['#A8A8A8', '#909090', '#787878', '#606060'],
//       steel: ['#C0C0C0', '#A8A8A8', '#808080', '#696969'],
//       mithril: ['#3D5D8F', '#4169E1', '#4682B4', '#5F9EA0'],
//       adamant: ['#2F4F2F', '#355E3B', '#4A5C4A', '#5F6F5F'],
//       rune: ['#5F9EA0', '#4682B4', '#00CED1', '#48D1CC'],
      
//       // Leathers
//       leather: ['#8B4513', '#A0522D', '#654321', '#704214'],
//       'hard-leather': ['#654321', '#5D4E37', '#4B3621', '#3E2F23'],
//       'studded-leather': ['#4A4A4A', '#8B4513', '#696969', '#2F2F2F'],
//       dragonhide: ['#228B22', '#006400', '#32CD32', '#3CB371'],
      
//       // Woods  
//       wood: ['#DEB887', '#D2691E', '#BC9A6A', '#A0522D'],
//       oak: ['#BC9A6A', '#A0522D', '#8B7355', '#6B4423'],
//       willow: ['#F5DEB3', '#FFE4B5', '#FFDEAD', '#F5E6D3'],
//       yew: ['#8B4513', '#A0522D', '#704214', '#5D3A1A'],
//       magic: ['#4B0082', '#6A0DAD', '#7B68EE', '#9370DB']
//     }
    
//     // Detect material from path
//     let dominantColor = '#888888'
//     let palette = ['#888888', '#666666', '#444444', '#222222']
    
//     // Check filename for material type
//     const filename = path.basename(modelPath).toLowerCase()
    
//     for (const [material, colors] of Object.entries(materialColors)) {
//       if (filename.includes(material)) {
//         dominantColor = colors[0]
//         palette = colors
//         break
//       }
//     }
    
//     // Special handling for base models
//     if (filename.includes('-base')) {
//       // Neutral colors for base models
//       dominantColor = '#808080'
//       palette = ['#808080', '#999999', '#666666', '#B0B0B0']
//     }
    
//     return {
//       dominantColor,
//       colorPalette: palette,
//       colorMap: palette.reduce((map, color, i) => {
//         map[color] = Math.floor(Math.random() * 1000) + 500
//         return map
//       }, {}),
//       averageColor: dominantColor,
//       brightnessRange: {
//         min: 0.2,
//         max: 0.8
//       }
//     }
//   }
  
//   /**
//    * Convert RGB values (0-1) to hex color
//    */
//   rgbToHex(r, g, b) {
//     const toHex = (val) => {
//       const hex = Math.round(val * 255).toString(16)
//       return hex.length === 1 ? '0' + hex : hex
//     }
//     return '#' + toHex(r) + toHex(g) + toHex(b)
//   }
// } 