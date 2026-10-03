import os
import sys
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Add backend to path to import modules
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from image_utils import load_image, calculate_complexity, image_to_bytes
from svd_engine import compute_svd, reconstruct_image, get_singular_values
from metrics import calculate_metrics, calculate_storage_reduction
from adaptive_rank import find_adaptive_rank

DATASETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'datasets')
RESULTS_DIR = os.path.join(os.path.dirname(__file__), 'results')
PLOTS_DIR = os.path.join(os.path.dirname(__file__), 'plots')
VISUALS_DIR = os.path.join(os.path.dirname(__file__), 'visual_comparisons')

def run_experiments():
    images = [f for f in os.listdir(DATASETS_DIR) if f.endswith(('.jpg', '.png'))]
    
    all_results = []
    adaptive_results = []
    complexity_results = []
    
    ranks_to_test = [5, 10, 20, 30, 50, 75, 100]
    target_ssims = [0.80, 0.90, 0.95]
    
    # 1. Quality vs Compression
    # 2. Target Quality Experiment
    # 3. Fixed vs Adaptive (e.g. Fixed rank 30 vs Adaptive 0.90)
    
    for img_name in images:
        print(f"Processing {img_name}...")
        category = os.path.splitext(img_name)[0]
        img_path = os.path.join(DATASETS_DIR, img_name)
        
        with open(img_path, "rb") as f:
            img_bytes = f.read()
            
        img_array = load_image(img_bytes, max_size=512)
        H, W = img_array.shape[0], img_array.shape[1]
        max_rank = min(H, W)
        
        complexity = calculate_complexity(img_array)
        
        U, S, Vt = compute_svd(img_array)
        
        # Singular value plot
        sv = get_singular_values(S)
        plt.figure()
        plt.plot(sv[:min(200, len(sv))])
        plt.title(f"Singular Value Decay: {category}")
        plt.xlabel("Index")
        plt.ylabel("Magnitude")
        plt.savefig(os.path.join(PLOTS_DIR, f"{category}_sv_decay.png"))
        plt.close()
        
        # Fixed ranks
        for k in ranks_to_test:
            rec = reconstruct_image(U, S, Vt, k)
            metrics = calculate_metrics(img_array, rec)
            storage = calculate_storage_reduction(img_array.shape, k)
            all_results.append({
                "Image": category,
                "Rank": k,
                "SSIM": metrics['ssim'],
                "PSNR": metrics['psnr'],
                "MSE": metrics['mse'],
                "CompressionRatio": storage['compression_ratio'],
                "StorageReduction": storage['storage_reduction_percent']
            })
            
            # Save visual comparison for k
            if k in [5, 10, 20, 50]:
                rec_bytes = image_to_bytes(rec)
                with open(os.path.join(VISUALS_DIR, f"{category}_rank_{k}.jpg"), "wb") as out:
                    out.write(rec_bytes)
        
        # Adaptive ranks
        for target in target_ssims:
            best_rank, metrics = find_adaptive_rank(img_array, U, S, Vt, target, max_rank)
            storage = calculate_storage_reduction(img_array.shape, best_rank)
            adaptive_results.append({
                "Image": category,
                "TargetSSIM": target,
                "SelectedRank": best_rank,
                "ActualSSIM": metrics['ssim'],
                "PSNR": metrics['psnr'],
                "StorageReduction": storage['storage_reduction_percent']
            })
            
            if target == 0.90:
                complexity_results.append({
                    "Image": category,
                    "Complexity": complexity,
                    "RequiredRank": best_rank
                })
                # Save visual comparison for adaptive 0.90
                rec = reconstruct_image(U, S, Vt, best_rank)
                rec_bytes = image_to_bytes(rec)
                with open(os.path.join(VISUALS_DIR, f"{category}_adaptive_0.90.jpg"), "wb") as out:
                    out.write(rec_bytes)
                    
        # Save original
        with open(os.path.join(VISUALS_DIR, f"{category}_original.jpg"), "wb") as out:
            out.write(image_to_bytes(img_array))

    # Save CSVs
    pd.DataFrame(all_results).to_csv(os.path.join(RESULTS_DIR, "all_results.csv"), index=False)
    pd.DataFrame(adaptive_results).to_csv(os.path.join(RESULTS_DIR, "adaptive_results.csv"), index=False)
    pd.DataFrame(complexity_results).to_csv(os.path.join(RESULTS_DIR, "complexity_results.csv"), index=False)
    
    # Generate Plots
    df_all = pd.DataFrame(all_results)
    
    # 1. Rank vs SSIM
    plt.figure()
    for img in images:
        cat = os.path.splitext(img)[0]
        subset = df_all[df_all['Image'] == cat]
        plt.plot(subset['Rank'], subset['SSIM'], marker='o', label=cat)
    plt.title("Rank vs SSIM")
    plt.xlabel("Rank")
    plt.ylabel("SSIM")
    plt.legend()
    plt.savefig(os.path.join(PLOTS_DIR, "rank_vs_ssim.png"))
    plt.close()
    
    # 2. Complexity vs Rank (Target 0.90)
    df_comp = pd.DataFrame(complexity_results)
    plt.figure()
    plt.scatter(df_comp['Complexity'], df_comp['RequiredRank'])
    for i, row in df_comp.iterrows():
        plt.annotate(row['Image'], (row['Complexity'], row['RequiredRank']))
    plt.title("Image Complexity vs Required Rank (SSIM=0.90)")
    plt.xlabel("Complexity (Edge Density)")
    plt.ylabel("Required Rank")
    plt.savefig(os.path.join(PLOTS_DIR, "complexity_vs_rank.png"))
    plt.close()

    print("Experiments completed.")

if __name__ == "__main__":
    run_experiments()
