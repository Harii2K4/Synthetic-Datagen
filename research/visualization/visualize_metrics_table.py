import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

def create_metrics_table(json_file_path):
    """
    Create a visualization table from dataset metrics summary.
    
    Args:
        json_file_path: Path to the dataset_metrics_summary.json file
    
    Returns:
        pandas.DataFrame: Formatted metrics table
    """
    # Load the JSON data
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    # Extract metrics table and convert to DataFrame
    metrics_data = data['metricsTable']
    
    # Create DataFrame with dataset labels as index
    df = pd.DataFrame(metrics_data)
    df = df.set_index('datasetLabel')
    
    # Select columns to display (excluding sampleCount and embeddingDimension)
    columns_to_display = [
        'meanPairwiseCosineSimilarity', 
        'p90PairwiseSimilarity',
        'meanNearestNeighborSimilarity',
        'topicEntropy',
        'uniqueTopicCount',
        'distinct2'
    ]
    
    # Filter and reorder columns
    df_display = df[columns_to_display].copy()
    
    # Format column names for better readability
    column_renames = {
        'meanPairwiseCosineSimilarity': 'Mean Pairwise Cosine',
        'p90PairwiseSimilarity': 'P90 Pairwise',
        'meanNearestNeighborSimilarity': 'Mean Nearest Neighbor',
        'topicEntropy': 'Topic Entropy',
        'uniqueTopicCount': 'Unique Topics',
        'distinct2': 'Distinct-2'
    }
    
    df_display = df_display.rename(columns=column_renames)
    
    # Format numeric values for better readability
    # Round float columns to 4 decimal places
    float_columns = ['Mean Pairwise Cosine', 'P90 Pairwise', 'Mean Nearest Neighbor', 
                     'Topic Entropy', 'Distinct-2']
    for col in float_columns:
        df_display[col] = df_display[col].round(4)
    
    return df_display

def visualize_metrics_table(json_file_path=None, save_path=None):
    """
    Create and display a styled visualization of the metrics table.
    
    Args:
        json_file_path: Path to the dataset_metrics_summary.json file (optional)
        save_path: Optional path to save the table visualization
    """
    # Default path if not provided
    if json_file_path is None:
        script_dir = Path(__file__).resolve().parent
        json_file_path = script_dir / "results" / "summary" / "dataset_metrics_summary.json"
    
    json_file_path = Path(json_file_path)
    
    # Check if file exists
    if not json_file_path.exists():
        print(f"Error: Metrics file not found at {json_file_path}")
        print("Please run calculate_metrics.py first to generate the metrics summary.")
        return None
    
    # Default save path if not provided
    if save_path is None:
        script_dir = Path(__file__).resolve().parent
        tables_dir = script_dir / "results" / "tables"
        tables_dir.mkdir(parents=True, exist_ok=True)
        save_path = tables_dir / "metrics_table.png"
    
    # Create the metrics table
    df = create_metrics_table(json_file_path)
    
    # Create a figure for the table
    plt.figure(figsize=(14, 8))
    
    # Create a table visualization
    ax = plt.subplot(111)
    ax.axis('tight')
    ax.axis('off')
    
    # Create the table
    table = ax.table(cellText=df.values,
                     rowLabels=df.index,
                     colLabels=df.columns,
                     cellLoc='center',
                     loc='center',
                     bbox=[0, 0, 1, 1])
    
    # Style the table
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1.2, 1.5)
    
    # Color the header row
    for i in range(len(df.columns)):
        table[(0, i)].set_facecolor('#4CAF50')
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    # Color alternating rows
    for i in range(len(df)):
        color = '#f0f0f0' if i % 2 == 0 else 'white'
        for j in range(len(df.columns)):
            table[(i+1, j)].set_facecolor(color)
    
    plt.title('Dataset Metrics Comparison', fontsize=16, fontweight='bold', pad=20)
    
    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        print(f"Table visualization saved to: {save_path}")
    
    plt.show()
    
    return df

def print_metrics_table(json_file_path=None):
    """
    Print a simple text version of the metrics table.
    
    Args:
        json_file_path: Path to the dataset_metrics_summary.json file (optional)
    """
    # Default path if not provided
    if json_file_path is None:
        script_dir = Path(__file__).resolve().parent
        json_file_path = script_dir / "results" / "summary" / "dataset_metrics_summary.json"
    
    json_file_path = Path(json_file_path)
    
    # Check if file exists
    if not json_file_path.exists():
        print(f"Error: Metrics file not found at {json_file_path}")
        print("Please run calculate_metrics.py first to generate the metrics summary.")
        return
    
    df = create_metrics_table(json_file_path)
    
    print("\n" + "="*80)
    print("DATASET METRICS COMPARISON")
    print("="*80)
    print(df.to_string())
    print("="*80)

if __name__ == "__main__":
    # Use default path (will check results/summary directory)
    json_file_path = None  # Will default to results/summary/dataset_metrics_summary.json
    
    # Print simple table
    print_metrics_table(json_file_path)
    
    # Create visualization and save to tables folder
    visualize_metrics_table(json_file_path, save_path=None)
