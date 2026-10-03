# SMART SVD: Adaptive Image Compression Using Linear Algebra

## Project Motivation
This project explores Singular Value Decomposition (SVD), a fundamental concept in Linear Algebra, and its application to image compression. Instead of a standard fixed-rank approximation, we propose an **Adaptive Rank Selection** method that automatically determines the minimum number of singular components required to meet a specific visual quality threshold (SSIM).

## Mathematical Concept
An image matrix $A$ can be decomposed using SVD:
$A = U \Sigma V^T$

By retaining only the first $k$ singular values (the largest), we get a low-rank approximation:
$A_k = U_k \Sigma_k V_k^T$

Our algorithm dynamically finds the minimal $k$ such that the Structural Similarity (SSIM) between $A$ and $A_k$ meets a given target (e.g., 0.90).

## Architecture
- **Frontend**: Next.js, React, Tailwind CSS, Recharts for an interactive dashboard.
- **Backend**: FastAPI (Python), NumPy for SVD computation, Scikit-image for metrics.
- **Experiments Pipeline**: Python scripts (`run_experiments.py`) to generate CSV data and matplotlib graphs.

## Installation

### Prerequisites
- Node.js
- Python 3.9+

### Backend Setup
1. `cd backend`
2. `python -m venv venv`
3. `.\venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux)
4. `pip install fastapi uvicorn numpy scikit-image pillow pandas matplotlib python-multipart`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm install recharts lucide-react`

## Running the Application

1. **Start Backend**:
   `cd backend`
   `.\\venv\\Scripts\\uvicorn main:app --host 0.0.0.0 --port 8001`

2. **Start Frontend**:
   `cd frontend`
   `npm run dev`
   Navigate to `http://localhost:3000`.

## Running Experiments
To generate the research report results, graphs, and visual comparisons:
1. `cd experiments`
2. `python download_datasets.py` (Downloads sample images if missing)
3. `python run_experiments.py`
Results will be saved in `experiments/results/` and `experiments/plots/`.

## Evaluation Metrics
- **SSIM (Structural Similarity Index)**: Measures perceptual visual quality.
- **PSNR (Peak Signal-to-Noise Ratio)**: Measures pixel-level error.
- **Storage Reduction**: Percentage of parameters saved relative to the original image dimensions.

## Example Results
Adaptive compression shows that images with high complexity (e.g., dense text or street scenes) require significantly higher SVD ranks (components) to maintain the same SSIM compared to low-complexity images (e.g., simple portraits).
