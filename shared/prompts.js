export const FOUNDATIONAL_PROMPT = (user_input, ideas, names) => `You are a master world-builder and storyteller. Your task is to generate the foundational elements for a new fantasy story.

First, carefully review the seed ideas and names provided for inspiration. Then, generate the core components of the world, its key characters, and the central conflict that will drive the narrative.

**The generated foundation must:**
*   **Be Creative:** Weave the provided "Primary Idea" and if needed "Inspiration Seed" ideas into the core concepts of the world and conflicts.
*   **Be Cohesive:** Ensure the characters' motivations logically connect to the central conflict and the world they inhabit.
*   **Be Concrete:** Provide specific, actionable details, not vague descriptions.
*   **Use the Names:** Assign the provided "Name Seed" to characters and places to ensure originality.

**Primary Idea:**
"${JSON.stringify(user_input)}"

**Inspiration Seed (Ideas):**
"${ideas}"

**Name Seed (Characters & Places):**
"${names}"

Now, generate the story foundation in three distinct parts as detailed below.

**1. World Info:**
*   **Setting:** Describe the era/tech level and the name of a key country.
*   **Magic System:** Explain the source, rules, and limitations of magic, directly incorporating one of the seed ideas.
*   **Key Location:** Describe one important town or city.

**2. The Characters:**
Provide a description for each. Include appearance, core motivation, charisma.

**3. The Conflict:**
*   **Core Conflict:** In one sentence, what is the central problem threatening the world, inspired by a seed idea?
*   **Sub-conflicts:** Briefly list couple smaller side conflicts for the MC.
`;



export const OUTLINE_START_PROMPT = (user_input, foundation) => `You are a master plotter and structural editor. Your task is to create a detailed plot outline for the introductory section of a story. This blueprint will be used to write the story's opening.
The outline must be clear, logical, and accomplish three things: establish a compelling hook, introduce the protagonist, and launch the central conflict.

**Key Crafting Goals:**
*   **Show, Don't Tell:** Bring the outline to life through action, dialogue, and sensory details rather than stating facts directly.
*   **Establish Tone & Atmosphere:** Set the story's mood from the very first paragraph.
*   **Voice:** Write in a clear and engaging third-person limited perspective, closely following the protagonist's thoughts and feelings.
*   **Pacing:** Manage the flow of information to build suspense and draw the reader in.
*   **Use Characters from Story Foundation:** If it is named character use ones already created in foundation.

**Primary Idea:**
"${JSON.stringify(user_input)}"

**Story Foundation:**
"${JSON.stringify(foundation)}"

Now, create a detailed starting plot outline with 10 key bullet points.`;



export const STORY_START_PROMPT = (outline, foundation) => `You are a master storyteller. Your task is to write the opening of a story based *only* on the provided plot outline. Transform the structural points of the outline into a compelling narrative.

**Key Crafting Goals:**
*   **Show, Don't Tell:** Bring the outline to life through action, dialogue, and sensory details rather than stating facts directly.
*   **Establish Tone & Atmosphere:** Set the story's mood from the very first paragraph.
*   **Voice:** Write in a clear and engaging third-person limited perspective, closely following the protagonist's thoughts and feelings.
*   **Pacing:** Manage the flow of information to build suspense and draw the reader in.

**Outline to Follow:**
"${JSON.stringify(outline)}"

**Story Foundation:**
"${JSON.stringify(foundation)}"

Now, write the opening of the story in about 4000 words.`;



export const OUTLINE_CONTINUATION_PROMPT = (foundation, history, recent_in_depth_story) => `You are a master plotter and structural editor. Your task is to continue plotting a story that is in progress by creating the next section of the outline.

First, carefully review the context provided to understand the characters, plot, and tone. Then, devise the next series of key events.

**The new outline section must:**
*   **Logically Progress the Plot:** Events must be a direct and believable consequence of what has already happened.
*   **Raise the Stakes:** Introduce new challenges, complications, or revelations to escalate the central conflict.
*   **Develop Characters:** Use the new events to test the protagonist and reveal new aspects of their personality or backstory.
*   **Maintain Consistency:** Ensure all new plot points align with the established world and character motivations.

**Story Foundation:**
"${JSON.stringify(foundation)}"

**Outline History:**
"${JSON.stringify(history)}"

**Recent in Depth Story So Far (curent last sentence here):**
"${JSON.stringify(recent_in_depth_story)}"

Now, create the next detailed plot outline with 10 key bullet points that immediately follow the "Story Written So Far".`;



export const STORY_CONTINUATION_PROMPT = (foundation, history, recent_in_depth_story, outline) => `You are a master storyteller. Your task is to continue writing a story, picking up *exactly* where the previous section left off. You will use the new outline section to guide the narrative forward while maintaining absolute consistency with the established story.

**Critical Instructions:**
*   **Seamless Transition:** Your first sentence must flow directly from the last sentence of the "Story So Far." No summaries or lead-ins.
*   **Consistent Voice & Tone:** Write in the exact same narrative style and maintain the established atmosphere.
*   **Character Consistency:** Ensure all character actions, dialogue, and internal thoughts align perfectly with their previous portrayal and froundation description.
*   **Follow the New Outline:** Use the new outline as the blueprint for the events in this section.

**Story Foundation:**
"${JSON.stringify(foundation)}"

**Outline History (for context):**
"${JSON.stringify(history)}"

**Recent in Depth Story So Far (curent last sentence here):**
"${JSON.stringify(recent_in_depth_story)}"

**New Outline to Follow:**
"${JSON.stringify(outline)}"

Now, continue the story immediately from where it left off in about 4000 words.`;



export const STORY_JSONIFICATION_PROMPT = (history, story, foundation) => `You are an expert at deconstructing narrative prose into a frame-by-frame visual script. Your task is to process the provided story text sequentially and break it down into a highly granular visual script, formatted as a JSON array.

**Outline history (for context):** Use the key events from this outline to help you identify the most important moments that should become individual scenes.
"${JSON.stringify(history)}"

**Story Foundation (for context):** Use world description and character appearance to depict scenes.
"${JSON.stringify(foundation)}"

**Story Text to Analyze:** This is the narrative you will be converting.
"${JSON.stringify(story)}"

Now, generate the JSON array based on a granular, frame-by-frame analysis of the 'Story Text to Analyze'`;
