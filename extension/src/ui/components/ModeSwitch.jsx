import React from 'react'
import { useAppStore } from '../../lib/store'
import { cn } from '../../lib/utils'
import { MessageSquare, Zap, Users } from 'lucide-react'

export function ModeSwitch() {
  const { mode, setMode } = useAppStore()

  return (
    <div className="flex p-1 bg-muted rounded-lg shadow-inner mb-4 w-full">
      <button
        onClick={() => setMode('recommendation')}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all",
          mode === 'recommendation' 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Zap className="w-3.5 h-3.5" />
        AI Reply
      </button>
      <button
        onClick={() => setMode('free_chat')}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all",
          mode === 'free_chat' 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Chat
      </button>
      <button
        onClick={() => setMode('personas')}
        className={cn(
          "flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all",
          mode === 'personas' 
            ? "bg-background text-foreground shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Users className="w-3.5 h-3.5" />
        Personas
      </button>
    </div>
  )
}
