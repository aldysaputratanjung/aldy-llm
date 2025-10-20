/**
 * LLM Chat Application Template (NON-STREAMING)
 * * Menggunakan AI Gateway Binding yang benar agar fitur Caching, Rate Limiting,
 * dan DLP (Data Loss Prevention) di AI Gateway berfungsi.
 * Fitur streaming (SSE) DINONAKTIFKAN.
 *
 * @license MIT
 */

// Ganti dengan Model Workers AI yang Sesuai dan ada di Gateway Anda
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct"; 

// 🚨 GANTI INI DENGAN ID AI GATEWAY ANDA YANG SEBENARNYA 🚨
const AI_GATEWAY_ID = "aldy-llm"; 

const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

// Hapus import untuk Env dan ChatMessage jika Anda hanya menggunakan JavaScript murni.

export default {
	/**
     * @param {Request} request
     * @param {Env} env
     * @param {ExecutionContext} ctx
     * @returns {Promise<Response>}
     */
	async fetch(request, env, ctx) {
		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		try {
			// Harapkan array 'messages' dari frontend, bukan hanya 'prompt'
			const { messages: history } = await request.json();
			
			// Siapkan array messages untuk model
			let messages = Array.isArray(history) ? history : [];

			// Tambahkan SYSTEM_PROMPT di awal jika belum ada
			if (!messages.some((msg) => msg.role === "system")) {
				messages.unshift({ role: "system", content: SYSTEM_PROMPT });
			}
			
			// Fallback jika tidak ada pesan user
			if (messages.length === 1 && messages[0].role === "system") {
				messages.push({ role: "user", content: "Jelaskan Cloudflare Workers." });
			}

			// Opsi Model (NON-STREAMING)
			const modelOptions = {
				messages,
				max_tokens: 2048,
				// stream: false, // Tidak perlu ditulis karena default-nya sudah false
			};

			// Panggil env.AI.run() dengan 3 ARGUMEN YANG BENAR
			const response = await env.AI.run(
				MODEL_ID, // Argumen 1: Model ID
				modelOptions, // Argumen 2: Opsi Model
				{
					// Argumen 3: Opsi Tambahan (Termasuk konfigurasi AI Gateway)
					gateway: {
						id: AI_GATEWAY_ID, 
					},
				}
			);
			
            // Karena NON-STREAMING, respons adalah objek JSON dengan properti 'response'
			const modelResponseText = response.response;

			return new Response(JSON.stringify({
				// Anda bisa mengembalikan seluruh respons atau hanya teksnya
				response: modelResponseText
			}), {
				headers: { 'Content-Type': 'application/json' },
			});

		} catch (e) {
			console.error("Error processing chat request:", e);
			// Ini akan menangkap error, termasuk jika DLP memblokir permintaan
			return new Response(`AI Gateway/Model Error: ${e.message}`, { status: 500 });
		}
	},
};
