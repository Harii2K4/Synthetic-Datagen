from pathlib import Path

import pandas as pd
from langchain_core.messages import AIMessage
from langchain_core.runnables import RunnableLambda



REPO_ROOT = Path(__file__).resolve().parents[1]
PERSONA_DIR = REPO_ROOT / "persona_hub"
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import openrouter_sythesis as ors
from prompts.domain_templates import mathTemplate
from prompts.teacher_template import defaultPrompt
#checks the formatting template 
def test_generate_questions_sends_real_domain_prompt_to_model_and_returns_results():
    personas = ors.createPersonaList(
        split="math",
        size=3,
        selectionMethod="sequence",
    )["persona"].tolist()

    captured_prompts = []

    def fake_api_call(prompt_value):
        messages = prompt_value.to_messages()
        captured_prompts.append(messages)
        return AIMessage(content=f"question-{len(captured_prompts)}")

    model = RunnableLambda(fake_api_call)

    results = ors.generateQuestions(
        personas=personas,
        model=model,
        domain="math",
        maxConcurrentRequests=1,
    )

    assert results == ["question-1", "question-2", "question-3"]
    assert len(captured_prompts) == 3

    for idx, messages in enumerate(captured_prompts):
        assert len(messages) == 1
        assert messages[0].type == "system"
        expected_prompt = mathTemplate.format(persona=personas[idx])
        assert messages[0].content == expected_prompt

#test prompt formatting for answer generation
def test_generate_answers_sends_default_teacher_prompt_and_returns_results():
    questions = [
        "What is the derivative of x^2?",
        "Solve for x: 2x + 3 = 9",
    ]

    captured_prompts = []

    def fake_api_call(prompt_value):
        messages = prompt_value.to_messages()
        captured_prompts.append(messages)
        return AIMessage(content=f"answer::{messages[1].content}")

    model = RunnableLambda(fake_api_call)

    results = ors.generateAnswers(
        questions=questions,
        model=model,
        teacherName="default",
        maxConcurrentRequests=1,
    )

    assert results == [
        "answer::What is the derivative of x^2?",
        "answer::Solve for x: 2x + 3 = 9",
    ]
    assert len(captured_prompts) == 2

    for idx, messages in enumerate(captured_prompts):
        assert len(messages) == 2
        assert messages[0].type == "system"
        assert messages[1].type == "human"
        assert messages[0].content == defaultPrompt
        assert messages[1].content == questions[idx]

#testing sequence selection on persona list
def test_create_persona_list_sequence_reads_real_csv_correctly():
    expected_df = pd.read_csv(PERSONA_DIR / "persona.csv")

    result = ors.createPersonaList(
        split="general",
        size=10,
        selectionMethod="sequence",
    )

    assert len(result) == 10
    assert result.reset_index(drop=True).equals(expected_df.iloc[:10].reset_index(drop=True))

#testing random on real data
def test_create_persona_list_random_seeded_selection_is_stable_with_real_csv():
    first = ors.createPersonaList(
        split="general",
        size=10,
        selectionMethod="random",
        seed=123,
    )
    second = ors.createPersonaList(
        split="general",
        size=10,
        selectionMethod="random",
        seed=123,
    )

    assert len(first) == 10
    assert first["persona"].tolist() == second["persona"].tolist()

#check if selection list is correcly used 
def test_create_persona_list_selected_uses_requested_rows_from_real_csv():
    selection = [0, 4, 9]
    expected_df = pd.read_csv(PERSONA_DIR / "persona.csv")

    result = ors.createPersonaList(
        split="general",
        size=len(selection),
        selectionMethod="selected",
        selectionList=selection,
    )

    assert len(result) == len(selection)
    assert result.reset_index(drop=True).equals(
        expected_df.iloc[selection].reset_index(drop=True)
    )

#testing for a particular splir
def test_create_persona_list_reads_split_specific_csv_file():
    expected_df = pd.read_csv(PERSONA_DIR / "persona_math.csv")

    result = ors.createPersonaList(
        split="math",
        size=5,
        selectionMethod="sequence",
    )

    assert len(result) == 5
    assert result.reset_index(drop=True).equals(expected_df.iloc[:5].reset_index(drop=True))
