import React, { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '../../lib/utils'

export function FreeChatPanel() {
  const { chatHistory, addMessage } = useAppStore()
  const [input, setInput] = useState('')

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    // Add user message
    addMessage({ role: 'user', content: input })
    const userMsg = input
    setInput('')

    // Simulate AI response
    setTimeout(() => {
      addMessage({ 
        role: 'assistant', 
        content: `I am processing your request: "${userMsg}". (AI integration pending)` 
      })
    }, 600)
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1 custom-scrollbar">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-60">
            <Bot className="w-10 h-10 mb-2 text-primary/40" />
            <p className="text-sm">Ask anything about the chat...</p>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div 
              key={i} 
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : ""
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
              )}>
                {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "px-3 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm",
                msg.role === 'user' 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-card border border-border text-foreground rounded-tl-sm"
              )}>
                {msg.content}
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="relative mt-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="w-full bg-secondary/50 border border-border text-foreground text-sm rounded-full pl-4 pr-12 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary transition-all"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}
