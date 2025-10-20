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
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		try {
			const { messages: history } = await request.json();
			
			// Siapkan array messages untuk model
			// Jika history kosong atau tidak valid, gunakan prompt default
			const userMessages = Array.isArray(history) ? history : [
				{ role: "user", content: "Jelaskan Cloudflare Workers dalam satu kalimat." }
			];

			// Tambahkan SYSTEM_PROMPT di awal array messages
			const messages = [
				{ role: "system", content: SYSTEM_PROMPT },
				...userMessages
			];

			// Opsi dan Binding untuk env.AI.run()
			const options = {
				messages,
				max_tokens: 2048,
				stream: true, // WAJIB untuk streaming
			};

			// Panggil env.AI.run() dengan konfigurasi AI Gateway
			const response = await env.AI.run(
				MODEL_ID,
				options,
				{
					// Konfigurasi AI Gateway
					gateway: {
						id: AI_GATEWAY_ID, // ID Gateway AI Anda
					},
				}
			);
			
			// Jika Workers AI mengembalikan Response object,
			// kita langsung mengembalikannya (karena kita set stream: true)
			if (response instanceof Response) {
				return new Response(response.body, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						"Connection": "keep-alive",
					},
				});
			}

			// Penanganan jika response tidak berupa stream Response (misalnya, jika stream: false)
			// Ini biasanya tidak terjadi jika stream: true berhasil.
			const modelResponseText = response.response;
			return new Response(JSON.stringify({ response: modelResponseText }), {
				headers: { 'Content-Type': 'application/json' },
			});

		} catch (e) {
			console.error("Error running AI model:", e);
			return new Response(`Internal Server Error: ${e.message}`, { status: 500 });
		}
	},
};
