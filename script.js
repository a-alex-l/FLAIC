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
    const token = geminiApiKey; // TODO send request to server to crypto API

    generateButton.disabled = true;

    try {
        if (!storyData) {
            await startNewStory(token);
        } else {
            await generateNextStep(token);
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
async function startNewStory(token) {
    const userPromptText = promptInput.value.trim();
    if (!userPromptText) {
        alert('Please enter a story prompt.');
        throw new Error("Empty prompt.");
    }
    
    comicContainer.innerHTML = '';
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
            throw new Error("Sorry, AI did not generate any events for the story.");
        }
        
        promptInput.style.display = 'none';
        generateButton.textContent = 'Generate Next Event';
        await checkAndFetchImages();
        await generateNextStep(token);

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
async function generateNextStep(token) {
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

    await displayCurrentPanel(token);

    checkAndFetchStoryContinuation(token).catch(console.error);
    checkAndFetchImages().catch(console.error);
}

/**
 * Creates and displays the HTML for the current event panel.
 */
async function displayCurrentPanel(token) {
    let event = storyData.events[currentEventIndex];
    if (!event) {
        console.log("No event found at index, attempting to fetch more story...");
        await checkAndFetchStoryContinuation(token);
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
        imageElement.src = `data:image/jpeg;base64,${imageData}`;
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
async function checkAndFetchStoryContinuation(token) {
    if (isGenerating) return;
    isGenerating = true;
    if (storyData.events.length - currentEventIndex <= TEXT_HORIZON) {
        console.log("Requesting story update.");

        const storySoFar = { ...storyData, events: [] };
        
        const recentEvents = storyData.events.slice(compressedEventIndex, storyData.events.length);
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
            console.error("Failed to fetch story update:", (await response.json()).error);
            isGenerating = false;
        } else {
            const newStoryPart = await response.json();
            storyData.events.push(...newStoryPart.events);
            storyData.past = newStoryPart.past;
            storyData.characters = newStoryPart.characters;
            storyData.world_info = newStoryPart.world_info;
            console.log(`Added ${newStoryPart.events.length} new events. Total events: ${storyData.events.length}`);
            await checkAndFetchImages().catch(console.error);
        }
    }
    isGenerating = false;
}

/**
 * Checks if more images are needed and fetches them ONE BY ONE.
 * Triggered if the image for an upcoming panel (IMAGE_HORIZON steps ahead) is missing.
 */
async function checkAndFetchImages() {
    const imagePromises = [];
    const endIndex = Math.min(storyData.events.length, currentEventIndex + IMAGE_HORIZON);

    for (let i = currentEventIndex + 1; i < endIndex; i++) {
        const description = storyData.events[i].depiction;
        if (!base64Images[description]) {
            base64Images[description] = "";
            console.log("Requesting image.");
            const style = imageStyleInput.value.trim();
            const depiction = style + description;

            // Create a promise for each fetch call
            const promise = fetch('/api/generate_image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ depiction: depiction })
            })
            .then(res => {
                if (!res.ok) {
                    console.error(`Failed to generate image`);
                    return null;
                }
                return res.json();
            })
            .then(data => {
                if (data) {
                    console.log("Recieved image.");
                    return { image: data.image, description: description };
                }
                return null;
            })
            .catch(err => {
                console.error(`Error fetching image:`, err);
                return null;
            });
            imagePromises.push(promise);
        }
    }
        
    if (imagePromises.length === 0) return;

    const settledImages = await Promise.all(imagePromises);
    settledImages.forEach(result => {
        if (result) {
            base64Images[result.description] = result.image;
        }
    });
}


// --- HELPER FUNCTIONS ---

/**
 * A helper to wait for a specific image to become available in the `base64Images` array.
 */
function waitForImage(description, eventIndex) {
    return new Promise(resolve => {
        let watingCount = 10;
        const intervalId = setInterval(() => {
            if (base64Images[description] && base64Images[description] != "") {
                const imgElement = document.getElementById(`image-${eventIndex}`);
                if (imgElement) {
                    imgElement.src = `data:image/jpeg;base64,${base64Images[description]}`;
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
