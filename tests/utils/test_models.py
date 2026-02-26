import os
import sys

import pytest
from pydantic import ValidationError

# add the parent directory to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from utils import models


@pytest.mark.parametrize(
    ("temperature", "expected"),
    [
        (-1.5, 0),
        (0, 0),
        (1.25, 1.25),
        (2, 2),
        (7.3, 2),
    ],
)
def test_model_config_temperature_is_clipped_between_zero_and_two(temperature, expected):
    config = models.ModelConfig(modelId="test-model", temperature=temperature)
    assert config.temperature == expected


@pytest.mark.parametrize("effort", ["xhigh", "high", "medium", "low", "minimal", "none"])
def test_model_config_accepts_all_reasoning_effort_literals(effort):
    config = models.ModelConfig(modelId="test-model", reasoningEffort=effort)
    assert config.reasoningEffort == effort


def test_model_config_rejects_invalid_reasoning_effort_literal():
    with pytest.raises(ValidationError):
        models.ModelConfig(modelId="test-model", reasoningEffort="invalid")


@pytest.mark.parametrize("summary", ["auto", "concise", "detailed"])
def test_model_config_accepts_all_reasoning_summary_literals(summary):
    config = models.ModelConfig(modelId="test-model", reasoningSummary=summary)
    assert config.reasoningSummary == summary


def test_model_config_rejects_invalid_reasoning_summary_literal():
    with pytest.raises(ValidationError):
        models.ModelConfig(modelId="test-model", reasoningSummary="invalid")


def test_model_config_defaults_are_set_as_expected():
    config = models.ModelConfig(modelId="test-model")
    assert config.temperature == 0
    assert config.reasoningEffort == "none"
    assert config.reasoningSummary == "auto"
    assert config.providerPriority is None
    assert config.route is None


def test_model_config_create_model_instance_passes_expected_payload(monkeypatch):
    captured = {}

    class FakeChatOpenRouter:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setattr(models, "ChatOpenRouter", FakeChatOpenRouter)

    config = models.ModelConfig(
        modelId="openrouter/test",
        temperature=1.5,
        reasoningEffort="high",
        reasoningSummary="concise",
        providerPriority=["provider-a", "provider-b"],
        route="fallback-route",
    )

    instance = config.createModelInstance()

    assert isinstance(instance, FakeChatOpenRouter)
    assert captured == {
        "model": "openrouter/test",
        "temperature": 1.5,
        "reasoning": {"effort": "high", "summary": "concise"},
        "openrouter_provider": {"order": ["provider-a", "provider-b"]},
        "route": "fallback-route",
    }


def test_generation_model_config_inherits_and_uses_none_reasoning_default():
    config = models.generationModelConfig(modelId="gen-model")
    assert config.reasoningEffort == "none"


def test_teacher_model_config_inherits_and_uses_medium_reasoning_default():
    config = models.teacherModelConfig(modelId="teacher-model")
    assert config.reasoningEffort == "medium"


@pytest.mark.parametrize(
    "split",
    ["math", "instruction", "knowledge", "reasoning", "tool", "npc", "general"],
)
def test_persona_splits_choices_accepts_all_split_literals(split):
    config = models.personaSplitsChoices(size=1, split=split)
    assert config.split == split


def test_persona_splits_choices_rejects_invalid_split_literal():
    with pytest.raises(ValidationError):
        models.personaSplitsChoices(size=1, split="invalid")


@pytest.mark.parametrize("method", ["random", "sequence", "selected"])
def test_persona_splits_choices_accepts_all_selection_methods(method):
    config = models.personaSplitsChoices(size=1, selectionMethod=method)
    assert config.selectionMethod == method


def test_persona_splits_choices_rejects_invalid_selection_method():
    with pytest.raises(ValidationError):
        models.personaSplitsChoices(size=1, selectionMethod="invalid")


def test_persona_splits_choices_defaults_and_return_split_config_shape():
    config = models.personaSplitsChoices(size=3)

    assert config.split == "general"
    assert config.selectionMethod == "sequence"
    assert config.selectionList is None
    assert config.seed == 42
    assert config.generationModel is None
    assert config.teacherModel is None

    assert config.returnSplitConfig() == {
        "split": "general",
        "selectionMethod": "sequence",
        "selectionList": None,
        "seed": 42,
        "size": 3,
    }


def test_persona_splits_choices_supports_nested_model_configs_from_dicts():
    config = models.personaSplitsChoices(
        size=2,
        generationModel={"modelId": "gen-model"},
        teacherModel={"modelId": "teacher-model"},
    )

    assert isinstance(config.generationModel, models.generationModelConfig)
    assert isinstance(config.teacherModel, models.teacherModelConfig)
    assert config.generationModel.reasoningEffort == "none"
    assert config.teacherModel.reasoningEffort == "medium"


def test_persona_splits_choices_requires_size():
    with pytest.raises(ValidationError):
        models.personaSplitsChoices()
