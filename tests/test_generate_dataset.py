import os
import sys

import pandas as pd
import pytest

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import generate
from exceptions import GenerationModelNotFoundError, TeacherModelNotFoundError
from models import generationModelConfig, personaSplitsChoices, teacherModelConfig


class FakeModelConfig:
    def __init__(self, model_id, instance=None, raise_on_create=None):
        self.modelId = model_id
        self._instance = object() if instance is None else instance
        self._raise_on_create = raise_on_create
        self.create_calls = 0

    def createModelInstance(self):
        self.create_calls += 1
        if self._raise_on_create is not None:
            raise self._raise_on_create
        return self._instance


class FakeResponse:
    def __init__(self, content):
        self.content = content


# to mimic saving of the df at the end

def _capture_to_csv(monkeypatch):
    captured = {}

    def fake_to_csv(self, path, index=False):
        captured["path"] = path
        captured["index"] = index
        captured["df"] = self.copy()

    monkeypatch.setattr(pd.DataFrame, "to_csv", fake_to_csv)
    return captured


@pytest.fixture
def valid_models(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model", "split-gen", "split-teacher"])
    return FakeModelConfig("gen-model", "GEN"), FakeModelConfig("teacher-model", "TEACHER")

#empty list as input raises error
def test_generate_dataset_raises_when_dataset_config_is_empty(valid_models):
    gen_model, teacher_model = valid_models

    with pytest.raises(ValueError):
        generate.generateDataset(
            datasetConfig=[],
            datasetSize=1,
            generationModel=gen_model,
            teacherModel=teacher_model,
        )

#when the dataset size is zero or None
@pytest.mark.parametrize("dataset_size", [None, 0])
def test_generate_dataset_raises_when_dataset_size_invalid(valid_models, dataset_size):
    gen_model, teacher_model = valid_models

    with pytest.raises(ValueError):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=dataset_size,
            generationModel=gen_model,
            teacherModel=teacher_model,
        )

#for unknown global model
def test_generate_dataset_raises_for_unknown_global_generation_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["teacher-model"])

    with pytest.raises(GenerationModelNotFoundError):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=FakeModelConfig("missing-gen"),
            teacherModel=FakeModelConfig("teacher-model"),
        )

#global teacher is unknown
def test_generate_dataset_raises_for_unknown_global_teacher_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model"])

    with pytest.raises(TeacherModelNotFoundError):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=FakeModelConfig("gen-model"),
            teacherModel=FakeModelConfig("missing-teacher"),
        )

#failed to create instance of generation model
def test_generate_dataset_raises_if_global_model_instance_creation_fails(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])

    with pytest.raises(RuntimeError, match="bad generation init"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=FakeModelConfig("gen-model", raise_on_create=RuntimeError("bad generation init")),
            teacherModel=FakeModelConfig("teacher-model"),
        )


@pytest.mark.parametrize(
    "persona_error",
    [
        ValueError("bad persona file"),
        FileNotFoundError("missing persona file"),
        KeyError("persona"),
    ],
)
def test_generate_dataset_collects_non_retryable_persona_read_errors_and_continues(
    monkeypatch,
    valid_models,
    persona_error,
):
    gen_model, teacher_model = valid_models

    def fake_create_persona_list(**kwargs):
        if kwargs["split"] == "math":
            raise persona_error
        return pd.DataFrame({"persona": ["instruction-p1", "instruction-p2"]})

    monkeypatch.setattr(generate, "createPersonaList", fake_create_persona_list)
    monkeypatch.setattr(
        generate,
        "generateQuestions",
        lambda personas, model, domain: [FakeResponse(f"{domain}-q-{i}") for i, _ in enumerate(personas)],
    )
    monkeypatch.setattr(
        generate,
        "generateAnswers",
        lambda questions, model: [FakeResponse(f"a-{i}") for i, _ in enumerate(questions)],
    )
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[
            {"math": personaSplitsChoices(split="math", size=1)},
            {"instruction": personaSplitsChoices(split="instruction", size=2)},
        ],
        datasetSize=3,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="persona-read-error",
    )

    assert stats["totalSplits"] == 2
    assert stats["successfulSplits"] == 1
    assert stats["failedSplits"] == 1
    assert stats["rowsGenerated"] == 2
    assert stats["rowsFailed"] == 1
    assert len(stats["errors"]) == 1
    assert stats["errors"][0]["stage"] == "persona_read"
    assert stats["errors"][0]["retryable"] is False
    assert captured["path"].endswith("persona-read-error.csv")
    assert captured["df"].to_dict("records") == [
        {"input persona": "instruction-p1", "domain": "instruction", "Question": "instruction-q-0", "Answer": "a-0"},
        {"input persona": "instruction-p2", "domain": "instruction", "Question": "instruction-q-1", "Answer": "a-1"},
    ]
    assert stats["errors"][0]['message']==str(persona_error)

