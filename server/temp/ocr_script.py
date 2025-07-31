
import sys
import os
import pytesseract
from pdf2image import convert_from_path

def ocr_pdf(pdf_path):
    # Convert PDF to images
    images = convert_from_path(pdf_path, dpi=300)
    
    # Extract text from each image
    text = ''
    for i, image in enumerate(images):
        text += pytesseract.image_to_string(image) + '

'
    # Clean up temporary image files
    for image in images:
        if hasattr(image, 'filename') and os.path.exists(image.filename):
            os.remove(image.filename)
    
    return text.strip()

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python ocr_script.py <pdf_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    try:
        result = ocr_pdf(pdf_path)
        print(result)
    except Exception as e:
        print(f"OCR_ERROR: {str(e)}", file=sys.stderr)
        sys.exit(1)
    