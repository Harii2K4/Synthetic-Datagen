import pandas as pd
import pytest
import sys
import os
#add parent dir to the sys path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


import openrouter_sythesis as ors
from prompts import domain_templates


class DummyAIMessage:
    def __init__(self, content: str):
        self.content = content


class DummyPrompt:
    def __init__(self, messages):
        self.messages = messages

    def format_prompt(self):
        return {"formatted": self.messages}


class DummyBatchTemplate:
    def __init__(self, messages, capture):
        self.messages = messages
        self.capture = capture

    def __or__(self, model):
        self.capture["batch_model"] = model

        class Chain:
            def __init__(self, capture):
                self.capture = capture

            def batch(self, prompts):
                self.capture["batch_prompts"] = prompts
                return [DummyAIMessage(f"resp_{i}") for i, _ in enumerate(prompts)]

        return Chain(self.capture)


class DummyChatPromptTemplate:
    def __init__(self, messages):
        self.messages = messages

    def format_prompt(self):
        return {"formatted": self.messages}


class DummyBatchPromptFactory:
    def __init__(self, capture):
        self.capture = capture

    def __call__(self, messages):
        self.capture["constructor_messages"] = messages
        return DummyPrompt(messages)

    def from_messages(self, messages):
        self.capture["from_messages"] = messages
        return DummyBatchTemplate(messages, self.capture)


class DummyChatOpenRouter:
    def __init__(self, model, temperature, capture):
        self.capture = capture
        self.capture["model"] = model
        self.capture["temperature"] = temperature

    def invoke(self, input):
        self.capture["invoke_input"] = input
        return DummyAIMessage("single_response")


def test_get_domain_template_returns_expected_template_for_each_domain():
    assert ors.getDomainTemplate("math") == domain_templates.mathTemplate
    assert ors.getDomainTemplate("instruction") == domain_templates.instructionTemplate
    assert ors.getDomainTemplate("knowledge") == domain_templates.knowledgeTemplate
    assert ors.getDomainTemplate("reasoning") == domain_templates.reasoningTemplate
    assert ors.getDomainTemplate("tool") == domain_templates.toolTemplate
    assert ors.getDomainTemplate("npc") == domain_templates.npcTemplate


def test_generate_questions_single_persona(monkeypatch):
    capture = {}
    prompt_factory = DummyBatchPromptFactory(capture)

    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "Domain: {persona}")
    monkeypatch.setattr(ors, "ChatPromptTemplate", prompt_factory)
    monkeypatch.setattr(
        ors,
        "ChatOpenRouter",
        lambda model, temperature: DummyChatOpenRouter(model, temperature, capture),
    )

    result = ors.generateQuestions("teacher", model="test-model", domain="math")

    assert result == "single_response"
    assert capture["constructor_messages"] == [("system", "Domain: teacher")]
    assert capture["model"] == "test-model"
    assert capture["temperature"] == 0
    assert capture["invoke_input"] == {"formatted": [("system", "Domain: teacher")]}


def test_generate_questions_list_persona_batch_success_with_positional_template(monkeypatch):
    capture = {}
    prompt_factory = DummyBatchPromptFactory(capture)

    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "{}")
    monkeypatch.setattr(ors, "ChatPromptTemplate", prompt_factory)
    monkeypatch.setattr(
        ors,
        "ChatOpenRouter",
        lambda model, temperature: DummyChatOpenRouter(model, temperature, capture),
    )

    result = ors.generateQuestions(["p1", "p2"], model="batch-model", domain="math")

    assert result == ["resp_0", "resp_1"]
    assert capture["from_messages"] == [("system", "{personaPrompt}")]
    assert capture["batch_prompts"] == [{"personaPrompts": "p1"}, {"personaPrompts": "p2"}]


def test_generate_questions_list_persona_with_named_template_raises_key_error(monkeypatch):
    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "Domain: {persona}")

    with pytest.raises(KeyError):
        ors.generateQuestions(["p1", "p2"], domain="math")


def test_generate_questions_non_string_non_iterable_persona_raises(monkeypatch):
    monkeypatch.setattr(ors, "getDomainTemplate", lambda _domain: "{}")

    with pytest.raises(TypeError):
        ors.generateQuestions(123, domain="math")


def test_generate_answers_single_question_escapes_braces(monkeypatch):
    capture = {}
    prompt_factory = DummyBatchPromptFactory(capture)

    monkeypatch.setattr(ors, "ChatPromptTemplate", prompt_factory)
    monkeypatch.setattr(
        ors,
        "ChatOpenRouter",
        lambda model, temperature: DummyChatOpenRouter(model, temperature, capture),
    )

    result = ors.generateAnswers("Solve {x} + {y}", model="ans-model")

    assert result == "single_response"
    assert capture["constructor_messages"][0][0] == "system"
    assert capture["constructor_messages"][1] == ("user", "Solve {{x}} + {{y}}")


