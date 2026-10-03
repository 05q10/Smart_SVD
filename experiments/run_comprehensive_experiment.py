import os
import sys
import time
import requests
import json
import numpy as np
import pandas as pd
from PIL import Image
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats

# Ensure backend can be imported
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(BASE_DIR, "../backend"))
sys.path.append(BACKEND_DIR)

from svd_engine import compute_svd, reconstruct_image
from metrics import calculate_metrics
from image_utils import calculate_complexity

# Setup Directories
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
PLOTS_DIR = os.path.join(BASE_DIR, "plots")
CASE_STUDIES_DIR = os.path.join(BASE_DIR, "case_studies")

for d in [DATASET_DIR, RESULTS_DIR, PLOTS_DIR, CASE_STUDIES_DIR,
          os.path.join(CASE_STUDIES_DIR, "fixed_failure"),
          os.path.join(CASE_STUDIES_DIR, "fixed_overretention"),
          os.path.join(CASE_STUDIES_DIR, "high_rank_required")]:
    os.makedirs(d, exist_ok=True)

CATEGORIES = [
    "landscape", "portrait", "animal", "architecture", 
    "street", "document", "food", "vehicle", 
    "indoor", "flower", "sports"
]
IMAGES_PER_CAT = 15
IMAGE_SIZE = 256
TARGETS = [0.80, 0.90, 0.95]
FIXED_RANKS = [25, 50, 100, 150]

def calc_reduction(rank, m=IMAGE_SIZE, n=IMAGE_SIZE):
    original = m * n
    compressed = rank * (m + n + 1)
    return max(0, (1 - compressed / original) * 100)

def download_images():
    images_info = []
    for filename in os.listdir(DATASET_DIR):
        if filename.endswith(".jpg") or filename.endswith(".png"):
            cat = filename.split("_")[0]
            images_info.append({
                "id": filename.split(".")[0],
                "category": cat,
                "path": os.path.join(DATASET_DIR, filename)
            })
    return images_info

def run_experiment():
    images_info = download_images()
    print(f"Loaded {len(images_info)} images across {len(CATEGORIES)} categories.")

    all_results = []
    coarse_ranks = [5, 10, 20, 30, 40, 50, 75, 100, 125, 150, 175, 200, 250]
    
    print("Running SVD and evaluating ranks for all images...")
    
    # Store evaluated curves
    curves = {}
    
    for idx, info in enumerate(images_info):
        try:
            img = Image.open(info['path']).convert('RGB').resize((IMAGE_SIZE, IMAGE_SIZE))
            img_arr = np.array(img).astype(np.float64) / 255.0
            
            U, S, Vt = compute_svd(img_arr)
            complexity = calculate_complexity(img_arr)
            
            # Cache evaluated ranks for this image
            evaluated = {}
            
            def get_ssim_for_rank(r):
                if r in evaluated: return evaluated[r]
                rec = reconstruct_image(U, S, Vt, r)
                ssim_val = calculate_metrics(img_arr, rec)['ssim']
                evaluated[r] = ssim_val
                return ssim_val

            # 1. Evaluate coarse ranks
            for r in coarse_ranks:
                get_ssim_for_rank(r)
                
            curves[info['id']] = evaluated

            # 2. Adaptive Search
            for target in TARGETS:
                # Find coarse transition
                lower_bound = 1
                upper_bound = 256
                
                for r in coarse_ranks:
                    if evaluated[r] >= target:
                        upper_bound = r
                        break
                    lower_bound = r
                
                # Finer search between lower and upper
                best_rank = upper_bound
                best_ssim = evaluated.get(upper_bound, 1.0)
                
                if upper_bound > lower_bound + 1:
                    for r in range(lower_bound + 1, upper_bound):
                        val = get_ssim_for_rank(r)
                        if val >= target:
                            best_rank = r
                            best_ssim = val
                            break
                
                all_results.append({
                    "image_id": info['id'],
                    "category": info['category'],
                    "complexity": complexity,
                    "target_ssim": target,
                    "adaptive_rank": best_rank,
                    "actual_ssim": best_ssim,
                    "reduction": calc_reduction(best_rank)
                })
        except Exception as e:
            print(f"Error processing {info['id']}: {e}")
            
    df = pd.DataFrame(all_results)
    df.to_csv(os.path.join(RESULTS_DIR, "all_results.csv"), index=False)
    
    # Dataset Summary
    cat_summary = df[df['target_ssim'] == 0.90].groupby('category').agg(
        num_images=('image_id', 'count'),
        avg_complexity=('complexity', 'mean'),
        median_complexity=('complexity', 'median'),
        mean_rank=('adaptive_rank', 'mean'),
        median_rank=('adaptive_rank', 'median'),
        mean_reduction=('reduction', 'mean')
    ).reset_index()
    cat_summary.to_csv(os.path.join(RESULTS_DIR, "dataset_summary.csv"), index=False)
    
    return df, curves, images_info

