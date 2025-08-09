import { base64Images, currentEventIndex, generateNextStep, beats } from './engine.js';

import { generateTogetherAIImage } from './shared/generate_together_ai_image.js';

// --- DOM ELEMENT REFERENCES ---
const generateButton = document.getElementById('generate-btn');
const comicContainer = document.getElementById('comic-container');
const promptInput = document.getElementById('prompt-input');
const controlsContainer = document.getElementById('controls-container');
const imageStyleInput = document.getElementById('image-style-prompt');
// Text Generation UI
const textProviderSelect = document.getElementById('text-provider-select');
const textModelSelect = document.getElementById('text-model-select');
const textApiKeyInput = document.getElementById('text-api-key');
// Image Generation UI
const imageProviderSelect = document.getElementById('image-provider-select');
const imageModelSelect = document.getElementById('image-model-select');
const imageApiKeyInput = document.getElementById('image-api-key');


// --- CONSTANTS ---
const TEXT_PROVIDERS = {
    "Google AI Studio": {
        models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
    }
};
const IMAGE_PROVIDERS = {
    "TensorOpera AI": {
        models: ["stabilityai/flux_dev_meme", "stabilityai/sdxl_emoji", "stabilityai/stable-diffusion-3-medium-diffusers"]
    },
    "together.ai": {
         models: ["black-forest-labs/FLUX.1-schnell-Free"]
    }
};

// --- INITIALIZATION ---
generateButton.addEventListener('click', handleGenerateClick);

document.addEventListener('DOMContentLoaded', () => {
    populateProviderSelect(TEXT_PROVIDERS, textProviderSelect);
    populateProviderSelect(IMAGE_PROVIDERS, imageProviderSelect);

    textProviderSelect.addEventListener('change', () => onProviderChange(TEXT_PROVIDERS, textProviderSelect, textModelSelect, textApiKeyInput));
    imageProviderSelect.addEventListener('change', () => onProviderChange(IMAGE_PROVIDERS, imageProviderSelect, imageModelSelect, imageApiKeyInput));

    textProviderSelect.dispatchEvent(new Event('change'));
    imageProviderSelect.dispatchEvent(new Event('change'));

    textApiKeyInput.addEventListener('input', syncApiKeys);
    generateButton.addEventListener('click', handleGenerateClick);
});


// --- UI LOGIC ---
/**
 * Populates a provider dropdown with options from the PROVIDERS constant.
 * @param {HTMLSelectElement} selectElement The dropdown to populate.
 */
function populateProviderSelect(providers, selectElement) {
    Object.keys(providers).forEach(providerName => {
        const option = document.createElement('option');
        option.value = providerName;
        option.textContent = providerName;
        selectElement.appendChild(option);
    });
}

/**
 * Correctly populates the model dropdown based on the selected provider.
 * @param {object} providers The dictionary of providers (TEXT_PROVIDERS or IMAGE_PROVIDERS).
 */
function onProviderChange(providers, providerSelect, modelSelect, apiKeyInput) {
    const selectedProvider = providerSelect.value;
    apiKeyInput.value = '';
    modelSelect.innerHTML = '';

    if (selectedProvider && providers[selectedProvider]) {
        providers[selectedProvider].models.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            option.textContent = modelName;
            modelSelect.appendChild(option);
        });
    }
    syncApiKeys();
}

/**
 * Syncs the image API key with the text API key if the providers are the same.
 */
function syncApiKeys() {
    const textProvider = textProviderSelect.value;
    const imageProvider = imageProviderSelect.value;

    if (textProvider && textProvider === imageProvider) {
        imageApiKeyInput.value = textApiKeyInput.value;
        imageApiKeyInput.disabled = true; // Visually indicate that the key is synced
    } else {
        imageApiKeyInput.disabled = false;
    }
}


