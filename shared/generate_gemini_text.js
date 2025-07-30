import { STORY_SCHEMA } from '../shared/schema.js';


/**
 * Generates an image using the Gemini API.
 * @param {string} apiKey
 * @param {string} model - The specific model to use (e.g., "Flux/Dev").
 * @param {string} prompt - The text prompt for the image.
 * @returns {json} A json answer.
 * @throws {Error} If the API call fails or the API key is missing.
 */
export async function generateGeminiText(apiKey, model, prompt) {

    if (process && apiKey == process.env.TEST_PASSWORD)
        apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY is not set or provided by the client.');
        throw new Error('Server configuration error: Gemini API key is missing.');
    }

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestBody = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": {
            "response_mime_type": "application/json",
            "response_schema": STORY_SCHEMA
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

    const jsonText = responseData.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
}

