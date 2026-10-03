import numpy as np

def compute_svd(img_array):
    """
    Computes SVD for an image array.
    For an RGB image of shape (H, W, 3), we compute SVD per channel.
    Returns: U_channels, S_channels, Vt_channels
    """
    is_rgb = img_array.ndim == 3
    
    if is_rgb:
        U_channels, S_channels, Vt_channels = [], [], []
        for i in range(3):
            U, S, Vt = np.linalg.svd(img_array[:, :, i], full_matrices=False)
            U_channels.append(U)
            S_channels.append(S)
            Vt_channels.append(Vt)
        return U_channels, S_channels, Vt_channels
    else:
        U, S, Vt = np.linalg.svd(img_array, full_matrices=False)
        return [U], [S], [Vt]

def reconstruct_image(U_channels, S_channels, Vt_channels, rank):
    """
    Reconstructs an image using the first `rank` singular values.
    """
    reconstructed_channels = []
    
    for U, S, Vt in zip(U_channels, S_channels, Vt_channels):
        # Determine the maximum rank valid for the image
        k = min(rank, len(S))
        
        # A_k = U_k * S_k * Vt_k
        U_k = U[:, :k]
        S_k = np.diag(S[:k])
        Vt_k = Vt[:k, :]
        
        # Reconstruct the channel
        channel_rec = np.dot(U_k, np.dot(S_k, Vt_k))
        reconstructed_channels.append(channel_rec)
        
    if len(reconstructed_channels) == 3:
        img_rec = np.stack(reconstructed_channels, axis=2)
    else:
        img_rec = reconstructed_channels[0]
        
    # Clip values to [0, 1] range
    return np.clip(img_rec, 0.0, 1.0)
    
def get_singular_values(S_channels):
    """
    Returns the average singular values across channels for visualization.
    """
    if len(S_channels) == 3:
        avg_S = np.mean(S_channels, axis=0)
    else:
        avg_S = S_channels[0]
    return avg_S.tolist()
