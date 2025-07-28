/**
 * This function handles POST requests to /api/generate_image
 * It expects a JSON body with a single "depiction": { "depiction": "a cat" }
 * It returns a JSON object with a single compressed, base64 encoded "image".
 */
import sharp from 'sharp';

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }

    try {
        const { depiction } = request.body;

        if (!depiction || typeof depiction !== 'string') {
            return response.status(400).json({ error: 'Request body must be an object with a "depiction" string.' });
        }

        const apiKey = process.env.TENSOR_OPERA_API_KEY;
        if (!apiKey) {
            console.error('TENSOR_OPERA_API_KEY is not set in environment variables.');
            return response.status(500).json({ error: 'Server configuration error.' });
        }

        // --- Step 1: Fetch the image from the external API ---
        const tensorOperaApiUrl = "https://open.tensoropera.ai/inference/api/v1/text2Image";
        const requestBody = {
            "prompt": depiction,
            "model": "Flux/Dev",
            "width": 512,
            "height": 512,
            "steps": 15,
            "guidance_scale": 2,
        };

        const apiResponse = await fetch(tensorOperaApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        const data = await apiResponse.json();

        if (!apiResponse.ok || data.code !== "SUCCESS" || !data.data?.b64_json) {
            console.error('TensorOpera API Error:', data);
            throw new Error(`Failed to generate image for prompt: "${depiction}"`);
        }

        const originalBase64 = data.data.b64_json;

        // --- Step 2: Decode, Compress, and Re-encode the image ---
        
        // Convert the base64 string to a raw image buffer
        const imageBuffer = Buffer.from(originalBase64, 'base64');

        // Use sharp to compress the image.
        // - .jpeg() converts the image to JPEG format.
        // - quality: 75 is a great balance between size and visual quality.
        // - mozjpeg: true uses an advanced encoder for even better compression.
        const compressedImageBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 75, mozjpeg: true })
            .toBuffer();

        // Convert the newly compressed buffer back into a base64 string
        const compressedBase64 = compressedImageBuffer.toString('base64');

        // --- Step 3: Send the compressed image back to the client ---
        console.log(`Compressed ${originalBase64.length}->${compressedBase64.length}`);
        response.status(200).json({ image: compressedBase64 });

    } catch (error) {
        console.error('Error in generate_image handler:', error.message);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}