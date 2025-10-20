/**
 * Cloudflare AI Chat Worker with DLP Custom Response (Stable)
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

    // 🔹 Panggil model dengan AI Gateway
    const aiResponse = await env.AI.run(
      MODEL_ID,
      {
        gateway: {
          id: "aldy-llm", // pastikan sama dengan ID di AI Gateway
        },
      },
    );

    // 🔹 Clone respons untuk analisis error (tanpa merusak stream utama)
    const cloned = aiResponse.clone();
    const text = await cloned.text();

    // 🔍 Deteksi pesan error DLP atau gateway default error
    if (
      text.includes("policy") ||
      text.includes("blocked") ||
      text.includes("sensitive") ||
      text.includes("Sorry, there was a problem processing your request")
    ) {
      console.warn("[DLP] Request diblokir oleh Data Loss Prevention policy.");
      return new Response(
        JSON.stringify({
          response: "🚫 Request anda diblokir oleh DLP.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ✅ Kalau tidak ada DLP error, kirim response original (stream tetap utuh)
    return aiResponse;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan pada server." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
