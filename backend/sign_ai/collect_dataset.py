"""
Interactive Dataset Collection Tool for 25 STEM Sign Language Signs
Rajalakshmi Institute of Technology - Final Year Project

Records training images for YOLOv8 using standard webcam.
Saves images and generates YOLO format bounding box annotations automatically.

Usage:
    python collect_dataset.py --class-id 0 --samples 50
"""

import os
import sys
import time
import argparse
from pathlib import Path

# Try importing cv2
try:
    import cv2
except ImportError:
    print("[ERROR] OpenCV is not installed. Install via: pip install opencv-python")
    sys.exit(1)

SIGN_CLASSES = [
    "welcome", "question", "repeat", "understand", "dont_understand",
    "formula", "theorem", "velocity", "force", "acceleration",
    "integral", "derivative", "equal", "plus", "minus",
    "solution", "example_please", "slow_down", "yes", "no",
    "explain_again", "physics", "chemistry", "mathematics", "thank_you"
]

def parse_args():
    parser = argparse.ArgumentParser(description="Collect Sign Language Dataset for YOLOv8")
    parser.add_argument("--class-id", type=int, default=0, help=f"Class index 0-{len(SIGN_CLASSES)-1}")
    parser.add_argument("--samples", type=int, default=50, help="Number of frames to collect per class")
    parser.add_argument("--output-dir", type=str, default="./dataset", help="Output directory")
    parser.add_argument("--camera", type=int, default=0, help="Webcam device ID (default 0)")
    return parser.parse_args()

def main():
    args = parse_args()
    if args.class_id < 0 or args.class_id >= len(SIGN_CLASSES):
        print(f"[ERROR] Invalid class-id {args.class_id}. Must be between 0 and {len(SIGN_CLASSES)-1}.")
        return

    class_name = SIGN_CLASSES[args.class_id]
    print("=" * 60)
    print(f"STEM SIGN LANGUAGE DATASET COLLECTOR: Class #{args.class_id} -> '{class_name}'")
    print("=" * 60)

    # Setup directories
    img_train_dir = Path(args.output_dir) / "images" / "train"
    lbl_train_dir = Path(args.output_dir) / "labels" / "train"
    img_val_dir = Path(args.output_dir) / "images" / "val"
    lbl_val_dir = Path(args.output_dir) / "labels" / "val"

    for d in [img_train_dir, lbl_train_dir, img_val_dir, lbl_val_dir]:
        d.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"[ERROR] Cannot open webcam index {args.camera}")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

    print("\nCONTROLS:")
    print("  [SPACE] : Start recording samples for current sign")
    print("  [N]     : Switch to next sign class")
    print("  [Q]     : Quit\n")

    current_class_id = args.class_id
    collecting = False
    count = 0
    target_samples = args.samples

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1) # Mirror preview
        h, w, _ = frame.shape
        display = frame.copy()

        # Define Center Region Of Interest (ROI) for gesture bounding box
        roi_x1, roi_y1 = int(w * 0.2), int(h * 0.15)
        roi_x2, roi_y2 = int(w * 0.8), int(h * 0.85)

        # Draw ROI box
        color = (0, 255, 0) if collecting else (0, 165, 255)
        cv2.rectangle(display, (roi_x1, roi_y1), (roi_x2, roi_y2), color, 2)

        # Display info HUD
        current_name = SIGN_CLASSES[current_class_id]
        status_text = f"Recording ({count}/{target_samples})" if collecting else "Ready - Press SPACE to record"
        cv2.putText(display, f"Class [{current_class_id}]: {current_name.upper()}", (20, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.putText(display, status_text, (20, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        if collecting and count < target_samples:
            # 80% train, 20% val split
            is_val = (count % 5 == 0)
            target_img_dir = img_val_dir if is_val else img_train_dir
            target_lbl_dir = lbl_val_dir if is_val else lbl_train_dir

            timestamp = int(time.time() * 1000)
            base_filename = f"{current_name}_{timestamp}_{count}"
            img_path = target_img_dir / f"{base_filename}.jpg"
            lbl_path = target_lbl_dir / f"{base_filename}.txt"

            # Save JPEG
            cv2.imwrite(str(img_path), frame)

            # YOLO Format: <class-index> <x_center> <y_center> <width> <height> (normalized 0.0 to 1.0)
            x_center = ((roi_x1 + roi_x2) / 2.0) / w
            y_center = ((roi_y1 + roi_y2) / 2.0) / h
            box_w = (roi_x2 - roi_x1) / w
            box_h = (roi_y2 - roi_y1) / h

            with open(lbl_path, "w") as f:
                f.write(f"{current_class_id} {x_center:.6f} {y_center:.6f} {box_w:.6f} {box_h:.6f}\n")

            count += 1
            time.sleep(0.08) # ~12 fps collection rate

            if count >= target_samples:
                collecting = False
                print(f"[SUCCESS] Collected {target_samples} images for class '{current_name}'!")

        cv2.imshow("Sign Dataset Collector (YOLOv8)", display)
        key = cv2.waitKey(1) & 0xFF

        if key == ord(' '):
            collecting = not collecting
            count = 0
        elif key == ord('n'):
            current_class_id = (current_class_id + 1) % len(SIGN_CLASSES)
            count = 0
            collecting = False
        elif key == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("[DONE] Dataset collection session ended.")

if __name__ == "__main__":
    main()
