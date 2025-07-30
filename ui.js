
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
        models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-2.0-flash-lite"],
    }
};
const IMAGE_PROVIDERS = {
    "Google AI Studio": {
        models: ["gemini-2.0-flash-preview-image-generation"],
    },
    "TensorOpera AI": {
        models: ["Flux/Dev", "stabilityai/stable-diffusion-3-medium-diffusers", "flux_dev_meme"],
    }
};



// --- INITIALIZATION ---
generateButton.addEventListener('click', handleGenerateClick);

document.addEventListener('DOMContentLoaded', () => {
    populateProviderSelect(textProviderSelect);
    populateProviderSelect(imageProviderSelect);

    textProviderSelect.addEventListener('change', () => onProviderChange(textProviderSelect, textModelSelect, textApiKeyInput));
    imageProviderSelect.addEventListener('change', () => onProviderChange(imageProviderSelect, imageModelSelect, imageApiKeyInput));

    textApiKeyInput.addEventListener('input', syncApiKeys);

    generateButton.addEventListener('click', handleGenerateClick);
});


// --- UI LOGIC ---
/**
 * Populates a provider dropdown with options from the PROVIDERS constant.
 * @param {HTMLSelectElement} selectElement The dropdown to populate.
 */
function populateProviderSelect(selectElement) {
    Object.keys(PROVIDERS).forEach(providerName => {
        const option = document.createElement('option');
        option.value = providerName;
        option.textContent = providerName;
        selectElement.appendChild(option);
    });
}

/**
 * Handles the change event for a provider dropdown.
 * @param {HTMLSelectElement} providerSelect The provider dropdown that changed.
 * @param {HTMLSelectElement} modelSelect The corresponding model dropdown to update.
 * @param {HTMLInputElement} apiKeyInput The corresponding API key input to clear.
 */
function onProviderChange(providerSelect, modelSelect, apiKeyInput) {
    const selectedProvider = providerSelect.value;
    
    // 1. Clear the API key field
    apiKeyInput.value = '';

    // 2. Clear and update the model dropdown
    modelSelect.innerHTML = '<option value="">-- Select Model --</option>';
    if (selectedProvider && PROVIDERS[selectedProvider]) {
        PROVIDERS[selectedProvider].models.forEach(modelName => {
            const option = document.createElement('option');
            option.value = modelName;
            option.textContent = modelName;
            modelSelect.appendChild(option);
        });
    }

    // 3. Sync API keys if providers match
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
        return finalCaption;
    } else {
        return promptInput.value;
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
    if (!textService || !textModel || !textApiKey) {
        alert('Please select a provider, model, and enter an API key for text generation.');
        return;
    }

    const imageService = imageProviderSelect.value;
    const imageModel = imageModelSelect.value;
    const imageApiKey = imageApiKeyInput.value.trim();
    if (!imageService || !imageModel || !imageApiKey) {
        alert('Please select a provider, model, and enter an API key for image generation.');
        return;
    }

    generateButton.disabled = true;
    
    const prompt = GetPrompt();
    if (!prompt) {
        alert('Please enter a story prompt.');
        throw new Error("Empty prompt.");
    }

    try {
        await generateNextStep(textService, textModel, textApiKey, imageService, imageModel, imageApiKey, prompt);
    } catch (error) {
        alert('Sorry, something broke on owr end, please try reloading and come back later.');
        console.error('An error occurred in the main generation flow:', error);
    } finally {
        await displayCurrentPanel();
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
