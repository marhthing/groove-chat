# Document Upload Feature

## Overview

The Groove AI chat now supports document uploads, allowing users to attach files (images, PDFs, Word documents, and Excel spreadsheets) and ask questions about them. The AI can analyze the content and provide intelligent responses.

## Supported File Types

1. **Images** (JPG, PNG, GIF, etc.)
   - Uses Groq's vision model (Llama 4 Scout) for image analysis
   - Can describe images, extract text (OCR), answer questions about visual content

2. **PDF Documents**
   - Extracts text from all pages
   - AI can summarize, answer questions, or analyze the content

3. **Word Documents** (.docx)
   - Extracts plain text from Word files
   - AI can analyze, summarize, or answer questions about the content

4. **Excel Spreadsheets** (.xlsx, .xls)
   - Converts spreadsheet data to text format
   - AI can analyze data, identify trends, or answer questions about the data

## File Size Limits

- **Images**: Maximum **4MB** (automatically compressed if larger to meet Groq vision model limits)
  - Images exceeding 4MB or 33 megapixels are automatically resized and compressed
  - Compression maintains quality while ensuring compatibility with Groq's vision model
- **Documents** (PDF, Word, Excel): Maximum **20MB**
- Image resolution limit: **33 megapixels** (automatically handled)

## How It Works

### Backend Architecture

1. **Express Server** (`server/index.js`)
   - Runs on port 3000
   - Handles file uploads via `/api/process-document` endpoint
   - Proxied through Vite dev server on `/api` routes

2. **Document Processor** (`server/utils/documentProcessor.js`)
   - **Images**: 
     - Validates against Groq vision limits (4MB base64, 33MP)
     - Automatically compresses/resizes if needed using Sharp
     - Converts to optimized JPEG format
     - Returns base64 for Groq vision model
   - **PDF**: Uses `pdfjs-dist` to extract text from all pages
   - **Word**: Uses `mammoth` library to extract plain text
   - **Excel**: Uses SheetJS (`xlsx`) to convert sheets to CSV format

3. **Groq Client** (`server/utils/groqClient.js`)
   - Handles streaming responses from Groq API
   - Automatically selects the appropriate model based on content type

### Frontend Components

1. **FileAttachment Component** (`src/components/FileAttachment.tsx`)
   - Displays attached file with preview (for images)
   - Shows file type badge and size
   - Remove button to detach files

2. **Enhanced ChatInput** (`src/components/ChatInput.tsx`)
   - Paperclip button to attach files
   - File validation (type and size)
   - Preview attached files before sending
   - Disabled in Image Generator mode (only available in AI Assistant chat)

3. **File Upload Helper** (`src/lib/fileUploadHelper.ts`)
   - Processes file uploads via API
   - Creates enhanced message content with document context

## Model Selection

The system intelligently selects the appropriate Groq model:

- **For images**: `meta-llama/llama-4-scout-17b-16e-instruct` (Vision model)
- **For text/documents**: `mixtral-8x7b-32768` (Fast text model)
- **For synthesis**: `llama-3.3-70b-versatile` (Advanced reasoning)

## Usage Example

### For Users

1. Click the paperclip icon in the chat input
2. Select a file (image, PDF, Word, or Excel)
3. The file will appear as a preview above the input box
4. Type your question or leave blank for automatic analysis
5. Click Send
6. The AI will analyze the document and respond

### Sample Prompts

**With Image:**
- "What's in this image?"
- "Extract all text from this screenshot"
- "Describe the chart in this image"

**With PDF:**
- "Summarize this document"
- "What are the main findings?"
- "Extract the key points from page 3"

**With Excel:**
- "What trends do you see in this data?"
- "Calculate the average of column B"
- "Identify any anomalies in the spreadsheet"

**With Word:**
- "What is this document about?"
- "Extract action items from this meeting notes"
- "Rewrite this in a more formal tone"

## Technical Implementation

### Libraries Used

```json
{
  "pdfjs-dist": "^5.4.296",     // PDF text extraction
  "mammoth": "^1.11.0",         // Word document parsing
  "xlsx": "latest from CDN",     // Excel file processing
  "sharp": "^0.33.x",           // Image processing and compression
  "multer": "^2.0.2",           // File upload middleware
  "express": "^5.1.0",          // Backend server
  "cors": "^2.8.5"              // CORS support
}
```

### API Endpoints

#### POST `/api/process-document`
Processes uploaded files and extracts content.

**Request:**
- Content-Type: `multipart/form-data`
- Body: Single file with key `file`

**Response:**
```json
{
  "type": "pdf|docx|excel|image",
  "filename": "document.pdf",
  "text": "Extracted text content...",
  "size": 1024
}
```

#### POST `/api/chat`
Enhanced chat endpoint with document support.

**Request:**
```json
{
  "messages": [...],
  "hasDocument": true
}
```

**Response:** Server-Sent Events (SSE) stream

## Environment Variables

Required environment variable:
- `GROQ_API_KEY`: Your Groq API key for AI processing

## Limitations

- Only available in AI Assistant mode (not in Image Generator)
- One file per message
- Files are not stored permanently (processed on-the-fly)
- Vision model is in preview mode (may have occasional issues)

## Future Enhancements

Potential improvements:
- Multi-file upload support
- File storage and retrieval
- OCR for scanned PDFs
- More advanced Excel analysis (formulas, charts)
- Audio file transcription
- Video analysis support
