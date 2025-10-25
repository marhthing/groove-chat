import { AttachedFile } from "@/components/FileAttachment";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Set up PDF.js worker - use local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export interface ProcessedDocument {
  type: 'image' | 'pdf' | 'docx' | 'excel' | 'csv';
  filename: string;
  data?: string; // base64 for images
  text?: string; // extracted text for documents
  mimeType?: string;
  storageUrl?: string; // URL from Supabase Storage
}

/**
 * Compress image if needed to meet size limits
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate max dimensions (33 megapixels)
        const maxPixels = 33 * 1024 * 1024;
        const currentPixels = width * height;

        if (currentPixels > maxPixels) {
          const ratio = Math.sqrt(maxPixels / currentPixels);
          width = Math.floor(width * ratio);
          height = Math.floor(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Try different quality levels to get under 4MB
        let quality = 0.9;
        let base64 = canvas.toDataURL('image/jpeg', quality);

        while (base64.length > 4 * 1024 * 1024 && quality > 0.1) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract text from PDF with intelligent adaptive truncation
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const totalPages = pdf.numPages;
  // Reduced to 4000 tokens to leave room for system prompt + conversation history
  const TARGET_TOKENS = 4000;
  const MAX_CHARS = TARGET_TOKENS * 4;

  // First pass: try to extract all pages
  let fullText = '';
  const pageTexts: string[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    pageTexts.push(pageText);
    fullText += `\n--- Page ${i} ---\n${pageText}\n`;
  }

  // If it fits, return everything!
  if (fullText.length <= MAX_CHARS) {
    return fullText;
  }

  // Calculate compression ratio needed
  const compressionRatio = MAX_CHARS / fullText.length;
  let text = '';

  // Light compression (>70% kept) - just trim some middle pages
  if (compressionRatio > 0.7) {
    const pagesToKeep = Math.floor(totalPages * compressionRatio);
    const skipStart = Math.floor(totalPages * 0.4);
    const skipEnd = skipStart + (totalPages - pagesToKeep);

    for (let i = 1; i <= totalPages; i++) {
      if (i >= skipStart && i < skipEnd) {
        if (i === skipStart) {
          text += `\n... [Pages ${skipStart} to ${skipEnd - 1} omitted] ...\n`;
        }
        continue;
      }
      text += `\n--- Page ${i} ---\n${pageTexts[i - 1]}\n`;
    }
  }
  // Moderate compression (40-70% kept) - strategic sampling
  else if (compressionRatio > 0.4) {
    const pagesToKeep = Math.floor(totalPages * compressionRatio);
    const keepFirst = Math.floor(pagesToKeep * 0.5);
    const keepMiddle = Math.floor(pagesToKeep * 0.2);
    const keepLast = pagesToKeep - keepFirst - keepMiddle;

    // First pages
    for (let i = 1; i <= keepFirst; i++) {
      text += `\n--- Page ${i} ---\n${pageTexts[i - 1]}\n`;
    }

    // Middle pages
    if (keepMiddle > 0) {
      const middleStart = Math.floor(totalPages / 2);
      text += `\n... [Pages ${keepFirst + 1} to ${middleStart - 1} omitted] ...\n`;
      for (let i = 0; i < keepMiddle; i++) {
        const pageNum = middleStart + i;
        text += `\n--- Page ${pageNum} ---\n${pageTexts[pageNum - 1]}\n`;
      }
    }

    // Last pages
    const lastStart = totalPages - keepLast + 1;
    text += `\n... [Pages ${Math.floor(totalPages / 2) + keepMiddle} to ${lastStart - 1} omitted] ...\n`;
    for (let i = lastStart; i <= totalPages; i++) {
      text += `\n--- Page ${i} ---\n${pageTexts[i - 1]}\n`;
    }

    text = `[PDF: ${totalPages} pages, showing ${pagesToKeep} pages]\n` + text;
  }
  // Heavy compression (<40% kept)
  else {
    const keepFirst = 3;
    const keepMiddle = 2;
    const keepLast = 3;

    for (let i = 1; i <= keepFirst; i++) {
      text += `\n--- Page ${i} ---\n${pageTexts[i - 1]}\n`;
    }

    text += `\n... [Significant content omitted] ...\n`;

    const middleStart = Math.floor(totalPages / 2);
    for (let i = 0; i < keepMiddle; i++) {
      const pageNum = middleStart + i;
      text += `\n--- Page ${pageNum} ---\n${pageTexts[pageNum - 1]}\n`;
    }

    text += `\n... [Significant content omitted] ...\n`;

    for (let i = totalPages - keepLast + 1; i <= totalPages; i++) {
      text += `\n--- Page ${i} ---\n${pageTexts[i - 1]}\n`;
    }

    text = `[PDF: ${totalPages} pages, heavily sampled to fit limits]\n` + text;
  }

  return text;
}

/**
 * Extract text from Word document with intelligent adaptive truncation
 */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  let text = result.value;

  // Reduced to 4000 tokens to leave room for system prompt + conversation history
  const TARGET_TOKENS = 4000;
  const MAX_CHARS = TARGET_TOKENS * 4;

  // If it fits, return as-is!
  if (text.length <= MAX_CHARS) {
    return text;
  }

  // Calculate how much to keep
  const compressionRatio = MAX_CHARS / text.length;

  // Light compression (>85% kept) - just trim the end
  if (compressionRatio > 0.85) {
    const charsToKeep = Math.floor(text.length * compressionRatio);
    text = text.substring(0, charsToKeep) + '\n\n... [End of document truncated] ...';
  }
  // Moderate compression (60-85% kept)
  else if (compressionRatio > 0.6) {
    const firstPart = text.substring(0, Math.floor(MAX_CHARS * 0.7));
    const lastPart = text.substring(text.length - Math.floor(MAX_CHARS * 0.3));
    text = firstPart + '\n\n... [Middle section omitted] ...\n\n' + lastPart;
  }
  // Heavy compression (<60% kept)
  else {
    const firstPart = text.substring(0, Math.floor(MAX_CHARS * 0.5));
    const lastPart = text.substring(text.length - Math.floor(MAX_CHARS * 0.5));
    text = firstPart + '\n\n... [Significant middle content omitted to fit limits] ...\n\n' + lastPart;
  }

  return text;
}

