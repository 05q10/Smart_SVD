# SMART SVD: Adaptive Image Compression Using Linear Algebra

## 1. Abstract
This project demonstrates an application of Singular Value Decomposition (SVD) for image compression. We introduce an adaptive rank selection algorithm that automatically finds the minimum number of singular components required to meet a user-specified visual quality target (SSIM).

## 2. Introduction
In many domains like medical imaging or cloud storage, it is crucial to balance storage reduction and visual quality. SVD decomposes an image matrix to identify the most significant information components. 

## 3. Background
- SVD factorization
- Rank approximations

## 4. Mathematical Foundation
A = UΣVᵀ
Where:
- U: left singular vectors
- Σ: diagonal matrix containing singular values
- Vᵀ: right singular vectors

Low-rank approximation:
A_k = U_k Σ_k V_kᵀ

## 5. Existing Application
Traditional SVD-based image compression manually selects a fixed rank `k` for all images, leading to inconsistent quality or suboptimal compression across diverse image datasets.

## 6. Proposed Adaptive Method
Our proposed method searches for the optimal rank `k` iteratively to meet a target Structural Similarity Index (SSIM), ensuring consistent visual quality with minimum parameters.

## 7. System Architecture
Next.js (Frontend) <-> FastAPI (Backend) <-> SVD & Metrics Engine (NumPy, Scikit-image)

## 8. Experimental Setup
- Tools: Python, Scikit-image
- Metrics: SSIM, PSNR, MSE
- Categories: Landscape, Portrait, Architecture, Document, Street

## 9. Dataset / Image Categories
- Landscape
- Portrait
- Architecture
- Document
- High-detail street

## 10. Evaluation Metrics
- SSIM (Structural Similarity Index)
- PSNR (Peak Signal-to-Noise Ratio)
- Compression Ratio = Original Params / Compressed Params

## 11. Results
(Populated after running experiments)

## 12. Fixed vs Adaptive Comparison
(Populated after running experiments)

## 13. Complexity Analysis
We measure image edge density (Sobel) and correlate it with the required rank to meet SSIM 0.90.

## 14. Real-World Applications
- Cloud storage
- Mobile photo storage
- Medical imaging
- Web image delivery
- Computer Vision datasets

## 15. Limitations
SVD is computationally expensive (O(min(N, M)^2 max(N, M))) compared to block-based methods like JPEG (DCT). Furthermore, SVD rank truncation is not as optimal for psychovisual compression as modern codecs.

## 16. Future Work
- Combining SVD with block-wise compression (e.g., SVD per 8x8 block).
- Utilizing Randomized SVD for faster computation.

## 17. Conclusion
Adaptive SVD rank selection ensures guaranteed quality targets across varying image complexities, making it a robust alternative to fixed-rank truncation.

## 18. References
1. Strang, G. (1993). Introduction to linear algebra.
2. Wang, Z., et al. (2004). "Image quality assessment: from error visibility to structural similarity." IEEE transactions on image processing.
