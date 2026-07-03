import React, { useState, useEffect } from 'react'
import { useAppStore } from '../../lib/store'
import { Check, Copy, RefreshCw, MessageCircle, Sparkles, Loader2, AlertCircle, Target, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'

// Tone indicator config
const TONE_CONFIG = {
  cold:     { color: '#60A5FA', label: 'Dingin',   bg: 'bg-blue-500' },
  neutral:  { color: '#A3A3A3', label: 'Netral',   bg: 'bg-neutral-400' },
  warm:     { color: '#34D399', label: 'Hangat',   bg: 'bg-emerald-400' },
  tense:    { color: '#FBBF24', label: 'Tegang',   bg: 'bg-amber-400' },
  conflict: { color: '#F87171', label: 'Konflik',  bg: 'bg-red-400' },
}

export function RecommendationPanel() {
  const { chatContext, setChatContext, contactGoals, initGoals, setGoal, clearGoal } = useAppStore()
  const [copied, setCopied] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState(null)
  const [isEditingContext, setIsEditingContext] = useState(false)
  const [customContext, setCustomContext] = useState("")
  const [currentContact, setCurrentContact] = useState(null)

  // Goal editing state
  const [isEditingGoal, setIsEditingGoal] = useState(false)
  const [goalDraft, setGoalDraft] = useState("")

  const situation = chatContext.situation || null
  const replies = chatContext.replies || []
  const tone = chatContext.tone || null
  const toneInfo = tone ? TONE_CONFIG[tone] : null

  // Current goal for this contact
  const currentGoal = currentContact ? (contactGoals[currentContact]?.goal || '') : ''

  useEffect(() => {
    initGoals()
  }, [])

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
      const allTabs = await chrome.tabs.query({ url: '*://web.whatsapp.com/*' })
      const waTab = allTabs[0]
      
      if (!waTab) {
        setError("WhatsApp Web tidak ditemukan. Buka web.whatsapp.com terlebih dahulu.")
        setIsAnalyzing(false)
        return
      }

      const chatData = await new Promise((resolve) => {
        chrome.tabs.sendMessage(waTab.id, { type: 'GET_CHAT_CONTEXT' }, (response) => {
          if (chrome.runtime.lastError) resolve(null)
          else resolve(response)
        })
      })

      if (!chatData || !chatData.messages || chatData.messages.length === 0) {
        setError("Tidak ada pesan yang bisa dibaca. Pastikan sebuah chat sedang terbuka.")
        setIsAnalyzing(false)
        return
      }

      // Track current contact
      if (chatData.contactName) setCurrentContact(chatData.contactName)

      chatData.customContext = customContext;

      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'ANALYZE_CHAT', payload: chatData }, (response) => {
          if (chrome.runtime.lastError) resolve(null)
          else resolve(response)
        })
      })

      if (result && result.status === 'Success') {
        setChatContext({ situation: result.situation, replies: result.replies, tone: result.tone })
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

  const handleSaveGoal = () => {
    if (currentContact) {
      setGoal(currentContact, goalDraft)
    }
    setIsEditingGoal(false)
  }

  return (
    <div className="flex flex-col h-full space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Goal Banner — always visible if goal is set */}
      {currentGoal && !isEditingGoal && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-xl px-3 py-2">
          <Target className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-xs text-primary flex-1 line-clamp-2">
            <span className="font-semibold">Tujuan:</span> {currentGoal}
          </p>
          <button
            onClick={() => { setGoalDraft(currentGoal); setIsEditingGoal(true) }}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            onClick={() => { clearGoal(currentContact); setGoalDraft('') }}
            className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Goal Editor */}
      {isEditingGoal && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Tujuan Percakapan</span>
          </div>
          <textarea
            value={goalDraft}
            onChange={(e) => setGoalDraft(e.target.value)}
            placeholder="Contoh: Ajak dia makan malam weekend ini..."
            className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary min-h-[56px] resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditingGoal(false)} className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Batal
            </button>
            <button onClick={handleSaveGoal} className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:bg-primary/90 transition-colors">
              Simpan
            </button>
          </div>
        </div>
      )}

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

      {/* Set Goal Button (shown before any analysis or if no goal) */}
      {!currentGoal && !isEditingGoal && (
        <button
          onClick={() => { setGoalDraft(''); setIsEditingGoal(true) }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium text-muted-foreground border border-dashed border-border hover:border-primary/50 hover:text-primary transition-all"
        >
          <Target className="w-3.5 h-3.5" />
          Tetapkan Tujuan Percakapan
        </button>
      )}

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
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3 text-primary" />
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">Situasi Chat</h3>
              {/* Tone Dot Indicator */}
              {toneInfo && (
                <div className="flex items-center gap-1 ml-1">
                  <div
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: toneInfo.color }}
                    title={`Nada: ${toneInfo.label}`}
                  />
                  <span className="text-[10px] font-medium" style={{ color: toneInfo.color }}>
                    {toneInfo.label}
                  </span>
                </div>
              )}
            </div>
            {!isEditingContext && (
              <button 
                onClick={() => setIsEditingContext(true)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Revisi
              </button>
            )}
          </div>
          
          {isEditingContext ? (
            <div className="space-y-2 mt-2">
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                placeholder="Jelaskan situasi sebenarnya atau tambahkan konteks..."
                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground/90 focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setIsEditingContext(false)}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    setIsEditingContext(false)
                    handleActivateAI()
                  }}
                  className="px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-md shadow hover:bg-primary/90 transition-colors"
                >
                  Analisis Ulang
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground/80 leading-relaxed">{situation}</p>
          )}
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
