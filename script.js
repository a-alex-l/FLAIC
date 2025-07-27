// Get references to the HTML elements.
const generateButton = document.getElementById('generate-btn');
const statusElement = document.getElementById('status');
const comicContainer = document.getElementById('comic-container');
const promptInput = document.getElementById('prompt-input');

// Attach the main function to the button's click event.
generateButton.addEventListener('click', createComic);

async function createComic() {
    // --- STEP 0: INITIAL SETUP ---
    const userPrompt = "Generate a story world and character descriptions based on the following setting. " +
                 "The world should include key locations, history, and culture. " +
                 "Generate 3 distinct characters with physical descriptions. " +
                 "There is no past yet so keep it empty. " +
                 "Setting: " + promptInput.value;
    if (!userPrompt || userPrompt.trim() === '') {
        alert('Please enter a story prompt.');
        return;
    }

    generateButton.disabled = true;
    comicContainer.innerHTML = ''; // Clear previous comic
    updateStatus('Step 1 of 3: Generating the story...');

    try {
        // --- STEP 1: GENERATE THE STORY ---
        // The API now only needs the prompt, as the schema is defined on the server.
        const storyResponse = await fetch('/api/generate_story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userPrompt })
        });

        if (!storyResponse.ok) {
            const errorData = await storyResponse.json();
            throw new Error(`Story generation failed: ${errorData.error || 'Unknown error'}`);
        }

        const story = await storyResponse.json();
        console.log("Story received:", story);
        updateStatus('Step 2 of 3: Story generated! Now requesting images...');

        // --- STEP 2: PREPARE AND REQUEST IMAGES IN PARALLEL ---
        // Extract the "depiction" text from each event in the story.
        const imageDepictions = story.events.map(event => "Epic, stunning, cinematic, hyper-realistic art style, sharp, detailed. " + event.depiction);

        if (imageDepictions.length === 0) {
            throw new Error("The generated story has no events to create images for.");
        }

        // The API expects the array under the key "depictions".
        const imagesResponse = await fetch('/api/generate_images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ depictions: imageDepictions })
        });

        if (!imagesResponse.ok) {
            const errorData = await imagesResponse.json();
            throw new Error(`Image generation failed: ${errorData.error || 'Unknown error'}`);
        }

        const imageData = await imagesResponse.json();
        const base64Images = imageData.images;
        console.log("Images received:", base64Images.length);
        updateStatus('Step 3 of 3: Images received! Assembling the comic...');

        // --- STEP 3: DISPLAY THE FINAL COMIC ---
        // Combine the story events with their corresponding images.
        story.events.forEach((event, index) => {
            const panelElement = document.createElement('div');
            panelElement.className = 'comic-panel';

            const imageElement = document.createElement('img');
            // The image is a base64 string, so we format it for the src attribute.
            imageElement.src = `data:image/jpeg;base64,${base64Images[index]}`;
            imageElement.alt = event.depiction; // Use depiction for accessibility.

            const captionElement = document.createElement('p');
            // Use the "caption" field from the story for the panel's text.
            captionElement.textContent = event.caption;

            // Append the new elements to the page.
            panelElement.appendChild(imageElement);
            panelElement.appendChild(captionElement);
            comicContainer.appendChild(panelElement);
        });

        updateStatus('Your comic is ready!');

    } catch (error) {
        // Centralized error handling.
        console.error('An error occurred during comic creation:', error);
        updateStatus(`Failed to create comic. Error: ${error.message}`);
    } finally {
        // --- STEP 4: CLEANUP ---
        // Always re-enable the button, whether it succeeded or failed.
        generateButton.disabled = false;
    }
}

// Helper function to update the status message on the page.
function updateStatus(message) {
    statusElement.textContent = message;
}