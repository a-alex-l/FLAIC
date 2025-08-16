import { generateContinuation } from '../shared/generate_text.js';


export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }
    try {
        const { service, model, apiKey, foundation, history, recent_story } = request.body;
        if (!service || typeof service !== 'string' || !model ||
                !apiKey || !foundation || !history || !recent_story) {
            return response.status(400).json({ error: 'Request body is incorrect.' });
        }
        return response.status(200).json(await generateContinuation(service, model, apiKey, foundation, history, recent_story));
    } catch (error) {
        console.error('Error in generate_story handler:', error);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}
