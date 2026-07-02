import React, { useEffect } from 'react'
import { ModeSwitch } from './ui/components/ModeSwitch'
import { RecommendationPanel } from './ui/components/RecommendationPanel'
import { FreeChatPanel } from './ui/components/FreeChatPanel'
import { PersonaPanel } from './ui/components/PersonaPanel'
import { useAppStore } from './lib/store'
import { Sparkles, Settings } from 'lucide-react'

function App() {
  const { mode, initPersonas } = useAppStore()

  useEffect(() => {
    initPersonas()
  }, [initPersonas])

  return (
    <div className="w-full h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <div className="bg-primary/20 p-1.5 rounded-lg">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">WA Copilot</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Assistant</p>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-secondary">
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 overflow-hidden">
        <ModeSwitch />
        
        <div className="flex-1 overflow-hidden relative">
          {mode === 'recommendation' && <RecommendationPanel />}
          {mode === 'free_chat' && <FreeChatPanel />}
          {mode === 'personas' && <PersonaPanel />}
        </div>
      </main>
    </div>
  )
}

export default App