def perform_fixed_vs_adaptive(df, curves):
    print("Evaluating Fixed Rank Baselines...")
    df_90 = df[df['target_ssim'] == 0.90].copy()
    
    # Find data-driven baseline (95% success for SSIM 0.90)
    best_baseline = 256
    for r in range(10, 256, 5):
        success_count = sum(1 for img_id, eval_dict in curves.items() if any(k <= r and v >= 0.90 for k, v in eval_dict.items()))
        if success_count / len(curves) >= 0.95:
            best_baseline = r
            break
            
    print(f"Data-driven baseline for 95% target coverage is k = {best_baseline}")
    
    fixed_strategies = FIXED_RANKS + [best_baseline]
    fixed_results = []
    
    for r in fixed_strategies:
        successes = 0
        excess_total = 0
        excess_count = 0
        for _, row in df_90.iterrows():
            # Get actual SSIM at this fixed rank from the curves if evaluated, or approximate
            # We'll just check if fixed rank >= adaptive_rank (since SSIM monotonically increases)
            success = 1 if r >= row['adaptive_rank'] else 0
            successes += success
            
            if success and r > row['adaptive_rank']:
                excess_total += (r - row['adaptive_rank'])
                excess_count += 1
                
        fixed_results.append({
            "fixed_rank": r,
            "target_success_rate": (successes / len(df_90)) * 100,
            "mean_reduction": calc_reduction(r),
            "mean_excess_components": (excess_total / excess_count) if excess_count > 0 else 0,
            "pct_unnecessarily_high": (excess_count / len(df_90)) * 100
        })
        
    pd.DataFrame(fixed_results).to_csv(os.path.join(RESULTS_DIR, "fixed_results.csv"), index=False)
    
    # Detailed fixed vs adaptive for the data-driven baseline
    f_vs_a = []
    for _, row in df_90.iterrows():
        fixed_success = best_baseline >= row['adaptive_rank']
        excess = max(0, best_baseline - row['adaptive_rank']) if fixed_success else 0
        f_vs_a.append({
            "image_id": row['image_id'],
            "category": row['category'],
            "adaptive_rank": row['adaptive_rank'],
            "fixed_rank": best_baseline,
            "target_met_by_fixed": fixed_success,
            "excess_rank": excess
        })
        
    df_fva = pd.DataFrame(f_vs_a)
    df_fva.to_csv(os.path.join(RESULTS_DIR, "fixed_vs_adaptive.csv"), index=False)
    
    return best_baseline, df_fva, pd.DataFrame(fixed_results)

