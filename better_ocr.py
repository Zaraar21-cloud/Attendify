import easyocr
import cv2
import sys
import numpy as np
import json
import os

def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return None
        
    # 1. Upscale image by 2x for better text clarity
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # 2. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 3. Blur and Adaptive Thresholding
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    # Using THRESH_BINARY_INV to get white text on black background for morphological operations
    thresh = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    
    # 4. Table Grid Removal
    # Horizontal lines
    horz_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 1))
    horz_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horz_kernel, iterations=1)
    
    # Vertical lines
    vert_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 50))
    vert_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vert_kernel, iterations=1)
    
    # Combine lines and dilate slightly to ensure full coverage of grid artifacts
    grid = cv2.add(horz_lines, vert_lines)
    grid = cv2.dilate(grid, np.ones((3,3), np.uint8), iterations=1)
    
    # Subtract the grid lines from the text mask
    text_mask = cv2.subtract(thresh, grid)
    
    # Apply a tiny dilation to the text to make it slightly bolder (helps OCR)
    text_mask = cv2.dilate(text_mask, np.ones((2,2), np.uint8), iterations=1)
    
    # Invert back to black text on white background
    result = cv2.bitwise_not(text_mask)
    
    return result

def parse_timetable(image_path, json_only=False):
    if not json_only:
        print(f"Processing {image_path} with Advanced OpenCV Preprocessing...")
    
    # Initialize EasyOCR Reader
    reader = easyocr.Reader(['en'], gpu=False, verbose=not json_only)
    
    processed_img = preprocess_image(image_path)
    if processed_img is None:
        if not json_only:
            print(f"Error: Could not read image {image_path}")
        else:
            print(json.dumps({"error": f"Could not read image {image_path}"}))
        return None
        
    # Run OCR on the purified, line-free, thresholded image
    results = reader.readtext(processed_img)
    
    if not results:
        if not json_only:
            print("No text found.")
        else:
            print(json.dumps([]))
        return []

    boxes = []
    total_conf = 0
    heights = []
    for bbox, text, conf in results:
        x_coords = [p[0] for p in bbox]
        y_coords = [p[1] for p in bbox]
        cx = sum(x_coords) / 4.0
        cy = sum(y_coords) / 4.0
        h = max(y_coords) - min(y_coords)
        
        boxes.append({
            'text': text,
            'cx': cx,
            'cy': cy,
            'h': h,
            'conf': conf,
            'bbox': bbox
        })
        total_conf += conf
        heights.append(h)
        
    avg_conf = total_conf / len(boxes) if boxes else 0
    median_h = np.median(heights) if heights else 40 # scaled by 2x
    
    # Save the retrieved data to a text file for verification
    text_file_path = image_path.replace('.png', '_raw_text.txt').replace('.jpg', '_raw_text.txt')
    try:
        with open(text_file_path, "w", encoding="utf-8") as tf:
            tf.write(f"Average OCR Confidence: {avg_conf:.2f}\n")
            tf.write(f"Median Text Height: {median_h:.2f}px\n\n")
            for box in boxes:
                tf.write(f"{box['text']} (Conf: {box['conf']:.2f})\n")
    except Exception:
        pass
        
    # Check if the OCR text matches the image with high accuracy
    if avg_conf < 0.35:
        if json_only:
            print(json.dumps({"error": f"OCR confidence too low ({avg_conf:.2f}). Please upload a clearer image."}))
        else:
            print(f"Error: OCR confidence too low ({avg_conf:.2f}). Please upload a clearer image.")
        return []

    # Dynamically determine the row grouping threshold based on the actual text size
    # Typically, text within the same row shouldn't drift more than 60% of the text's height
    y_threshold = max(15, median_h * 0.6)
    
    boxes.sort(key=lambda b: b['cy'])
    
    rows = []
    current_row = []
    
    for box in boxes:
        if not current_row:
            current_row.append(box)
        else:
            avg_cy = sum(b['cy'] for b in current_row) / len(current_row)
            if abs(box['cy'] - avg_cy) <= y_threshold:
                current_row.append(box)
            else:
                rows.append(current_row)
                current_row = [box]
    if current_row:
        rows.append(current_row)
        
    for row in rows:
        row.sort(key=lambda b: b['cx'])
        
    parsed_data = []
    for row in rows:
        row_texts = [box['text'] for box in row]
        parsed_data.append(row_texts)
        
    if json_only:
        print(json.dumps(parsed_data))
    else:
        print("\n--- OCR Parsed Table ---")
        for r_idx, row_texts in enumerate(parsed_data):
            print(f"Row {r_idx + 1}: " + " | ".join(row_texts))
            
        out_filename = image_path.replace('.png', '_output.json').replace('.jpg', '_output.json')
        with open(out_filename, 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, indent=2)
        print(f"\nSaved structured data to {out_filename}")
        
    return parsed_data

if __name__ == '__main__':
    args = sys.argv[1:]
    json_only = False
    
    if '--json' in args:
        json_only = True
        args.remove('--json')
        
    images_to_test = ["TimeTable_AIML_A.png", "TimeTable_AIML_C.png"] if not args else args
        
    for img_path in images_to_test:
        parse_timetable(img_path, json_only)
