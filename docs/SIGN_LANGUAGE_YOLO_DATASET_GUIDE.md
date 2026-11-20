# Sign Language Recognition with YOLOv8: Dataset & Training Guide
## Rajalakshmi Institute of Technology, Chennai
### Department of AI & ML — Final Year Project Review

---

## 1. Do We Need a Dataset? (Yes!)

**Yes, absolutely.** Machine learning models like **YOLOv8** are supervised models. To train a model to recognize sign language gestures, it requires a dataset of labeled images or video frames.

### Why a Dataset is Required:
1. **Bounding Box Localization:** YOLOv8 needs to know *where* the hands and body are in the video frame (`x_center, y_center, width, height`).
2. **Class Classification:** The model needs training samples to distinguish between different gestures (e.g., distinguishing between *"Formula"* and *"Repeat"*).
3. **Generalization:** It must learn to recognize signs under different lighting conditions, webcam resolutions, and across different people (different skin tones and hand sizes).

---

## 2. Dataset Options Available for Your Project

### Option A: The 25 Custom Educational STEM Dataset (Recommended for Final Review)
For your final year project, creating a domain-specific dataset for **25 STEM Educational Signs** gives you the **highest marks** because:
* Generic sign datasets do NOT contain STEM-specific signs like *"Formula"*, *"Derivative"*, *"Integral"*, or *"Newton's Law"*.
* External examiners specifically check if the team collected domain-specific primary data.
* You can record it directly using your laptop webcams with the included script in **15 minutes**.

#### The 25 Classroom Signs Defined in the Project:
| Category | Signs Included | Purpose |
| :--- | :--- | :--- |
| **STEM Math & Science** | `formula`, `theorem`, `velocity`, `force`, `acceleration`, `integral`, `derivative`, `equal`, `plus`, `minus` | Spoken equation support and technical terms |
| **Student Questions** | `question`, `repeat`, `dont_understand`, `explain_again`, `example_please`, `slow_down`, `doubt` | Non-verbal classroom participation for speech-impaired students |
| **Responses & Common** | `welcome`, `understand`, `solution`, `yes`, `no`, `physics`, `chemistry`, `mathematics`, `thank_you` | Two-way dialogue between teacher and student |

---

### Option B: Public Benchmark Datasets (For Literature Comparison)

When presenting in your project review, cite these standard benchmark datasets:

1. **INCLUDE Dataset (Indian Sign Language - ISL):**
   * *Published by:* IIT Madras & AI4Bharat.
   * *Contents:* 4,287 videos of 263 signs performed by native signers across 15 categories (including educational signs, numbers, and basic communication).
   * *Use:* Benchmark reference for Indian Sign Language accuracy.
2. **WLASL (Word-Level American Sign Language):**
   * *Contents:* Over 2,000 common words and 21,000 video clips from multiple signers.
   * *Use:* Comprehensive benchmark for ASL translation.
3. **Roboflow Universe Sign Language Datasets:**
   * Pre-annotated YOLOv8 format datasets available for instant download in PyTorch/YOLO format (e.g., *American Sign Language Letters*, *ISL Gestures*).

---

## 3. Step-by-Step: How to Collect & Train the YOLOv8 Model

### Step 1: Record the 25 Educational Signs (10–15 Minutes)
We have provided an automated tool in `backend/sign_ai/collect_dataset.py` that captures webcam frames and writes the YOLO annotations automatically:

```bash
# Navigate to sign_ai directory
cd backend/sign_ai

# Record 50 samples for Class 0 ("welcome")
python collect_dataset.py --class-id 0 --samples 50

# Record 50 samples for Class 5 ("formula")
python collect_dataset.py --class-id 5 --samples 50

# Or record all classes sequentially by pressing 'N' in the tool
python collect_dataset.py --class-id 0 --samples 50
```

**Controls in the Tool:**
* `[SPACE]` : Start / stop recording samples.
* `[N]`     : Switch to the next sign class.
* `[Q]`     : Finish and save.

The tool automatically splits your data:
* **80%** into `dataset/images/train` & `dataset/labels/train`
* **20%** into `dataset/images/val` & `dataset/labels/val`

---

### Step 2: Configure the YOLO Dataset Specification (`dataset.yaml`)
The configuration is already generated at `backend/sign_ai/dataset.yaml`:
```yaml
path: ./dataset
train: images/train
val: images/val
nc: 25
names:
  0: "welcome"
  1: "question"
  2: "repeat"
  3: "understand"
  4: "dont_understand"
  5: "formula"
  6: "theorem"
  ...
```

---

### Step 3: Train the YOLOv8 Model
Run the provided training pipeline:

```bash
python train_yolo.py --epochs 50 --batch 16 --imgsz 640 --export-onnx
```

* **Model Used:** `yolov8n.pt` (YOLOv8 Nano pretrained on COCO, fine-tuned on your signs).
* **Speed:** ~30–40 ms per frame on edge CPU / laptop.
* **Outputs Generated:**
  * Best weights: `runs/sign_language/yolov8_stem_signs/weights/best.pt`
  * ONNX export: `runs/sign_language/yolov8_stem_signs/weights/best.onnx` (for direct in-browser inference)
  * Metric plots: `confusion_matrix.png`, `F1_curve.png`, `PR_curve.png` (ready to copy into your Project Report PPT).

---

## 4. How the Model Integrates with the Live Classroom

```
[Webcam Stream in Browser]
          │
          ▼
[HTML5 Vision Canvas Overlay] ──► Real-time tracking reticle & bounding box
          │
          ▼
[YOLOv8 Gesture Classifier]   ──► Identifies sign (e.g., "FORMULA", 94% confidence)
          │ (Held > 600ms)
          ▼
[WebRTC DataChannel]          ──► Emits caption: "[ISL Sign → Text] Can we write the formula?"
          │
          ▼
[Meeting HUD / Subtitles]     ──► Visible to all students and the teacher instantly
```

---

## 5. Review Defense & Viva Q&A

**Examiner Question:** *"Why did you choose YOLOv8 over simple CNN or MediaPipe alone?"*
* **Answer:** *"MediaPipe provides landmark coordinate detection, but in real classroom video environments with varying distance, cluttered backgrounds, and low light, landmark detectors frequently fail. YOLOv8 provides state-of-the-art object localization and classification with high FPS (>45 FPS on edge CPUs) and robust feature extraction even with background noise."*

**Examiner Question:** *"What metrics did you use to evaluate your sign recognition model?"*
* **Answer:** *"We evaluated the model using Mean Average Precision ($\text{mAP@50}$), Precision, Recall, and a 25-class Confusion Matrix across test video frames."*
