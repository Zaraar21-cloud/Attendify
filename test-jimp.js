const { recognize } = require('tesseract.js');
const Jimp = require('jimp');

async function testOCR() {
  console.log("Loading image with Jimp...");
  const image = await Jimp.read('TimeTable_AIML_A.png');
  
  console.log("Preprocessing: grayscale, contrast, scale...");
  image.greyscale();
  image.contrast(0.5); // Increase contrast
  image.scale(2); // Scale up 2x

  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  
  console.log("Running Tesseract...");
  const result = await recognize(buffer, 'eng');
  
  console.log("\\n--- OCR TEXT ---");
  console.log(result.data.text);
}

testOCR().catch(console.error);
