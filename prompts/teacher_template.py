# teacher_prompt="""Solve the problem step by step.
#
# Return your response in this format:
#
# <reasoning>
# Step-by-step solution.
# </reasoning>
# <answer>
# Final answer only.
# </answer>
# """
defaultPrompt="""Solve the problem step by step.

Keep reasoning concise and mathematical.
Use equations and short statements.
Avoid long explanations.

Output exactly:

<reasoning>
...
</reasoning>
<answer>
...
</answer>

Do not add anything outside these tags."""
