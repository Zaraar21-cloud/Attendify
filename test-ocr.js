const { recognize } = require('tesseract.js');
const path = require('path');

async function testOCR() {
  const imagePath = path.resolve('TimeTable_AIML_A.png');
  const result = await recognize(imagePath, 'eng', { 
    logger: m => {}, 
    tessedit_pageseg_mode: '4' 
  });
  console.log(result.data.text);
}

testOCR().catch(console.error);
