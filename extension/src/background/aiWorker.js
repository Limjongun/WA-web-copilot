// aiWorker.js - Background Service Worker

console.log("Background worker initialized.");

const API_URL = "https://models.inference.ai.azure.com/chat/completions";
const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"; // Ganti dengan token yang valid di lokal

async function processChat(payload) {
  const { contactName, messages } = payload;
  
  // Ambil persona RAG dari storage
  let personaContext = "";
  const data = await chrome.storage.local.get(['waCopilotPersonas']);
  const personas = data.waCopilotPersonas || [];
  
  const matchedPersona = personas.find(p => p.contactName?.toLowerCase() === contactName?.toLowerCase());
  if (matchedPersona) {
    personaContext = matchedPersona.context;
  }

  // Format percakapan dengan label eksplisit: [SAYA] vs [LAWAN]
  // Ini mencegah AI salah mengidentifikasi siapa pengirim dan siapa penerima
  const conversationText = messages.map(m => {
    const role = m.sender === 'You' ? '[SAYA]' : `[LAWAN - ${contactName}]`;
    let line = `${role}: ${m.text}`;
    if (m.type && m.type !== 'text') line = `${role}: (${m.type}) ${m.text}`;
    return line;
  }).join('\n');
  
  // Sistem prompt yang tegas soal peran
  let systemPrompt = `Kamu adalah Ghostwriter AI untuk WhatsApp.

KONTEKS PERAN:
- Percakapan berlabel [SAYA] = pesan yang sudah dikirim oleh USER (pemilik HP).
- Percakapan berlabel [LAWAN - ${contactName}] = pesan dari lawan bicara.
- Tugasmu: tulis SATU balasan singkat dari sudut pandang [SAYA] yang ditujukan kepada [LAWAN - ${contactName}].

Aturan output:
1. Output HANYA teks balasannya saja — tanpa tanda kutip, tanpa penjelasan, tanpa label apapun.
2. Ikuti gaya bahasa yang digunakan [SAYA] di percakapan (formal/gaul/singkat/dll).
3. Balasan harus logis merespons pesan TERAKHIR dari [LAWAN - ${contactName}].`;

  if (personaContext) {
    systemPrompt += `\n4. Konteks hubungan [SAYA] dengan [LAWAN - ${contactName}]: ${personaContext}. Sesuaikan nada!`;
  }

  const userPrompt = `Riwayat percakapan:\n\n${conversationText}\n\nTulis balasan [SAYA] kepada [LAWAN - ${contactName}] untuk merespons pesan terakhirnya:`;

  try {
    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const json = await response.json();
    const reply = json.choices[0].message.content.trim();
    
    return { status: 'Success', draft: reply };
  } catch (error) {
    console.error("AI Worker Error:", error);
    return { status: 'Error', draft: null };
  }
}

