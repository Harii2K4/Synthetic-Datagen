import os
import sys

import pandas as pd
import pytest

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import generate
from exceptions import GenerationModelNotFoundError, TeacherModelNotFoundError
from models import generationModelConfig, personaSplitsChoices, teacherModelConfig

#to mimic saving of the df at the end
def _capture_to_csv(monkeypatch):
    captured = {}

    def fake_to_csv(self, path, index=False):
        captured["path"] = path
        captured["index"] = index
        captured["df"] = self.copy()

    monkeypatch.setattr(pd.DataFrame, "to_csv", fake_to_csv)
    return captured


class FakeModelConfig:
    def __init__(self, model_id, instance):
        self.modelId = model_id
        self._instance = instance
        self.create_calls = 0

    def createModelInstance(self):
        self.create_calls += 1
        return self._instance


#sanity test for output and input schema verification
def test_generate_dataset_writes_expected_rows_for_single_config(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    captured_calls = {}
    generation_instance = object()
    teacher_instance = object()
    generation_model = FakeModelConfig("gen-model", generation_instance)
    teacher_model = FakeModelConfig("teacher-model", teacher_instance)

    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **_kwargs: pd.DataFrame({"persona": ["persona-1", "persona-2"]}),
    )

    def fake_generate_questions(personas, model, domain):
        captured_calls["generation_model"] = model
        captured_calls["domain"] = domain
        return [f"{domain}-q-{i}" for i, _ in enumerate(personas)]

    def fake_generate_answers(questions, model):
        captured_calls["teacher_model"] = model
        return [f"answer-{i}" for i, _ in enumerate(questions)]

    monkeypatch.setattr(generate, "generateQuestions", fake_generate_questions)
    monkeypatch.setattr(generate, "generateAnswers", fake_generate_answers)
    captured = _capture_to_csv(monkeypatch)

    generate.generateDataset(
        datasetConfig=[{"math": personaSplitsChoices(size=2)}],
        datasetSize=2,
        generationModel=generation_model,
        teacherModel=teacher_model,
        datasetName="sample",
    )

    assert captured["path"] == generate.DATASET_FOLDER + "sample.csv"
    assert captured["index"] is False
    assert captured_calls == {
        "generation_model": generation_instance,
        "domain": "math",
        "teacher_model": teacher_instance,
    }
    assert generation_model.create_calls == 1
    assert teacher_model.create_calls == 1
    assert captured["df"].columns.tolist() == ["input persona", "Question", "Answer"]
    assert captured["df"].to_dict("records") == [
        {"input persona": "persona-1", "Question": "math-q-0", "Answer": "answer-0"},
        {"input persona": "persona-2", "Question": "math-q-1", "Answer": "answer-1"},
    ]

#testing multiple splits
def test_generate_dataset_combines_multiple_domain_configs_in_order(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    generation_model = FakeModelConfig("gen-model", object())
    teacher_model = FakeModelConfig("teacher-model", object())
    persona_by_domain = {
        "math": pd.DataFrame({"persona": ["math-persona"]}),
        "tool": pd.DataFrame({"persona": ["tool-persona"]}),
    }

    def fake_create_persona_list(**kwargs):
        return persona_by_domain[kwargs["split"]]

    monkeypatch.setattr(generate, "createPersonaList", fake_create_persona_list)
    monkeypatch.setattr(
        generate,
        "generateQuestions",
        lambda personas, model, domain: [f"{domain}-question-for-{personas[0]}"],
    )
    monkeypatch.setattr(
        generate,
        "generateAnswers",
        lambda questions, model: [f"answer:{questions[0]}"],
    )
    captured = _capture_to_csv(monkeypatch)

    generate.generateDataset(
        datasetConfig=[
            {"math": personaSplitsChoices(split="math", size=1)},
            {"tool": personaSplitsChoices(split="tool", size=1)},
        ],
        datasetSize=2,
        generationModel=generation_model,
        teacherModel=teacher_model,
        datasetName="combined",
    )

    assert generation_model.create_calls == 1
    assert teacher_model.create_calls == 1
    assert captured["df"].to_dict("records") == [
        {
            "input persona": "math-persona",
            "Question": "math-question-for-math-persona",
            "Answer": "answer:math-question-for-math-persona",
        },
        {
            "input persona": "tool-persona",
            "Question": "tool-question-for-tool-persona",
            "Answer": "answer:tool-question-for-tool-persona",
        },
    ]

#errora raised due to missing gen model id
def test_generate_dataset_rejects_unknown_generation_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["teacher-model"])
    generation_model = FakeModelConfig("missing-gen-model", object())
    teacher_model = FakeModelConfig("teacher-model", object())

    with pytest.raises(GenerationModelNotFoundError, match="generation model id"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=generation_model,
            teacherModel=teacher_model,
        )

#errors raised due to model not being found
def test_generate_dataset_rejects_unknown_teacher_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model"])
    generation_model = FakeModelConfig("gen-model", object())
    teacher_model = FakeModelConfig("missing-teacher-model", object())

    with pytest.raises(TeacherModelNotFoundError, match="teacher model id"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=generation_model,
            teacherModel=teacher_model,
        )