#mark empty personaList as non-retryable and continues
def test_generate_dataset_marks_empty_persona_list_as_non_retryable(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": []}))
    monkeypatch.setattr(generate, "generateQuestions", lambda **_kwargs: pytest.fail("no model call expected"))
    monkeypatch.setattr(generate, "generateAnswers", lambda **_kwargs: pytest.fail("no model call expected"))
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
        datasetSize=1,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="empty-personas",
    )

    assert stats["failedSplits"] == 1
    assert stats["successfulSplits"] == 0
    assert stats["rowsGenerated"] == 0
    assert stats["rowsFailed"] == 1
    assert stats["errors"][0]["stage"] == "persona_read"
    assert stats["errors"][0]["retryable"] is False
    assert stats["errors"][0]["message"]== "Persona list is empty"
    assert stats["errors"][0]["errorType"]== type(ValueError()).__name__

    assert captured["df"].empty

#test rate limit exceptions return during question generation
def test_generate_dataset_collects_retryable_question_errors_and_stops_future_model_calls(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    question_calls = []
    answer_calls = []
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **kwargs: pd.DataFrame({"persona": [f"{kwargs['split']}-p1", f"{kwargs['split']}-p2"]}),
    )

    def fake_generate_questions(personas, model, domain):
        question_calls.append(domain)
        if domain == "math":
            return [RuntimeError("rate limit"), FakeResponse("math-q2")]
        return [FakeResponse(f"{domain}-q1"), FakeResponse(f"{domain}-q2")]

    def fake_generate_answers(questions, model):
        answer_calls.append(list(questions))
        return [FakeResponse(f"ans-{i}") for i, _ in enumerate(questions)]

    monkeypatch.setattr(generate, "generateQuestions", fake_generate_questions)
    monkeypatch.setattr(generate, "generateAnswers", fake_generate_answers)
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[
            {"math": personaSplitsChoices(split="math", size=2)},
            {"tool": personaSplitsChoices(split="tool", size=2)},
        ],
        datasetSize=4,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="question-exception",
    )

    assert question_calls == ["math"]
    # answers are skipped once exception policy activates
    assert answer_calls == []
    assert stats["totalSplits"] == 2
    assert stats["failedSplits"] == 2
    assert stats["rowsGenerated"] == 0
    assert stats["rowsFailed"] == 4
    assert any(e["stage"] == "question_generation" and e["retryable"] is True for e in stats["errors"])
    assert captured["df"].shape[0] == 4
    assert stats['errors'][0]['errorType'] ==type(RuntimeError()).__name__
    assert stats['errors'][0]['message'] =="rate limit"

