import { generateGeminiText } from './shared/generate_gemini_text.js';

import { generateTensorOperaImage } from './shared/generate_tensoropera_image.js';
import { generateTogetherAIImage, downloadImageAsBase64 } from './shared/generate_together_ai_image.js';
import { generateGeminiImage } from './shared/generate_gemini_image.js';


// --- CONSTANTS ---
const IMAGE_HORIZON = 3;
const TEXT_HORIZON = 5;

// --- APPLICATION STATE ---
let isGenerating = false; // A lock to prevent simultaneous API calls
let compressedEventIndex = 0; // Index of the event currently being displayed
export let storyData = null; // Will hold the entire story object { world_info, characters, story_beats, ... }
export let base64Images = {}; // Array to store generated images, can have empty slots
export let currentEventIndex = -1; // Index of the event currently being displayed


/**
 * Generates and displays the next event in the story sequence.
 */
export async function generateNextStep(textService, textModel, textApiKey,
            imageService, imageModel, imageApiKey, prompt, style) {
    if (currentEventIndex >= 0) {
        if (prompt !== storyData.story_beats[currentEventIndex].caption) {
            console.log(`Caption for event ${currentEventIndex} changed. Branching story from this point.`);
            storyData.story_beats.splice(currentEventIndex + 1);
        }
        storyData.story_beats[currentEventIndex].caption = prompt;
    }
    currentEventIndex++;
    if (!storyData || !storyData.story_beats[currentEventIndex]) {
        console.log("No event found at index, attempting to fetch more story...");
        try {
        await checkAndFetchStoryContinuation(textService, textModel, textApiKey,
                imageService, imageModel, imageApiKey, prompt, style);
        } finally {
            if (!storyData || !storyData.story_beats[currentEventIndex]) {
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
        const storySoFar = { ...storyData, story_plan: "",
            premise: "", current_chapter_synopsis: "",
            current_scene_idea: "", story_beats: [] };
        
        const recentEvents = storyData.story_beats.slice(compressedEventIndex, storyData.story_beats.length);
        compressedEventIndex = storyData.story_beats.length;
        const eventData = recentEvents.map(e => e.caption).join('\n');
        storySoFar.past += eventData;

        return "As a creative writer, your task is to write the next part of the story" +
               " in a series of small, sequential, and highly detailed steps." +
               " Imagine you are writing a screenplay or a comic book script" +
               " where every single action, reaction, and line of dialogue needs to be captured." +
               " It is crucial that these new story_beats logically and immediately follow the 'past'." +
               " Full Story So Far:\n" + JSON.stringify(storySoFar) + "\n\n" +
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
    if (!storyData || storyData.story_beats.length - currentEventIndex <= TEXT_HORIZON) {
        console.log("Requesting story update.");
        const prompt = CollectPrompt(userPrompt);
        let newStoryPart;
        try {
            if (textService === "Google AI Studio") {
                newStoryPart = await generateGeminiText(textApiKey, textModel, prompt);
            } else {
                console.error('Somehow got unexisting Text Provider.');
                throw new Error('Somehow got unexisting Text Provider.');
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
            storyData.story_beats.push(...newStoryPart.story_beats);
            storyData.past = newStoryPart.past;
            storyData.story_plan = newStoryPart.story_plan;
            storyData.premise = newStoryPart.premise;
            storyData.current_chapter_synopsis = newStoryPart.current_chapter_synopsis;
            storyData.current_scene_idea = newStoryPart.current_scene_idea;
            storyData.characters = newStoryPart.characters;
            storyData.world_info = newStoryPart.world_info;
        } else {
            storyData = newStoryPart;
        }
        console.log(`Added ${newStoryPart.story_beats.length} new events. Total events: ${storyData.story_beats.length}`);
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
            confirm.error(`Unexpected image json: ${json}`);
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
    const endIndex = Math.min(storyData.story_beats.length, currentEventIndex + IMAGE_HORIZON);

    for (let i = currentEventIndex; i < endIndex; i++) {
        const depiction = storyData.story_beats[i].depiction;
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