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
  type: 'image' | 'pdf' | 'docx' | 'excel';
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
 * Extract text from PDF with intelligent truncation
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let text = '';
  const MAX_CHARS = 8000; // Limit to ~2000 tokens (safer for Groq's 12k limit)

  // Extract all pages first to get total count
  const totalPages = pdf.numPages;

  // If few pages, extract all
  if (totalPages <= 10) {
    for (let i = 1; i <= totalPages; i++) {
      if (text.length >= MAX_CHARS) break;

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += `\n--- Page ${i} ---\n${pageText}\n`;
    }
  } else {
    // For large PDFs, sample pages strategically
    const firstPages = 3;
    const middlePages = 2;
    const lastPages = 3;

    // First pages
    for (let i = 1; i <= firstPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += `\n--- Page ${i} ---\n${pageText}\n`;
    }

    // Middle pages
    const middleStart = Math.floor(totalPages / 2);
    text += `\n... [Pages ${firstPages + 1} to ${middleStart - 1} omitted] ...\n`;
    for (let i = 0; i < middlePages; i++) {
      const pageNum = middleStart + i;
      if (pageNum > totalPages - lastPages) break;

      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += `\n--- Page ${pageNum} ---\n${pageText}\n`;
    }

    // Last pages
    text += `\n... [Pages ${middleStart + middlePages} to ${totalPages - lastPages} omitted] ...\n`;
    for (let i = totalPages - lastPages + 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(' ');
      text += `\n--- Page ${i} ---\n${pageText}\n`;
    }

    text = `[PDF Document: ${totalPages} pages total, showing sample pages]\n` + text;
  }

  // Final safety check
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + '\n\n[Document truncated to fit token limits]';
  }

  return text;
}

/**
 * Extract text from Word document with intelligent truncation
 */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  let text = result.value;

  const MAX_CHARS = 8000; // Limit to ~2000 tokens (safer for Groq's 12k limit)

  if (text.length > MAX_CHARS) {
    // Keep first 60%, last 40% for context
    const firstPart = text.substring(0, Math.floor(MAX_CHARS * 0.6));
    const lastPart = text.substring(text.length - Math.floor(MAX_CHARS * 0.4));
    text = firstPart + '\n\n... [Middle section truncated to fit token limits] ...\n\n' + lastPart;
  }

  return text;
}

/**
 * Extract text from Excel with intelligent truncation
 */
async function extractExcelText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  let text = '';
  const MAX_CHARS = 8000; // Limit to ~2000 tokens (safer for Groq's 12k limit)

  workbook.SheetNames.forEach(sheetName => {
    if (text.length >= MAX_CHARS) return; // Stop if we've reached limit

    const worksheet = workbook.Sheets[sheetName];
    const csvData = XLSX.utils.sheet_to_csv(worksheet);
    const lines = csvData.split('\n');

    text += `Sheet: ${sheetName}\n`;

    // Include header row (first line)
    if (lines.length > 0) {
      text += lines[0] + '\n';
    }

    // Calculate how many data rows we can include
    const remainingChars = MAX_CHARS - text.length;
    const avgLineLength = csvData.length / lines.length;
    const maxRows = Math.floor(remainingChars / avgLineLength);

    // Include sample of data rows
    if (lines.length > 1) {
      // Get first rows, middle rows, and last rows for representative sample
      const sampleSize = Math.min(maxRows, lines.length - 1);
      const firstBatch = Math.floor(sampleSize / 3);
      const middleBatch = Math.floor(sampleSize / 3);
      const lastBatch = sampleSize - firstBatch - middleBatch;

      // First rows
      for (let i = 1; i <= Math.min(firstBatch, lines.length - 1); i++) {
        text += lines[i] + '\n';
      }

      // Middle rows
      if (lines.length > 100) {
        const middleStart = Math.floor(lines.length / 2) - Math.floor(middleBatch / 2);
        text += `... [${middleStart - firstBatch - 1} rows omitted] ...\n`;
        for (let i = 0; i < middleBatch && middleStart + i < lines.length; i++) {
          text += lines[middleStart + i] + '\n';
        }
      }

      // Last rows
      if (lastBatch > 0 && lines.length > firstBatch + middleBatch) {
        const lastStart = Math.max(lines.length - lastBatch, firstBatch + middleBatch + 1);
        if (lastStart > firstBatch + middleBatch) {
          text += `... [${lastStart - firstBatch - middleBatch - 1} rows omitted] ...\n`;
        }
        for (let i = lastStart; i < lines.length; i++) {
          text += lines[i] + '\n';
        }
      }

      text += `\n[Total rows in sheet: ${lines.length - 1}]\n`;
    }

    text += '\n';
  });

  // Final safety check
  if (text.length > MAX_CHARS) {
    text = text.substring(0, MAX_CHARS) + '\n\n[Data truncated to fit token limits]';
  }

  return text;
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
    console.error('File processing error:', error);
    throw new Error(error.message || 'Failed to process document');
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