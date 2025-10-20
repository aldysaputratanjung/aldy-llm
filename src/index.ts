/**
 * LLM Chat Application Template with Custom DLP Response
 */

import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm",
          cacheTtl: 86400,
        },
      },
    );

    // Clone response untuk pengecekan isi JSON (termasuk error DLP)
    const cloned = aiResponse.clone();
    let json: any;
    try {
      json = await cloned.json();
    } catch {
      json = null;
    }

    // 🔍 Jika DLP Gateway menolak konten
    if (json && json.error && /sensitive|blocked|policy/i.test(json.error)) {
      console.warn("[DLP] Sensitive data detected — blocked by policy.");
      return new Response(
        JSON.stringify({
          response: "🚫 Request anda diblokir oleh DLP.",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // 🔍 Jika response Cloudflare default “Sorry there was a problem…”
    const textCheck = await cloned.text();
    if (textCheck.includes("Sorry, there was a problem processing your request")) {
      console.warn("[DLP] Gateway default error detected — blocked by DLP.");
      return new Response(
        JSON.stringify({
          response: "🚫 GAK BOLEH SHARE INFORMASI SENSITIVE BROK",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // ✅ Jika tidak ada DLP issue, kembalikan response normal (streaming)
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
