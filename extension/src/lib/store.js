import { create } from 'zustand'

const chromeStorage = globalThis.chrome?.storage

export const useAppStore = create((set, get) => ({
  mode: 'recommendation', // 'recommendation', 'free_chat', or 'personas'
  setMode: (mode) => set({ mode }),
  
  // Chat Context State (current analysis result)
  chatContext: {
    situation: '',
    replies: [],
    tone: null,    // 'cold' | 'neutral' | 'warm' | 'tense' | 'conflict'
  },
  setChatContext: (context) => set({ chatContext: context }),
  
  // Free Chat State
  chatHistory: [],
  addMessage: (msg) => set((state) => ({ chatHistory: [...state.chatHistory, msg] })),

  // Personas RAG State
  personas: [],
  initPersonas: async () => {
    if (chromeStorage) {
      const data = await chromeStorage.local.get(['waCopilotPersonas']);
      if (data.waCopilotPersonas) {
        set({ personas: data.waCopilotPersonas });
      }
    }
  },
  addPersona: (persona) => set((state) => {
    const newPersonas = [...state.personas, { ...persona, id: Date.now() }];
    chromeStorage?.local.set({ waCopilotPersonas: newPersonas });
    return { personas: newPersonas };
  }),
  removePersona: (id) => set((state) => {
    const newPersonas = state.personas.filter(p => p.id !== id);
    chromeStorage?.local.set({ waCopilotPersonas: newPersonas });
    return { personas: newPersonas };
  }),

  // === CONVERSATION MEMORY (per-contact, persisted) ===
  contactMemory: {},
  initMemory: async () => {
    if (chromeStorage) {
      const data = await chromeStorage.local.get(['waCopilotMemory']);
      if (data.waCopilotMemory) {
        set({ contactMemory: data.waCopilotMemory });
      }
    }
  },
  updateMemory: (contactName, summary) => set((state) => {
    const updated = {
      ...state.contactMemory,
      [contactName]: {
        lastSummary: summary,
        updatedAt: new Date().toISOString(),
      }
    };
    chromeStorage?.local.set({ waCopilotMemory: updated });
    return { contactMemory: updated };
  }),
  clearMemory: (contactName) => set((state) => {
    const updated = { ...state.contactMemory };
    delete updated[contactName];
    chromeStorage?.local.set({ waCopilotMemory: updated });
    return { contactMemory: updated };
  }),

  // === CONVERSATION GOALS (per-contact, persisted) ===
  contactGoals: {},
  initGoals: async () => {
    if (chromeStorage) {
      const data = await chromeStorage.local.get(['waCopilotGoals']);
      if (data.waCopilotGoals) {
        set({ contactGoals: data.waCopilotGoals });
      }
    }
  },
  setGoal: (contactName, goal) => set((state) => {
    const updated = {
      ...state.contactGoals,
      [contactName]: { goal, updatedAt: new Date().toISOString() }
    };
    chromeStorage?.local.set({ waCopilotGoals: updated });
    return { contactGoals: updated };
  }),
  clearGoal: (contactName) => set((state) => {
    const updated = { ...state.contactGoals };
    delete updated[contactName];
    chromeStorage?.local.set({ waCopilotGoals: updated });
    return { contactGoals: updated };
  }),
}))
