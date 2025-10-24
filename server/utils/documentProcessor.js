import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Initialize PDF.js worker
const pdfjsWorker = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Process uploaded document and extract text or prepare for vision model
 * @param {Object} file - Multer file object
 * @returns {Object} Processed document data
 */
export async function processDocument(file) {
  const { buffer, mimetype, originalname } = file;

  // Handle images - return base64 for vision model
  if (mimetype.startsWith('image/')) {
    return {
      type: 'image',
      filename: originalname,
      mimeType: mimetype,
      data: buffer.toString('base64'),
      size: buffer.length
    };
  }

  // Handle PDF files
  if (mimetype === 'application/pdf') {
    try {
      const text = await extractPdfText(buffer);
      return {
        type: 'pdf',
        filename: originalname,
        text: text,
        size: buffer.length
      };
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  // Handle Word documents (.docx)
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return {
        type: 'docx',
        filename: originalname,
        text: result.value,
        size: buffer.length
      };
    } catch (error) {
      console.error('DOCX extraction error:', error);
      throw new Error('Failed to extract text from Word document');
    }
  }

  // Handle Excel files (.xlsx, .xls)
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
    try {
      const text = await extractExcelText(buffer);
      return {
        type: 'excel',
        filename: originalname,
        text: text,
        size: buffer.length
      };
    } catch (error) {
      console.error('Excel extraction error:', error);
      throw new Error('Failed to extract data from Excel file');
    }
  }

  throw new Error(`Unsupported file type: ${mimetype}`);
}

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  
  return fullText.trim();
}

/**
 * Extract text from Excel buffer
 */
async function extractExcelText(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let allText = '';
  
  workbook.SheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to CSV format for better readability
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    
    allText += `Sheet: ${sheetName}\n`;
    allText += csv;
    allText += '\n\n';
  });
  
  return allText.trim();
}
