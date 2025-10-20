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
    async fetch(request, env, ctx) {
        // Ambil prompt dari request body (contoh sederhana)
        const requestBody = await request.json();
        const userPrompt = requestBody.prompt || "Jelaskan Cloudflare Workers dalam satu kalimat.";

        try {
            // Panggil env.AI.run() dan sertakan objek 'gateway'
            // Ganti "my-ai-gateway" dengan ID Gateway AI Anda
            const response = await env.AI.run(
                MODEL_ID, // Model Workers AI yang Anda gunakan
				    {
						messages,
						max_tokens: 2048,
					},
                {
                    prompt: userPrompt,
                },
                {
                    // Konfigurasi AI Gateway
                    gateway: {
                        id: "my-ai-gateway", // Ganti dengan ID AI Gateway Anda
                    },
                }
            );

            // Respon dari model (biasanya berisi properti 'response')
            const modelResponseText = response.response;

            return new Response(JSON.stringify({
                prompt: userPrompt,
                response: modelResponseText
            }), {
                headers: { 'Content-Type': 'application/json' },
            });

        } catch (e) {
            return new Response(`Error: ${e.message}`, { status: 500 });
        }
    }
}; satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  try {
    // Parse JSON request body
    const { messages = [] } = (await request.json()) as {
      messages: ChatMessage[];
    };

    // Add system prompt if not present
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const response = await env.AI.run(
      MODEL_ID,
      {
        messages,
        max_tokens: 1024,
      },
      {
        returnRawResponse: true,
        // Uncomment to use AI Gateway
        // gateway: {
        //   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
        //   skipCache: false,      // Set to true to bypass cache
        //   cacheTtl: 3600,        // Cache time-to-live in seconds
        // },
      },
    );

    // Return streaming response
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
