from svd_engine import reconstruct_image
from metrics import calculate_metrics

def find_adaptive_rank(original_img, U, S, Vt, target_ssim, max_rank, step=5):
    """
    Finds the minimum rank required to achieve the target SSIM.
    Uses a simple incremental or binary search strategy.
    Because SSIM generally increases monotonically with rank, binary search is efficient.
    """
    low = 1
    high = max_rank
    best_rank = high
    
    # Let's use binary search to quickly zero in on the required rank
    while low <= high:
        mid = (low + high) // 2
        
        reconstructed = reconstruct_image(U, S, Vt, mid)
        metrics = calculate_metrics(original_img, reconstructed)
        current_ssim = metrics['ssim']
        
        if current_ssim >= target_ssim:
            best_rank = mid
            high = mid - 1
        else:
            low = mid + 1
            
    # For safety, let's verify if best_rank really meets the target
    # If binary search fails due to non-monotonicity (rare but possible), fallback to incremental
    reconstructed = reconstruct_image(U, S, Vt, best_rank)
    metrics = calculate_metrics(original_img, reconstructed)
    
    if metrics['ssim'] < target_ssim and best_rank < max_rank:
        # Incremental search from best_rank upwards if we slightly missed
        for r in range(best_rank + 1, max_rank + 1):
            reconstructed = reconstruct_image(U, S, Vt, r)
            metrics = calculate_metrics(original_img, reconstructed)
            if metrics['ssim'] >= target_ssim:
                return r, metrics
        return max_rank, metrics
        
    return best_rank, metrics
