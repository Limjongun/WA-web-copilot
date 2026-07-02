import React, { useState } from 'react'
import { useAppStore } from '../../lib/store'
import { Plus, Trash2, UserCircle } from 'lucide-react'

export function PersonaPanel() {
  const { personas, addPersona, removePersona } = useAppStore()
  const [contactName, setContactName] = useState('')
  const [context, setContext] = useState('')
  
  const handleAdd = (e) => {
    e.preventDefault()
    if (!contactName.trim() || !context.trim()) return
    addPersona({ contactName: contactName.trim(), context: context.trim() })
    setContactName('')
    setContext('')
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      <div className="bg-secondary/30 rounded-xl p-3 border border-border mb-4">
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Tambahkan Persona</h3>
        <form onSubmit={handleAdd} className="space-y-2">
          <input 
            type="text" 
            placeholder="Nama Kontak (Persis di WA)..." 
            value={contactName}
            onChange={e => setContactName(e.target.value)}
            className="w-full bg-card border border-border text-foreground text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <textarea 
            placeholder="Hubungan & konteks (cth: Teman akrab, pakai bahasa gaul)..."
            value={context}
            onChange={e => setContext(e.target.value)}
            className="w-full bg-card border border-border text-foreground text-sm rounded-lg px-3 py-1.5 min-h-[60px] focus:outline-none focus:ring-1 focus:ring-primary custom-scrollbar resize-none"
          />
          <button 
            type="submit"
            disabled={!contactName.trim() || !context.trim()}
            className="w-full flex items-center justify-center gap-1 bg-primary text-primary-foreground text-xs font-semibold py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Simpan Persona
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pb-2 pr-1 custom-scrollbar">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Daftar Persona RAG</h3>
        {personas.length === 0 ? (
           <p className="text-xs text-muted-foreground italic text-center mt-4">Belum ada persona tersimpan.</p>
        ) : (
          personas.map((p) => (
            <div key={p.id} className="bg-card border border-border rounded-lg p-2.5 flex items-start gap-2 group">
              <UserCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold truncate text-foreground">{p.contactName}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{p.context}</p>
              </div>
              <button 
                onClick={() => removePersona(p.id)}
                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-1"
                title="Hapus persona"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
