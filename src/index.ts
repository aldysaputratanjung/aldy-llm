// DOM elements
const chatContainer = document.querySelector("#chat-container");
const inputField = document.querySelector("#user-input");
const sendButton = document.querySelector("#send-btn");

let chatHistory = [];

// Append message bubble to chat
function appendMessage(role, content) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", role === "user" ? "user" : "assistant");
  messageEl.textContent = content;
  chatContainer.appendChild(messageEl);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Update the assistant’s streaming message
function updateAssistantMessage(content) {
  let lastMessage = chatContainer.querySelector(".message.assistant:last-child");
  if (!lastMessage) {
    appendMessage("assistant", content);
  } else {
    lastMessage.textContent = content;
  }
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Main send handler
async function sendMessage() {
  const userInput = inputField.value.trim();
  if (!userInput) return;

  appendMessage("user", userInput);
  inputField.value = "";

  chatHistory.push({ role: "user", content: userInput });

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory }),
    });

    const contentType = response.headers.get("content-type") || "";

    // 🟡 Handle DLP or gateway error response
    if (contentType.includes("application/json")) {
      const json = await response.json();
      if (json.error?.length) {
        const errMsg = json.error[0].message || "Unknown AI Gateway error";
        appendMessage("system", `⚠️ ${errMsg}`);
        return;
      }
    }

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantReply = "";

      appendMessage("assistant", ""); // create bubble first

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          assistantReply += chunk;
          updateAssistantMessage(assistantReply);
        }
      }

      chatHistory.push({ role: "assistant", content: assistantReply.trim() });
    } else {
      appendMessage("system", "⚠️ No response received from AI Gateway.");
    }
  } catch (err) {
    console.error("Chat error:", err);
    appendMessage("system", `⚠️ Error: ${err.message}`);
  }
}

// Send on button click
sendButton.addEventListener("click", sendMessage);

// Send on Enter key
inputField.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
