import { generateTensorOperaImage } from '../shared/generate_tensoropera_image.js';
import { generateGeminiImage } from '../shared/generate_gemini_image.js';
import { generateTogetherAIImage } from '../shared/generate_together_ai_image.js';


/*
 * This function handles POST requests to /api/generate_image
 * It expects a JSON body with "service", "apiKey", and "prompt".
 * Example: { "service": "tensorOpera", "apiKey": "your_api_key": "model_name", "prompt": "a cat" }
 * It returns a JSON object with a single compressed, base64 encoded "image".
 */
import sharp from 'sharp';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }

    try {
        const { service, apiKey, model, prompt } = request.body;
        if (!service || typeof service !== 'string' || !prompt || typeof prompt !== 'string') {
            return response.status(400).json({ error: 'Request body must include "service", "apiKey" and "prompt".' });
        }

        let base64;
        try {
            if (service === "TensorOpera AI") {
                base64 = await generateTensorOperaImage(apiKey, model, prompt, 1024, 1024, 15, 2);
            } else if (service === "together.ai") {
                base64 = await generateTogetherAIImage(apiKey, model, prompt, 1024, 1024, 4, 2);
            } else {
                return response.status(400).json({ error: `Unknown service: "${service}".` });
            }
        } catch {
            console.warn('User API didn`t fit. Using servers quota.');
            base64 = await generateTensorOperaImage(process.env.TEST_PASSWORD, "stabilityai/flux_dev_meme", prompt, 512, 512, 25, 2);
        }

        const imageBuffer = Buffer.from(base64, 'base64');
        const compressedImageBuffer = await sharp(imageBuffer).webp({ quality: 90 }).toBuffer();
        const compressedBase64 = compressedImageBuffer.toString('base64');

        console.log(`Compressed ${base64.length}->${compressedBase64.length}`);
        return response.status(200).json({ image: compressedBase64 });
    } catch (error) {
        console.error('Error in generate_image handler:', error.message);
        return response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}