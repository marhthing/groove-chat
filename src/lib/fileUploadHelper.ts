import { AttachedFile } from "@/components/FileAttachment";

export interface ProcessedDocument {
  type: 'image' | 'pdf' | 'docx' | 'excel';
  filename: string;
  data?: string; // base64 for images
  text?: string; // extracted text for documents
  mimeType?: string;
}

/**
 * Process and upload a file to the backend
 */
export async function processFileUpload(
  file: AttachedFile
): Promise<ProcessedDocument> {
  const formData = new FormData();
  formData.append('file', file.file);

  const response = await fetch('/api/process-document', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process document');
  }

  return await response.json();
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