#Test when answer generation return error and future calls are skipped
def test_generate_dataset_collects_retryable_answer_errors_and_stops_future_model_calls(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    question_calls = []
    answer_calls = []
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **kwargs: pd.DataFrame({"persona": [f"{kwargs['split']}-p1", f"{kwargs['split']}-p2"]}),
    )

    def fake_generate_questions(personas, model, domain):
        question_calls.append(domain)
        return [FakeResponse(f"{domain}-q1"), FakeResponse(f"{domain}-q2")]

    def fake_generate_answers(questions, model):
        answer_calls.append(list(questions))
        if len(answer_calls) == 1:
            return [RuntimeError("provider unavailable"), FakeResponse("a2")]
        return [FakeResponse("a1"), FakeResponse("a2")]

    monkeypatch.setattr(generate, "generateQuestions", fake_generate_questions)
    monkeypatch.setattr(generate, "generateAnswers", fake_generate_answers)
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[
            {"math": personaSplitsChoices(split="math", size=2)},
            {"tool": personaSplitsChoices(split="tool", size=2)},
        ],
        datasetSize=4,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="answer-exception",
    )

    assert question_calls == ["math" ]
    assert len(answer_calls) == 1
    assert stats["totalSplits"] == 2
    assert stats["failedSplits"] == 2
    assert stats["rowsGenerated"] == 1
    assert stats["rowsFailed"] == 3
    assert any(e["stage"] == "answer_generation" and e["retryable"] is True for e in stats["errors"])
    assert captured["df"].shape[0] == 4
    assert stats['errors'][0]['errorType'] ==type(RuntimeError()).__name__
    assert stats['errors'][0]['message'] =="provider unavailable"

#empty generation of question returned from model
@pytest.mark.parametrize("empty_value", [None, []])
def test_generate_dataset_marks_empty_question_generation_as_non_retryable(monkeypatch, valid_models, empty_value):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))
    monkeypatch.setattr(generate, "generateQuestions", lambda **_kwargs: empty_value)
    monkeypatch.setattr(generate, "generateAnswers", lambda **_kwargs: pytest.fail("answer call should not happen"))
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
        datasetSize=1,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="empty-question-gen",
    )

    assert stats["successfulSplits"] == 0
    assert stats["failedSplits"] == 1
    assert stats["rowsGenerated"] == 0
    assert stats["rowsFailed"] == 1
    assert stats["errors"][0]["stage"] == "question_generation"
    assert stats["errors"][0]["retryable"] is False
    assert stats["errors"][0]["message"] == "Generated question list is empty"
    assert stats["errors"][0]["errorType"] == type(ValueError()).__name__
    assert captured["df"].empty


@pytest.mark.parametrize("empty_value", [None, []])
def test_generate_dataset_marks_empty_answer_generation_as_non_retryable(monkeypatch, valid_models, empty_value):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))
    monkeypatch.setattr(generate, "generateQuestions", lambda **_kwargs: [FakeResponse("q1")])
    monkeypatch.setattr(generate, "generateAnswers", lambda **_kwargs: empty_value)
    captured = _capture_to_csv(monkeypatch)

    stats = generate.generateDataset(
        datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
        datasetSize=1,
        generationModel=gen_model,
        teacherModel=teacher_model,
        datasetName="empty-answer-gen",
    )

    assert stats["successfulSplits"] == 0
    assert stats["failedSplits"] == 1
    assert stats["rowsGenerated"] == 0
    assert stats["rowsFailed"] == 1
    assert stats["errors"][0]["stage"] == "answer_generation"
    assert stats["errors"][0]["retryable"] is False
    assert stats["errors"][0]["message"] == "Generated answer list is empty"
    assert stats["errors"][0]["errorType"] == type(ValueError()).__name__
    assert captured["df"].empty


