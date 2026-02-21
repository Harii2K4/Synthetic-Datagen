"""
file: setup.py
Description: Setup file for the final project
"""

from datasets import load_dataset
import os
from pandas import DataFrame
#for downloading the dataset
DATASET_FOLDER="./persona_hub/"

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
            df=df['input persona']
            fileName=f"persona_{datasetName}.csv"
        df.to_csv(DATASET_FOLDER + fileName,index=False)

def main():
        #creating the dataset folder if doesnt exist
        os.makedirs(DATASET_FOLDER, exist_ok=True)
        #storing the general persona dataset
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

if __name__ == "__main__":
    main()

