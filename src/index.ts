/**
 * Cloudflare Workers AI + AI Gateway (DLP Enabled)
 */

import { Env, ChatMessage } from "./types";

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT =
  "You are a helpful assistant. Be concise, safe, and avoid sensitive data exposure.";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages } = (await request.json()) as { messages: ChatMessage[] };

    // Ensure valid chat structure
    const safeMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages.filter((m) => typeof m.content === "string" && m.content.trim() !== ""),
    ];

    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages: safeMessages, max_tokens: 512, stream: true },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm", // Gateway ID kamu
          skipCache: true,
        },
      },
    );

    // Return SSE streaming response
    return new Response(aiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("AI Gateway error:", err);
    return new Response(
      JSON.stringify({
        error: [
          {
            code: 500,
            message: `AI Gateway request failed: ${err.message || err}`,
          },
        ],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
