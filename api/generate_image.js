import { generateTensorOperaImage } from '../shared/generate_tensoropera_image.js';
import { generateGeminiImage } from '../shared/generate_gemini_image.js';


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
        const { service, apiKey, prompt } = request.body;
        if (!service || typeof service !== 'string' || !apiKey || typeof apiKey !== 'string' ||
                    !prompt || typeof prompt !== 'string') {
            return response.status(400).json({ error: 'Request body must include "service", "apiKey" and "prompt".' });
        }

        let pngBase64;
        try {
            if (service === "TensorOpera AI") {
                pngBase64 = await generateTensorOperaImage(apiKey, "Flux/Dev", prompt, 256, 256, 10, 2);
            } else {
                return response.status(400).json({ error: `Unknown service: "${service}".` });
            }
        } catch {
            console.log('User API didn`t fit. Using servers quota.');
            pngBase64 = await generateTensorOperaImage(process.env.TEST_PASSWORD, "Flux/Dev", prompt, 256, 256, 20, 2);
        }

        const imageBuffer = Buffer.from(pngBase64, 'base64');
        const compressedImageBuffer = await sharp(imageBuffer).webp({ quality: 90 }).toBuffer();
        const compressedBase64 = compressedImageBuffer.toString('base64');

        console.log(`Compressed ${pngBase64.length}->${compressedBase64.length}`);
        response.status(200).json({ image: compressedBase64 });
    } catch (error) {
        console.error('Error in generate_image handler:', error.message);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}