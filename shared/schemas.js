export const STORY_SCHEMA = {
    "type": "array",
    "description": "Deconstruct the provided narrative into a sequence of individual moments or actions, like a frame-by-frame storyboard. Each item in the array should represent a single, granular event, description, or piece of dialogue from the original text. Do NOT summarize or condense events; instead, 'unfold' the text into as many panels as are necessary to capture every detail.",
    "items": {
        "type": "object",
        "properties": {
            "caption": {
                "type": "string",
                "description": "The direct text for this single moment. This should be a close paraphrase or a direct quote of a sentence or a clause from the source text, representing one distinct action, observation, or feeling. Keep it focused on a single, granular event."
            },
            "depiction": {
                "type": "string",
                "description": "USE ENGLISH! Create a highly detailed prompt for a text-to-image AI to generate an illustration for this specific, granular moment. Include details from the text relevant ONLY to this panel: character expressions, specific actions, environmental details, lighting, camera angle, and atmosphere. Ensure the depiction matches the single event in the caption."
            }
        },
        "required": [
            "caption",
            "depiction"
        ]
    }
};