from types import SimpleNamespace
#helps create a object
import pandas as pd
import pytest
import sys
import os

#add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import openrouter_sythesis as ors


class FakeChain:
    def __init__(self, recorder):
        self.recorder = recorder

    def batch(self, prompts, return_exceptions, config):
        self.recorder["prompts"] = prompts
        self.recorder["return_exceptions"] = return_exceptions
        self.recorder["config"] = config
        return [SimpleNamespace(content=value) for value in self.recorder["responses"]]


class FakeTemplate:
    def __init__(self, recorder):
        self.recorder = recorder
    #uset to generate the chain in the fly when prompt|model
    def __or__(self, model):
        self.recorder["chain_used"] = True
        self.recorder["model"] = model
        return FakeChain(self.recorder)


@pytest.fixture
def install_fake_model_stack(monkeypatch):
    def _install(responses):
        recorder = {"responses": responses, "chain_used": False, "model": None}
        #patch chat prompt template .from_messages()
        monkeypatch.setattr(
            ors.ChatPromptTemplate,
            "from_messages",
            lambda *args, **kwargs: FakeTemplate(recorder),
        )
        return recorder

    return _install

#mocked df for use
@pytest.fixture
def persona_df():
    return pd.DataFrame({"persona": ["p0", "p1", "p2", "p3"]})

@pytest.fixture
def fake_model():
    return object()

#testing each domian as input
@pytest.mark.parametrize(
    "domain",
    ["math", "instruction", "knowledge", "reasoning", "tool", "npc"],
)
def test_generate_questions_supports_all_domain_inputs(
    monkeypatch, install_fake_model_stack, fake_model, domain
):
    #monkey patch just lets you alter some code to make it predicatable
    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "Ask: {persona}")
    recorder = install_fake_model_stack([f"question-{domain}"])

    results = ors.generateQuestions(personas=["persona-a"], model=fake_model, domain=domain)

    assert results == [f"question-{domain}"]
    assert recorder["chain_used"] is True
    assert recorder["model"] is fake_model
    assert len(recorder["prompts"]) == 1
    assert "personaPrompt" in recorder["prompts"][0]


#mapping input to output (question to answer),ensure the chain doesnt combine the prompts into one
def test_generate_answers_returns_one_answer_per_question(install_fake_model_stack, fake_model):
    recorder = install_fake_model_stack(["a1", "a2"])

    results = ors.generateAnswers(questions=["q1", "q2"], model=fake_model, teacherName="default")

    assert results == ["a1", "a2"]
    assert recorder["model"] is fake_model
    assert len(recorder["prompts"]) == 2

#for usesr defined teacher prompts
def test_generate_answers_accepts_non_default_teacher_name():
    with pytest.raises(
        ors.TeacherPromptNotFoundError,
        match="User Defined teacher prompt not found",
    ):
        ors.generateAnswers(questions=["q1"], model=object(), teacherName="custom-teacher")

#for using default prompts
def test_generate_answers_default_teacher_name_does_not_raise_invalid_teacher_prompt_error(
    install_fake_model_stack, fake_model
):
    install_fake_model_stack(["a1"])

    results = ors.generateAnswers(questions=["q1"], model=fake_model, teacherName="default")

    assert results == ["a1"]

#test if the {}->{{}} conversion is done to ensure langchain doesnt mistake variables
def test_generate_answers_handles_questions_with_curly_braces(
    install_fake_model_stack, fake_model
):
    recorder=install_fake_model_stack(["a1", "a2"])

    results = ors.generateAnswers(
        questions=["What does {x} mean?", "Compare {a} with {b}."],
        model=fake_model,
        teacherName="default",
    )

    assert len(results) == 2
    assert recorder["model"] is fake_model
    assert recorder["prompts"][0]["question"] == "What does {{x}} mean?"
    assert recorder["prompts"][1]["question"] == "Compare {{a}} with {{b}}."

@pytest.mark.parametrize(
    ("split", "expected_filename"),
    [
        ("general", "persona.csv"),
        ("math", "persona_math.csv"),
        ("instruction", "persona_instruction.csv"),
        ("knowledge", "persona_knowledge.csv"),
        ("reasoning", "persona_reasoning.csv"),
        ("tool", "persona_tool.csv"),
        ("npc", "persona_npc.csv"),
    ],
)
#sanity check to see if it reads the correct file path
def test_create_persona_list_reads_expected_dataset_file(
    monkeypatch, persona_df, split, expected_filename
):
    captured = {}

    def fake_read_csv(path):
        captured["path"] = path
        return persona_df

    monkeypatch.setattr(ors.pd, "read_csv", fake_read_csv)

    result = ors.createPersonaList(

        split=split,
        size=1,
        selectionMethod="sequence",
    )

    assert len(result) == 1
    assert captured["path"].endswith(expected_filename)

#checks if the sequence works for the mocked df
def test_create_persona_list_sequence_returns_first_rows(monkeypatch, persona_df):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    result = ors.createPersonaList(size=2, selectionMethod="sequence")

    assert result["persona"].tolist() == ["p0", "p1"]

#sanity check if random is acutually seeded ,by checking if they return same results
def test_create_persona_list_random_is_seeded(monkeypatch, persona_df):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    first = ors.createPersonaList(size=2, selectionMethod="random", seed=7)
    second = ors.createPersonaList(size=2, selectionMethod="random", seed=7)

    assert first["persona"].tolist() == second["persona"].tolist()
    assert len(first) == 2

#check for displaying the warning if list > size
def test_create_persona_list_selected_mode_uses_selection_list(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.warns(UserWarning):
        result = ors.createPersonaList(
            size=1,
            selectionMethod="selected",
            selectionList=[1, 3],
        )

    assert result["persona"].tolist() == ["p1", "p3"]

#test to ensure value error is raised when there is no selection list
def test_create_persona_list_selected_mode_requires_selection_list(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.raises(ValueError):
        ors.createPersonaList(size=1, selectionMethod="selected", selectionList=None)

#check the warning when size > len(df) number of rows in d
def test_create_persona_list_warns_when_size_exceeds_dataset(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.warns(UserWarning):
        result = ors.createPersonaList(size=10, selectionMethod="sequence")

    assert len(result) == len(persona_df)

#throw file not found errors
def test_create_persona_list_wraps_dataset_load_errors(monkeypatch):
    monkeypatch.setattr(
        ors.pd,
        "read_csv",
        lambda _path: (_ for _ in ()).throw(FileNotFoundError("missing")),
    )

    with pytest.raises(Exception, match="Dataset file not found in path:"):
        ors.createPersonaList(split="math", size=1, selectionMethod="sequence")
