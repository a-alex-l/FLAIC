/**
 * Generates an image using the Gemini API.
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
export async function generateGeminiImage(apiKey, 
            model, prompt, width, hight, steps, guidance) {

    if (process && apiKey == process.env.TEST_PASSWORD)
        apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set or provided by the client.');
        throw new Error('Server configuration error: Gemini API key is missing.');
    }

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        "contents": [{ "parts": [{ "text": "Generate an image for prompt:\n" + prompt }] }],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"]
        }
    };

    const geminiResponse = await fetch(geminiApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const responseData = await geminiResponse.json();
    if (!geminiResponse.ok) {
        console.error('Gemini API Error:', responseData);
        throw new Error(responseData.error?.message || 'Failed to generate image from Gemini.');
    }

    const imagePart = responseData.candidates[0]?.content?.parts?.find(part => part.hasOwnProperty('inlineData'));
    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
        console.error('Gemini API Error: inlineData or data property not found in the response part.', responseData);
        throw new Error('Image data not found in Gemini response.');
    }

    return imagePart.inlineData.data;
}