def test_generate_answers_single_custom_teacher_name_uses_default_prompt_path(monkeypatch):
    capture = {}
    prompt_factory = DummyBatchPromptFactory(capture)

    monkeypatch.setattr(ors, "ChatPromptTemplate", prompt_factory)
    monkeypatch.setattr(
        ors,
        "ChatOpenRouter",
        lambda model, temperature: DummyChatOpenRouter(model, temperature, capture),
    )

    result = ors.generateAnswers("Q", teacherName="custom")

    assert result == "single_response"
    assert capture["constructor_messages"][0][0] == "system"


def test_generate_answers_batch_questions(monkeypatch):
    capture = {}
    prompt_factory = DummyBatchPromptFactory(capture)

    monkeypatch.setattr(ors, "ChatPromptTemplate", prompt_factory)
    monkeypatch.setattr(
        ors,
        "ChatOpenRouter",
        lambda model, temperature: DummyChatOpenRouter(model, temperature, capture),
    )

    result = ors.generateAnswers(["A {1}", "B"], model="batch-ans")

    assert result == ["resp_0", "resp_1"]
    assert capture["from_messages"] == [("system", "{systemPrompt}"), ("user", "{question}")]
    assert capture["batch_prompts"][0]["user"] == "A {{1}}"
    assert capture["batch_prompts"][1]["user"] == "B"


def test_generate_answers_non_iterable_question_raises():
    with pytest.raises(TypeError):
        ors.generateAnswers(123)


def test_create_persona_list_general_uses_persona_csv(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1"]})
    capture = {}

    def fake_read_csv(path):
        capture["path"] = path
        return df

    monkeypatch.setattr(ors.pd, "read_csv", fake_read_csv)

    result = ors.createPersonaList(respository="general", size=1, selection="sequence")

    assert capture["path"].endswith("persona.csv")
    assert result["persona"].tolist() == ["p0"]


def test_create_persona_list_domain_specific_file(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1"]})
    capture = {}

    def fake_read_csv(path):
        capture["path"] = path
        return df

    monkeypatch.setattr(ors.pd, "read_csv", fake_read_csv)

    ors.createPersonaList(respository="math", size=1, selection="sequence")

    assert capture["path"].endswith("persona_math.csv")


def test_create_persona_list_sequence(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1", "p2", "p3"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    result = ors.createPersonaList(size=2, selection="sequence")

    assert result["persona"].tolist() == ["p0", "p1"]


def test_create_persona_list_random_deterministic(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1", "p2", "p3", "p4"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    result_a = ors.createPersonaList(size=3, selection="random", seed=123)
    result_b = ors.createPersonaList(size=3, selection="random", seed=123)

    assert result_a["persona"].tolist() == result_b["persona"].tolist()
    assert len(result_a) == 3


def test_create_persona_list_selected(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1", "p2", "p3"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    result = ors.createPersonaList(size=2, selection="selected", selectionList=[1, 3])

    assert result["persona"].tolist() == ["p1", "p3"]


def test_create_persona_list_selected_without_list_raises(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    with pytest.raises(ValueError, match="selection list is None"):
        ors.createPersonaList(size=1, selection="selected", selectionList=None)


def test_create_persona_list_selected_size_mismatch_warns(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1", "p2"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    with pytest.warns(UserWarning, match="size and selection list size are not equal"):
        result = ors.createPersonaList(size=1, selection="selected", selectionList=[0, 2])

    assert result["persona"].tolist() == ["p0", "p2"]


def test_create_persona_list_size_greater_than_dataset_warns_and_returns_all(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    with pytest.warns(UserWarning, match="size is greater than dataset size"):
        result = ors.createPersonaList(size=10)

    assert result.equals(df)


def test_create_persona_list_dataset_load_error(monkeypatch):
    def raise_error(_):
        raise FileNotFoundError("missing file")

    monkeypatch.setattr(ors.pd, "read_csv", raise_error)

    with pytest.raises(Exception, match="Error loading dataset"):
        ors.createPersonaList()


def test_create_persona_list_invalid_selection_raises_unboundlocalerror(monkeypatch):
    df = pd.DataFrame({"persona": ["p0", "p1"]})
    monkeypatch.setattr(ors.pd, "read_csv", lambda _: df)

    with pytest.raises(UnboundLocalError):
        ors.createPersonaList(size=1, selection="invalid")
