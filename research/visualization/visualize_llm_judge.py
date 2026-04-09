import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import numpy as np

def load_ranking_data(json_file_path):
    with open(json_file_path, 'r') as f:
        return json.load(f)

def create_ranking_dataframe(data):
    records = []
    for model, model_data in data['perModel'].items():
        for dataset, stats in model_data['datasetStats'].items():
            records.append({
                'Model': model,
                'Dataset': dataset,
                'Average Rank': stats['averageRank'],
                'Total Points': stats['pointsTotal'],
                'First Place': stats['firstPlaceCount'],
                'Second Place': stats['secondPlaceCount'],
                'Third Place': stats['thirdPlaceCount'],
                'Valid Rounds': model_data['validRoundCount'],
                'Invalid Responses': model_data['invalidResponseCount']
            })
    return pd.DataFrame(records)

def plot_average_rank_heatmap(df, save_path=None):
    pivot = df.pivot(index='Model', columns='Dataset', values='Average Rank')
    order = ['math_evol', 'math_persona', 'math_persona_general']
    pivot = pivot[order]
    
    fig, ax = plt.subplots(figsize=(10, 6))
    sns.heatmap(pivot, annot=True, fmt='.2f', cmap='RdYlGn_r', 
                center=2, ax=ax, cbar_kws={'label': 'Average Rank (lower=better)'})
    ax.set_title('Model Quality by Dataset: Average Ranking\n(Lower = Better)', fontsize=14, fontweight='bold')
    ax.set_xlabel('Dataset', fontsize=12)
    ax.set_ylabel('Model', fontsize=12)
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved: {save_path}")
    plt.show()

def plot_total_points(df, save_path=None):
    fig, ax = plt.subplots(figsize=(12, 6))
    datasets = ['math_evol', 'math_persona', 'math_persona_general']
    x = np.arange(len(datasets))
    width = 0.2
    models = df['Model'].unique()
    
    for i, model in enumerate(models):
        model_data = df[df['Model'] == model].set_index('Dataset').reindex(datasets)
        ax.bar(x + i*width, model_data['Total Points'], width, label=model)
    
    ax.set_xlabel('Dataset', fontsize=12)
    ax.set_ylabel('Total Points (Borda)', fontsize=12)
    ax.set_title('Total Borda Points by Model and Dataset\n(1st=3pts, 2nd=2pts, 3rd=1pt)', fontsize=14, fontweight='bold')
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(['Math Evol\n(Evolved Questions)', 'Math Persona\n(Persona-based)', 'Math Persona General\n(General Persona)'])
    ax.legend(title='Model')
    ax.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved: {save_path}")
    plt.show()

def plot_rank_distribution(df, save_path=None):
    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    datasets = ['math_evol', 'math_persona', 'math_persona_general']
    rank_cols = ['First Place', 'Second Place', 'Third Place']
    colors = ['#2ecc71', '#3498db', '#e74c3c']
    
    for idx, dataset in enumerate(datasets):
        subset = df[df['Dataset'] == dataset]
        x = np.arange(len(subset))
        width = 0.25
        
        for i, (col, color) in enumerate(zip(rank_cols, colors)):
            axes[idx].bar(x + i*width, subset[col], width, label=col, color=color)
        
        axes[idx].set_title(dataset.replace('_', ' ').title(), fontsize=12, fontweight='bold')
        axes[idx].set_xticks(x + width)
        axes[idx].set_xticklabels(subset['Model'], rotation=45, ha='right')
        axes[idx].legend()
        axes[idx].set_ylabel('Count')
    
    fig.suptitle('Rank Distribution by Model and Dataset', fontsize=14, fontweight='bold')
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved: {save_path}")
    plt.show()

def plot_reliability(df, save_path=None):
    reliability = df.groupby('Model').agg({
        'Valid Rounds': 'first',
        'Invalid Responses': 'first'
    }).reset_index()
    reliability['Success Rate'] = reliability['Valid Rounds'] / 50 * 100
    
    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(reliability['Model'], reliability['Success Rate'], color=['#2ecc71' if r >= 95 else '#e74c3c' for r in reliability['Success Rate']])
    ax.axhline(y=100, color='gray', linestyle='--', alpha=0.5, label='Perfect (100%)')
    ax.set_xlabel('Model', fontsize=12)
    ax.set_ylabel('Success Rate (%)', fontsize=12)
    ax.set_title('Model Reliability: Response Success Rate\n(Higher = More Reliable)', fontsize=14, fontweight='bold')
    ax.set_ylim(0, 110)
    
    for bar, rate in zip(bars, reliability['Success Rate']):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2, f'{rate:.0f}%', ha='center', fontsize=11)
    
    plt.tight_layout()
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"Saved: {save_path}")
    plt.show()

def main():
    script_dir = Path(__file__).resolve().parent
    json_file = script_dir / "results" / "llm_judge" / "llm_question_ranking_summary_20260329_115420.json"
    
    data = load_ranking_data(json_file)
    df = create_ranking_dataframe(data)
    
    output_dir = script_dir / "results" / "visualizations"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*60)
    print("LLM JUDGE RANKING VISUALIZATION")
    print("="*60)
    
    plot_average_rank_heatmap(df, output_dir / "average_rank_heatmap.png")
    plot_total_points(df, output_dir / "total_points.png")
    plot_rank_distribution(df, output_dir / "rank_distribution.png")
    plot_reliability(df, output_dir / "reliability.png")
    
    print("\n" + "="*60)
    print(f"All visualizations saved to: {output_dir}")
    print("="*60)

if __name__ == "__main__":
    main()
