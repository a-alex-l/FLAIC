import { generateStart, generateContinuation } from '../shared/generate_text.js';
import { generateTensorOperaImage } from './shared/generate_tensoropera_image.js';
import { generateTogetherAIImage, downloadImageAsBase64 } from './shared/generate_together_ai_image.js';
import { generateGeminiImage } from './shared/generate_gemini_image.js';


// --- CONSTANTS ---
const IMAGE_HORIZON = 3;
const TEXT_HORIZON = 5;

// --- APPLICATION STATE ---
let isGenerating = false; // A lock to prevent simultaneous API calls
export let beats = []; // Will hold the entire story object { story_narative, characters, story_beats, ... }
export let base64Images = {}; // Array to store generated images, can have empty slots
export let currentEventIndex = -1; // Index of the event currently being displayed
let foundation = "";

/**
 * Generates and displays the next event in the story sequence.
 */
export async function generateNextStep(textService, textModel, textApiKey,
            imageService, imageModel, imageApiKey, prompt, style) {
    if (currentEventIndex >= 0) {
        if (prompt !== beats[currentEventIndex].caption) {
            console.log(`Caption for event ${currentEventIndex} changed. Branching story from this point.`);
            beats.splice(currentEventIndex + 1);
            beats[currentEventIndex].caption = prompt;
        }
    }
    currentEventIndex++;
    if (!beats[currentEventIndex]) {
        console.log("No event found at index, attempting to fetch more story...");
        try {
            await checkAndFetchStory(textService, textModel, textApiKey,
                    imageService, imageModel, imageApiKey, prompt, style);
        } finally {
            if (!beats[currentEventIndex]) {
                currentEventIndex = -1;
                beats = [];
                console.error("Failed to display panel: No event available even after fetch attempt.");
                throw new Error("Sorry, AI did not generate any events for the story.");
            }
        }
    }
    checkAndFetchStory(textService, textModel, textApiKey,
        imageService, imageModel, imageApiKey, prompt, style).catch(console.error);
    checkAndFetchImages(imageService, imageModel, imageApiKey, style).catch(console.error);
}


async function checkAndFetchStoryStart(textService, textModel, textApiKey, userInput) {
    let newStoryPart;
    try {
        newStoryPart =  await generateStart(textService, textModel, textApiKey, userInput);
    } catch {
        const response = await fetch('/api/generate_story_start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: textService, apiKey: textApiKey, model: textModel, user_input: userInput })
        });
        if (!response.ok) {
            console.error("Failed to fetch story update:", (await response.json()).error);
            isGenerating = false;
            throw new Error('Failed to fetch story update.');
        }
        newStoryPart = await response.json();
    }
    let localId = 0;
    newStoryPart.story_beats.forEach(beat => {
        beat.story = newStoryPart;
        beat.size = ++localId;
    });
    beats.push(...newStoryPart.story_beats);
    foundation = newStoryPart.foundation;
}


async function checkAndFetchStoryContinuation(textService, textModel, textApiKey) {
    let newStoryPart;
    const recency = Math.min(beats.length, TEXT_HORIZON);
    const recentEvents = beats.slice(-recency);
    const historyEvents = beats.slice(0, -recency);
    const resentStory = recentEvents.map(e => e.caption).join('\n');
    const history = historyEvents.map(e => e.caption).join('\n');
    try {
        newStoryPart =  await generateContinuation(textService, textModel, textApiKey,
                foundation, history, resentStory);
    } catch {
        const response = await fetch('/api/generate_story_continuation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: textService, apiKey: textApiKey, model: textModel,
                foundation: foundation, history: history, resent_story: resentStory })
        });
        if (!response.ok) {
            console.error("Failed to fetch story update:", (await response.json()).error);
            isGenerating = false;
            throw new Error('Failed to fetch story update.');
        }
        newStoryPart = await response.json();
    }
    let localId = 0;
    newStoryPart.story_beats.forEach(beat => {
        beat.story = newStoryPart;
        beat.size = ++localId;
    });
    beats.push(...newStoryPart.story_beats);
}


async function checkAndFetchStory(textService, textModel, textApiKey,
            imageService, imageModel, imageApiKey, userPrompt, style) {
    if (isGenerating)
        return;
    isGenerating = true;
    if (beats.length - currentEventIndex <= TEXT_HORIZON) {
        console.log("Requesting story update.");
        if (beats.length === 0) {
            await checkAndFetchStoryStart(textService, textModel, textApiKey, userPrompt);
        } else {
            await checkAndFetchStoryContinuation(textService, textModel, textApiKey);
        }

        console.log(`Added new events. Total events: ${beats.length}`);
        await checkAndFetchImages(imageService, imageModel, imageApiKey, style).catch(console.error);
    }
    isGenerating = false;
}

async function checkAndFetchImage(depiction, imageService, imageModel, imageApiKey, style) {
    console.log("Requesting image.");
    const prompt = style + depiction;
    
    try {
        if (imageService === "TensorOpera AI") {
            base64Images[depiction] = await generateTensorOperaImage(imageApiKey, imageModel, prompt, 1024, 1024, 15, 2);
        } else if (imageService === "Google AI Studio") {
            base64Images[depiction] = await generateGeminiImage(imageApiKey, imageModel, prompt, 1024, 1024, 15, 2);
        } else if (imageService === "together.ai") {
            throw new Error("Sadly due to CORS Policy needs to go through the server");
            //base64Images[depiction] = await generateTogetherAIImage(imageApiKey, imageModel, prompt, 1024, 1024, 4, 2);
        } else {
            console.error('Somehow got unexisting Image Provider.');
            throw new Error('Somehow got unexisting Image Provider.');
        }
    } catch {
        const response = await fetch('/api/generate_image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: imageService, apiKey: imageApiKey, model: imageModel, prompt: prompt })
        });
        const json = await response.json();
        if (!response.ok) {
            console.error("Failed to fetch image", json.error);
            throw new Error('Failed to fetch image');
        }
        if ('image' in json) {
            base64Images[depiction] = json.image;
        } else if ('url' in json) {
            base64Images[depiction] = downloadImageAsBase64(json.url);
        } else {
            console.error(`Unexpected image json: ${json}`);
            base64Images[depiction] = "Failed";
        }
    }
}

/**
 * Checks if more images are needed and fetches them ONE BY ONE.
 * Triggered if the image for an upcoming panel (IMAGE_HORIZON steps ahead) is missing.
 */
async function checkAndFetchImages(imageService, imageModel, imageApiKey, style) {
    const imagePromises = [];
    const endIndex = Math.min(beats.length, currentEventIndex + IMAGE_HORIZON);

    for (let i = currentEventIndex; i < endIndex; i++) {
        const depiction = beats[i].depiction;
        if (!base64Images[depiction]) {
            base64Images[depiction] = "";
            const promise = checkAndFetchImage(depiction, imageService, imageModel, imageApiKey, style);
            imagePromises.push(promise);
        }
    }
    if (imagePromises.length > 0) {
        try {
            await Promise.all(imagePromises);
            console.log("All requested images have been fetched successfully.");
        } catch (error) {
            console.error("An error occurred while fetching one of the images:", error);
        }
    }
}