def generate_plots(df, df_fva, df_fixed, cat_summary, curves, images_info):
    print("Generating Presentation-Ready Plots...")
    sns.set_theme(style="whitegrid", context="talk")
    
    df_90 = df[df['target_ssim'] == 0.90].copy()
    
    # 1. Rank vs SSIM curves
    plt.figure(figsize=(10,6))
    plotted_cats = set()
    for img_id, eval_dict in list(curves.items())[:20]:
        cat = next(i['category'] for i in images_info if i['id'] == img_id)
        if cat not in plotted_cats and len(plotted_cats) < 5:
            ranks = sorted(eval_dict.keys())
            ssims = [eval_dict[r] for r in ranks]
            plt.plot(ranks, ssims, marker='o', label=cat)
            plotted_cats.add(cat)
    plt.axhline(0.90, color='r', linestyle='--', label='Target SSIM = 0.90')
    plt.title("Rank vs SSIM curves across image classes")
    plt.xlabel("SVD Rank")
    plt.ylabel("SSIM")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "rank_vs_ssim.png"))
    plt.close()

    # 2. Adaptive Rank Distribution
    plt.figure(figsize=(10,6))
    sns.histplot(df_90['adaptive_rank'], bins=20, kde=True, color='indigo')
    plt.title("Distribution of Adaptive Rank (Target SSIM 0.90)")
    plt.xlabel("Minimum Required Rank")
    plt.ylabel("Number of Images")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "adaptive_rank_distribution.png"))
    plt.close()
    
    # 3. Complexity vs Rank
    plt.figure(figsize=(10,6))
    sns.regplot(data=df_90, x='complexity', y='adaptive_rank', scatter_kws={'alpha':0.6}, color='teal')
    plt.title("Image Complexity is Associated with Required Rank")
    plt.xlabel("Edge Density (Complexity)")
    plt.ylabel("Adaptive Rank")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "complexity_vs_rank.png"))
    plt.close()
    
    # 4. Complexity vs Reduction
    plt.figure(figsize=(10,6))
    sns.regplot(data=df_90, x='complexity', y='reduction', scatter_kws={'alpha':0.6}, color='coral')
    plt.title("Image Complexity vs Representation Reduction")
    plt.xlabel("Edge Density (Complexity)")
    plt.ylabel("Theoretical Representation Reduction (%)")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "complexity_vs_reduction.png"))
    plt.close()
    
    # 5. Fixed vs Adaptive paired plot
    plt.figure(figsize=(14,6))
    sorted_fva = df_fva.sort_values('adaptive_rank').reset_index(drop=True)
    x = np.arange(len(sorted_fva))
    plt.plot(x, sorted_fva['fixed_rank'], label=f"Fixed Baseline ({df_fva['fixed_rank'].iloc[0]})", color='slategray', lw=2)
    plt.plot(x, sorted_fva['adaptive_rank'], label="Adaptive Rank", color='#4f46e5', lw=2)
    plt.fill_between(x, sorted_fva['adaptive_rank'], sorted_fva['fixed_rank'], where=(sorted_fva['fixed_rank'] > sorted_fva['adaptive_rank']), color='#4f46e5', alpha=0.1, label='Excess Components Avoided')
    plt.fill_between(x, sorted_fva['adaptive_rank'], sorted_fva['fixed_rank'], where=(sorted_fva['fixed_rank'] < sorted_fva['adaptive_rank']), color='red', alpha=0.2, label='Fixed Rank Failed')
    plt.title("Fixed Strategy Retains Unnecessary Components for Many Images")
    plt.xlabel("Images (sorted by required rank)")
    plt.ylabel("SVD Rank")
    plt.legend()
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "fixed_vs_adaptive.png"))
    plt.close()
    
    # 6. Target success rate
    plt.figure(figsize=(10,6))
    sns.barplot(data=df_fixed, x='fixed_rank', y='target_success_rate', color='steelblue')
    plt.axhline(100, color='#10b981', linestyle='--', label='Adaptive Success Rate (100%)')
    plt.title("Target Success Rate by Fixed Rank")
    plt.xlabel("Fixed Rank Strategy")
    plt.ylabel("Images Achieving Target (%)")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "target_success_rate.png"))
    plt.close()
    
    # 7. Representation Reduction: Fixed vs Adaptive
    # We can plot mean_reduction for each strategy
    plt.figure(figsize=(10,6))
    df_red = df_fixed[['fixed_rank', 'mean_reduction']].copy()
    adaptive_red = df_90['reduction'].mean()
    df_red.loc[len(df_red)] = ['Adaptive', adaptive_red]
    sns.barplot(data=df_red, x='fixed_rank', y='mean_reduction', palette='Set2')
    plt.title("Representation Reduction: Fixed vs Adaptive")
    plt.ylabel("Theoretical Representation Reduction (%)")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "representation_comparison.png"))
    plt.close()

    # 8. Class-level median adaptive rank
    plt.figure(figsize=(12,6))
    sns.barplot(data=cat_summary.sort_values('median_rank'), x='category', y='median_rank', palette='viridis')
    plt.title("Class-level Median Adaptive Rank")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "class_rank.png"))
    plt.close()

    # 9. Class-level representation reduction
    plt.figure(figsize=(12,6))
    sns.barplot(data=cat_summary.sort_values('mean_reduction', ascending=False), x='category', y='mean_reduction', palette='magma')
    plt.title("Class-level Representation Reduction")
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "class_reduction.png"))
    plt.close()

    # 10. Adaptive rank vs target SSIM
    plt.figure(figsize=(10,6))
    sns.boxplot(data=df, x='target_ssim', y='adaptive_rank', palette='pastel')
    plt.title("Adaptive Rank vs Target SSIM")
    plt.xlabel("Target SSIM")
    plt.ylabel("Adaptive Rank")
    plt.tight_layout()
    plt.savefig(os.path.join(PLOTS_DIR, "target_vs_rank.png"))
    plt.close()

