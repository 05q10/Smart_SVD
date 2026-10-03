import os
import sys
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from datasets import load_dataset
from tqdm import tqdm

# Add backend to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from image_utils import load_image, calculate_complexity
from svd_engine import compute_svd
from adaptive_rank import find_adaptive_rank
from metrics import calculate_storage_reduction

RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')
PLOTS_DIR = os.path.join(os.path.dirname(__file__), 'plots')

os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(PLOTS_DIR, exist_ok=True)

def run_imagenet_benchmark(num_images=100, target_ssim=0.90):
    print(f"Starting benchmark on {num_images} images (Beans Dataset)...")
    print("Loading streaming dataset (beans)...")
    
    # We are using the 'beans' dataset (high-res leaf images) because it's a modern 
    # Parquet-based dataset that HuggingFace fully supports without security errors.
    dataset = load_dataset("AI-Lab-Makerere/beans", split="validation", streaming=True)
    
    results = []
    
    # Iterate through the streamed dataset
    for idx, item in enumerate(tqdm(dataset, total=num_images)):
        if idx >= num_images:
            break
            
        try:
            # The dataset returns a PIL image
            pil_img = item['image'].convert("RGB")
            
            # Convert to numpy array [0, 1] as expected by our backend
            img_array = np.array(pil_img, dtype=np.float32) / 255.0
            
            H, W = img_array.shape[0], img_array.shape[1]
            max_rank = min(H, W)
            
            # Compute complexity (Edge density)
            complexity = calculate_complexity(img_array)
            
            # Run our backend algorithms
            U, S, Vt = compute_svd(img_array)
            best_rank, metrics = find_adaptive_rank(img_array, U, S, Vt, target_ssim, max_rank)
            storage = calculate_storage_reduction(img_array.shape, best_rank)
            
            results.append({
                "ImageID": idx,
                "Label": item.get('labels', item.get('label', 'unknown')),
                "OriginalHeight": H,
                "OriginalWidth": W,
                "Complexity": complexity,
                "TargetSSIM": target_ssim,
                "SelectedRank": best_rank,
                "RankPercentage": (best_rank / max_rank) * 100,
                "ActualSSIM": metrics['ssim'],
                "PSNR": metrics['psnr'],
                "StorageReduction": storage['storage_reduction_percent']
            })
        except Exception as e:
            print(f"Skipped image {idx} due to error: {e}")
            
    # Save to CSV
    df = pd.DataFrame(results)
    csv_path = os.path.join(RESULTS_DIR, "imagenet_benchmark_results.csv")
    df.to_csv(csv_path, index=False)
    print(f"\nSaved benchmark results to {csv_path}")
    
    # Generate Advanced Plots for Stronger Proof
    print("Generating benchmark plots...")
    
    # 1. Histogram of Required Ranks (shows variance across a large dataset)
    plt.figure(figsize=(10, 6))
    plt.hist(df['RankPercentage'], bins=20, color='indigo', alpha=0.7, edgecolor='black')
    plt.title(f"Distribution of Required Rank % to achieve SSIM {target_ssim}\\n(Beans Dataset - {num_images} Images)")
    plt.xlabel("Percentage of Maximum Rank Retained (%)")
    plt.ylabel("Number of Images")
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.savefig(os.path.join(PLOTS_DIR, "imagenet_rank_distribution.png"))
    plt.close()
    
    # 2. Complexity vs Storage Reduction
    plt.figure(figsize=(10, 6))
    plt.scatter(df['Complexity'], df['StorageReduction'], alpha=0.6, color='teal')
    plt.title(f"Image Complexity vs Storage Reduction (SSIM {target_ssim})")
    plt.xlabel("Image Complexity (Edge Density)")
    plt.ylabel("Storage Reduction (%)")
    
    # Add a trendline to prove the correlation mathematically
    z = np.polyfit(df['Complexity'], df['StorageReduction'], 1)
    p = np.poly1d(z)
    plt.plot(df['Complexity'], p(df['Complexity']), "r--", alpha=0.8, label=f"Trend (Slope: {z[0]:.2f})")
    plt.legend()
    plt.savefig(os.path.join(PLOTS_DIR, "imagenet_complexity_vs_storage.png"))
    plt.close()

    print(f"Benchmark completed successfully! Average Storage Reduction: {df['StorageReduction'].mean():.2f}%")

if __name__ == "__main__":
    # You can change 100 to 500 or 1000 for an even stronger claim in the report!
    run_imagenet_benchmark(num_images=100, target_ssim=0.90)
