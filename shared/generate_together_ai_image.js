/**
 * Generates an image using the TensorOpera API.
 * @param {string} apiKey
 * @param {string} model - The specific model to use (e.g., "Flux/Dev").
 * @param {string} prompt - The text prompt for the image.
 * @param {string} width
 * @param {string} hight
 * @param {string} steps
 * @param {string} guidance
 * @returns {Promise<string>} A promise that resolves to image url.
 * @throws {Error} If the API call fails or the API key is missing.
 */
export async function generateTogetherAIImageUrl(apiKey, 
            model, prompt, width, hight, steps, guidance) {

    if (typeof process !== 'undefined' && apiKey == process.env.TEST_PASSWORD)
        apiKey = process.env.TOGETHER_AI_API_KEY;
    if (!apiKey) {
        console.warn('TOGETHER_AI_API_KEY is not set in environment variables.');
        throw new Error('Server configuration error: Together AI API key is missing.');
    }
    const apiUrl = "https://api.together.xyz/v1/images/generations";

    const requestBody = {
        model: model,
        prompt: prompt,
        width: width,
        height: hight,
        steps: steps,
        n: 1 // image count
    };

    const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    const json = await apiResponse.json();

    if (!apiResponse.ok) {
        console.error('Together.ai API Error:', json);
        throw new Error(`Failed to generate image. Status: ${apiResponse.status}. Message: ${json.error?.message || 'Unknown error'}`);
    }

    console.log(json.data[0].url);
    return json.data[0].url;
}

/**
 * Helper function to download an image from a URL and convert it to a base64 string.
 * This is for a Node.js environment.
 * @param {string} url - The URL of the image to download.
 * @returns {Promise<string>} A promise that resolves to the base64 encoded image string.
 * @throws {Error} If the download fails.
 */


export async function downloadImageAsBase64(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to download image. Status: ${response.status} ${response.statusText}`);
        }
        // Get the image data as an ArrayBuffer
        const imageBuffer = await response.arrayBuffer();
        // Convert the ArrayBuffer to a base64 string using Node.js Buffer
        return Buffer.from(imageBuffer).toString('base64');
    } catch (error) {
        console.error(`Error downloading from ${url}:`, error);
        throw error; // Re-throw the error to be caught by the main function
    }
}

/**
 * Main Function: Combines URL generation and download into a single step.
 * It returns the final raw base64 string.
 */
export async function generateTogetherAIImage(apiKey, 
            model, prompt, width, hight, steps, guidance) {
    const url = await generateTogetherAIImageUrl(apiKey, 
            model, prompt, width, hight, steps, guidance);
    return await downloadImageAsBase64(url);
}
