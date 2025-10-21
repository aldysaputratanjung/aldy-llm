/**
 * LLM Chat Application with AI Gateway + DLP
 *
 * This Worker integrates with Cloudflare Workers AI and AI Gateway.
 * It supports DLP scanning and streaming LLM responses.
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

/**
 * Main Worker handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve frontend assets
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // Handle chat API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Chat API handler with DLP support via AI Gateway
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    // Ensure system prompt exists
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    // Call Workers AI model through AI Gateway (with DLP enabled)
    const aiResponse = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
        stream: true,
      },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm", // <-- Ganti dengan Gateway ID milikmu di dashboard AI Gateway
          skipCache: true,
          metadata: { source: "llm-worker", policy: "dlp-enabled" },
        },
      },
    );

    // Stream back the model response (SSE)
    const { readable, writable } = new TransformStream();
    aiResponse.body?.pipeTo(writable);

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("AI Gateway or DLP error:", err);

    return new Response(
      JSON.stringify({
        error: "Failed to process request via AI Gateway.",
        details: err.message || err,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
