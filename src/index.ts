export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve static assets
    if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Hello World!", { status: 200 });
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    // Chat API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChatRequest(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct";
const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant. Provide concise and accurate responses.";

async function handleChatRequest(request, env) {
  try {
    const { messages = [] } = await request.json();

    if (!messages.some((m) => m.role === "system")) {
      messages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const aiResponse = await env.AI.run(MODEL_ID, {
      messages,
      max_tokens: 2048,
      options: {
        gateway_id: "aldy-llm",
        cache_ttl: 3600,
        raw: true,
      },
    });

    if (!aiResponse.ok) {
      let errorBody;
      try {
        errorBody = await aiResponse.clone().json();
      } catch {
        errorBody = await aiResponse.text();
      }

      console.error("AI Gateway Error:", aiResponse.status, errorBody);

      const errMsg = JSON.stringify(errorBody);
      if (
        aiResponse.status >= 400 &&
        aiResponse.status < 500 &&
        (errMsg.includes("Guardrail") ||
          errMsg.includes("blocked") ||
          errMsg.includes("Policy"))
      ) {
        console.warn("[AI-Gateway][DLP] Sensitive data blocked by policy.");
        return Response.json(
          {
            response:
              "🚫 Pesan Anda diblokir. Terdeteksi adanya pelanggaran kebijakan Data Loss Prevention (DLP).",
            error_code: "DLP_BLOCKED",
            gateway_status: aiResponse.status,
          },
          { status: 403 },
        );
      }
    }

    return aiResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Chat error:", message);

    if (message.includes("Guardrail") || message.includes("Policy")) {
      return Response.json(
        {
          response:
            "🚫 Pesan Anda diblokir. Terdeteksi adanya pelanggaran kebijakan Data Loss Prevention (DLP).",
          error_code: "DLP_BLOCKED",
        },
        { status: 403 },
      );
    }

    return Response.json(
      { error: "Gagal memproses permintaan LLM: Error internal" },
      { status: 500 },
    );
  }
}