/**
 * LLM Chat Application Template with DLP Handling
 *
 * This Worker handles chat requests through Cloudflare Workers AI + AI Gateway
 * with DLP (Data Loss Prevention) detection enabled.
 */

// Asumsi tipe dasar untuk Worker
// Jika Anda menggunakan TypeScript, pastikan file ini adalah index.ts dan Anda memiliki file types.ts
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
      // Pastikan ASSETS tersedia atau ubah logika jika tidak menggunakan Cloudflare Pages/Assets
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
 * Ini adalah fungsi yang diperbaiki.
 */
async function handleChatRequest(request: Request, env: Env): Promise<Response> {
  try {
    const { messages = [] } = (await request.json()) as { messages: ChatMessage[] };

    // Tambahkan system prompt jika belum ada
    if (!messages.some((msg) => msg.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    // 1. Jalankan AI model via AI Gateway
    // Jika DLP memblokir permintaan (Request) atau respons (Response), 
    // baris kode ini akan melempar (throw) error.
    const aiResponse = await env.AI.run(
      MODEL_ID,
      { messages, max_tokens: 1024 },
      {
        returnRawResponse: true,
        gateway: {
          id: "aldy-llm", // Pastikan ini sama persis dengan Gateway ID di dashboard
          cacheTtl: 3600,
        },
      },
    );

    // 2. Jika tidak ada DLP issue dan model berhasil dipanggil
    return aiResponse;

  } catch (error) {
    // 3. Blok Catch: Menangkap error, termasuk error pemblokiran DLP/Guardrail
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error processing chat request:", errorMessage);

    // Deteksi jika error disebabkan oleh pemblokiran oleh AI Gateway
    // Pesan error dari AI Gateway biasanya akan berisi kata kunci seperti "Guardrail" atau "blocked"
    if (errorMessage.includes("Guardrail") || errorMessage.includes("blocked") || errorMessage.includes("Policy")) {
        console.warn("[DLP] Sensitive data detected and blocked by policy.");
        return new Response(
            JSON.stringify({
                response: "🚫 Pesan Anda diblokir. Terdeteksi adanya pelanggaran kebijakan Data Loss Prevention (DLP) pada Request atau Response.",
                error_code: "DLP_BLOCKED",
            }),
            {
                status: 403, // Status 403 Forbidden lebih sesuai untuk pemblokiran keamanan
                headers: { "Content-Type": "application/json" },
            },
        );
    }
    
    // Default error handling untuk error lainnya
    return new Response(
      JSON.stringify({ error: "Gagal memproses permintaan LLM: Error internal" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}