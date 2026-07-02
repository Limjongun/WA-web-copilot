// domReader.js - Content Script for WhatsApp Web

console.log("WhatsApp Web Copilot Content Script Injected.");

// CRXJS bundles content scripts as ES Modules, so `chrome` may not be
// available as a bare global. Use globalThis.chrome as the safe accessor.
const chromeAPI = globalThis.chrome;

// Function to simulate typing/pasting into WhatsApp's React-based input and sending
const injectTextToWhatsApp = (text) => {
  const inputEl = document.querySelector('div[contenteditable="true"][data-tab="10"]');
  if (!inputEl) return;
  
  const dataTransfer = new DataTransfer();
  dataTransfer.setData('text/plain', text);
  
  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dataTransfer,
    bubbles: true,
    cancelable: true
  });
  
  inputEl.focus();
  inputEl.dispatchEvent(pasteEvent);

  // Simulate pressing send after a short delay to allow React state to update
  setTimeout(() => {
    // Try to find the send button (usually has an icon with data-icon="send")
    const sendIcon = document.querySelector('span[data-icon="send"]');
    if (sendIcon) {
      const sendBtn = sendIcon.closest('button') || sendIcon.parentElement;
      if (sendBtn) sendBtn.click();
    } else {
      // Fallback: try pressing Enter if the send button isn't found
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      inputEl.dispatchEvent(enterEvent);
    }
  }, 300);
};

// Core function to extract chat data
const getChatContext = () => {
  const mainChat = document.getElementById('main');
  if (!mainChat) return null;

  // Contact name: dari header span yang punya title attribute
  const contactNameEl = mainChat.querySelector('header span[title]');
  const contactName = contactNameEl ? contactNameEl.getAttribute('title') : "Unknown Contact";

  // --- STRATEGY 1: cari message bubbles via data-id (paling reliabel) ---
  let extractedMessages = [];
  const messageDivs = mainChat.querySelectorAll('div[data-id]');

  if (messageDivs.length > 0) {
    messageDivs.forEach(div => {
      // Ambil semua teks yang bisa dipilih di dalam bubble ini
      const textSpans = div.querySelectorAll('span.selectable-text');
      if (textSpans.length === 0) return;

      const text = Array.from(textSpans).map(s => s.innerText).join(' ').trim();
      if (!text) return;

      // Deteksi arah pesan paling akurat via awalan 'data-id'
      // WhatsApp biasanya format: "true_nomor@c.us_..." untuk pesan kita, "false_..." untuk pesan lawan
      let isOutgoing = false;
      const dataId = div.getAttribute('data-id') || '';
      if (dataId.startsWith('true_')) {
        isOutgoing = true;
      } else if (dataId.startsWith('false_')) {
        isOutgoing = false;
      } else {
        // Fallback jika format data-id berubah
        isOutgoing = div.classList.contains('message-out') ||
                     !!div.querySelector('[class*="message-out"]') ||
                     !!div.querySelector('div[data-pre-plain-text]')?.closest('[class*="out"]');
      }
      
      const sender = isOutgoing ? 'You' : contactName;
      extractedMessages.push({ sender, text });
    });
  }

  // --- STRATEGY 2: fallback via copyable-text attribute (di pre-plain-text) ---
  if (extractedMessages.length === 0) {
    const copyables = mainChat.querySelectorAll('[data-pre-plain-text]');
    copyables.forEach(el => {
      const meta = el.getAttribute('data-pre-plain-text') || '';
      // Meta sering kali "[jam, tanggal] Nama:"
      // Kita asumsikan jika meta mengandung "You" atau nama user, itu milik user.
      // Namun untuk mempermudah, kita cek posisi bubble nya
      const isOutgoing = !!el.closest('.message-out') || meta.includes('You');
      const textSpan = el.querySelector('span.selectable-text') ||
                       el.querySelector('span[class*="selectable"]');
      const text = textSpan ? textSpan.innerText.trim() : el.innerText.trim();
      if (!text) return;
      extractedMessages.push({ sender: isOutgoing ? 'You' : contactName, text });
    });
  }

  // --- STRATEGY 3: fallback paling luas --- ambil semua selectable-text di dalam #main
  if (extractedMessages.length === 0) {
    const allTextSpans = mainChat.querySelectorAll('span.selectable-text');
    allTextSpans.forEach(span => {
      const text = span.innerText.trim();
      if (!text || text.length < 1) return;
      // Sulit membedakan pengirim pada level fallback ini, tebak berdasarkan letak
      const isOutgoing = !!span.closest('.message-out');
      extractedMessages.push({ sender: isOutgoing ? 'You' : contactName, text });
    });
  }

  console.log(`[WA Copilot] Extracted ${extractedMessages.length} messages from chat: ${contactName}`);
  return { contactName, messages: extractedMessages };
};

// Function for the Test Extract button
const extractActiveChat = () => {
  const data = getChatContext();
  if (!data) {
    alert("Tidak dapat menemukan chat yang sedang aktif.");
    return;
  }
  
  console.log("=== HASIL EKSTRAKSI CHAT AKTIF ===");
  console.log("Kontak: ", data.contactName);
  console.log("Total Pesan: ", data.messages.length);
  console.table(data.messages);
  
  alert(`Ekstrak Sukses!\nKontak: ${data.contactName}\nJumlah pesan dibaca: ${data.messages.length}\n(Buka Developer Console [F12] untuk melihat teks detailnya)`);
};

