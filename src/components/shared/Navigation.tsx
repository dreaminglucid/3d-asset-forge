import React from 'react'
import { Database, Wand2, Wrench, Hand, Shield } from 'lucide-react'
import { NavigationView } from '../../types'

interface NavigationProps {
  currentView: NavigationView
  onViewChange: (view: NavigationView) => void
}

const Navigation: React.FC<NavigationProps> = ({ currentView, onViewChange }) => {
  return (
    <nav className="bg-bg-secondary border-b border-border-primary px-6 shadow-theme-sm relative z-[100]">
      <div className="flex items-center justify-between h-[60px]">
        <div className="flex items-center">
          <h1 className="text-xl font-semibold text-gradient">AI Asset Generation</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === 'assets' 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange('assets')}
          >
            <Database size={18} />
            <span>Assets</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === 'generation' 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange('generation')}
          >
            <Wand2 size={18} />
            <span>Generate</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === 'equipment' 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange('equipment')}
          >
            <Wrench size={18} />
            <span>Equipment Fitting</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === 'handRigging' 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange('handRigging')}
          >
            <Hand size={18} />
            <span>Hand Rigging</span>
          </button>
          
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-base ${
              currentView === 'armorFitting' 
                ? 'bg-primary bg-opacity-10 text-primary' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
            onClick={() => onViewChange('armorFitting')}
          >
            <Shield size={18} />
            <span>Armor Fitting</span>
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation