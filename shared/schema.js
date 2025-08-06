export const STORY_SCHEMA = {
    "type": "object",
    "properties": {
        "world_info": {
            "type": "string",
            "description": "General information about the story's world, setting, lore, key mechanics, and any crucial context for an AI to understand the narrative. This should be comprehensive enough to set the stage for the entire story. (Aim for around 300 words)"
        },
        "past": {
            "type": "string",
            "description": "Extract key information from old past and add RECENT_PAST. (Aim for around 500 words)"
        },
        "characters": {
            "type": "array",
            "description": "For each character there should be info (at least 3 characters)",
            "items": {
                "type": "string",
                "description": "A description of how a character looks, behaives. Mention colors, race, species, gender, apparent age, build/physique, shapes, positions, poses, clothes, hair style, hair color, skin color, eye color, footwear type, objects/weapons, accessories, distinguishing marks/features, expressions, lighting, texture, condition of cloth, overall vibe, and specific stylistic elements (around 150 words)."
            }
        },
        "premise": {
            "type": "string",
            "description":  "Define the high-level thesis for the NEXT block of story. This acts as a bridge from the 'past' events to future action. (Aim for around 20 words)"
        },
        "current_chapter_synopsis": {
            "type": "string",
            "description": "Based on the 'premise' and 'past', outline the key plot points of the current chapter that will follow. (Aim for around 40 words)"
        },
        "current_scene_idea": {
            "type": "string",
            "description": "Zoom in on a sub-event from the 'current_chapter_synopsis'. This event must logically continue from the 'past'. (Aim for around 50 words)"
        },
        "story_beats": {
            "type": "array",
            "description": "A sequence of panels that tells a story, similar to a comic strip. They unfold the 'current_scene_idea' into the most granular final text. (Aim for around 10 story beats)",        
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
        }
    },
    "propertyOrdering": [
        "world_info",
        "past",
        "characters",
        "premise",
        "current_chapter_synopsis",
        "current_scene_idea",
        "story_beats"
    ],
    "required": [
        "world_info",
        "past",
        "characters",
        "premise",
        "current_chapter_synopsis",
        "current_scene_idea",
        "story_beats"
    ]
};