/**
 * Extract text from Excel with intelligent adaptive truncation
 */
async function extractExcelText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  let text = '';
  // Reduced to 4000 tokens to leave room for system prompt + conversation history
  const TARGET_TOKENS = 4000;
  const MAX_CHARS = TARGET_TOKENS * 4; // ~4 chars per token average

  // First pass: extract everything
  let fullText = '';
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    fullText += `Sheet: ${sheetName}\n${csvData}\n\n`;
  });

  // If it fits comfortably, return as-is (no optimization needed!)
  if (fullText.length <= MAX_CHARS) {
    return fullText;
  }

  // Smart adaptive optimization: Calculate how much we need to reduce
  const reductionNeeded = fullText.length - MAX_CHARS;
  const compressionRatio = MAX_CHARS / fullText.length;

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const lines = csvData.split('\n');

    text += `Sheet: ${sheetName}\n`;

    // Include header row
    if (lines.length > 0) {
      text += lines[0] + '\n';
    }

    if (lines.length <= 1) {
      text += '\n';
      return;
    }

    // Calculate how many rows we can keep for this sheet
    const dataRows = lines.length - 1;
    const targetRows = Math.floor(dataRows * compressionRatio);

    // If compression is minimal (>85% kept), just trim the tail slightly
    if (compressionRatio > 0.85) {
      const rowsToKeep = Math.max(targetRows, Math.floor(dataRows * 0.85));
      for (let i = 1; i <= rowsToKeep; i++) {
        text += lines[i] + '\n';
      }
      if (rowsToKeep < dataRows) {
        text += `... [${dataRows - rowsToKeep} rows omitted from end] ...\n`;
      }
    }
    // If moderate compression needed (50-85% kept), smart sampling
    else if (compressionRatio > 0.5) {
      const keepFirst = Math.floor(targetRows * 0.5);
      const keepLast = Math.floor(targetRows * 0.3);
      const keepMiddle = targetRows - keepFirst - keepLast;

      // First rows
      for (let i = 1; i <= keepFirst; i++) {
        text += lines[i] + '\n';
      }

      // Middle sample
      const middleStart = Math.floor(dataRows / 2) - Math.floor(keepMiddle / 2);
      if (keepMiddle > 0 && dataRows > keepFirst + keepLast + 20) {
        text += `... [${middleStart - keepFirst - 1} rows omitted] ...\n`;
        for (let i = 0; i < keepMiddle; i++) {
          text += lines[middleStart + i] + '\n';
        }
      }

      // Last rows
      if (keepLast > 0) {
        const lastStart = dataRows - keepLast + 1;
        if (lastStart > keepFirst + keepMiddle) {
          text += `... [${lastStart - keepFirst - keepMiddle - 1} rows omitted] ...\n`;
        }
        for (let i = lastStart; i <= dataRows; i++) {
          text += lines[i] + '\n';
        }
      }
    }
    // Heavy compression needed (<50% kept)
    else {
      const keepFirst = Math.floor(targetRows * 0.4);
      const keepMiddle = Math.floor(targetRows * 0.2);
      const keepLast = Math.floor(targetRows * 0.4);

      // First rows
      for (let i = 1; i <= keepFirst; i++) {
        text += lines[i] + '\n';
      }
      text += `... [significant data omitted] ...\n`;

      // Middle sample
      if (keepMiddle > 0) {
        const middleStart = Math.floor(dataRows / 2);
        for (let i = 0; i < keepMiddle; i++) {
          text += lines[middleStart + i] + '\n';
        }
        text += `... [significant data omitted] ...\n`;
      }

      // Last rows
      for (let i = dataRows - keepLast + 1; i <= dataRows; i++) {
        text += lines[i] + '\n';
      }
    }

    text += `\n[Total rows in sheet: ${dataRows}, Rows included: ${targetRows}]\n\n`;
  });

  return text;
}

