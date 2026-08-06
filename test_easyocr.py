import easyocr
import cv2
import sys

image_path = "TimeTable_AIML_A.png"
reader = easyocr.Reader(['en'], gpu=False)
img = cv2.imread(image_path)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Test with lower thresholds
results = reader.readtext(gray, text_threshold=0.1, low_text=0.1)

for (bbox, text, prob) in results:
    if "SE" in text or "se" in text.lower():
        print(f"Found SE: {text} at {bbox} with prob {prob}")