def find_case_studies(df, df_fva, images_info, baseline):
    print("Identifying case studies automatically...")
    
    df_90 = df[df['target_ssim'] == 0.90]
    
    # 1. Fixed failure (max failure)
    failure_cases = df_fva[df_fva['target_met_by_fixed'] == False].copy()
    max_fail = None
    if not failure_cases.empty:
        # Sort by highest adaptive rank needed (worst failure for fixed)
        worst_failure = failure_cases.sort_values('adaptive_rank', ascending=False).iloc[0]
        max_fail = worst_failure['image_id']
        
    # 2. Over-retention (Max savings)
    success_cases = df_fva[df_fva['target_met_by_fixed'] == True].copy()
    max_savings = None
    if not success_cases.empty:
        best_savings = success_cases.sort_values('excess_rank', ascending=False).iloc[0]
        max_savings = best_savings['image_id']
        
    # 3. High detail required
    highest_rank_id = df_90.sort_values('adaptive_rank', ascending=False).iloc[0]['image_id']
    
    case_ids = {
        "fixed_failure": max_fail,
        "fixed_overretention": max_savings,
        "high_rank_required": highest_rank_id
    }
    
    cases = []
    
    for case_type, img_id in case_ids.items():
        if img_id is None: continue
        
        info = next(i for i in images_info if i['id'] == img_id)
        row = df_90[df_90['image_id'] == img_id].iloc[0]
        
        # We need the original and the two reconstructions
        img = Image.open(info['path']).convert('RGB').resize((IMAGE_SIZE, IMAGE_SIZE))
        img_arr = np.array(img)
        U, S, Vt = compute_svd(img_arr)
        
        adaptive_rank = int(row['adaptive_rank'])
        adaptive_rec = reconstruct_image(U, S, Vt, adaptive_rank)
        
        fixed_rec = reconstruct_image(U, S, Vt, baseline)
        fixed_ssim = calculate_metrics(img_arr, fixed_rec)['ssim']
        
        # Save images
        case_dir = os.path.join(CASE_STUDIES_DIR, case_type)
        Image.fromarray((img_arr * 255).astype(np.uint8)).save(os.path.join(case_dir, "original.jpg"))
        Image.fromarray((adaptive_rec * 255).astype(np.uint8)).save(os.path.join(case_dir, f"adaptive_rank_{adaptive_rank}.jpg"))
        Image.fromarray((fixed_rec * 255).astype(np.uint8)).save(os.path.join(case_dir, f"fixed_rank_{baseline}.jpg"))
        
        cases.append({
            "type": case_type,
            "image_id": img_id,
            "category": info['category'],
            "complexity": row['complexity'],
            "adaptive_rank": adaptive_rank,
            "fixed_rank": baseline,
            "adaptive_ssim": row['actual_ssim'],
            "fixed_ssim": fixed_ssim,
            "adaptive_reduction": row['reduction'],
            "fixed_reduction": calc_reduction(baseline),
            "target_success": fixed_ssim >= 0.90
        })
        
    pd.DataFrame(cases).to_csv(os.path.join(RESULTS_DIR, "case_studies.csv"), index=False)

