import { generateGeminiText } from 'shared/generate_gemini_text.js';

import { generateTensorOperaImage } from 'shared/generate_tensoropera_image.js';
import { generateGeminiImage } from 'shared/generate_gemini_image.js';


// --- DOM ELEMENT REFERENCES ---
const generateButton = document.getElementById('generate-btn');
const comicContainer = document.getElementById('comic-container');
const promptInput = document.getElementById('prompt-input');
const controlsContainer = document.getElementById('controls-container');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const imageStyleInput = document.getElementById('image-style-prompt');

// --- CONSTANTS ---
const IMAGE_HORIZON = 3;
const TEXT_HORIZON = 5;

// --- APPLICATION STATE ---
let storyData = null; // Will hold the entire story object { world_info, characters, events, ... }
let base64Images = {}; // Array to store generated images, can have empty slots
let currentEventIndex = -1; // Index of the event currently being displayed
let isGenerating = false; // A lock to prevent simultaneous API calls
let compressedEventIndex = 0; // Index of the event currently being displayed

// --- EVENT LISTENERS ---
generateButton.addEventListener('click', handleGenerateClick);

/**
 * Main handler for the generate button.
 * It decides whether to start a new story or generate the next event.
 */
async function handleGenerateClick() {
    if (generateButton.disabled)
        return;
    const geminiApiKey = geminiApiKeyInput.value.trim();
    /*if (!geminiApiKey) {
        alert('Please enter your Gemini API Key.');
        return;
    }*/
    const textApiKey = geminiApiKey || "4";
    const imageApiKey = geminiApiKey || "4";

    generateButton.disabled = true;

    try {
        if (!storyData) {
            await startNewStory(textApiKey, imageApiKey);
        } else {
            await generateNextStep(textApiKey, imageApiKey);
        }
    } catch (error) {
        console.error('An error occurred in the main generation flow:', error);
    } finally {
        generateButton.disabled = false;
    }
}

/**
 * STEP 1: Starts a brand new story.
 * Called only on the very first "Start Story" click.
 */
async function startNewStory(textApiKey, imageApiKey) {
    const userPromptText = promptInput.value.trim();
    if (!userPromptText) {
        alert('Please enter a story prompt.');
        throw new Error("Empty prompt.");
    }
    
    const service = "gemini";
    const model = "gemini-2.5-flash";
    comicContainer.innerHTML = '';
    const prompt = "Generate a story world and character descriptions based on the following setting. " +
                 "The world should include key locations, history, and culture. " +
                 "Generate 3 distinct characters with physical descriptions. " +
                 "There is no past yet so keep it empty. " +
                 "Setting: " + userPromptText;

    try {
        let newStoryStart;
        try {
            newStoryStart = await generateGeminiText(textApiKey, model, prompt);
        } catch {
            const response = await fetch('/api/generate_story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: service, apiKey: textApiKey, model: model, prompt: prompt })
            });
            
            if (!response.ok) {
                console.error("Story generation failed:", (await response.json()).error);
                throw new Error(`Story generation failed: ${ (await response.json()).error }`);
            }
            newStoryStart = await response.json();
        }
        const response = await fetch('/api/generate_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ service: service, apiKey: textApiKey, model: model, prompt: initialPrompt, apiKey: textApiKey })
        });
        if (!response.ok) throw new Error(`Story generation failed: ${ (await response.json()).error }`);
        
        newStoryStart = await response.json();
        console.log("Initial story data received:", newStoryStart);

        if (!newStoryStart.events || newStoryStart.events.length === 0) {
            throw new Error("Sorry, AI did not generate any events for the story.");
        }
        
        promptInput.style.display = 'none';
        generateButton.textContent = 'Generate Next Event';
        await checkAndFetchImages(imageApiKey);
        await generateNextStep(textApiKey);

    } catch (error) {
        storyData = null;
        generateButton.textContent = 'Start Story';
        promptInput.style.display = 'block';
        throw error;
    }
}

/**
 * Generates and displays the next event in the story sequence.
 */
async function generateNextStep(textApiKey, imageApiKey) {
    if (currentEventIndex >= 0) {
        const lastPanel = document.getElementById(`panel-${currentEventIndex}`);
        const captionInput = lastPanel.querySelector('.caption-input');
        const finalCaption = captionInput.value;

        if (finalCaption !== storyData.events[currentEventIndex].caption) {
            console.log(`Caption for event ${currentEventIndex} changed. Branching story from this point.`);
            storyData.events.splice(currentEventIndex + 1);
        }
        
        storyData.events[currentEventIndex].caption = finalCaption;

        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = finalCaption;
        captionInput.replaceWith(captionText);
    }
    currentEventIndex++;

    await displayCurrentPanel(textApiKey, imageApiKey);

    checkAndFetchStoryContinuation(textApiKey, imageApiKey).catch(console.error);
    checkAndFetchImages(imageApiKey).catch(console.error);
}

/**
 * Creates and displays the HTML for the current event panel.
 */
