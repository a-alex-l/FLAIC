/**
 * Generates an image using the TensorOpera API.
 * @param {string} apiKey
 * @param {string} model - The specific model to use (e.g., "Flux/Dev").
 * @param {string} prompt - The text prompt for the image.
 * @param {string} width
 * @param {string} hight
 * @param {string} steps
 * @param {string} guidance
 * @returns {Promise<string>} A promise that resolves to the raw base64 encoded image string.
 * @throws {Error} If the API call fails or the API key is missing.
 */
export async function generateTensorOperaImage(apiKey, 
            model, prompt, width, hight, steps, guidance) {

    if (typeof process !== 'undefined' && apiKey == process.env.TEST_PASSWORD)
        apiKey = process.env.TENSOR_OPERA_API_KEY;
    if (!apiKey) {
        console.error('TENSOR_OPERA_API_KEY is not set in environment variables.');
        throw new Error('Server configuration error: TensorOpera API key is missing.');
    }

    const tensorOperaApiUrl = "https://open.tensoropera.ai/inference/api/v1/text2Image";
    const requestBody = {
        "prompt": prompt,
        "model": model,
        "width": width,
        "height": hight,
        "steps": steps,
        "guidance_scale": guidance,
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
        throw new Error(`Failed to generate image from TensorOpera for prompt: "${prompt}"`);
    }

    return data.data.b64_json;
}