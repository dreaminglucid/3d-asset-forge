import React from 'react'
import { cn } from '../../styles'
import { Target } from 'lucide-react'
import { EQUIPMENT_SLOTS } from '../../constants'

interface EquipmentSlotSelectorProps {
  equipmentSlot: string
  onSlotChange: (slot: string) => void
}

export const EquipmentSlotSelector: React.FC<EquipmentSlotSelectorProps> = ({
  equipmentSlot,
  onSlotChange
}) => {
  return (
    <div className="bg-bg-primary/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Equipment Slot</h3>
            <p className="text-xs text-text-secondary mt-0.5">Choose where to attach the equipment</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {EQUIPMENT_SLOTS.map((slot) => {
            const Icon = slot.icon
            return (
              <button
                key={slot.id}
                onClick={() => onSlotChange(slot.id)}
                className={cn(
                  "relative p-4 rounded-lg border transition-all duration-300 group overflow-hidden",
                  equipmentSlot === slot.id
                    ? "bg-primary/10 border-primary shadow-lg shadow-primary/10"
                    : "bg-bg-secondary/40 border-white/10 hover:border-white/20 hover:bg-bg-secondary/60"
                )}
              >
                {/* Hover effect background */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/10 opacity-0 transition-opacity duration-300",
                  equipmentSlot !== slot.bone && "group-hover:opacity-100"
                )} />
                
                <div className="relative flex flex-col items-center gap-2.5">
                  <div className={cn(
                    "w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300",
                    equipmentSlot === slot.id
                      ? "bg-primary text-white shadow-md scale-110"
                      : "bg-bg-tertiary/50 text-text-secondary group-hover:bg-bg-tertiary/70 group-hover:text-text-primary group-hover:scale-105"
                  )}>
                    <Icon size={20} />
                  </div>
                  <div className="text-center">
                    <span className={cn(
                      "text-sm font-medium block transition-colors duration-300",
                      equipmentSlot === slot.id ? "text-primary" : "text-text-primary group-hover:text-white"
                    )}>
                      {slot.name}
                    </span>
                    {slot.description && (
                      <span className="text-[11px] text-text-tertiary mt-0.5 block">{slot.description}</span>
                    )}
                  </div>
                </div>
                
                {/* Selection indicator */}
                {equipmentSlot === slot.bone && (
                  <div className="absolute top-2 right-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
} 