async function displayCurrentPanel(textApiKey, imageApiKey) {
    let event = storyData.events[currentEventIndex];
    if (!event) {
        console.log("No event found at index, attempting to fetch more story...");
        await checkAndFetchStoryContinuation(textApiKey, imageApiKey);
        event = storyData.events[currentEventIndex];
        
        if (!event) {
            console.error("Failed to display panel: No event available even after fetch attempt.");
            generateButton.textContent = 'End of Story';
            generateButton.disabled = true;
            return;
        }
    }
    
    const panelElement = document.createElement('div');
    panelElement.className = 'comic-panel';
    panelElement.id = `panel-${currentEventIndex}`;

    const imageElement = document.createElement('img');
    imageElement.id = `image-${currentEventIndex}`;
    imageElement.alt = event.depiction;

    const imageData = base64Images[event.depiction];
    if (imageData && imageData != "") {
        imageElement.src = `data:image/webp;base64,${imageData}`;
    } else {
        imageElement.src = "";
        await waitForImage(event.depiction, currentEventIndex);
    }

    const captionInput = document.createElement('textarea');
    captionInput.className = 'caption-input';
    captionInput.textContent = event.caption;
    captionInput.addEventListener('input', () => autoResizeTextarea(captionInput));

    panelElement.appendChild(imageElement);
    panelElement.appendChild(captionInput);
    comicContainer.appendChild(panelElement);
    autoResizeTextarea(captionInput);

    requestAnimationFrame(() => {
        panelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}

/**
 * Checks if more story events are needed and fetches them.
 * Triggered if fewer than TEXT_HORIZON events are left in the queue.
 */
async function checkAndFetchStoryContinuation(textApiKey, imageApiKey) {
    if (isGenerating)
        return;
    isGenerating = true;
    const service = "gemini";
    const model = "gemini-2.5-flash";
    if (storyData.events.length - currentEventIndex <= TEXT_HORIZON) {
        console.log("Requesting story update.");

        const storySoFar = { ...storyData, events: [] };
        
        const recentEvents = storyData.events.slice(compressedEventIndex, storyData.events.length);
        compressedEventIndex = storyData.events.length;
        const eventData = recentEvents.map(e => e.caption).join('\n');

        const prompt = "As a creative writer, your task is to write the next part of the story" +
                " in a series of small, sequential, and highly detailed steps." +
                " Imagine you are writing a screenplay or a comic book script" +
                " where every single action, reaction, and line of dialogue needs to be captured." +
                " It is crucial that these new events logically and immediately follow the 'RECENT_PAST'." +
                " Full Story So Far:\n" + JSON.stringify(storySoFar) + "\n\n" +
                " Events that just happened (aka RECENT_PAST):\n" + eventData + "\n\n" +
                " Now, write a detailed description of the immediate aftermath or the very next event that occurs.";
        
        let newStoryPart;
        try {
            newStoryPart = await generateGeminiText(textApiKey, model, prompt);
        } catch {
            const response = await fetch('/api/generate_story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: service, apiKey: textApiKey, model: model, prompt: prompt })
            });
            
            if (!response.ok) {
                console.error("Failed to fetch story update:", (await response.json()).error);
                isGenerating = false;
                return;
            }
            newStoryPart = await response.json();
        }
        storyData.events.push(...newStoryPart.events);
        storyData.past = newStoryPart.past;
        storyData.characters = newStoryPart.characters;
        storyData.world_info = newStoryPart.world_info;
        console.log(`Added ${newStoryPart.events.length} new events. Total events: ${storyData.events.length}`);
        await checkAndFetchImages(imageApiKey).catch(console.error);
    }
    isGenerating = false;
}

/**
 * Checks if more images are needed and fetches them ONE BY ONE.
 * Triggered if the image for an upcoming panel (IMAGE_HORIZON steps ahead) is missing.
 */
async function checkAndFetchImages(apiKey) {
    const service = "tensorOpera";
    const model = "gemini-2.0-flash-preview-image-generation";
    const imagePromises = [];
    const endIndex = Math.min(storyData.events.length, currentEventIndex + IMAGE_HORIZON);

    for (let i = currentEventIndex + 1; i < endIndex; i++) {
        const depiction = storyData.events[i].depiction;
        if (!base64Images[depiction]) {
            base64Images[depiction] = "";
            console.log("Requesting image.");
            const style = imageStyleInput.value.trim();
            const prompt = style + depiction;

            const promise = fetch('/api/generate_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service: service, apiKey: apiKey,
                                       model: model, prompt: prompt })
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


// --- HELPER FUNCTIONS ---

/**
 * A helper to wait for a specific image to become available in the `base64Images` array.
 */
function waitForImage(depiction, eventIndex) {
    return new Promise(resolve => {
        let watingCount = 100;
        const intervalId = setInterval(() => {
            if (base64Images[depiction] && base64Images[depiction] != "") {
                const imgElement = document.getElementById(`image-${eventIndex}`);
                if (imgElement && base64Images[depiction] != "Failed") {
                    imgElement.src = `data:image/webp;base64,${base64Images[depiction]}`;
                }
                clearInterval(intervalId);
                resolve();
                return;
            }
            if (--watingCount == 0) {
                console.log(`Timed out waiting for image for event ${eventIndex}. Displaying alt text.`);
                clearInterval(intervalId);
                resolve();
                return;
            }
        }, 150);
    });
}

function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
