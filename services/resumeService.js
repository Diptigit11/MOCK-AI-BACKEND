import fs from "fs";

// Fixed PDF parser loading
let pdfParse;
const loadPdfParse = async () => {
  if (!pdfParse) {
    try {
      // Import pdf-parse properly
      const pdfModule = await import('pdf-parse/lib/pdf-parse.js');
      pdfParse = pdfModule.default;
    } catch (error) {
      console.warn('PDF parsing not available:', error.message);
      try {
        // Fallback import method
        const pdfModule = await import('pdf-parse');
        pdfParse = pdfModule.default;
      } catch (fallbackError) {
        console.warn('PDF parsing fallback also failed:', fallbackError.message);
        return null;
      }
    }
  }
  return pdfParse;
};

// Fixed mammoth loading
let mammoth;
const loadMammoth = async () => {
  if (!mammoth) {
    try {
      const mammothModule = await import('mammoth');
      mammoth = mammothModule.default;
    } catch (error) {
      console.warn('DOC parsing not available:', error.message);
      return null;
    }
  }
  return mammoth;
};

// Enhanced text extraction with better error handling
export async function extractResumeText(filePath, mimetype) {
  try {
    console.log(`Extracting text from: ${filePath}, mimetype: ${mimetype}`);
    
    if (mimetype === "application/pdf") {
      const pdfParser = await loadPdfParse();
      if (!pdfParser) {
        console.warn("PDF parsing not available, skipping resume analysis");
        return "PDF parsing not available - continuing without resume analysis";
      }
      
      if (!fs.existsSync(filePath)) {
        console.error("PDF file not found:", filePath);
        return "PDF file not found";
      }
      
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParser(dataBuffer);
      console.log("PDF text extracted, length:", pdfData.text.length);
      return pdfData.text;
    } 
    else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) {
      const docParser = await loadMammoth();
      if (!docParser) {
        console.warn("DOC parsing not available, skipping resume analysis");
        return "DOC parsing not available - continuing without resume analysis";
      }
      
      if (!fs.existsSync(filePath)) {
        console.error("DOC file not found:", filePath);
        return "DOC file not found";
      }
      
      const data = await docParser.extractRawText({ path: filePath });
      console.log("DOC text extracted, length:", data.value.length);
      return data.value;
    } 
    else if (mimetype === "text/plain") {
      if (!fs.existsSync(filePath)) {
        console.error("TXT file not found:", filePath);
        return "TXT file not found";
      }
      
      const text = fs.readFileSync(filePath, "utf-8");
      console.log("TXT text extracted, length:", text.length);
      return text;
    } 
    else {
      return "Unsupported resume format - continuing without resume analysis";
    }
  } catch (error) {
    console.error("Error extracting resume text:", error);
    return `Error extracting resume content: ${error.message} - continuing without resume analysis`;
  }
}