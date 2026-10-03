import numpy as np
from PIL import Image
import io

def load_image(file_bytes: bytes, max_size=512):
    """
    Loads an image from bytes, converts to RGB, and resizes if it's too large.
    Resizing helps keep SVD computation fast.
    """
    image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    
    # Resize if necessary while maintaining aspect ratio
    if max(image.width, image.height) > max_size:
        ratio = max_size / max(image.width, image.height)
        new_size = (int(image.width * ratio), int(image.height * ratio))
        image = image.resize(new_size, Image.Resampling.LANCZOS)
        
    img_array = np.array(image, dtype=np.float32) / 255.0
    return img_array

def image_to_bytes(img_array, format="JPEG", quality=90):
    """
    Converts a float [0, 1] numpy array to image bytes.
    """
    img_uint8 = (np.clip(img_array, 0, 1) * 255.0).astype(np.uint8)
    image = Image.fromarray(img_uint8)
    
    buf = io.BytesIO()
    image.save(buf, format=format, quality=quality)
    return buf.getvalue()

def calculate_complexity(img_array):
    """
    Calculates a simple image complexity measure (Edge density using Sobel).
    """
    from skimage.color import rgb2gray
    from skimage.filters import sobel
    
    gray_img = rgb2gray(img_array)
    edge_map = sobel(gray_img)
    # Edge density: fraction of edge pixels above a threshold
    edge_density = np.mean(edge_map > 0.05)
    return float(edge_density)
