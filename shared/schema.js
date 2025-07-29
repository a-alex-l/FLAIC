export const STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "world_info": {
            "type": "string",
            "description": "General information about the story's world, setting, lore, key mechanics, and any crucial context for an AI to understand the narrative. This should be comprehensive enough to set the stage for the entire story. (around 300 words)"
        },
        "past": {
            "type": "string",
            "description": "Extract key information from old past and add RECENT_PAST. (around 500 words)"
        },
        "characters": {
            "type": "array",
            "description": "For each character there should be info (at least 3 characters)",
            "items": {
                "type": "string",
                "description": "A description of how a character looks, behaives. Mention colors, race, species, gender, apparent age, build/physique, shapes, positions, poses, clothes, hair style, hair color, skin color, eye color, footwear type, objects/weapons, accessories, distinguishing marks/features, expressions, lighting, texture, condition of cloth, overall vibe, and specific stylistic elements (around 150 words)."
            }
        },
        "events": {
            "type": "array",
            "description": "A sequence of panels that tell a story, similar to a comic strip. (Aim for around 7 events)",        
            "items": {
                "type": "object",
                "properties": {
                    "caption": {
                        "type": "string",
                        "description": "A short narrative text for the panel, like a narrator's box or a character's thought bubble. (Aim for around 30 words)"
                    },
                    "depiction": {
                        "type": "string",
                        "description": "USE ENGLISH! Create a highly detailed, prompt for a text-to-image AI to generate illustrations. Your goal is a hyper-realistic art style. Include the following if applicable: Amount of people, their cloth, hair color, cloth color, age, gender, eyes color, foot wear, scars, Buiding count, buildings style, buildings positioning, building colors, how light falls, weather, day time, textures, auras, brightness of the scene, camera settings, composition, atmosphere. (Aim for around 150 words)"
                    }
                },
                "required": [
                    "caption",
                    "depiction"
                ]
            }
        }
    },
    "propertyOrdering": [
        "world_info",
        "past",
        "characters",
        "events"
    ],
    "required": [
        "world_info",
        "past",
        "characters",
        "events"
    ]
};
