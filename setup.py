"""
file: setup.py
Description: Setup file for the final project
"""

from datasets import load_dataset
import os
from pandas import DataFrame
import requests
import json
#for downloading the dataset
DATASET_FOLDER="./persona_hub/"
MODEL_LIST_FILE="./openrouter_models_list.json"

def storeAsCsv(datasetName:str):
    try:
        ds = load_dataset("proj-persona/PersonaHub",datasetName)
    except Exception as e:
        raise Exception(f"Error loading dataset: {e}")

    #for converting to pandas
    for _, data in ds.items():
        df = data.to_pandas()
        #to handle when larger persona data are imported as chunks
        if type(df) is not DataFrame:
            continue
        fileName="persona.csv"
        if datasetName!="persona":
            df.rename(columns={'input persona': 'persona'}, inplace=True)
            df=df['persona']

            fileName=f"persona_{datasetName}.csv"
        df.to_csv(DATASET_FOLDER + fileName,index=False)

def main():
        # creating the dataset folder if doesnt exist
        os.makedirs(DATASET_FOLDER, exist_ok=True)
        # storing the general persona dataset
        storeAsCsv("persona")

        #storing the datasets for each domain
        persona_domain_list=["math","instruction","knowledge","reasoning",
                             "tool","npc"]
        for domain in persona_domain_list:
            try:
                storeAsCsv(domain)
            except Exception as e:
                print(f"Error loading dataset: {e}")

        print("Dataset saved to all domains successfully in persona_hub folder")
       # List all models and their properties (GET /models)
        response = requests.get(
          "https://openrouter.ai/api/v1/models",
          headers={},
        )

        if response.status_code != 200:
            raise Exception(f"Error in downloading models information: {response.status_code}")
        modelsData=response.json()
        #filter the modelData to what we want
        modelsData=[
            {
                "id":model.get('id'),
                "name":model.get('name'),
                "context_length":model.get('context_length'),
                "input_price":model.get('pricing').get('prompt'),
                "output_price":model.get('pricing').get('completion'),
            }
            for model in modelsData['data']
            if 'text' in model.get('architecture').get('input_modalities') and
            'text' in model.get('architecture').get('output_modalities')
        ]
        print(f'Storing {len(modelsData)} model information')

        with open(MODEL_LIST_FILE, "w", encoding="utf-8") as f:
            json.dump(modelsData,f,ensure_ascii=False,indent=2)


if __name__ == "__main__":
    main()

