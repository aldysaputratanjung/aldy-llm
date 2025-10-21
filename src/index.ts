/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Default system prompt
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle static assets (frontend)
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    if (url.pathname === "/api/chat") {
      // Handle POST requests for chat
      if (request.method === "POST") {
        return handleChatRequest(request, env);
      }

      // Method not allowed for other request types
      return new Response("Method not allowed", { status: 405 });
    }

    // Handle 404 for unmatched routes
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    // Ambil hanya pesan terakhir dari user
    const latestUserMessage = messages.filter((msg) => msg.role === "user").pop();

    if (!latestUserMessage) {
      return new Response(JSON.stringify({ error: "No user input found" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Bangun ulang konteks minimal agar dianggap 'fresh' oleh AI Gateway
    const newMessages: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      latestUserMessage,
    ];

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages: newMessages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm",
          skipCache: true, // pastikan Gateway tidak menggunakan konteks cache
        },
      },
    );

    return response;
  } catch (error) {
    console.error("Error processing chat request:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
}