/**
 * Extract and optimize CSV text with intelligent adaptive truncation
 */
async function extractCsvText(file: File): Promise<string> {
  const text = await file.text();
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Reduced to 4000 tokens to leave room for system prompt + conversation history
  const TARGET_TOKENS = 4000;
  const MAX_CHARS = TARGET_TOKENS * 4;
  
  // If CSV fits within limits, return as-is
  if (text.length <= MAX_CHARS) {
    return text;
  }
  
  // Calculate compression ratio needed
  const compressionRatio = MAX_CHARS / text.length;
  const totalRows = lines.length - 1; // Exclude header
  const targetRows = Math.floor(totalRows * compressionRatio);
  
  let result = '';
  
  // Always include header
  if (lines.length > 0) {
    result += lines[0] + '\n';
  }
  
  if (lines.length <= 1) {
    return result;
  }
  
  // Light compression (>85% kept) - just trim the tail
  if (compressionRatio > 0.85) {
    const rowsToKeep = Math.max(targetRows, Math.floor(totalRows * 0.85));
    for (let i = 1; i <= rowsToKeep; i++) {
      result += lines[i] + '\n';
    }
    if (rowsToKeep < totalRows) {
      result += `... [${totalRows - rowsToKeep} rows omitted from end] ...\n`;
    }
  }
  // Moderate compression (50-85% kept) - smart sampling
  else if (compressionRatio > 0.5) {
    const keepFirst = Math.floor(targetRows * 0.5);
    const keepLast = Math.floor(targetRows * 0.3);
    const keepMiddle = targetRows - keepFirst - keepLast;
    
    // First rows
    for (let i = 1; i <= keepFirst; i++) {
      result += lines[i] + '\n';
    }
    
    // Middle sample
    const middleStart = Math.floor(totalRows / 2) - Math.floor(keepMiddle / 2);
    if (keepMiddle > 0 && totalRows > keepFirst + keepLast + 20) {
      result += `... [${middleStart - keepFirst - 1} rows omitted] ...\n`;
      for (let i = 0; i < keepMiddle; i++) {
        result += lines[middleStart + i] + '\n';
      }
    }
    
    // Last rows
    if (keepLast > 0) {
      const lastStart = totalRows - keepLast + 1;
      if (lastStart > keepFirst + keepMiddle) {
        result += `... [${lastStart - keepFirst - keepMiddle - 1} rows omitted] ...\n`;
      }
      for (let i = lastStart; i <= totalRows; i++) {
        result += lines[i] + '\n';
      }
    }
  }
  // Heavy compression (<50% kept)
  else {
    const keepFirst = Math.floor(targetRows * 0.4);
    const keepMiddle = Math.floor(targetRows * 0.2);
    const keepLast = Math.floor(targetRows * 0.4);
    
    // First rows
    for (let i = 1; i <= keepFirst; i++) {
      result += lines[i] + '\n';
    }
    result += `... [significant data omitted] ...\n`;
    
    // Middle sample
    if (keepMiddle > 0) {
      const middleStart = Math.floor(totalRows / 2);
      for (let i = 0; i < keepMiddle; i++) {
        result += lines[middleStart + i] + '\n';
      }
      result += `... [significant data omitted] ...\n`;
    }
    
    // Last rows
    for (let i = totalRows - keepLast + 1; i <= totalRows; i++) {
      result += lines[i] + '\n';
    }
  }
  
  result += `\n[Total rows in CSV: ${totalRows}, Rows included: ${targetRows}]\n`;
  
  return result;
}