function escapeQuotes(str) {
    return str.replace(/(?<!\\)"/g, '\\"');
}


/*
 *
 */
function GetPrompt() {
    if (currentEventIndex >= 0) {
        const lastPanel = document.getElementById(`panel-${currentEventIndex}`);
        const captionInput = lastPanel.querySelector('.caption-input');
        const finalCaption = captionInput.value;

        const captionText = document.createElement('p');
        captionText.className = 'caption-text';
        captionText.textContent = finalCaption;
        captionInput.replaceWith(captionText);
        return escapeQuotes(finalCaption);
    } else {
        return escapeQuotes(promptInput.value);
    }
}


/**
 * Main handler for the generate button.
 * It decides whether to start a new story or generate the next event.
 */
async function handleGenerateClick() {
    if (generateButton.disabled)
        return;

    const textService = textProviderSelect.value;
    const textModel = textModelSelect.value;
    const textApiKey = textApiKeyInput.value.trim();
    /*if (!textApiKey) {
        alert('Please enter an API key for text generation.');
        return;
    }*/

    const imageService = imageProviderSelect.value;
    const imageModel = imageModelSelect.value;
    const imageApiKey = imageApiKeyInput.value.trim();
    /*if (!imageApiKey) {
        alert('Please enter an API key for image generation.');
        return;
    }*/

    generateButton.disabled = true;
    
    const prompt = GetPrompt();
    if (!prompt) {
        alert('Please enter a story prompt.');
        return;
    }
    const style = imageStyleInput.value.trim();
    try {
        await generateNextStep(textService, textModel, textApiKey, imageService, imageModel, imageApiKey, prompt, style);
        promptInput.style.display = 'none';
        await displayCurrentPanel();
    } catch (error) {
        alert('Sorry, something broke on owr end, please try reloading and come back later.');
        console.error('An error occurred in the main generation flow:', error);
    } finally {
        generateButton.disabled = false;
    }
}



/**
 * Creates and displays the HTML for the current event panel.
 */
async function displayCurrentPanel() {
    const panelElement = document.createElement('div');
    panelElement.className = 'comic-panel';
    panelElement.id = `panel-${currentEventIndex}`;

    const event = beats[currentEventIndex];
    const imageElement = document.createElement('img');
    imageElement.id = `image-${currentEventIndex}`;
    imageElement.alt = event.depiction;

    const imageData = base64Images[event.depiction];
    if (imageData && imageData != "") {
        imageElement.src = addType(imageData);
    } else {
        imageElement.src = "";
        await waitForImage(event.depiction, currentEventIndex);
    }

    const captionInput = document.createElement('textarea');
    captionInput.className = 'caption-input';
    captionInput.textContent = event.caption;
    event.caption = escapeQuotes(event.caption);
    captionInput.addEventListener('input', () => autoResizeTextarea(captionInput));

    panelElement.appendChild(imageElement);
    panelElement.appendChild(captionInput);
    comicContainer.appendChild(panelElement);
    autoResizeTextarea(captionInput);

    requestAnimationFrame(() => {
        panelElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
                    imgElement.src = addType(base64Images[depiction]);
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

/**
 * Converts a raw base64 string into a full Data URI by automatically
 * detecting the MIME type and prepending the necessary prefix.
 * @param {string | null | undefined} base64String The raw base64 string (e.g., "iVBOR...").
 * @returns {string} The full Data URI (e.g., "data:image/png;base64,iVBOR..."),
 *                   or the original string if it already has a prefix,
 *                   or an empty string if the input is empty/null.
 */
export function addType(base64String) {
    if (!base64String || base64String.startsWith('data:')) {
        return base64String || "";
    }

    switch (true) {
        case base64String.startsWith('iVBOR'):
            return `data:image/png;base64,${base64String}`;
        case base64String.startsWith('/9j/'):
            return `data:image/jpeg;base64,${base64String}`;
        case base64String.startsWith('R0lGO'):
            return `data:image/gif;base64,${base64String}`;
        case base64String.startsWith('UklGR'):
            return `data:image/webp;base64,${base64String}`;
        case base64String.startsWith('PHN2Zy'): // Corresponds to "<svg"
            return `data:image/svg+xml;base64,${base64String}`;
        case base64String.startsWith('Qk0='):
            return `data:image/bmp;base64,${base64String}`;
        default:
            return `data:application/octet-stream;base64,${base64String}`;
    }
}


function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
