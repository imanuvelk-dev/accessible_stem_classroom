"""
YOLOv8 Sign Language Recognition Training Pipeline
Rajalakshmi Institute of Technology - Final Year Project

Trains YOLOv8 Nano on 25 Educational STEM Sign Language gestures.
Produces validation metrics: mAP@50, Precision, Recall, Confusion Matrix, and ONNX export.

Usage:
    python train_yolo.py --epochs 50 --batch 16 --imgsz 640
"""

import os
import sys
import argparse
from pathlib import Path

def parse_args():
    parser = argparse.ArgumentParser(description="Train YOLOv8 on Sign Language Dataset")
    parser.add_argument("--data", type=str, default="dataset.yaml", help="Path to dataset.yaml")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Pretrained model (yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image resolution")
    parser.add_argument("--device", type=str, default="", help="Device: '0' for CUDA GPU, 'cpu' for CPU")
    parser.add_argument("--export-onnx", action="store_true", help="Export best weights to ONNX format")
    return parser.parse_args()

def main():
    args = parse_args()

    try:
        from ultralytics import YOLO
    except ImportError:
        print("[ERROR] Ultralytics is not installed. Install via: pip install ultralytics")
        print("Tip: Run: pip install ultralytics opencv-python")
        sys.exit(1)

    data_path = Path(__file__).parent / args.data
    if not data_path.exists():
        print(f"[ERROR] Cannot find {data_path}. Ensure dataset.yaml is present.")
        sys.exit(1)

    print("=" * 60)
    print("STARTING YOLOV8 EDUCATIONAL SIGN LANGUAGE MODEL TRAINING")
    print(f"Base Model : {args.model}")
    print(f"Data Config: {data_path}")
    print(f"Epochs     : {args.epochs}")
    print(f"Batch Size : {args.batch}")
    print(f"Resolution : {args.imgsz}")
    print("=" * 60)

    # Load pretrained YOLOv8 nano model (transfer learning)
    model = YOLO(args.model)

    # Train model
    results = model.train(
        data=str(data_path),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device if args.device else None,
        plots=True,
        save=True,
        project="runs/sign_language",
        name="yolov8_stem_signs",
        patience=15, # early stopping patience
    )

    print("\n[SUCCESS] Training completed!")
    print("Results saved to: runs/sign_language/yolov8_stem_signs")

    # Evaluate best model on validation set
    print("\nEvaluating best model on Validation Set...")
    metrics = model.val()
    print(f"mAP@50    : {metrics.box.map50:.4f}")
    print(f"mAP@50-95 : {metrics.box.map:.4f}")

    if args.export_onnx:
        print("\nExporting model to ONNX for ultra-low latency browser & edge inference...")
        model.export(format="onnx")
        print("[SUCCESS] Exported best.onnx!")

if __name__ == "__main__":
    main()
