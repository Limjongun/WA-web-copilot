import { create } from 'zustand'

export const useAppStore = create((set) => ({
  mode: 'recommendation', // 'recommendation', 'free_chat', or 'personas'
  setMode: (mode) => set({ mode }),
  
  // Chat Context State
  chatContext: {
    situation: '',
    replies: []
  },
  setChatContext: (context) => set({ chatContext: context }),
  
  // Free Chat State
  chatHistory: [],
  addMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),

  // Personas RAG State
  personas: [],
  
  // Method to initialize personas from storage
  initPersonas: async () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const data = await chrome.storage.local.get(['waCopilotPersonas']);
      if (data.waCopilotPersonas) {
        set({ personas: data.waCopilotPersonas });
      }
    }
  },

  addPersona: (persona) => set((state) => {
    const newPersonas = [...state.personas, { ...persona, id: Date.now() }];
    if (typeof chrome !== 'undefined' && chrome.storage) {
       chrome.storage.local.set({ waCopilotPersonas: newPersonas });
    }
    return { personas: newPersonas };
  }),
  
  removePersona: (id) => set((state) => {
    const newPersonas = state.personas.filter(p => p.id !== id);
    if (typeof chrome !== 'undefined' && chrome.storage) {
       chrome.storage.local.set({ waCopilotPersonas: newPersonas });
    }
    return { personas: newPersonas };
  }),
}))
