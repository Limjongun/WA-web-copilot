// aiWorker.js - Background Service Worker

console.log("Background worker initialized.");

const API_URL = "https://models.inference.ai.azure.com/chat/completions";
const GITHUB_TOKEN = "YOUR_GITHUB_TOKEN_HERE"; // Removed for GitHub push protection

async function processChat(payload) {
  const { contactName, messages } = payload;
  
  // Ambil persona RAG dari storage
  let personaContext = "";
  const data = await chrome.storage.local.get(['waCopilotPersonas']);
  const personas = data.waCopilotPersonas || [];
  
  const matchedPersona = personas.find(p => p.contactName.toLowerCase() === contactName.toLowerCase());
  if (matchedPersona) {
    personaContext = matchedPersona.context;
  }

  // Siapkan teks percakapan
  let conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');
  
  // Siapkan System Prompt
  let systemPrompt = `Kamu adalah Ghostwriter AI profesional yang terhubung langsung dengan WhatsApp Web user.
Tugasmu adalah membaca konteks percakapan terakhir, dan membuat 1 (satu) balasan singkat, natural, dan langsung (tanpa tanda kutip, penjelasan, atau basa-basi tambahan).
Balasan ini akan otomatis dimasukkan ke kolom chat user, jadi posisikan dirimu sebagai "User" (You) tersebut yang membalas pesan orang ini.

Aturan Penting:
1. Pahami bahasa yang digunakan (Indonesia formal, gaul, dll) dan ikuti gaya bahasanya.
2. Jangan pernah menghasilkan output seperti "Tentu, ini balasannya:", LANGSUNG berikan balasannya saja.`;

  if (personaContext) {
    systemPrompt += `\n3. User sedang berbicara dengan ${contactName}. Konteks/Hubungan: ${personaContext}. Sesuaikan nada bicara dengan konteks ini!`;
  }

  const userPrompt = `Lanjutkan percakapan ini dengan membalas pesan terakhir (sebagai "You"):\n\n${conversationText}\nYou:`;

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
  const { contactName, messages } = payload;
  if (!messages || messages.length === 0) {
    return { status: 'Error', error: 'No messages to analyze' };
  }

  // Get persona context from storage
  let personaContext = "";
  const data = await chrome.storage.local.get(['waCopilotPersonas']);
  const personas = data.waCopilotPersonas || [];
  const matchedPersona = personas.find(p => p.contactName.toLowerCase() === contactName?.toLowerCase());
  if (matchedPersona) {
    personaContext = matchedPersona.context;
  }

  const conversationText = messages.map(m => `${m.sender}: ${m.text}`).join('\n');

  let systemPrompt = `Kamu adalah AI analis percakapan WhatsApp yang membantu user memahami situasi chat dan menyiapkan balasan.

Tugasmu:
1. Analisa percakapan yang diberikan
2. Buat ringkasan situasi singkat (1-2 kalimat, pakai bahasa yang sama dengan chat)
3. Hasilkan TEPAT 3 opsi balasan: Casual, Neutral, dan Assertive

Format output HARUS JSON valid seperti ini (tidak ada teks lain di luar JSON):
{
  "situation": "Ringkasan situasi percakapan di sini...",
  "replies": [
    { "type": "Casual", "text": "Balasan santai di sini..." },
    { "type": "Neutral", "text": "Balasan netral di sini..." },
    { "type": "Assertive", "text": "Balasan tegas di sini..." }
  ]
}

Aturan penting:
- Output HANYA JSON, tidak ada kata penjelasan sebelum atau sesudah
- Ikuti gaya bahasa yang digunakan di percakapan (formal/gaul/dll)
- Balasan harus natural, singkat, dan relevan dengan konteks`;

  if (personaContext) {
    systemPrompt += `\n- User sedang berbicara dengan ${contactName}. Konteks hubungan: ${personaContext}. Sesuaikan nada!`;
  }

  const userPrompt = `Analisis percakapan ini (kontak: ${contactName || 'Unknown'}):\n\n${conversationText}`;

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
        max_tokens: 400,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const json = await response.json();
    const raw = json.choices[0].message.content.trim();
    const parsed = JSON.parse(raw);

    return { status: 'Success', situation: parsed.situation, replies: parsed.replies };
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
