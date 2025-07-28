// --- DOM ELEMENT REFERENCES ---
const generateButton = document.getElementById('generate-btn');
const comicContainer = document.getElementById('comic-container');
const promptInput = document.getElementById('prompt-input');
const controlsContainer = document.getElementById('controls-container');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const imageStyleInput = document.getElementById('image-style-prompt');

const IMAGE_HORIZON = 3;
const TEXT_HORIZON = 5;

// --- APPLICATION STATE ---
let storyData = null; // Will hold the entire story object { world_info, characters, events, ... }
let base64Images = []; // Array to store generated images, can have empty slots
let currentEventIndex = -1; // Index of the event currently being displayed
let isGenerating = false; // A lock to prevent simultaneous API calls
let compressedEventIndex = -1; // Index of the event currently being displayed

// --- EVENT LISTENERS ---
generateButton.addEventListener('click', handleGenerateClick);

/**
 * Main handler for the generate button.
 * It decides whether to start a new story or generate the next event.
 */
async function handleGenerateClick() {
    if (isGenerating) return; // Prevent multiple clicks
    const geminiApiKey = geminiApiKeyInput.value.trim();
    /*if (!geminiApiKey) {
        alert('Please enter your Gemini API Key.');
        return;
    }*/
   const token = geminiApiKey; // TODO send request to server to crypto API

    isGenerating = true;
    generateButton.disabled = true;

    try {
        if (!storyData) {
            // If there's no story, this is the first click.
            await startNewStory(token);
        } else {
            // If a story exists, we're generating the next event.
            await generateNextStep(token);
        }
    } catch (error) {
        console.error('An error occurred in the main generation flow:', error);
    } finally {
        isGenerating = false;
        generateButton.disabled = false;
    }
}

/**
 * STEP 1: Starts a brand new story.
 * Called only on the very first "Start Story" click.
 */
async function startNewStory(token) {
    const userPromptText = promptInput.value.trim();
    if (!userPromptText) {
        alert('Please enter a story prompt.');
        throw new Error("Empty prompt.");
    }
    
    comicContainer.innerHTML = ''; // Clear the comic container

    const initialPrompt = "Generate a story world and character descriptions based on the following setting. " +
                 "The world should include key locations, history, and culture. " +
                 "Generate 3 distinct characters with physical descriptions. " +
                 "There is no past yet so keep it empty. " +
                 "Setting: " + userPromptText;

    try {
        const response = await fetch('/api/generate_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: initialPrompt, token: token })
        });
        if (!response.ok) throw new Error(`Story generation failed: ${ (await response.json()).error }`);
        
        storyData = await response.json();
        console.log("Initial story data received:", storyData);

        if (!storyData.events || storyData.events.length === 0) {
            throw new Error("The AI did not generate any events for the story.");
        }
        
        // Prepare the UI for the interactive part
        promptInput.style.display = 'none'; // Hide the initial large textarea
        generateButton.textContent = 'Generate Next Event';

        // Pre-fetch the first batch of images
        await checkAndFetchImages();

        // Start the sequence by generating the very first step
        await generateNextStep(token);

    } catch (error) {
        // If starting fails, reset to initial state
        storyData = null;
        generateButton.textContent = 'Start Story';
        promptInput.style.display = 'block';
        throw error; // Re-throw to be caught by the main handler
    }
}

/**
 * Generates and displays the next event in the story sequence.
 */
async function generateNextStep(token) {
    // 1. Lock in the caption from the PREVIOUS panel (if one exists)
    if (currentEventIndex >= 0) {
        const lastPanel = document.getElementById(`panel-${currentEventIndex}`);
        const captionInput = lastPanel.querySelector('.caption-input');
        const finalCaption = captionInput.value;

        if (finalCaption !== storyData.events[currentEventIndex].caption) {
            console.log(`Caption for event ${currentEventIndex} changed. Branching story from this point.`);
            storyData.events.splice(currentEventIndex + 1);
            base64Images.splice(currentEventIndex + 1);
        }
        
        // Update the official story data with the user's caption
        storyData.events[currentEventIndex].caption = finalCaption;

        // Replace the input with static text
        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = finalCaption;
        captionInput.replaceWith(captionText);
    }
    
    // 2. Move to the next event
    currentEventIndex++;

    // 3. Display the new panel
    await displayCurrentPanel();

    // 4. Proactively fetch more content in the background
    // These run in parallel and don't block the UI
    checkAndFetchStoryContinuation(token).catch(console.error);
    checkAndFetchImages().catch(console.error);
}

/**
 * Creates and displays the HTML for the current event panel.
 */
