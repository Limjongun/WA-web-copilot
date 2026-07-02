import React, { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { Check, Copy, RefreshCw, MessageCircle, Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export function RecommendationPanel() {
  const { chatContext, setChatContext } = useAppStore()
  const [copied, setCopied] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)

  const situation = chatContext.situation || null
  const replies = chatContext.replies || []

  const handleActivateAI = async () => {
    setIsAnalyzing(true)
    setError(null)
    
    const chrome = globalThis.chrome
    if (!chrome || !chrome.tabs || !chrome.runtime) {
      setError("Chrome API tidak tersedia. Pastikan ekstensi aktif.")
      setIsAnalyzing(false)
      return
    }

    try {
      // 1. Find WhatsApp Web tab by URL (active+currentWindow picks the POPUP window, not browser tab)
      const allTabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' })
      const waTab = allTabs[0]
      
      if (!waTab) {
        setError("WhatsApp Web tidak ditemukan. Buka web.whatsapp.com terlebih dahulu.")
        setIsAnalyzing(false)
        return
      }

      // 2. Request chat context from content script
      const chatData = await new Promise((resolve) => {
        chrome.tabs.sendMessage(waTab.id, { type: 'GET_CHAT_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null)
          } else {
            resolve(response)
          }
        })
      })

      if (!chatData || !chatData.messages || chatData.messages.length === 0) {
        setError("Tidak ada pesan yang bisa dibaca. Pastikan sebuah chat sedang terbuka.")
        setIsAnalyzing(false)
        return
      }

      // 3. Send to background for AI analysis
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'ANALYZE_CHAT', payload: chatData }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null)
          } else {
            resolve(response)
          }
        })
      })

      if (result && result.status === 'Success') {
        setChatContext({ situation: result.situation, replies: result.replies })
      } else {
        setError(result?.error || "Gagal menganalisis chat. Coba lagi.")
      }
    } catch (err) {
      setError(err.message || "Terjadi kesalahan tidak terduga.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleSendDirect = (text) => {
    const chrome = globalThis.chrome
    if (!chrome || !chrome.tabs) return
    chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
      const waTab = tabs[0]
      if (!waTab) return
      chrome.tabs.sendMessage(waTab.id, { type: 'INJECT_TEXT', text })
    })
  }

  return (
    <div className="flex flex-col h-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Activate Button */}
      <button
        onClick={handleActivateAI}
        disabled={isAnalyzing}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md",
          isAnalyzing
            ? "bg-primary/60 text-primary-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
        )}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Menganalisis...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Aktifkan AI
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-destructive/10 text-destructive rounded-lg p-3 text-xs border border-destructive/20">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!situation && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground gap-3 py-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary/50" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground/60">AI Siap Beraksi</p>
            <p className="text-xs text-muted-foreground mt-1">Buka chat di WhatsApp Web,<br />lalu klik "Aktifkan AI"</p>
          </div>
        </div>
      )}

      {/* Situation Analysis */}
      {situation && (
        <div className="bg-secondary/50 rounded-xl p-3 border border-border">
          <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            Situasi Chat
          </h3>
          <p className="text-sm text-foreground/80 leading-relaxed">{situation}</p>
        </div>
      )}

      {/* Quick Replies */}
      {replies.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-0.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Replies
            </h3>
            <button onClick={handleActivateAI} className="text-primary hover:text-primary/80 transition-colors" title="Refresh analisis">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {replies.map((reply, i) => (
            <div
              key={i}
              className="group relative bg-card border border-border hover:border-primary/50 transition-all rounded-xl p-3 shadow-sm hover:shadow-md"
            >
              <div className="flex justify-between items-start mb-1.5">
                <span className="text-[10px] font-bold text-primary/70 uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded-full">
                  {reply.type}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleSendDirect(reply.text)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors px-2 py-0.5 rounded-md hover:bg-primary/10"
                    title="Kirim ke WA"
                  >
                    ↗
                  </button>
                  <button
                    onClick={() => handleCopy(reply.text, i)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors"
                    title="Copy"
                  >
                    {copied === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <p className="text-sm text-foreground">{reply.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