#to raise Value Error when no split configs are sent in 
def test_generate_dataset_writes_empty_dataset_when_no_configs(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    generation_model = FakeModelConfig("gen-model", object())
    teacher_model = FakeModelConfig("teacher-model", object())

    with pytest.raises(ValueError):
        generate.generateDataset(
            datasetConfig=[],
            datasetSize=0,
            generationModel=generation_model,
            teacherModel=teacher_model,
            datasetName="empty",
        )


#api errors while calling the models
def test_generate_dataset_propagates_generation_failures(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    generation_model = FakeModelConfig("gen-model", object())
    teacher_model = FakeModelConfig("teacher-model", object())
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}),
    )
    monkeypatch.setattr(
        generate,
        "generateQuestions",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("api unavailable")),
    )
    monkeypatch.setattr(
        pd.DataFrame,
        "to_csv",
        lambda *_args, **_kwargs: pytest.fail("Dataset should not be saved on generation failure"),
    )

    with pytest.raises(RuntimeError, match="api unavailable"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=generation_model,
            teacherModel=teacher_model,
        )

#when teacher api calls fail
def test_generate_dataset_propagates_answer_generation_failures(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    generation_model = FakeModelConfig("gen-model", object())
    teacher_model = FakeModelConfig("teacher-model", object())
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **_kwargs: pd.DataFrame({"persona": ["p1"]}),
    )
    monkeypatch.setattr(
        generate,
        "generateQuestions",
        lambda **_kwargs: ["q1"],
    )
    monkeypatch.setattr(
        generate,
        "generateAnswers",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("teacher api unavailable")),
    )
    monkeypatch.setattr(
        pd.DataFrame,
        "to_csv",
        lambda *_args, **_kwargs: pytest.fail("Dataset should not be saved on answer failure"),
    )

    with pytest.raises(RuntimeError, match="teacher api unavailable"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel=generation_model,
            teacherModel=teacher_model,
        )


@pytest.mark.parametrize(
    "split_gen_model_id,split_teacher_model_id,expected_gen_model,expected_teacher_model",
    [
        (None, None, "global-gen-instance", "global-teacher-instance"),
        ("split-gen-model", None, "split-gen-instance", "global-teacher-instance"),
        (None, "split-teacher-model", "global-gen-instance", "split-teacher-instance"),
        ("split-gen-model", "split-teacher-model", "split-gen-instance", "split-teacher-instance"),
        ("missing-split-gen-model", None, "global-gen-instance", "global-teacher-instance"),
        (None, "missing-split-teacher-model", "global-gen-instance", "global-teacher-instance"),
        (
            "missing-split-gen-model",
            "missing-split-teacher-model",
            "global-gen-instance",
            "global-teacher-instance",
        ),
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
        [
            "global-gen-model",
            "global-teacher-model",
            "split-gen-model",
            "split-teacher-model",
        ],
    )

    # Mock model instance creation to avoid real API clients.
    def fake_create_generation_model_instance(self):
        if self.modelId == "global-gen-model":
            return "global-gen-instance"
        if self.modelId == "split-gen-model":
            return "split-gen-instance"
        return f"unexpected-gen:{self.modelId}"

    def fake_create_teacher_model_instance(self):
        if self.modelId == "global-teacher-model":
            return "global-teacher-instance"
        if self.modelId == "split-teacher-model":
            return "split-teacher-instance"
        return f"unexpected-teacher:{self.modelId}"

    monkeypatch.setattr(generationModelConfig, "createModelInstance", fake_create_generation_model_instance)
    monkeypatch.setattr(teacherModelConfig, "createModelInstance", fake_create_teacher_model_instance)
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **_kwargs: pd.DataFrame({"persona": ["persona-1"]}),
    )

    observed = {}

    def fake_generate_questions(personas, model, domain):
        observed["questions_model"] = model
        observed["domain"] = domain
        return ["q1"]

    def fake_generate_answers(questions, model):
        observed["answers_model"] = model
        return ["a1"]

    monkeypatch.setattr(generate, "generateQuestions", fake_generate_questions)
    monkeypatch.setattr(generate, "generateAnswers", fake_generate_answers)
    captured = _capture_to_csv(monkeypatch)

    split_generation_model = (
        generationModelConfig(modelId=split_gen_model_id) if split_gen_model_id is not None else None
    )
    split_teacher_model = (
        teacherModelConfig(modelId=split_teacher_model_id) if split_teacher_model_id is not None else None
    )

    generate.generateDataset(
        datasetConfig=[
            {
                "math": personaSplitsChoices(
                    size=1,
                    generationModel=split_generation_model,
                    teacherModel=split_teacher_model,
                )
            }
        ],
        datasetSize=1,
        generationModel=generationModelConfig(modelId="global-gen-model"),
        teacherModel=teacherModelConfig(modelId="global-teacher-model"),
        datasetName="override-check",
    )

    assert observed["domain"] == "math"
    assert observed["questions_model"] == expected_gen_model
    assert observed["answers_model"] == expected_teacher_model
    assert captured["df"].to_dict("records") == [
        {"input persona": "persona-1", "Question": "q1", "Answer": "a1"},
    ]