async function displayCurrentPanel() {
    const event = storyData.events[currentEventIndex];
    if (!event) {
        generateButton.style.display = 'none'; // Hide button at the end
        return;
    }
    
    const panelElement = document.createElement('div');
    panelElement.className = 'comic-panel';
    panelElement.id = `panel-${currentEventIndex}`;

    // Create image element (it might be empty while loading)
    const imageElement = document.createElement('img');
    imageElement.id = `image-${currentEventIndex}`;
    imageElement.alt = event.depiction;
    const imageData = base64Images[currentEventIndex];
    if (imageData) {
        // If the real image is already loaded, display it
        imageElement.src = `data:image/jpeg;base64,${imageData}`;
    } else {
        // If image isn't ready, show a placeholder and try to load it
        imageElement.src = ""; // Placeholder can be set in CSS
        // Poll for the image
        await waitForImage(currentEventIndex);
    }

    // Create editable caption element
    const captionInput = document.createElement('textarea');
    captionInput.className = 'caption-input';
    captionInput.textContent = event.caption;
    captionInput.addEventListener('input', () => autoResizeTextarea(captionInput));
    autoResizeTextarea(captionInput);

    // Append elements to the container
    panelElement.appendChild(imageElement);
    panelElement.appendChild(captionInput);
    comicContainer.appendChild(panelElement);

    // Scroll the new panel into view
    panelElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * Checks if more story events are needed and fetches them.
 * Triggered if fewer than TEXT_HORIZON events are left in the queue.
 */
async function checkAndFetchStoryContinuation(token) {
    if (storyData.events.length - 1 - currentEventIndex <= TEXT_HORIZON) {
        console.log("Fewer than TEXT_HORIZON events remaining, fetching continuation...");

        const storySoFar = { ...storyData, events: [] };
        
        // Get the last TEXT_HORIZON captions as "RECENT_PAST"
        const recentEvents = storyData.events.slice(compressedEventIndex);
        compressedEventIndex = storyData.events.length;
        const eventData = recentEvents.map(e => e.caption).join('\n');

        const continuationPrompt = "As a creative writer, your task is to write the next part of the story" +
                " in a series of small, sequential, and highly detailed steps." +
                " Imagine you are writing a screenplay or a comic book script" +
                " where every single action, reaction, and line of dialogue needs to be captured." +
                " It is crucial that these new events logically and immediately follow the 'RECENT_PAST'." +
                " Full Story So Far:\n" + JSON.stringify(storySoFar) + "\n\n" +
                " Events that just happened (aka RECENT_PAST):\n" + eventData + "\n\n" +
                " Now, write a detailed description of the immediate aftermath or the very next event that occurs.";
        
        const response = await fetch('/api/generate_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: continuationPrompt, token: token })
        });
        
        if (!response.ok) {
            console.error("Failed to fetch story continuation:", (await response.json()).error);
            return;
        }

        const newStoryPart = await response.json();
        // Append new events to our existing story data
        storyData.events.push(...newStoryPart.events);
        storyData.past = newStoryPart.past;
        storyData.characters = newStoryPart.characters;
        storyData.world_info = newStoryPart.world_info;
        console.log(`Added ${newStoryPart.events.length} new events. Total events: ${storyData.events.length}`);
    }
}

/**
 * Checks if more images are needed and fetches them ONE BY ONE.
 * Triggered if the image for an upcoming panel (IMAGE_HORIZON steps ahead) is missing.
 */
async function checkAndFetchImages() {
    // Trigger condition: if we are IMAGE_HORIZON steps away from running out of images
    if (currentEventIndex + IMAGE_HORIZON >= base64Images.length) {
        console.log("Pre-fetching all available future images individually...");
        
        const imagePromises = [];
        
        const endIndex = Math.min(storyData.events.length, currentEventIndex + IMAGE_HORIZON);
        
        // It will now create a fetch promise for EVERY future event that doesn't have an image.
        for (let i = base64Images.length; i < endIndex; i++) {
            if (!base64Images[i]) {
                const style = imageStyleInput.value.trim();
                const depiction = style + storyData.events[i].depiction;
                const index = i; // Capture the current index

                // Create a promise for each fetch call
                const promise = fetch('/api/generate_image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ depiction: depiction })
                })
                .then(res => {
                    if (!res.ok) {
                        console.error(`Failed to generate image for index ${index}`);
                        return null;
                    }
                    return res.json();
                })
                .then(data => {
                    if (data) {
                        return { image: data.image, index: index };
                    }
                    return null;
                })
                .catch(err => {
                    console.error(`Error fetching image for index ${index}:`, err);
                    return null;
                });

                imagePromises.push(promise);
            }
        }
        
        if (imagePromises.length === 0) return;

        // Wait for all the individual fetch requests to complete
        const settledImages = await Promise.all(imagePromises);

        let fetchCount = 0;
        settledImages.forEach(result => {
            if (result) {
                fetchCount++;
                base64Images[result.index] = result.image;
                
                const imgElement = document.getElementById(`image-${result.index}`);
                if (imgElement) {
                    imgElement.src = `data:image/jpeg;base64,${result.image}`;
                }
            }
        });

        if (fetchCount > 0) {
            console.log(`Fetched and compressed ${fetchCount} new images.`);
        }
    }
}


// --- HELPER FUNCTIONS ---

/**
 * A helper to wait for a specific image to become available in the `base64Images` array.
 */
function waitForImage(index) {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            if (base64Images[index]) {
                const imgElement = document.getElementById(`image-${index}`);
                if (imgElement) {
                    imgElement.src = `data:image/jpeg;base64,${base64Images[index]}`;
                }
                clearInterval(interval);
                resolve();
            }
        }, 150);
    });
}