/**
 * Process and upload a file using Supabase Storage
 */
export async function processFileUpload(
  file: AttachedFile
): Promise<ProcessedDocument> {
  const { file: uploadFile, type } = file;

  try {
    // Get current user
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('User not authenticated');
    }

    const userId = session.user.id;
    const timestamp = Date.now();
    const fileName = `${userId}/${timestamp}-${uploadFile.name}`;

    // Process based on file type
    if (type === 'image') {
      // Compress and convert to base64
      const base64Data = await compressImage(uploadFile);

      // Also upload to Supabase Storage for persistence
      const { data: storageData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, uploadFile, {
          contentType: uploadFile.type,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      return {
        type: 'image',
        filename: uploadFile.name,
        data: base64Data,
        mimeType: uploadFile.type,
        storageUrl: publicUrl
      };
    }

    // For documents, extract text
    let extractedText = '';

    if (type === 'pdf') {
      extractedText = await extractPdfText(uploadFile);
    } else if (type === 'docx') {
      extractedText = await extractDocxText(uploadFile);
    } else if (type === 'excel') {
      extractedText = await extractExcelText(uploadFile);
    } else if (type === 'csv') {
      extractedText = await extractCsvText(uploadFile);
    }

    // Upload to Supabase Storage
    const { data: storageData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, uploadFile, {
        contentType: uploadFile.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    return {
      type,
      filename: uploadFile.name,
      text: extractedText,
      mimeType: uploadFile.type,
      storageUrl: publicUrl
    };
  } catch (error: any) {
    // console.error('File processing error:', error);
    throw new Error('There was an error processing, please try again later');
  }
}

/**
 * Create a message content that includes file information
 */
export function createFileMessageContent(
  userMessage: string,
  processedDoc: ProcessedDocument
): { content: string; isMultimodal: boolean } {
  if (processedDoc.type === 'image') {
    // For images, we'll send them to the vision model
    return {
      content: userMessage || 'What do you see in this image?',
      isMultimodal: true,
    };
  }

  // Check if data was truncated
  const wasTruncated = processedDoc.text?.includes('[Data truncated') ||
                       processedDoc.text?.includes('[Document truncated') ||
                       processedDoc.text?.includes('rows omitted') ||
                       processedDoc.text?.includes('Pages') && processedDoc.text?.includes('omitted');

  // For documents (PDF, Excel, Word), prepend the extracted text
  // Only construct this message if it's not multimodal and there's text to send
  if (!wasTruncated && !processedDoc.text) {
      return {
          content: userMessage || "I've uploaded a document. What would you like to know about it?",
          isMultimodal: false
      };
  }

  const documentContext = `
I've uploaded a ${processedDoc.type.toUpperCase()} file (${processedDoc.filename}).
${wasTruncated ? '\nNote: Large document was intelligently sampled to fit within processing limits. Key sections from beginning, middle, and end are included.\n' : ''}

Document content:
${processedDoc.text}

${userMessage ? `My question: ${userMessage}` : 'Please analyze this document and provide insights.'}
  `.trim();

  return {
    content: documentContext,
    isMultimodal: false,
  };
}