// Make a draggable floating panel
const injectAIFloatingButton = () => {
  if (!document.querySelector('footer')) return;
  if (document.getElementById('wa-copilot-float')) return;

  // Restore last saved position or default bottom-right
  const savedPos = JSON.parse(localStorage.getItem('waCopilotPos') || 'null');
  const defaultRight = 24;
  const defaultBottom = 90;

  // --- OUTER WRAPPER (fixed + draggable) ---
  const panel = document.createElement('div');
  panel.id = 'wa-copilot-float';
  panel.style.cssText = `
    position: fixed;
    right: ${savedPos ? 'auto' : defaultRight + 'px'};
    bottom: ${savedPos ? 'auto' : defaultBottom + 'px'};
    left: ${savedPos ? savedPos.left + 'px' : 'auto'};
    top: ${savedPos ? savedPos.top + 'px' : 'auto'};
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0;
    user-select: none;
  `;

  // --- DRAG HANDLE BAR ---
  const handle = document.createElement('div');
  handle.style.cssText = `
    background: rgba(30,30,30,0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #aaa;
    font-size: 11px;
    font-weight: 600;
    padding: 5px 10px;
    border-radius: 12px 12px 0 0;
    cursor: grab;
    display: flex;
    align-items: center;
    gap: 6px;
    letter-spacing: 0.5px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
  `;
  handle.innerHTML = `<span style="font-size:14px;opacity:0.6">⠿</span> WA Copilot`;
  handle.title = 'Drag to move';

  // --- BUTTON ROW ---
  const btnRow = document.createElement('div');
  btnRow.style.cssText = `
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(20,20,20,0.88);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border-radius: 0 0 14px 14px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.35);
    align-items: center;
  `;

  // Button: Test Extract
  const btnExtract = document.createElement('button');
  btnExtract.innerHTML = '🔍 Extract';
  btnExtract.style.cssText = `
    background: #3B82F6;
    color: white;
    border: none;
    border-radius: 20px;
    padding: 5px 11px;
    font-weight: bold;
    cursor: pointer;
    font-size: 12px;
    transition: opacity 0.2s;
  `;
  btnExtract.onmouseenter = () => { btnExtract.style.opacity = '0.85'; };
  btnExtract.onmouseleave = () => { btnExtract.style.opacity = '1'; };
  btnExtract.onclick = extractActiveChat;

  // Button: AI Reply
  const btnAI = document.createElement('button');
  btnAI.innerHTML = '✨ AI Reply';
  btnAI.style.cssText = `
    background: linear-gradient(135deg, #25D366, #128C7E);
    color: white;
    border: none;
    border-radius: 20px;
    padding: 5px 13px;
    font-weight: bold;
    cursor: pointer;
    font-size: 12px;
    transition: opacity 0.2s;
    box-shadow: 0 2px 8px rgba(37,211,102,0.4);
  `;
  btnAI.onmouseenter = () => { btnAI.style.opacity = '0.85'; };
  btnAI.onmouseleave = () => { btnAI.style.opacity = '1'; };
  btnAI.onclick = () => {
    const data = getChatContext();
    if (!data || data.messages.length === 0) {
      alert('Tidak ada riwayat chat yang bisa dibaca.');
      return;
    }
    btnAI.innerHTML = '⏳...';
    if (!chromeAPI || !chromeAPI.runtime) {
      alert('Chrome Extension API tidak tersedia.');
      btnAI.innerHTML = '✨ AI Reply';
      return;
    }
    chromeAPI.runtime.sendMessage({ type: 'PROCESS_CHAT_CONTEXT', payload: data }, (response) => {
      if (chromeAPI.runtime.lastError) {
        console.error('Runtime Error:', chromeAPI.runtime.lastError.message);
        btnAI.innerHTML = '✨ AI Reply';
        return;
      }
      if (response && response.draft) {
        injectTextToWhatsApp(response.draft);
      } else {
        alert('Gagal memproses AI.');
      }
      btnAI.innerHTML = '✨ AI Reply';
    });
  };

  btnRow.appendChild(btnExtract);
  btnRow.appendChild(btnAI);
  panel.appendChild(handle);
  panel.appendChild(btnRow);
  document.body.appendChild(panel);

  // --- DRAG LOGIC ---
  let isDragging = false;
  let startX, startY, startLeft, startTop;

  handle.style.cursor = 'grab';

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    handle.style.cursor = 'grabbing';
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    // Switch from right/bottom to left/top for dragging
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = startLeft + 'px';
    panel.style.top = startTop + 'px';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, startLeft + dx));
    const newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, startTop + dy));
    panel.style.left = newLeft + 'px';
    panel.style.top = newTop + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = 'grab';
    // Save position
    localStorage.setItem('waCopilotPos', JSON.stringify({
      left: parseInt(panel.style.left),
      top: parseInt(panel.style.top)
    }));
  });
};


// Observer to detect when a chat is opened
const observer = new MutationObserver((mutations) => {
  // Look for footer which indicates an active chat
  if (document.querySelector('footer')) {
    injectAIFloatingButton();
  }
});

// Start observing the body for DOM changes
observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from the Popup
if (chromeAPI && chromeAPI.runtime) {
  chromeAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_CHAT_CONTEXT') {
      const data = getChatContext();
      sendResponse(data || { contactName: null, messages: [] });
      return true;
    }
    if (request.type === 'INJECT_TEXT') {
      injectTextToWhatsApp(request.text);
      sendResponse({ status: 'ok' });
      return true;
    }
  });
}
