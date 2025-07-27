/**
 * This function handles POST requests to /api/generate_images
 * It expects a JSON body with a "depictions" array: { "depictions": ["a cat", "a dog"] }
 * It returns a JSON object with an "images" array containing the base64 encoded image data
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }

    try {
        const { depictions } = request.body;

        if (!Array.isArray(depictions) || depictions.length === 0) {
            return response.status(400).json({ error: 'Request body must be an object with a non-empty "descriptions" array.' });
        }

        const apiKey = process.env.TENSOR_OPERA_API_KEY;
        if (!apiKey) {
            console.error('TENSOR_OPERA_API_KEY is not set in environment variables.');
            return response.status(500).json({ error: 'Server configuration error.' });
        }

        // This function makes a single API call to generate an image.
        const fetchImage = async (prompt) => {
            const tensorOperaApiUrl = "https://open.tensoropera.ai/inference/api/v1/text2Image";
            const requestBody = {
                "prompt": prompt,
                "model": "Flux/Dev", // Or other model as needed
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
                throw new Error(`Failed to generate image for prompt: "${prompt}"`);
            }

            return data.data.b64_json;
        };

        // Use Promise.all to run all fetch requests in parallel.
        // This is much faster than running them sequentially.
        const imageResults = await Promise.all(depictions.map(prompt => fetchImage(prompt)));

        // Send the ordered array of base64 images back to the client.
        response.status(200).json({ images: imageResults });

    } catch (error) {
        console.error('Error in generate_images handler:', error.message);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}