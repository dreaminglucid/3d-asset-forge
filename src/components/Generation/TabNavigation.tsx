import React from 'react'
import { Settings, Zap, Package } from 'lucide-react'
import { cn } from '../../styles'

interface Tab {
  id: 'config' | 'progress' | 'results'
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface TabNavigationProps {
  activeView: 'config' | 'progress' | 'results'
  generatedAssetsCount: number
  onTabChange: (view: 'config' | 'progress' | 'results') => void
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
  activeView,
  generatedAssetsCount,
  onTabChange
}) => {
  const tabs: Tab[] = [
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'progress', label: 'Pipeline', icon: Zap },
    { id: 'results', label: 'Results', icon: Package }
  ]

  return (
    <div className="flex-1 flex gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const count = tab.id === 'results' ? generatedAssetsCount : 0
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200",
              activeView === tab.id
                ? "bg-bg-secondary text-text-primary"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary hover:bg-opacity-50"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {count > 0 && (
              <span className="ml-1.5 px-2 py-0.5 bg-primary bg-opacity-20 text-primary text-xs rounded-full font-semibold">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default TabNavigation 