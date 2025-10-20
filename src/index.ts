/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE) via AI Gateway Binding.
 *
 * @license MIT
 */

// NOTE: Karena template ini bertujuan untuk chat dan streaming,
// kita akan menggunakan model chat.
// Ganti "@cf/meta/llama-3.3-70b-instruct-fp8-fast" dengan model yang valid jika perlu.
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct"; 

// Ganti dengan ID AI Gateway Anda
const AI_GATEWAY_ID = "aldy-llm"; 

const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Tipe sederhana (seharusnya ada di './types' jika Anda menggunakannya)
// type ChatMessage = { role: "system" | "user" | "assistant", content: string };
// type Env = { AI: any }; // Anggap tipe ini ada di env

export default {
	async fetch(request, env, ctx) {
        // ... (Logika POST, ambil messages)

		try {
			// ... (Siapkan array messages)

			// Opsi dan Binding untuk env.AI.run()
			const options = {
				messages,
				max_tokens: 2048,
				// Hapus 'stream: true'
			};

			// Panggil env.AI.run()
			const response = await env.AI.run(
				MODEL_ID,
				options,
				{
					gateway: { id: AI_GATEWAY_ID }, 
				}
			);
			
            // Karena NON-STREAMING, respon adalah JSON yang berisi properti 'response'
			const modelResponseText = response.response;

			return new Response(JSON.stringify({ 
                response: modelResponseText 
            }), {
				headers: { 'Content-Type': 'application/json' },
			});

		} catch (e) {
			console.error("Error running AI model:", e);
			return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
		}
	},
};
