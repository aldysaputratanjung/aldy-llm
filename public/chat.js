// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// State
let chatHistory = [
  {
    role: "assistant",
    content:
      "Hello! 👋 I'm your Cloudflare AI assistant. How can I help you today?",
  },
];
let isProcessing = false;

// Auto resize textarea
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

// Handle Enter key
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Send button click
sendButton.addEventListener("click", sendMessage);

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message || isProcessing) return;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // 1. Tambahkan pesan user ke UI
  addMessageToChat("user", message);
  userInput.value = "";
  userInput.style.height = "auto";
  typingIndicator.classList.add("visible");
  chatHistory.push({ role: "user", content: message });

  try {
    // 2. Siapkan elemen pesan asisten kosong
    const assistantMessageEl = document.createElement("div");
    assistantMessageEl.className = "message assistant-message";
    // Tidak perlu innerHTML = "<p></p>", kita akan langsung mengisi textContent
    assistantMessageEl.textContent = ""; 
    chatMessages.appendChild(assistantMessageEl);
    scrollToBottom();

    // 3. Panggil Worker API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory }),
    });

    if (!response.ok) throw new Error("Failed to get response");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "";
    let buffer = ""; // Buffer untuk menangani chunk yang terpotong

    // 4. Proses Stream (Perbaikan SSE ada di sini)
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk; // Tambahkan data baru ke buffer

      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // Ambil baris terakhir (mungkin terpotong) ke buffer

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const data = line.substring(5).trim(); // Hapus awalan "data:"
          
          if (data === "[DONE]") {
            break; // Selesai
          }

          try {
            const json = JSON.parse(data);
            
            // Model Workers AI non-streaming/streaming memiliki properti 'response' atau 'content'
            // Kita gunakan 'content' yang ada di log Anda, atau fallback ke 'response'
            const content = json.response || (json.choices && json.choices[0] && json.choices[0].message.content);
            
            if (content) {
              responseText += content;
              assistantMessageEl.textContent = responseText;
              scrollToBottom();
            }
          } catch (e) {
            // Abaikan baris yang bukan JSON valid
          }
        }
      }
    }
    
    // 5. Finalisasi dan update history
    chatHistory.push({ role: "assistant", content: responseText });
  } catch (err) {
    console.error("Error:", err);
    addMessageToChat("assistant", "⚠️ Sorry, there was a problem processing your request. Check your Worker logs.");
  } finally {
    // 6. Cleanup
    typingIndicator.classList.remove("visible");
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

function addMessageToChat(role, content) {
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}-message`;
  messageEl.textContent = content;
  chatMessages.appendChild(messageEl);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
