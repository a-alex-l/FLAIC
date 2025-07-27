// --- DOM ELEMENT REFERENCES ---
const generateButton = document.getElementById('generate-btn');
const statusElement = document.getElementById('status');
const comicContainer = document.getElementById('comic-container');
const promptInput = document.getElementById('prompt-input');
const controlsContainer = document.getElementById('controls-container');
const geminiApiKeyInput = document.getElementById('gemini-api-key');
const imageStyleInput = document.getElementById('image-style-prompt');

// --- APPLICATION STATE ---
let storyData = null; // Will hold the entire story object { world_info, characters, events, ... }
let base64Images = []; // Array to store generated images, can have empty slots
let currentEventIndex = -1; // Index of the event currently being displayed
let isGenerating = false; // A lock to prevent simultaneous API calls

// --- EVENT LISTENERS ---
generateButton.addEventListener('click', handleGenerateClick);

/**
 * Main handler for the generate button.
 * It decides whether to start a new story or generate the next event.
 */
async function handleGenerateClick() {
    if (isGenerating) return; // Prevent multiple clicks
    const geminiApiKey = geminiApiKeyInput.value.trim();
    if (!geminiApiKey) {
        alert('Please enter your Gemini API Key.');
        return;
    }

    isGenerating = true;
    generateButton.disabled = true;

    try {
        if (!storyData) {
            // If there's no story, this is the first click.
            await startNewStory(geminiApiKey);
        } else {
            // If a story exists, we're generating the next event.
            await generateNextStep(geminiApiKey);
        }
    } catch (error) {
        console.error('An error occurred in the main generation flow:', error);
        updateStatus(`Error: ${error.message}`);
    } finally {
        isGenerating = false;
        generateButton.disabled = false;
    }
}

/**
 * STEP 1: Starts a brand new story.
 * Called only on the very first "Start Story" click.
 */
async function startNewStory(apiKey) {
    const userPromptText = promptInput.value.trim();
    if (!userPromptText) {
        alert('Please enter a story prompt.');
        throw new Error("Empty prompt.");
    }
    
    updateStatus('Generating initial story world...');
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
            body: JSON.stringify({ prompt: initialPrompt, apiKey: apiKey })
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
        updateStatus('Story created! Generating first images...');

        // Pre-fetch the first batch of images
        await checkAndFetchImages();

        // Start the sequence by generating the very first step
        await generateNextStep(apiKey);

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
async function generateNextStep(apiKey) {
    // 1. Lock in the caption from the PREVIOUS panel (if one exists)
    if (currentEventIndex >= 0) {
        const lastPanel = document.getElementById(`panel-${currentEventIndex}`);
        const captionInput = lastPanel.querySelector('.caption-input');
        const finalCaption = captionInput.value;
        
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
    updateStatus(`Displaying event ${currentEventIndex + 1} of ${storyData.events.length}...`);

    // 3. Display the new panel
    await displayCurrentPanel();

    // 4. Proactively fetch more content in the background
    // These run in parallel and don't block the UI
    checkAndFetchStoryContinuation(apiKey).catch(console.error);
    checkAndFetchImages().catch(console.error);
}

/**
 * Creates and displays the HTML for the current event panel.
 */
async function displayCurrentPanel() {
    const event = storyData.events[currentEventIndex];
    if (!event) {
        updateStatus("You've reached the end of the story!");
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
    if (base64Images[currentEventIndex]) {
        imageElement.src = `data:image/jpeg;base64,${base64Images[currentEventIndex]}`;
    } else {
        // If image isn't ready, show a placeholder and try to load it
        imageElement.src = ""; // Placeholder can be set in CSS
        updateStatus(`Image for event ${currentEventIndex + 1} is being generated...`);
        // Poll for the image
        await waitForImage(currentEventIndex);
        updateStatus(`Displaying event ${currentEventIndex + 1} of ${storyData.events.length}...`);
    }

    // Create editable caption element
    const captionInput = document.createElement('textarea');
    captionInput.className = 'caption-input';
    captionInput.textContent = event.caption; // Pre-fill with AI's suggestion

    // Append elements to the container
    panelElement.appendChild(imageElement);
    panelElement.appendChild(captionInput);
    comicContainer.appendChild(panelElement);

    // Scroll the new panel into view
    panelElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * Checks if more story events are needed and fetches them.
 * Triggered if fewer than 6 events are left in the queue.
 */
async function checkAndFetchStoryContinuation(apiKey) {
    if (storyData.events.length - 1 - currentEventIndex < 6) {
        updateStatus("Getting more of the story from the AI...");
        console.log("Fewer than 6 events remaining, fetching continuation...");

        const storySoFar = { ...storyData, events: [] }; // Clone story without events
        
        // Get the last 5 captions as "RECENT_PAST"
        const recentEvents = storyData.events.slice(-5);
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
            body: JSON.stringify({ prompt: continuationPrompt, apiKey: apiKey })
        });
        
        if (!response.ok) {
            console.error("Failed to fetch story continuation:", (await response.json()).error);
            return;
        }

        const newStoryPart = await response.json();
        // Append new events to our existing story data
        storyData.events.push(...newStoryPart.events);
        storyData.past = newStoryPart.past; // Update the past
        console.log(`Added ${newStoryPart.events.length} new events. Total events: ${storyData.events.length}`);
        updateStatus("Story has been extended!");
    }
}

/**
 * Checks if more images are needed and fetches them in a batch.
 * Triggered if the image for an upcoming panel (3 steps ahead) is missing.
 */
async function checkAndFetchImages() {
    // Check if we need to fetch images (i.e., the image 3 panels ahead is missing)
    if (currentEventIndex + 3 >= base64Images.length) {
        console.log("Prefetching next batch of images...");
        
        const depictionsToFetch = [];
        const indicesToFill = [];

        // Find the next 5 events that don't have an image yet
        for (let i = currentEventIndex; i < storyData.events.length && depictionsToFetch.length < 5; i++) {
            if (!base64Images[i]) {
                const style = imageStyleInput.value.trim();
                depictionsToFetch.push(style + storyData.events[i].depiction);
                indicesToFill.push(i);
            }
        }
        
        if (depictionsToFetch.length === 0) return; // Nothing to fetch

        const response = await fetch('/api/generate_images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ depictions: depictionsToFetch })
        });

        if (!response.ok) {
            console.error("Failed to fetch images:", (await response.json()).error);
            return;
        }

        const imageData = await response.json();
        // Place the new images into their correct slots in the main array
        imageData.images.forEach((img, i) => {
            const originalIndex = indicesToFill[i];
            base64Images[originalIndex] = img;
            
            // If the image element already exists on the page, update its src
            const imgElement = document.getElementById(`image-${originalIndex}`);
            if (imgElement) {
                imgElement.src = `data:image/jpeg;base64,${img}`;
            }
        });
        console.log(`Fetched ${imageData.images.length} new images.`);
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
        }, 500); // Check every half a second
    });
}

/**
 * Updates the status message on the page.
 */
function updateStatus(message) {
    statusElement.textContent = message;
}
