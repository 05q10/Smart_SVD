from skimage.metrics import structural_similarity as ssim
from skimage.metrics import peak_signal_noise_ratio as psnr
from skimage.metrics import mean_squared_error as mse
import numpy as np

def calculate_metrics(original_img, reconstructed_img):
    """
    Calculates SSIM, PSNR, MSE between original and reconstructed images.
    Images should be numpy arrays with values in [0, 1].
    """
    # ensure data types are float64 for metrics
    orig_float = original_img.astype(np.float64)
    rec_float = reconstructed_img.astype(np.float64)
    
    # Compute SSIM. We need to specify data_range and multichannel/channel_axis
    if orig_float.ndim == 3:
        # skimage version 0.19+ uses channel_axis
        try:
            ssim_val = ssim(orig_float, rec_float, data_range=1.0, channel_axis=-1)
        except TypeError:
            ssim_val = ssim(orig_float, rec_float, data_range=1.0, multichannel=True)
    else:
        ssim_val = ssim(orig_float, rec_float, data_range=1.0)
        
    psnr_val = psnr(orig_float, rec_float, data_range=1.0)
    mse_val = mse(orig_float, rec_float)
    
    return {
        "ssim": float(ssim_val),
        "psnr": float(psnr_val),
        "mse": float(mse_val)
    }

def calculate_storage_reduction(original_shape, rank):
    """
    Calculates the compression ratio and storage reduction percentage.
    For an M x N image with 3 channels:
    Original parameters = M * N * 3
    Compressed parameters = (M * rank + rank + rank * N) * 3
                          = rank * (M + N + 1) * 3
    """
    H = original_shape[0]
    W = original_shape[1]
    channels = original_shape[2] if len(original_shape) == 3 else 1
    
    original_params = H * W * channels
    compressed_params = rank * (H + W + 1) * channels
    
    compression_ratio = original_params / compressed_params if compressed_params > 0 else 1
    storage_reduction = (1 - (compressed_params / original_params)) * 100
    
    return {
        "original_params": int(original_params),
        "compressed_params": int(compressed_params),
        "compression_ratio": float(compression_ratio),
        "storage_reduction_percent": float(storage_reduction)
    }
