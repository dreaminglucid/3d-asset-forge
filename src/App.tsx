import { AppProvider } from './contexts/AppContext'
import { NavigationProvider } from './contexts/NavigationContext'
import { useNavigation } from './hooks/useNavigation'
import Navigation from './components/shared/Navigation'
import NotificationBar from './components/shared/NotificationBar'
import { AssetsPage } from './pages/AssetsPage'
import { GenerationPage } from './pages/GenerationPage'
import { EquipmentPage } from './pages/EquipmentPage'
import { HandRiggingPage } from './pages/HandRiggingPage'
import { ArmorFittingPage } from './pages/ArmorFittingPage'

function AppContent() {
  const { currentView, navigateTo, navigateToAsset } = useNavigation()

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-bg-primary to-bg-secondary relative">
      {/* Subtle grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="h-full w-full" style={{
          backgroundImage: `linear-gradient(to right, var(--color-primary) 1px, transparent 1px),
                           linear-gradient(to bottom, var(--color-primary) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navigation currentView={currentView} onViewChange={navigateTo} />
        <NotificationBar />
      
        <main className="flex-1">
          {currentView === 'assets' && (
            <div className="h-full overflow-hidden">
              <AssetsPage />
            </div>
          )}
          {currentView === 'generation' && (
            <GenerationPage 
              onNavigateToAssets={() => navigateTo('assets')}
              onNavigateToAsset={navigateToAsset}
            />
          )}
          {currentView === 'equipment' && (
            <EquipmentPage />
          )}
          {currentView === 'handRigging' && (
            <HandRiggingPage />
          )}
          {currentView === 'armorFitting' && (
            <ArmorFittingPage />
          )}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AppProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </AppProvider>
  )
}

export default App
