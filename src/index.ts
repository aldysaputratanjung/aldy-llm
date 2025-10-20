/**
 * LLM Chat Application Template with DLP Handling
 *
 * This Worker handles chat requests through Cloudflare Workers AI + AI Gateway
 */

// Asumsi tipe dasar untuk Worker
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type Env = {
  AI: any; // Binding untuk Workers AI / AI Gateway
  ASSETS: { fetch: (request: Request) => Promise<Response> };
};

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
      if (env.ASSETS) {
          return env.ASSETS.fetch(request);
      }
      return new Response("Hello World!", { status: 200 });
    }

    // API endpoint
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;

// --------------------------------------------------------------------------------

/**
 * Handle Chat Request (POST /api/chat)
 * Perbaikan utama: Pengecekan Status Code respons dari AI Gateway.
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    // Tambahkan system prompt
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    // 1. Jalankan AI model via AI Gateway
    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm", // Pastikan ini sama persis
          cacheTtl: 86400,
        },
      },
    );

    // 2. Cek Status Response dari AI Gateway
    // Jika AI Gateway memblokir (DLP), ia mungkin mengembalikan Response 400/403/404,
    // BUKAN selalu melempar exception.
    if (!aiResponse.ok) {
        // Coba baca body response untuk melihat pesan error dari AI Gateway
        const errorBody = await aiResponse.text();
        console.error("AI Gateway responded with error status:", aiResponse.status, errorBody);

        // Jika status adalah 400/403/404, dan body mengindikasikan Guardrail/DLP
        if (aiResponse.status === 400 || aiResponse.status === 403 || aiResponse.status === 404) {
            // Kita asumsikan status 4xx dari AI Gateway di sini disebabkan oleh DLP/Guardrail
            // Karena konfigurasi Anda adalah 'Block'.
            if (errorBody.includes("Guardrail") || errorBody.includes("blocked") || errorBody.includes("Policy")) {
                console.warn("[DLP] Sensitive data detected and blocked by policy (Status Check).");
                return new Response(
                    JSON.stringify({
                        response: "🚫 Pesan Anda diblokir. Terdeteksi adanya pelanggaran kebijakan Data Loss Prevention (DLP).",
                        error_code: "DLP_BLOCKED",
                        gateway_status: aiResponse.status
                    }),
                    {
                        status: 403,
                        headers: { "Content-Type": "application/json" },
                    },
                );
            }
            // Jika error 4xx tapi bukan DLP/Guardrail, lempar sebagai error internal
            throw new Error(`AI Gateway Error (${aiResponse.status}): ${errorBody}`);
        }
    }

    // 3. Jika response OK (Status Code 200)
    return aiResponse;

  } catch (error) {
    // 4. Blok Catch: Menangkap exception murni (jika env.AI.run() melempar daripada mengembalikan Response 4xx)
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing chat request (CATCH):", errorMessage);

    // Deteksi jika exception disebabkan oleh pemblokiran
    if (errorMessage.includes("Guardrail") || errorMessage.includes("blocked") || errorMessage.includes("Policy")) {
        console.warn("[DLP] Sensitive data detected and blocked by policy (Catch Block).");
        return new Response(
            JSON.stringify({
                response: "🚫 Pesan Anda diblokir. Terdeteksi adanya pelanggaran kebijakan Data Loss Prevention (DLP).",
                error_code: "DLP_BLOCKED",
            }),
            {
                status: 403,
                headers: { "Content-Type": "application/json" },
            },
        );
    }
    
    // Default error handling
    return new Response(
      JSON.stringify({ error: "Gagal memproses permintaan LLM: Error internal" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