@pytest.mark.parametrize(
    "split_gen_model_id,split_teacher_model_id,expected_gen_model,expected_teacher_model",
    [
        (None, None, "GEN", "TEACHER"),
        ("split-gen", None, "SPLIT-GEN", "TEACHER"),
        (None, "split-teacher", "GEN", "SPLIT-TEACHER"),
        ("split-gen", "split-teacher", "SPLIT-GEN", "SPLIT-TEACHER"),
        ("missing-gen", "missing-teacher", "GEN", "TEACHER"),
    ],
)
def test_generate_dataset_uses_split_model_overrides_when_available(
    monkeypatch,
    split_gen_model_id,
    split_teacher_model_id,
    expected_gen_model,
    expected_teacher_model,
):
    monkeypatch.setattr(
        generate,
        "openrouterModelList",
        ["gen-model", "teacher-model", "split-gen", "split-teacher"],
    )

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))

    observed = {}

    def fake_generate_questions(personas, model, domain):
        observed["q_model"] = model
        observed["domain"] = domain
        return [FakeResponse("q1")]

    def fake_generate_answers(questions, model):
        observed["a_model"] = model
        return [FakeResponse("a1")]

    monkeypatch.setattr(generate, "generateQuestions", fake_generate_questions)
    monkeypatch.setattr(generate, "generateAnswers", fake_generate_answers)
    captured = _capture_to_csv(monkeypatch)

    def fake_split_gen_instance(self):
        if self.modelId == "split-gen":
            return "SPLIT-GEN"
        return f"UNEXPECTED-SPLIT-GEN:{self.modelId}"

    def fake_split_teacher_instance(self):
        if self.modelId == "split-teacher":
            return "SPLIT-TEACHER"
        return f"UNEXPECTED-SPLIT-TEACHER:{self.modelId}"

    monkeypatch.setattr(generationModelConfig, "createModelInstance", fake_split_gen_instance)
    monkeypatch.setattr(teacherModelConfig, "createModelInstance", fake_split_teacher_instance)

    global_gen = FakeModelConfig("gen-model", "GEN")
    global_teacher = FakeModelConfig("teacher-model", "TEACHER")
    split_gen = generationModelConfig(modelId=split_gen_model_id) if split_gen_model_id else None
    split_teacher = teacherModelConfig(modelId=split_teacher_model_id) if split_teacher_model_id else None

    stats = generate.generateDataset(
        datasetConfig=[
            {
                "math": personaSplitsChoices(
                    split="math",
                    size=1,
                    generationModel=split_gen,
                    teacherModel=split_teacher,
                )
            }
        ],
        datasetSize=1,
        generationModel=global_gen,
        teacherModel=global_teacher,
        datasetName="override-check",
    )

    assert observed["domain"] == "math"
    assert observed["q_model"] == expected_gen_model
    assert observed["a_model"] == expected_teacher_model
    assert stats["rowsGenerated"] == 1
    assert stats["rowsFailed"] == 0
    assert captured["df"].to_dict("records") == [
        {"input persona": "p1", "domain": "math", "Question": "q1", "Answer": "a1"}
    ]


def test_generate_dataset_raises_on_question_call_exception_outside_loop_handling(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))
    monkeypatch.setattr(
        generate,
        "generateQuestions",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("question call failed")),
    )

    with pytest.raises(RuntimeError, match="question call failed"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
            datasetSize=1,
            generationModel=gen_model,
            teacherModel=teacher_model,
        )


def test_generate_dataset_raises_on_answer_call_exception_outside_loop_handling(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))
    monkeypatch.setattr(generate, "generateQuestions", lambda **_kwargs: [FakeResponse("q1")])
    monkeypatch.setattr(
        generate,
        "generateAnswers",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("answer call failed")),
    )

    with pytest.raises(RuntimeError, match="answer call failed"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
            datasetSize=1,
            generationModel=gen_model,
            teacherModel=teacher_model,
        )


def test_generate_dataset_raises_if_dataset_save_fails(monkeypatch, valid_models):
    gen_model, teacher_model = valid_models

    monkeypatch.setattr(generate, "createPersonaList", lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}))
    monkeypatch.setattr(generate, "generateQuestions", lambda **_kwargs: [FakeResponse("q1")])
    monkeypatch.setattr(generate, "generateAnswers", lambda **_kwargs: [FakeResponse("a1")])

    def fail_to_csv(*_args, **_kwargs):
        raise OSError("disk full")

    monkeypatch.setattr(pd.DataFrame, "to_csv", fail_to_csv)

    with pytest.raises(OSError, match="disk full"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(split="math", size=1)}],
            datasetSize=1,
            generationModel=gen_model,
            teacherModel=teacher_model,
            datasetName="save-fail",
        )
