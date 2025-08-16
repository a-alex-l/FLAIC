import {
    FOUNDATIONAL_PROMPT, OUTLINE_START_PROMPT,
    STORY_START_PROMPT, STORY_JSONIFICATION_PROMPT,
    OUTLINE_CONTINUATION_PROMPT, STORY_CONTINUATION_PROMPT
} from './prompts.js';
import { getRandomNames } from './names.js';
import { getRandomIdeas } from './ideas.js';
import { generateGeminiText, generateGeminiJson } from '../shared/generate_gemini_text.js';


async function generateText(service, model, apiKey, prompt) {
    try {
         if (service === "Google AI Studio") {
            return await generateGeminiText(apiKey, model, prompt);
        } else {
            throw new Error(`Unknown service: "${service}".`);
        }
    } catch {
        if (typeof process !== 'undefined') {
            return generateGeminiText("", "gemini-2.5-flash", prompt);
        } else {
            console.warning("Couldn't request text data");
            throw new Error("Couldn't request text data");
        }
    }
}


async function generateJson(service, model, apiKey, prompt) {
    try {
         if (service === "Google AI Studio") {
            return await generateGeminiJson(apiKey, model, prompt);
        } else {
            throw new Error(`Unknown service: "${service}".`);
        }
    } catch {
        if (typeof process !== 'undefined') {
            return await generateGeminiJson("", "gemini-2.5-flash", prompt);
        } else {
            console.warning("Couldn't request json data");
            throw new Error("Couldn't request json data");
        }
    }
}


export async function generateStart(service, model, apiKey, user_input) {
    const foundation = await generateText(
        service, model, apiKey,
        FOUNDATIONAL_PROMPT(user_input, getRandomIdeas(10), getRandomNames(10))
    );
    const outline = await generateText(
        service, model, apiKey,
        OUTLINE_START_PROMPT(user_input, foundation)
    );
    const story = await generateText(
        service, model, apiKey,
        STORY_START_PROMPT(outline, foundation)
    );
    const story_beats = await generateJson(
        service, model, apiKey,
        STORY_JSONIFICATION_PROMPT("", story, foundation)
    );
    return {
        "foundation": foundation,
        "outline": outline,
        "story" : story,
        "story_beats": story_beats
    };
}


export async function generateContinuation(service, model, apiKey, foundation, history, recent_story) {
    const outline = await generateText(
        service, model, apiKey,
        OUTLINE_CONTINUATION_PROMPT(foundation, history, recent_story)
    );
    const story = await generateText(
        service, model, apiKey,
        STORY_CONTINUATION_PROMPT(foundation, history, recent_story, outline)
    );
    const story_beats = await generateJson(
        service, model, apiKey,
        STORY_JSONIFICATION_PROMPT(history, story, foundation)
    );
    return {
        "outline": outline,
        "story" : story,
        "story_beats": story_beats
    };
}


