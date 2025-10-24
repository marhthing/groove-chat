
import { AttachedFile } from "@/components/FileAttachment";
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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
 * Extract text from PDF
 */
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  let text = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += pageText + '\n';
  }
  
  return text;
}

/**
 * Extract text from Word document
 */
async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

/**
 * Extract text from Excel
 */
async function extractExcelText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  let text = '';
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    text += `Sheet: ${sheetName}\n`;
    text += XLSX.utils.sheet_to_csv(worksheet);
    text += '\n\n';
  });
  
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

  // For documents (PDF, Excel, Word), prepend the extracted text
  const documentContext = `
I've uploaded a ${processedDoc.type.toUpperCase()} file (${processedDoc.filename}).

Document content:
${processedDoc.text}

${userMessage ? `My question: ${userMessage}` : 'Please analyze this document and provide insights.'}
  `.trim();

  return {
    content: documentContext,
    isMultimodal: false,
  };
}
