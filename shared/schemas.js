export const STORY_SCHEMA = {
    "type": "array",
    "description": "A sequence of panels that tells a story, similar to a comic strip. They unfold the 'paragraph' into the most granular final text. (Aim for around 10 story beats)",        
    "items": {
        "type": "object",
        "properties": {
            "caption": {
                "type": "string",
                "description": "The most granular level of detail. A short text for the panel, like a narrator's box or a character's thought bubble. (Aim for around 30 words)"
            },
            "depiction": {
                "type": "string",
                "description": "USE ENGLISH! Create a highly detailed prompt for a text-to-image AI to generate illustrations. Include the following if applicable: number of people, their clothing, hair color, cloth color, age, gender, eye color, footwear, scars, building count, building style, building positioning, building colors, how light falls, weather, time of day, textures, auras, scene brightness, camera settings, composition, and atmosphere. (Aim for around 150 words)"
            }
        },
        "required": [
            "caption",
            "depiction"
        ]
    }
};