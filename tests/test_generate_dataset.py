import os
import sys

import pandas as pd
import pytest

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import generate
from models import personaSplitsChoices


def _capture_to_csv(monkeypatch):
    captured = {}

    def fake_to_csv(self, path, index=False):
        captured["path"] = path
        captured["index"] = index
        captured["df"] = self.copy()

    monkeypatch.setattr(pd.DataFrame, "to_csv", fake_to_csv)
    return captured


def test_generate_dataset_writes_expected_rows_for_single_config(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    captured_calls = {}

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
        generationModel="gen-model",
        teacherModel="teacher-model",
        datasetName="sample",
    )

    assert captured["path"] == generate.DATASET_FOLDER + "sample.csv"
    assert captured["index"] is False
    assert captured_calls == {
        "generation_model": "gen-model",
        "domain": "math",
        "teacher_model": "teacher-model",
    }
    assert captured["df"].columns.tolist() == ["input persona", "Question", "Answer"]
    assert captured["df"].to_dict("records") == [
        {"input persona": "persona-1", "Question": "math-q-0", "Answer": "answer-0"},
        {"input persona": "persona-2", "Question": "math-q-1", "Answer": "answer-1"},
    ]


def test_generate_dataset_combines_multiple_domain_configs_in_order(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
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
        generationModel="gen-model",
        teacherModel="teacher-model",
        datasetName="combined",
    )

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


def test_generate_dataset_rejects_unknown_generation_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["teacher-model"])

    with pytest.raises(ValueError, match="generation model id"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel="missing-gen-model",
            teacherModel="teacher-model",
        )


def test_generate_dataset_rejects_unknown_teacher_model(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model"])

    with pytest.raises(ValueError, match="teacher model id"):
        generate.generateDataset(
            datasetConfig=[{"math": personaSplitsChoices(size=1)}],
            datasetSize=1,
            generationModel="gen-model",
            teacherModel="missing-teacher-model",
        )


def test_generate_dataset_writes_empty_dataset_when_no_configs(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
    monkeypatch.setattr(
        generate,
        "createPersonaList",
        lambda **_kwargs: pytest.fail("createPersonaList should not be called for empty config"),
    )
    captured = _capture_to_csv(monkeypatch)

    generate.generateDataset(
        datasetConfig=[],
        datasetSize=0,
        generationModel="gen-model",
        teacherModel="teacher-model",
        datasetName="empty",
    )

    assert captured["path"] == generate.DATASET_FOLDER + "empty.csv"
    assert captured["df"].empty
    assert captured["df"].columns.tolist() == ["input persona", "Question", "Answer"]


def test_generate_dataset_propagates_generation_failures(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
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
            generationModel="gen-model",
            teacherModel="teacher-model",
        )


def test_generate_dataset_propagates_answer_generation_failures(monkeypatch):
    monkeypatch.setattr(generate, "openrouterModelList", ["gen-model", "teacher-model"])
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
            generationModel="gen-model",
            teacherModel="teacher-model",
        )