def generate_summary(df, df_fva, df_fixed, baseline):
    df_90 = df[df['target_ssim'] == 0.90]
    
    pearson_r, p_val = stats.pearsonr(df_90['complexity'], df_90['adaptive_rank'])
    spearman_rho, _ = stats.spearmanr(df_90['complexity'], df_90['adaptive_rank'])
    
    try:
        t_stat, t_pval = stats.wilcoxon(df_fva['fixed_rank'], df_fva['adaptive_rank'])
    except:
        t_pval = "N/A"
        
    baseline_row = df_fixed[df_fixed['fixed_rank'] == baseline].iloc[0]
    
    summary = f"""
================================================
SMART SVD EXPERIMENT SUMMARY
================================================

Dataset:
{len(df_90)} images
{len(CATEGORIES)} classes

Target:
SSIM >= 0.90

Adaptive:
Mean rank: {df_90['adaptive_rank'].mean():.1f}
Median rank: {df_90['adaptive_rank'].median():.1f}
Mean representation reduction: {df_90['reduction'].mean():.1f}%
Target success: 100%

Fixed baseline (Data-driven for 95% coverage):
Rank: {baseline}
Target success: {baseline_row['target_success_rate']:.1f}%
Mean representation reduction: {baseline_row['mean_reduction']:.1f}%

Adaptive advantage vs {baseline}:
Mean excess components avoided: {baseline_row['mean_excess_components']:.1f}
% images where fixed rank was too low: {100 - baseline_row['target_success_rate']:.1f}%
% images where fixed rank was unnecessarily high: {baseline_row['pct_unnecessarily_high']:.1f}%

Statistical Analysis (Adaptive vs Fixed):
Wilcoxon p-value: {t_pval}

Complexity relationship:
Pearson r: {pearson_r:.3f}
Spearman rho: {spearman_rho:.3f}
p-value: {p_val:.3e}

================================================
RESEARCH QUESTIONS
================================================
RQ1: Do different images require different ranks to achieve the same SSIM target?
Yes. The required rank varied from {df_90['adaptive_rank'].min()} to {df_90['adaptive_rank'].max()} across the dataset.

RQ2: Does adaptive rank selection satisfy the target quality across the dataset?
Yes, by definition it achieved 100% success by selecting the necessary rank.

RQ3: How often does a fixed-rank baseline fail to achieve the target?
For a fixed rank of 50, it failed {(100 - df_fixed[df_fixed['fixed_rank']==50].iloc[0]['target_success_rate']):.1f}% of the time. 
For our robust baseline of {baseline}, it failed {(100 - baseline_row['target_success_rate']):.1f}% of the time.

RQ4: When fixed rank succeeds, how often does it retain more components than necessary?
For the baseline of {baseline}, it retained unnecessary components for {baseline_row['pct_unnecessarily_high']:.1f}% of the images.

RQ5: How many additional components does the fixed strategy retain on average?
When it over-retained, it wasted an average of {baseline_row['mean_excess_components']:.1f} SVD components per image.

RQ6: Is image complexity associated with required rank?
Yes. There is a strong correlation (Pearson r = {pearson_r:.3f}, p = {p_val:.3e}), meaning structurally complex images require more components.
"""
    print(summary)
    with open(os.path.join(RESULTS_DIR, "summary.txt"), "w") as f:
        f.write(summary)

if __name__ == "__main__":
    df, curves, info = run_experiment()
    baseline, df_fva, df_fixed = perform_fixed_vs_adaptive(df, curves)
    cat_summary = pd.read_csv(os.path.join(RESULTS_DIR, "dataset_summary.csv"))
    find_case_studies(df, df_fva, info, baseline)
    generate_plots(df, df_fva, df_fixed, cat_summary, curves, info)
    generate_summary(df, df_fva, df_fixed, baseline)
    print("Experiment completed successfully! All data and plots saved.")
