/**
 * This function handles POST requests to /api/generate_story
 * It expects a JSON body with "prompt" and an optional "token"
 * It returns the structured JSON response from the Gemini API
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end(`Method ${request.method} Not Allowed`);
    }

    try {
        // Now expecting 'prompt' and 'key' from the request body
        const { prompt, token: clientApiKey } = request.body;

        if (!prompt) {
            return response.status(400).json({ error: 'Request body must contain a "prompt".' });
        }

        // Use the client-provided API key, or fall back to the environment variable.
        const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.error('GEMINI_API_KEY is not set in environment variables or provided by the client.');
            return response.status(400).json({ error: 'Server configuration error: API key is missing. Please provide a key.' });
        }

        const model = "gemini-2.5-flash"
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
            return response.status(geminiResponse.status).json({ error: responseData.error?.message || 'Failed to generate story.' });
        }

        const jsonText = responseData.candidates[0].content.parts[0].text;
        const resultJson = JSON.parse(jsonText);

        response.status(200).json(resultJson);

    } catch (error) {
        console.error('Error in generate_story handler:', error);
        response.status(500).json({ error: error.message || 'An internal server error occurred.' });
    }
}


const STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "world_info": {
            "type": "string",
            "description": "General information about the story's world, setting, lore, key mechanics, and any crucial context for an AI to understand the narrative. This should be comprehensive enough to set the stage for the entire story. (around 300 words)"
        },
        "past": {
            "type": "string",
            "description": "Extract key information from old past and add RECENT_PAST. (around 500 words)"
        },
        "characters": {
            "type": "array",
            "description": "For each character there should be info (at least 10 characters)",
            "items": {
                "type": "string",
                "description": "A depiction of how a character looks, behaives. Mention colors, race, species, gender, apparent age, build/physique, shapes, positions, poses, clothes, hair style, hair color, skin color, eye color, footwear type, objects/weapons, accessories, distinguishing marks/features, expressions, lighting, texture, condition of cloth, overall vibe, and specific stylistic elements (around 150 words)."
            }
        },
        "events": {
            "type": "array",
            "description": "A sequence of panels that tell a story, similar to a comic strip. (Aim for around 20 events)",        
            "items": {
                "type": "object",
                "properties": {
                    "caption": {
                        "type": "string",
                        "description": "A short narrative text for the panel, like a narrator's box or a character's thought bubble. (Aim for around 30 words)"
                    },
                    "depiction": {
                        "type": "string",
                        "description": "USE ENGLISH! Create a highly detailed, prompt for a text-to-image AI to generate illustrations. Your goal is a hyper-realistic art style. Include the following if applicable: Amount of people, their cloth, hair color, cloth color, age, gender, eyes color, foot wear, scars, Buiding count, buildings style, buildings positioning, building colors, how light falls, weather, day time, textures, auras, brightness of the scene, camera settings, composition, atmosphere. (Aim for around 150 words)"
                    }
                },
                "required": [
                    "caption",
                    "depiction"
                ]
            }
        }
    },
    "propertyOrdering": [
        "world_info",
        "past",
        "characters",
        "events"
    ],
    "required": [
        "world_info",
        "past",
        "characters",
        "events"
    ]
};
