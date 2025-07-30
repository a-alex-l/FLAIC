import { generateGeminiText } from '../shared/generate_gemini_text.js';


/*
 * This function handles POST requests to /api/generate_story
 * It expects a JSON body with "service", "apiKey", and "prompt".
 * Example: { "service": "tensorOpera", "apiKey": "your_api_key", "model": "model_name", "prompt": "a cat" }
 * It returns a JSON object.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }
    
    try {
        const { service, apiKey, prompt } = request.body;
        const model = "gemini-2.0-flash-lite";
        if (!service || typeof service !== 'string' || !apiKey || typeof apiKey !== 'string' ||
                    !prompt || typeof prompt !== 'string') {
            return response.status(400).json({ error: 'Request body must include "service", "apiKey" and "prompt".' });
        }

        if (service === "Google AI Studio") {
            response.status(200).json(await generateGeminiText(apiKey, model, prompt));
        } else {
            return response.status(400).json({ error: `Unknown service: "${service}". Supported services are "tensorOpera" and "gemini".` });
        }
    } catch (error) {
        console.error('Error in generate_story handler:', error);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
