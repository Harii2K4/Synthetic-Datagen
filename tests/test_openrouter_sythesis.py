from types import SimpleNamespace

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

    def __or__(self, _model):
        self.recorder["chain_used"] = True
        return FakeChain(self.recorder)


@pytest.fixture
def install_fake_model_stack(monkeypatch):
    def _install(responses):
        recorder = {"responses": responses, "chain_used": False}
        monkeypatch.setattr(ors, "ChatOpenRouter", lambda *args, **kwargs: object())
        monkeypatch.setattr(
            ors.ChatPromptTemplate,
            "from_messages",
            lambda *args, **kwargs: FakeTemplate(recorder),
        )
        return recorder

    return _install


@pytest.fixture
def persona_df():
    return pd.DataFrame({"persona": ["p0", "p1", "p2", "p3"]})


@pytest.mark.parametrize(
    "domain",
    ["math", "instruction", "knowledge", "reasoning", "tool", "npc"],
)
def test_generate_questions_supports_all_domain_inputs(
    monkeypatch, install_fake_model_stack, domain
):
    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "Ask: {persona}")
    recorder = install_fake_model_stack([f"question-{domain}"])

    results = ors.generateQuestions(personas=["persona-a"], domain=domain)

    assert results == [f"question-{domain}"]
    assert recorder["chain_used"] is True
    assert len(recorder["prompts"]) == 1
    assert "personaPrompt" in recorder["prompts"][0]


def test_generate_questions_handles_empty_persona_list(
    monkeypatch, install_fake_model_stack
):
    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "Ask: {persona}")
    recorder = install_fake_model_stack([])

    results = ors.generateQuestions(personas=[])

    assert results == []
    assert recorder["prompts"] == []


def test_generate_answers_returns_one_answer_per_question(install_fake_model_stack):
    recorder = install_fake_model_stack(["a1", "a2"])

    results = ors.generateAnswers(questions=["q1", "q2"], teacherName="default")

    assert results == ["a1", "a2"]
    assert len(recorder["prompts"]) == 2


def test_generate_answers_accepts_non_default_teacher_name(install_fake_model_stack):
    install_fake_model_stack(["a1"])

    results = ors.generateAnswers(questions=["q1"], teacherName="custom-teacher")

    assert results == ["a1"]


def test_generate_answers_handles_questions_with_curly_braces(
    install_fake_model_stack,
):
    install_fake_model_stack(["a1", "a2"])

    results = ors.generateAnswers(
        questions=["What does {x} mean?", "Compare {a} with {b}."],
        teacherName="default",
    )

    assert len(results) == 2
    assert all(isinstance(answer, str) for answer in results)


def test_generate_answers_handles_empty_question_list(install_fake_model_stack):
    recorder = install_fake_model_stack([])

    results = ors.generateAnswers(questions=[])

    assert results == []
    assert recorder["prompts"] == []


@pytest.mark.parametrize(
    ("repository", "expected_filename"),
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
def test_create_persona_list_reads_expected_dataset_file(
    monkeypatch, persona_df, repository, expected_filename
):
    captured = {}

    def fake_read_csv(path):
        captured["path"] = path
        return persona_df

    monkeypatch.setattr(ors.pd, "read_csv", fake_read_csv)

    result = ors.createPersonaList(
        respository=repository,
        size=1,
        selection="sequence",
    )

    assert len(result) == 1
    assert captured["path"].endswith(expected_filename)


def test_create_persona_list_sequence_returns_first_rows(monkeypatch, persona_df):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    result = ors.createPersonaList(size=2, selection="sequence")

    assert result["persona"].tolist() == ["p0", "p1"]


def test_create_persona_list_random_is_seeded(monkeypatch, persona_df):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    first = ors.createPersonaList(size=2, selection="random", seed=7)
    second = ors.createPersonaList(size=2, selection="random", seed=7)

    assert first["persona"].tolist() == second["persona"].tolist()
    assert len(first) == 2


def test_create_persona_list_selected_mode_uses_selection_list(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.warns(UserWarning):
        result = ors.createPersonaList(
            size=1,
            selection="selected",
            selectionList=[1, 3],
        )

    assert result["persona"].tolist() == ["p1", "p3"]


def test_create_persona_list_selected_mode_requires_selection_list(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.raises(ValueError):
        ors.createPersonaList(size=1, selection="selected", selectionList=None)


def test_create_persona_list_warns_when_size_exceeds_dataset(
    monkeypatch, persona_df
):
    monkeypatch.setattr(ors.pd, "read_csv", lambda _path: persona_df)

    with pytest.warns(UserWarning):
        result = ors.createPersonaList(size=10, selection="sequence")

    assert len(result) == len(persona_df)


def test_create_persona_list_wraps_dataset_load_errors(monkeypatch):
    monkeypatch.setattr(
        ors.pd,
        "read_csv",
        lambda _path: (_ for _ in ()).throw(FileNotFoundError("missing")),
    )

    with pytest.raises(Exception, match="Error loading dataset"):
        ors.createPersonaList(respository="math", size=1, selection="sequence")
