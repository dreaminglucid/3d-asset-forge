/**
 * Creature Scaling Service
 * Handles runtime scaling calculations for weapons based on creature size
 */

import { CREATURE_SIZE_CATEGORIES, getCreatureCategory } from '../../types/NormalizationConventions'

export interface WeaponScaleResult {
  scaleFactor: number
  category: string
  reasoning: string
  constraints: {
    min: number
    max: number
    applied: boolean
  }
}

export class CreatureScalingService {
  // Weapon type proportions for medium (human-sized) creatures
  private static readonly BASE_WEAPON_PROPORTIONS: Record<string, number> = {
    sword: 0.65,      // 65% of height
    dagger: 0.25,     // 25% of height
    axe: 0.5,         // 50% of height
    mace: 0.45,       // 45% of height
    staff: 1.1,       // 110% of height
    spear: 1.2,       // 120% of height
    bow: 0.7,         // 70% of height
    crossbow: 0.5,    // 50% of height
    shield: 0.4,      // 40% of height
    wand: 0.2,        // 20% of height
  }
  
  // Minimum weapon sizes to maintain visibility
  private static readonly MIN_WEAPON_SIZES: Record<string, number> = {
    sword: 0.5,       // meters
    dagger: 0.15,
    axe: 0.3,
    mace: 0.3,
    staff: 0.8,
    spear: 1.0,
    bow: 0.5,
    crossbow: 0.4,
    shield: 0.3,
    wand: 0.1,
  }
  
  // Maximum weapon sizes for game balance
  private static readonly MAX_WEAPON_SIZES: Record<string, number> = {
    sword: 3.0,       // meters
    dagger: 0.8,
    axe: 2.5,
    mace: 2.0,
    staff: 5.0,
    spear: 7.0,
    bow: 3.0,
    crossbow: 2.0,
    shield: 3.0,
    wand: 1.0,
  }
  
  /**
   * Get weapon scale factor for a creature
   */
  static getWeaponScaleForCreature(
    creatureHeight: number,
    weaponType: string,
    currentWeaponLength: number
  ): WeaponScaleResult {
    const category = getCreatureCategory(creatureHeight)
    const baseProportion = this.BASE_WEAPON_PROPORTIONS[weaponType.toLowerCase()] || 0.5
    
    // Calculate adaptive proportion based on creature size
    const adaptiveProportion = this.calculateAdaptiveProportion(
      creatureHeight,
      weaponType,
      baseProportion
    )
    
    // Calculate ideal weapon length
    const idealWeaponLength = creatureHeight * adaptiveProportion
    
    // Calculate scale factor
    let scaleFactor = idealWeaponLength / currentWeaponLength
    
    // Apply constraints
    const minSize = this.MIN_WEAPON_SIZES[weaponType.toLowerCase()] || 0.1
    const maxSize = this.MAX_WEAPON_SIZES[weaponType.toLowerCase()] || 5.0
    
    const scaledLength = currentWeaponLength * scaleFactor
    let constraintApplied = false
    
    if (scaledLength < minSize) {
      scaleFactor = minSize / currentWeaponLength
      constraintApplied = true
    } else if (scaledLength > maxSize) {
      scaleFactor = maxSize / currentWeaponLength
      constraintApplied = true
    }
    
    // Generate reasoning
    const reasoning = this.generateScalingReasoning(
      creatureHeight,
      category,
      weaponType,
      adaptiveProportion,
      constraintApplied
    )
    
    return {
      scaleFactor,
      category,
      reasoning,
      constraints: {
        min: minSize / currentWeaponLength,
        max: maxSize / currentWeaponLength,
        applied: constraintApplied
      }
    }
  }
  
  /**
   * Calculate adaptive proportion based on creature size
   */
  private static calculateAdaptiveProportion(
    creatureHeight: number,
    weaponType: string,
    baseProportion: number
  ): number {
    const category = getCreatureCategory(creatureHeight)
    
    // Scaling curves for different size categories
    switch (category) {
      case 'tiny':
        // Tiny creatures need proportionally larger weapons
        return this.getTinyCreatureWeaponProportion(weaponType, baseProportion)
        
      case 'small':
        // Small creatures use slightly larger proportions
        return baseProportion * 1.1
        
      case 'medium':
        // Medium creatures use base proportions
        return baseProportion
        
      case 'large':
        // Large creatures use slightly smaller proportions
        return baseProportion * 0.9
        
      case 'huge':
        // Huge creatures use smaller proportions
        return this.getHugeCreatureWeaponProportion(weaponType, baseProportion)
        
      case 'gargantuan':
        // Gargantuan creatures use much smaller proportions
        return this.getGargantuanWeaponProportion(weaponType, baseProportion)
        
      default:
        return baseProportion
    }
  }
  
