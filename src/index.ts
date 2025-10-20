/**
 * LLM Chat Application Template with DLP Handling
 *
 * This Worker handles chat requests through Cloudflare Workers AI + AI Gateway
 * with DLP (Data Loss Prevention) detection enabled.
 */

import { Env, ChatMessage } from "./types";

// Model ID untuk Workers AI
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

/**
 * Worker entrypoint
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve static assets
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API endpoint
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handle Chat Request (POST /api/chat)
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    // Tambahkan system prompt jika belum ada
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    // Jalankan AI model via AI Gateway
    const aiResponse = await env.AI.run(
      MODEL_ID,
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm", // Pastikan ini sama persis dengan Gateway ID di dashboard
        },
      },
    );

    // Clone response untuk pengecekan DLP
    const cloned = aiResponse.clone();
    let json: any;
    try {
      json = await cloned.json();
    } catch {
      json = null; // Response bukan JSON (streaming case)
    }

    // ✅ Jika DLP terdeteksi di response JSON
    if (json && json.error && json.error.includes("Sensitive")) {
      console.warn("[DLP] Sensitive data detected — blocked by policy.");
      return new Response(
        JSON.stringify({
          response: "🚫 Message blocked due to DLP policy.",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ✅ Jika tidak ada DLP issue → kirim streaming response normal
    return aiResponse;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
