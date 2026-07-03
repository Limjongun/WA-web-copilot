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

// Helper: Decode UNIX timestamp from WhatsApp message ID
// Format: true_628xxx@c.us_3EB0TIMESTAMP (timestamp embedded in hex)
const decodeTimestampFromId = (dataId) => {
  try {
    // WA message IDs contain a 32-char hex segment. The last 8 hex chars = unix seconds
    const parts = dataId.split('_');
    const hexSegment = parts[parts.length - 1];
    if (hexSegment && hexSegment.length >= 8) {
      const ts = parseInt(hexSegment.slice(-8), 16);
      if (ts > 1000000000 && ts < 9999999999) {
        return new Date(ts * 1000).toISOString();
      }
    }
  } catch (_) {}
  return null;
};

// Helper: Detect message type from bubble DOM
const detectMessageType = (div) => {
  if (div.querySelector('span[data-testid="revoked"]') || div.querySelector('div[data-testid="revoked"]')) return 'deleted';
  if (div.querySelector('img[src*="blob"]') || div.querySelector('div[data-testid*="media"]')) return 'image';
  if (div.querySelector('span[data-icon="audio-play"]') || div.querySelector('span[data-testid="ptt-play"]') || div.querySelector('audio')) return 'voice';
  if (div.querySelector('div[data-testid="document-thumb"]') || div.querySelector('span[data-icon="document-pdf"]') || div.querySelector('span[data-icon="document"]')) return 'document';
  if (div.querySelector('img[data-testid*="sticker"]') || div.querySelector('div[data-testid="sticker"]')) return 'sticker';
  if (div.querySelector('div[data-testid="poll-creation"]') || div.querySelector('span[data-icon="poll"]')) return 'poll';
  return 'text';
};

// Helper: Extract quoted/reply-to message
const extractReplyContext = (div) => {
  const quotedEl = div.querySelector('div[data-testid="quoted-message"]') ||
                   div.querySelector('div.quoted-mention') ||
                   div.querySelector('div[class*="quoted"]');
  if (!quotedEl) return null;
  const quotedText = quotedEl.querySelector('span.selectable-text')?.innerText?.trim() ||
                     quotedEl.innerText?.trim();
  const quotedSender = quotedEl.querySelector('span[class*="author"]')?.innerText?.trim() || null;
  return quotedText ? { sender: quotedSender, text: quotedText } : null;
};

// Core function to extract rich chat data
const getChatContext = () => {
  const mainChat = document.getElementById('main');
  if (!mainChat) return null;

  // Contact name: from header span with title attribute
  const contactNameEl = mainChat.querySelector('header span[title]');
  const contactName = contactNameEl ? contactNameEl.getAttribute('title') : "Unknown Contact";

  // --- STRATEGY 1: message bubbles via data-id (most reliable) ---
  let extractedMessages = [];
  const messageDivs = mainChat.querySelectorAll('div[data-id]');

  if (messageDivs.length > 0) {
    let prevTimestamp = null;
    messageDivs.forEach(div => {
      const dataId = div.getAttribute('data-id') || '';

      // ==========================================================
      // DIRECTION DETECTION — multi-layer approach
      //
      // WhatsApp Web renders outgoing (YOUR) messages with the class
      // "message-out" somewhere in the bubble's DOM tree.
      // Incoming messages (from contact) use "message-in" or have no such class.
      //
      // We check from most-reliable to least-reliable:
      //   1. Does THIS div or any CHILD contain class *message-out*?
      //   2. Does any PARENT of this div contain class *message-out*?
      //   3. data-id prefix: "false_" = outgoing (You), "true_" = incoming
      //      NOTE: "false" means fromMe=false relative to the DB side,
      //      but in practice WhatsApp Web uses false_ for YOUR sent msgs.
      // ==========================================================
      let isOutgoing = false;

      // Priority 1: check self + descendants
      if (div.classList.contains('message-out') || div.querySelector('[class*="message-out"]')) {
        isOutgoing = true;
      }
      // Priority 2: check ancestors up to #main
      else if (div.closest('[class*="message-out"]')) {
        isOutgoing = true;
      }
      // Priority 3: data-id prefix (false_ = sent by you, true_ = received)
      else if (dataId.startsWith('false_')) {
        isOutgoing = true;
      } else if (dataId.startsWith('true_')) {
        isOutgoing = false;
      }

      // Message type
      const type = detectMessageType(div);

      // Text extraction
      const textSpans = div.querySelectorAll('span.selectable-text');
      let text = Array.from(textSpans).map(s => s.innerText).join(' ').trim();

      // For non-text types, use a descriptive label if no text
      if (!text) {
        const typeLabels = {
          deleted: '[Pesan dihapus]',
          image: '[Gambar]',
          voice: '[Pesan suara]',
          document: '[Dokumen]',
          sticker: '[Sticker]',
          poll: '[Poll]'
        };
        text = typeLabels[type] || '';
      }
      if (!text) return;

      // Timestamp
      const timestamp = decodeTimestampFromId(dataId);
      let delaySeconds = null;
      if (timestamp && prevTimestamp) {
        delaySeconds = Math.round((new Date(timestamp) - new Date(prevTimestamp)) / 1000);
      }
      if (timestamp) prevTimestamp = timestamp;

      // Reply-thread context
      const replyTo = extractReplyContext(div);

      const sender = isOutgoing ? 'You' : contactName;
      console.log(`[WA Copilot] msg: "${text.slice(0,30)}" | dataId: ${dataId.slice(0,20)} | isOutgoing: ${isOutgoing} | sender: ${sender}`);
      extractedMessages.push({ sender, text, type, timestamp, delaySeconds, replyTo });
    });
  }


  // --- STRATEGY 2: fallback via data-pre-plain-text ---
  if (extractedMessages.length === 0) {
    const copyables = mainChat.querySelectorAll('[data-pre-plain-text]');
    copyables.forEach(el => {
      const meta = el.getAttribute('data-pre-plain-text') || '';
      const isOutgoing = !!el.closest('.message-out') || meta.includes('You');
      const textSpan = el.querySelector('span.selectable-text') || el.querySelector('span[class*="selectable"]');
      const text = textSpan ? textSpan.innerText.trim() : el.innerText.trim();
      if (!text) return;
      extractedMessages.push({ sender: isOutgoing ? 'You' : contactName, text, type: 'text' });
    });
  }

  // --- STRATEGY 3: broadest fallback ---
  if (extractedMessages.length === 0) {
    const allTextSpans = mainChat.querySelectorAll('span.selectable-text');
    allTextSpans.forEach(span => {
      const text = span.innerText.trim();
      if (!text || text.length < 1) return;
      const isOutgoing = !!span.closest('.message-out');
      extractedMessages.push({ sender: isOutgoing ? 'You' : contactName, text, type: 'text' });
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
