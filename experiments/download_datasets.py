import os
import skimage.data
import imageio

os.makedirs("../datasets", exist_ok=True)

images = {
    "landscape.jpg": skimage.data.astronaut(), 
    "portrait.jpg": skimage.data.camera(), 
    "architecture.jpg": skimage.data.brick(), 
    "document.jpg": skimage.data.page(), 
    "street.jpg": skimage.data.chelsea() 
}

for name, img in images.items():
    path = os.path.join("../datasets", name)
    if not os.path.exists(path):
        print(f"Saving {name}...")
        imageio.imsave(path, img)
    else:
        print(f"{name} already exists.")
print("Datasets ready.")
