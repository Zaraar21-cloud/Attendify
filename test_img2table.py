from img2table.document import Image
from img2table.ocr import EasyOCR
import json
import sys

def main():
    image_path = "TimeTable_AIML_A.png"
    # Provide easyocr args with lower thresholds to catch SE
    ocr = EasyOCR(lang=["en"], kw={"gpu": False, "text_threshold": 0.1, "low_text": 0.1})
    
    img = Image(image_path)
    
    # Extract tables
    tables = img.extract_tables(ocr=ocr, implicit_rows=False, borderless_tables=False, min_confidence=10)
    
    if not tables:
        print("No tables found")
        sys.exit(1)
        
    table = tables[0]
    
    result = []
    # table.content is an OrderedDict where keys are row ids (int) and values are lists of TableCell
    for row_idx, row in table.content.items():
        row_data = []
        for cell in row:
            val = cell.value if cell.value else ""
            row_data.append(val.replace('\n', ' ').strip())
        result.append(row_data)
        
    for i, r in enumerate(result):
        print(f"Row {i}: {' | '.join(r)}")

if __name__ == "__main__":
    main()
