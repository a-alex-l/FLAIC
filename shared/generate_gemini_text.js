import { STORY_SCHEMA } from './schemas.js';

const SAFETY_SETTINGS = [
    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
];

function getApiKey(apiKey) {
    if (typeof process !== 'undefined' && (apiKey == "" || apiKey == process.env.TEST_PASSWORD))
        return process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('GEMINI_API_KEY is not set or provided by the client.');
        throw new Error('Server configuration error: Gemini API key is missing.');
    }
    return apiKey;
}


export async function generateGeminiText(apiKey, model, prompt) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getApiKey(apiKey)}`;
    const requestBody = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": { "response_mime_type": "application/json" },
        "safetySettings": SAFETY_SETTINGS
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

    console.log(responseData);
    console.log(responseData.candidates[0].content.parts);
    const jsonText = responseData.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
}

export async function generateGeminiJson(apiKey, model, prompt) {
    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${getApiKey(apiKey)}`;
    const requestBody = {
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": { "response_mime_type": "application/json", "response_schema": STORY_SCHEMA },
        "safetySettings": SAFETY_SETTINGS
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

    console.log(responseData);
    console.log(responseData.candidates[0].content.parts);
    const jsonText = responseData.candidates[0].content.parts[0].text;
    return JSON.parse(jsonText);
}
