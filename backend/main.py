import uuid
import base64
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from image_utils import load_image, image_to_bytes, calculate_complexity
from svd_engine import compute_svd, reconstruct_image, get_singular_values
from metrics import calculate_metrics, calculate_storage_reduction
from adaptive_rank import find_adaptive_rank

app = FastAPI(title="Smart SVD API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cache for uploaded images and their SVD components
# In production, you'd use a more robust caching mechanism or database.
svd_cache = {}

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        # Load and resize image to prevent memory/computation issues
        img_array = load_image(contents, max_size=512)
        
        # Compute SVD
        U, S, Vt = compute_svd(img_array)
        
        image_id = str(uuid.uuid4())
        svd_cache[image_id] = {
            'original_img': img_array,
            'U': U,
            'S': S,
            'Vt': Vt
        }
        
        # Calculate complexity
        complexity = calculate_complexity(img_array)
        
        # Get singular values for plotting (average across channels)
        singular_values = get_singular_values(S)
        
        # Return original image as base64 so frontend can display it
        orig_bytes = image_to_bytes(img_array)
        base64_orig = base64.b64encode(orig_bytes).decode('utf-8')
        
        max_rank = min(img_array.shape[0], img_array.shape[1])
        
        return {
            "image_id": image_id,
            "shape": img_array.shape,
            "max_rank": max_rank,
            "complexity": complexity,
            "singular_values": singular_values[:100],  # Return top 100 for visualization
            "original_image": f"data:image/jpeg;base64,{base64_orig}"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/reconstruct/{image_id}")
async def get_reconstruction(image_id: str, rank: int):
    if image_id not in svd_cache:
        raise HTTPException(status_code=404, detail="Image not found in cache")
        
    cache_item = svd_cache[image_id]
    original_img = cache_item['original_img']
    U = cache_item['U']
    S = cache_item['S']
    Vt = cache_item['Vt']
    
    max_rank = min(original_img.shape[0], original_img.shape[1])
    rank = min(max(1, rank), max_rank)
    
    reconstructed = reconstruct_image(U, S, Vt, rank)
    metrics = calculate_metrics(original_img, reconstructed)
    storage = calculate_storage_reduction(original_img.shape, rank)
    
    rec_bytes = image_to_bytes(reconstructed)
    base64_rec = base64.b64encode(rec_bytes).decode('utf-8')
    
    return {
        "rank": rank,
        "metrics": metrics,
        "storage": storage,
        "reconstructed_image": f"data:image/jpeg;base64,{base64_rec}"
    }

@app.get("/api/adaptive/{image_id}")
async def get_adaptive_reconstruction(image_id: str, target_ssim: float):
    if image_id not in svd_cache:
        raise HTTPException(status_code=404, detail="Image not found in cache")
        
    cache_item = svd_cache[image_id]
    original_img = cache_item['original_img']
    U = cache_item['U']
    S = cache_item['S']
    Vt = cache_item['Vt']
    
    max_rank = min(original_img.shape[0], original_img.shape[1])
    
    best_rank, metrics = find_adaptive_rank(original_img, U, S, Vt, target_ssim, max_rank)
    
    storage = calculate_storage_reduction(original_img.shape, best_rank)
    
    reconstructed = reconstruct_image(U, S, Vt, best_rank)
    rec_bytes = image_to_bytes(reconstructed)
    base64_rec = base64.b64encode(rec_bytes).decode('utf-8')
    
    return {
        "target_ssim": target_ssim,
        "selected_rank": best_rank,
        "metrics": metrics,
        "storage": storage,
        "reconstructed_image": f"data:image/jpeg;base64,{base64_rec}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
