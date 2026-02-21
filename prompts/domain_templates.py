mathTemplate="""Create a math problem related to the following persona:

{persona}

Constraints:
1.The problem must require advanced mathematical reasoning that only top talents in the feld can solve. Avoid trivial arithmetic.
2.Do not just mention the persona. The problem must arise from a scenario specific to their expertise, utilizing their professional terminology or typical data constraints.
3.Structure: Provide exactly one problem, which may contain up to 2 sub-problems(a and b).
4. Format:
    - Your response must start with the literal string "Math problem:".
    - Do not provide the solution or any introductory conversational filler.
    - Use LaTeX for all mathematical notation."""
instructionTemplate="""Guess a complex instruction or request that the following persona would realistically pose to an AI:

{persona}

Constraints:
1. The instruction must reflect a high-level professional need or a niche inquiry specific to this persona's daily work or specialized interests.
2. The prompt must be specific
4. Your response must start with "User Prompt:".
"""

knowledgeTemplate="""Imagine you are writing a highly specialized, knowledge-rich technical text from the perspective of the following persona:

{persona}

Constraints:
1.The text must cover a specific, advanced concept or a nuanced procedure within the persona's field of expertise.
2.Use professional terminology and industry-specific jargon correctly.
3.A text of 200–400 words.
4.Your response must start with the literal string "Title:"."""

reasoningTemplate="""Create a complex logical reasoning problem or deduction puzzle based on the professional environment of the following persona:

{persona}

Constraints:
1. The problem must require deductive, inductive, or abductive reasoning. It should not be solvable by simple facts alone but through logical steps.
2. Provide the question clearly and dont provide the answer.
3. Your response must start with the literal string "Logic problem:"."""

toolTemplate="""You are a software architect specialized in API design.Your task is to analyze a given PERSONA and imagine a specific software tool, API, or function that would be highly relevant to their unique needs, hobbies, or profession.

Persona:
{persona}

Output Constraints:
1. The tool must be highly niche and tailored to the persona.
2. The output MUST be a valid JSON object.
3. Include: name, description, function_name, input_args, return, and depend.
"""

#user need to provide detailed info about the game world and other characters
npcTemplate="""
Game Details:
{gameDetails}

Task:
Develop a detailed NPC profile for the game above, using the following persona as the foundation:

{persona}

Constraints:
1. Define the NPC's core motivation, a unique personality quirk, and their specific area of "world knowledge."
2. Include three sample lines of dialogue that capture their unique professional voice and linguistic style.
3. Also specify how the npc interacts with other characters.
3. Structure: Include "Name", "Background", "Motivation", and "Dialogue Samples".
4. Format:
    - Your response must start with the literal string "NPC Profile:"."""
