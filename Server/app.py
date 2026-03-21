import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
import cv2
from utils import image_to_base64, to_grayscale, normalize_img
from spatial import add_noise, apply_filter
from edge import apply_edge
from fft_filters_hybrid import apply_fft_filter, create_hybrid
from histogram import process_histogram
from snake import run_snake

app = FastAPI(title="Image Equalizer Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

images = {}

class SpatialParams(BaseModel):
    noise_type: str
    filter_type: str
    noise_ratio: float
    kernel_size: int

class EdgeParams(BaseModel):
    method: str

class FFTParams(BaseModel):
    filter_type: str
    radius: int

class HybridParams(BaseModel):
    image_id_1: str
    image_id_2: str
    radius_low: int
    radius_high: int

class HistogramParams(BaseModel):
    mode: str    # "gray" | "rgb"
    action: str  # "none" | "equalize" | "normalize"

class SnakeParams(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int
    alpha: float = 0.1
    beta: float = 0.1
    gamma: float = 1.0
    max_iterations: int = 300
    adaptive_weights: bool = True

@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    image_id = str(uuid.uuid4())
    images[image_id] = img
    return {"image_id": image_id}

@app.post("/apply_spatial")
async def apply_spatial(
    image_id: str = Query(...),
    params: SpatialParams = Body(...)
):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    img = images[image_id]
    noisy = add_noise(img, params.noise_type, params.noise_ratio)
    filtered = apply_filter(noisy, params.filter_type, params.kernel_size)
    
    return {
        "noisy_image": image_to_base64(noisy),
        "filtered_image": image_to_base64(filtered)
    }

@app.post("/apply_edge")
async def apply_edge_detection(
    image_id: str = Query(...),
    params: EdgeParams = Body(...)
):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")
    img = images[image_id]
    gray = to_grayscale(img)
    results = apply_edge(gray, params.method)
    response = {}
    if params.method == "canny":
        response["edges"] = image_to_base64(results[0]["image"])
    else:
        for res in results:
            if res["label"] == "X-Gradient":   response["gx"] = image_to_base64(res["image"])
            elif res["label"] == "Y-Gradient": response["gy"] = image_to_base64(res["image"])
            elif res["label"] == "Magnitude":  response["magnitude"] = image_to_base64(res["image"])
    return response

@app.post("/apply_fft")
async def apply_fft(params: FFTParams, image_id: str = Query(...)):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    result = apply_fft_filter(images[image_id], params.filter_type, params.radius)
    return {"result_image": image_to_base64(result)}

@app.post("/apply_hybrid")
async def apply_hybrid_endpoint(params: HybridParams):
    if params.image_id_1 not in images or params.image_id_2 not in images:
        raise HTTPException(status_code=404, detail="One or both images not found")
    
    img1 = images[params.image_id_1]
    img2 = images[params.image_id_2]
    
    lp, hp, hybrid = create_hybrid(
        img1, 
        img2, 
        params.radius_low, 
        params.radius_high
    )
    
    return {
        "lp_image": image_to_base64(lp),
        "hp_image": image_to_base64(hp),
        "hybrid_image": image_to_base64(hybrid)
    }

@app.post("/apply_histogram")
async def apply_histogram(
    image_id: str = Query(...),
    params: HistogramParams = Body(...)
):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")

    result = process_histogram(images[image_id], params.mode, params.action)
    return result

@app.post("/apply_snake")
async def apply_snake(
    image_id: str = Query(...),
    params: SnakeParams = Body(...)
):
    if image_id not in images:
        raise HTTPException(status_code=404, detail="Image not found")

    img = images[image_id]

    result = run_snake(
        img_rgb=img,
        x1=params.x1,
        y1=params.y1,
        x2=params.x2,
        y2=params.y2,
        alpha=params.alpha,
        beta=params.beta,
        gamma=params.gamma,
        max_iterations=params.max_iterations,
        adaptive_weights=params.adaptive_weights,
    )

    return {
        "result_image":    image_to_base64(result["result_image"]),
        "initial_contour": result["initial_contour"],
        "final_contour":   result["final_contour"],
    }