  /**
   * Get weapon proportion for tiny creatures
   */
  private static getTinyCreatureWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Tiny creatures need weapons that are visible
    const tinyMultipliers: Record<string, number> = {
      sword: 1.5,      // 150% of base
      dagger: 1.8,     // Daggers become like swords
      staff: 1.2,      // Staves stay relatively large
      wand: 2.0,       // Wands need to be visible
    }
    
    const multiplier = tinyMultipliers[weaponType.toLowerCase()] || 1.4
    return baseProportion * multiplier
  }
  
  /**
   * Get weapon proportion for huge creatures
   */
  private static getHugeCreatureWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Huge creatures use smaller proportions to avoid absurd sizes
    const hugeMultipliers: Record<string, number> = {
      sword: 0.7,      // 70% of base
      staff: 0.6,      // Staves don't need to be huge
      spear: 0.5,      // Spears scale down more
    }
    
    const multiplier = hugeMultipliers[weaponType.toLowerCase()] || 0.7
    return baseProportion * multiplier
  }
  
  /**
   * Get weapon proportion for gargantuan creatures
   */
  private static getGargantuanWeaponProportion(
    weaponType: string,
    baseProportion: number
  ): number {
    // Gargantuan creatures use much smaller proportions
    const gargMultipliers: Record<string, number> = {
      sword: 0.5,      // 50% of base
      staff: 0.4,      // Even smaller for polearms
      spear: 0.35,     // Spears become relatively tiny
    }
    
    const multiplier = gargMultipliers[weaponType.toLowerCase()] || 0.5
    return baseProportion * multiplier
  }
  
  /**
   * Generate human-readable reasoning for scaling
   */
  private static generateScalingReasoning(
    creatureHeight: number,
    category: string,
    weaponType: string,
    proportion: number,
    constraintApplied: boolean
  ): string {
    const categoryInfo = CREATURE_SIZE_CATEGORIES[category as keyof typeof CREATURE_SIZE_CATEGORIES]
    
    let reasoning = `${categoryInfo.name} creature (${creatureHeight.toFixed(1)}m) `
    reasoning += `using ${weaponType} with ${(proportion * 100).toFixed(0)}% height proportion. `
    
    if (constraintApplied) {
      reasoning += `Scale limited by ${weaponType} size constraints.`
    }
    
    return reasoning
  }
  
  /**
   * Get recommended weapon types for creature size
   */
  static getRecommendedWeapons(creatureHeight: number): string[] {
    const category = getCreatureCategory(creatureHeight)
    
    switch (category) {
      case 'tiny':
        return ['dagger', 'wand', 'shortbow', 'dart']
        
      case 'small':
        return ['shortsword', 'dagger', 'shortbow', 'mace']
        
      case 'medium':
        return ['sword', 'axe', 'bow', 'staff', 'shield']
        
      case 'large':
        return ['greatsword', 'battleaxe', 'spear', 'tower shield']
        
      case 'huge':
        return ['giant sword', 'tree trunk club', 'massive spear']
        
      case 'gargantuan':
        return ['colossal blade', 'siege weapon', 'monument weapon']
        
      default:
        return ['sword', 'axe', 'bow']
    }
  }
  
  /**
   * Calculate visual thickness multiplier for large weapons
   */
  static getThicknessMultiplier(creatureHeight: number): number {
    const category = getCreatureCategory(creatureHeight)
    
    switch (category) {
      case 'tiny':
        return 0.8  // Slightly thinner for visibility
        
      case 'small':
        return 1.0
        
      case 'medium':
        return 1.0
        
      case 'large':
        return 1.2
        
      case 'huge':
        return 1.5  // Thicker for visual weight
        
      case 'gargantuan':
        return 2.0  // Much thicker for massive feel
        
      default:
        return 1.0
    }
  }
} 