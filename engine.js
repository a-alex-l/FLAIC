import { generateGeminiText } from './shared/generate_gemini_text.js';

import { generateTensorOperaImage } from './shared/generate_tensoropera_image.js';
import { generateGeminiImage } from './shared/generate_gemini_image.js';


// --- CONSTANTS ---
const IMAGE_HORIZON = 3;
const TEXT_HORIZON = 5;

// --- APPLICATION STATE ---
let isGenerating = false; // A lock to prevent simultaneous API calls
let compressedEventIndex = 0; // Index of the event currently being displayed
export let storyData = null; // Will hold the entire story object { world_info, characters, events, ... }
export let base64Images = {}; // Array to store generated images, can have empty slots
export let currentEventIndex = -1; // Index of the event currently being displayed


/**
 * Generates and displays the next event in the story sequence.
 */
export async function generateNextStep(textService, textModel, textApiKey,
            imageService, imageModel, imageApiKey, prompt, style) {
    if (currentEventIndex >= 0) {
        if (prompt !== storyData.events[currentEventIndex].caption) {
            console.log(`Caption for event ${currentEventIndex} changed. Branching story from this point.`);
            storyData.events.splice(currentEventIndex + 1);
        }
        storyData.events[currentEventIndex].caption = prompt;
    }
    currentEventIndex++;
    if (!storyData || !storyData.events[currentEventIndex]) {
        console.log("No event found at index, attempting to fetch more story...");
        try {
        await checkAndFetchStoryContinuation(textService, textModel, textApiKey,
                imageService, imageModel, imageApiKey, prompt, style);
        } finally {
            if (!storyData || !storyData.events[currentEventIndex]) {
                currentEventIndex = -1;
                storyData = null;
                console.error("Failed to display panel: No event available even after fetch attempt.");
                throw new Error("Sorry, AI did not generate any events for the story.");
            }
        }
    }
    checkAndFetchStoryContinuation(textService, textModel, textApiKey,
        imageService, imageModel, imageApiKey, prompt, style).catch(console.error);
    checkAndFetchImages(imageService, imageModel, imageApiKey, style).catch(console.error);
}

function CollectPrompt(prompt) {
    if (storyData) {
    const storySoFar = { ...storyData, events: [] };
        
        const recentEvents = storyData.events.slice(compressedEventIndex, storyData.events.length);
        compressedEventIndex = storyData.events.length;
        const eventData = recentEvents.map(e => e.caption).join('\n');

        return "As a creative writer, your task is to write the next part of the story" +
               " in a series of small, sequential, and highly detailed steps." +
               " Imagine you are writing a screenplay or a comic book script" +
               " where every single action, reaction, and line of dialogue needs to be captured." +
               " It is crucial that these new events logically and immediately follow the 'RECENT_PAST'." +
               " Full Story So Far:\n" + JSON.stringify(storySoFar) + "\n\n" +
               " Events that just happened (aka RECENT_PAST):\n" + eventData + "\n\n" +
               " Now, write a detailed description of the immediate aftermath or the very next event that occurs.";
        
    } else {
        return "Generate a story world and character descriptions based on the following setting. " +
               "The world should include key locations, history, and culture. " +
               "Generate 3 distinct characters with physical descriptions. " +
               "There is no past yet so keep it empty. " +
               "Setting: " +  prompt;
    }
}

/**
 * Checks if more story events are needed and fetches them.
 * Triggered if fewer than TEXT_HORIZON events are left in the queue.
 */
async function checkAndFetchStoryContinuation(textService, textModel, textApiKey,
            imageService, imageModel, imageApiKey, userPrompt, style) {
    if (isGenerating)
        return;
    isGenerating = true;
    if (!storyData || storyData.events.length - currentEventIndex <= TEXT_HORIZON) {
        console.log("Requesting story update.");
        const prompt = CollectPrompt(userPrompt);
        
        let newStoryPart;
        try {
            if (textService === "Google AI Studio") {
                newStoryPart = await generateGeminiText(textApiKey, textModel, prompt);
            } else {
                console.error('Somehow got unexisting Provider.');
                throw new Error('Somehow got unexisting Provider.');
            }
        } catch {
            const response = await fetch('/api/generate_story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: textService, apiKey: textApiKey, model: textModel, prompt: prompt })
            });
            
            if (!response.ok) {
                console.error("Failed to fetch story update:", (await response.json()).error);
                isGenerating = false;
                throw new Error('Failed to fetch story update.');
            }
            newStoryPart = await response.json();
        }
        if (storyData) {
            storyData.events.push(...newStoryPart.events);
            storyData.past = newStoryPart.past;
            storyData.characters = newStoryPart.characters;
            storyData.world_info = newStoryPart.world_info;
        } else {
            storyData = newStoryPart;
        }
        console.log(`Added ${newStoryPart.events.length} new events. Total events: ${storyData.events.length}`);
        await checkAndFetchImages(imageService, imageModel, imageApiKey, style).catch(console.error);
    }
    isGenerating = false;
}

/**
 * Checks if more images are needed and fetches them ONE BY ONE.
 * Triggered if the image for an upcoming panel (IMAGE_HORIZON steps ahead) is missing.
 */
async function checkAndFetchImages(imageService, imageModel, imageApiKey, style) {
    const imagePromises = [];
    const endIndex = Math.min(storyData.events.length, currentEventIndex + IMAGE_HORIZON);

    for (let i = currentEventIndex; i < endIndex; i++) {
        const depiction = storyData.events[i].depiction;
        if (!base64Images[depiction]) {
            base64Images[depiction] = "";
            console.log("Requesting image.");
            const prompt = style + depiction;

            const promise = fetch('/api/generate_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: imageService, apiKey: imageApiKey,
                                       model: imageModel, prompt: prompt })
            })
            .then(res => {
                if (!res.ok) {
                    console.error(`Failed to generate image`);
                    base64Images[depiction] != "Failed";
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (data) {
                    console.log("Recieved image.");
                    return { image: data.image, depiction: depiction };
                }
                return null;
            })
            .catch(err => {
                console.error(`Error fetching image:`, err);
                base64Images[depiction] != "Failed";
                return null;
            });
            imagePromises.push(promise);
        }
    }
        
    if (imagePromises.length === 0) return;

    const settledImages = await Promise.all(imagePromises);
    settledImages.forEach(result => {
        if (result) {
            base64Images[result.depiction] = result.image;
        }
    });
}