async function analyzeChat(payload) {
  const { contactName, messages, customContext } = payload;
  if (!messages || messages.length === 0) {
    return { status: 'Error', error: 'No messages provided' };
  }

  // Load all persistent context from storage in parallel
  const stored = await chrome.storage.local.get([
    'waCopilotPersonas',
    'waCopilotMemory',
    'waCopilotGoals'
  ]);

  // Persona context
  const personas = stored.waCopilotPersonas || [];
  const matchedPersona = personas.find(p => p.contactName?.toLowerCase() === contactName?.toLowerCase());
  const personaContext = matchedPersona?.context || '';

  // Conversation memory
  const memory = stored.waCopilotMemory || {};
  const contactMemory = memory[contactName];

  // Conversation goal
  const goals = stored.waCopilotGoals || {};
  const contactGoal = goals[contactName]?.goal || '';

  // Format percakapan dengan label eksplisit untuk mencegah ambiguitas peran
  const conversationText = messages.map(m => {
    const role = m.sender === 'You' ? '[SAYA]' : `[LAWAN - ${contactName}]`;
    let line = role;
    if (m.type && m.type !== 'text') line += ` (${m.type})`;
    if (m.replyTo) line += ` [membalas: "${m.replyTo.text.slice(0, 40)}"]`;
    if (m.delaySeconds && m.delaySeconds > 3600) line += ` (jeda ${Math.round(m.delaySeconds / 3600)} jam)`;
    else if (m.delaySeconds && m.delaySeconds > 300) line += ` (jeda ${Math.round(m.delaySeconds / 60)} mnt)`;
    line += `: ${m.text}`;
    return line;
  }).join('\n');

  let systemPrompt = `Kamu adalah AI Assistant cerdas dan empatik untuk WhatsApp.

LEGENDA PERCAKAPAN:
- [SAYA] = USER pemilik HP, orang yang memakai ekstensi ini.
- [LAWAN - ${contactName}] = lawan bicara yang perlu dibalas.

Semua balasan yang kamu hasilkan adalah dari sudut pandang [SAYA] dan ditujukan kepada [LAWAN - ${contactName}].
JANGAN PERNAH membuat balasan dari sudut pandang [LAWAN].

Balas dalam bentuk JSON PERSIS seperti ini:
{
  "situation": "Ringkasan situasi percakapan (1-2 kalimat, bahasa yang sama dengan chat, dari perspektif [SAYA]).",
  "tone": "nilai dari: cold | neutral | warm | tense | conflict",
  "replies": [
    { "type": "Casual", "text": "..." },
    { "type": "Neutral", "text": "..." },
    { "type": "Assertive", "text": "..." }
  ]
}

Panduan tone (berdasarkan keseluruhan suasana chat):
- cold: Kaku, formal berlebihan, satu pihak tidak responsif / slow reply sangat lama
- neutral: Normal, tidak ada tensi
- warm: Akrab, hangat, nyaman
- tense: Ada tensi, ketidaknyamanan, atau potensi konflik
- conflict: Pertengkaran, konfrontasi, kemarahan jelas

Aturan output:
- Output HANYA JSON valid, tidak ada teks lain di luar JSON
- Ikuti gaya bahasa [SAYA] di chat (formal/gaul/singkat/dll)
- Setiap opsi balasan harus logis merespons pesan TERAKHIR dari [LAWAN - ${contactName}]
- Pertimbangkan jeda waktu antar pesan sebagai sinyal mood`;

  if (personaContext) {
    systemPrompt += `\n\n[HUBUNGAN & PERSONA]: Kontak bernama "${contactName}". Konteks hubungan: ${personaContext}. Sesuaikan nada!`;
  }

  if (contactMemory?.lastSummary) {
    systemPrompt += `\n\n[MEMORI SESI SEBELUMNYA]: ${contactMemory.lastSummary} (terakhir diperbarui: ${new Date(contactMemory.updatedAt).toLocaleDateString('id-ID')})`;
  }

  if (contactGoal) {
    systemPrompt += `\n\n[TUJUAN PERCAKAPAN USER]: User ingin mengarahkan obrolan ini untuk: "${contactGoal}". Pastikan setidaknya 1 opsi balasan secara halus mendekatkan ke tujuan ini tanpa terkesan memaksa.`;
  }

  if (customContext) {
    systemPrompt += `\n\n[REVISI KONTEKS DARI USER]: "${customContext}". PRIORITASKAN informasi ini dalam analisis.`;
  }

  const userPrompt = `Analisis percakapan berikut (kontak: ${contactName || 'Unknown'}):\n\n${conversationText}`;

  try {
    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const json = await response.json();
    const raw = json.choices[0].message.content.trim();
    const parsed = JSON.parse(raw);

    // Auto-save the new situation as memory for this contact
    const currentMemory = stored.waCopilotMemory || {};
    const updatedMemory = {
      ...currentMemory,
      [contactName]: {
        lastSummary: parsed.situation,
        updatedAt: new Date().toISOString(),
      }
    };
    chrome.storage.local.set({ waCopilotMemory: updatedMemory });

    return {
      status: 'Success',
      situation: parsed.situation,
      tone: parsed.tone || 'neutral',
      replies: parsed.replies
    };
  } catch (error) {
    console.error("analyzeChat Error:", error);
    return { status: 'Error', error: error.message };
  }
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_CHAT_CONTEXT') {
    processChat(request.payload).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.type === 'ANALYZE_CHAT') {
    analyzeChat(request.payload).then(result => {
      sendResponse(result);
    });
    return true;
  }
});
