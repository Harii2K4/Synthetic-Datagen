"""Setup script for downloading persona datasets and OpenRouter model info."""

import json
import os
from pathlib import Path

import requests
from datasets import load_dataset

import logo_extraction

DATASET_FOLDER = Path("./data/persona_hub/")
MODEL_LIST_FILE = Path("./data/openrouter_models_list.json")
MODEL_LIST_FILE_FRONTEND = Path(
    "./frontend/final_project_frontend/src/data/openrouter_models_list.json"
)

PERSONA_DOMAINS = [
    "math",
    "instruction",
    "knowledge",
    "reasoning",
    "tool",
    "npc",
    "general",
]


def store_as_csv(dataset_name: str) -> None:
    try:
        ds = load_dataset("proj-persona/PersonaHub", dataset_name)
    except Exception as e:
        raise Exception(f"Error loading dataset '{dataset_name}': {e}")

    for _, data in ds.items():
        df = data.to_pandas()
        if not isinstance(df, object):  # handles chunked imports
            continue

        filename = "persona.csv"
        if dataset_name != "persona":
            filename = f"persona_{dataset_name}.csv"
            df.rename(columns={"input persona": "persona"}, inplace=True)
            df = df[~df["persona"].str.contains("我")]
            df["origin"] = "system"
            df = df[["persona", "origin"]]

        df.to_csv(DATASET_FOLDER / filename, index=False)


def fetch_openrouter_models() -> list[dict]:
    response = requests.get("https://openrouter.ai/api/v1/models", headers={})
    if response.status_code != 200:
        raise Exception(f"Error fetching models: {response.status_code}")

    models = response.json()["data"]
    return [
        {
            "id": m.get("id"),
            "name": m.get("name"),
            "context_length": m.get("context_length"),
            "input_price": m.get("pricing", {}).get("prompt"),
            "output_price": m.get("pricing", {}).get("completion"),
        }
        for m in models
        if "text" in m.get("architecture", {}).get("input_modalities", [])
        and "text" in m.get("architecture", {}).get("output_modalities", [])
    ]


def main() -> None:
    DATASET_FOLDER.mkdir(parents=True, exist_ok=True)

    store_as_csv("persona")
    for domain in PERSONA_DOMAINS:
        try:
            store_as_csv(domain)
        except Exception as e:
            print(f"Error loading dataset '{domain}': {e}")

    print("Persona datasets saved successfully")

    models = fetch_openrouter_models()
    print(f"Saving {len(models)} model entries")

    for path in [MODEL_LIST_FILE, MODEL_LIST_FILE_FRONTEND]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(models, ensure_ascii=False, indent=2))

    print("Extracting model logos")
    logo_extraction.main()
    print("Setup complete")


if __name__ == "__main__":
    main()
