import React from 'react'
import GenerationDashboard from '../components/Generation/GenerationDashboard'

interface GenerationPageProps {
  onNavigateToAssets?: () => void
  onNavigateToAsset?: (assetId: string) => void
}

export const GenerationPage: React.FC<GenerationPageProps> = () => {
  return <GenerationDashboard />
}

export default GenerationPage 