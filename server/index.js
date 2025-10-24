import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { processDocument } from './utils/documentProcessor.js';
import { chatWithGroq } from './utils/groqClient.js';

const app = express();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Chat endpoint with optional document support
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, hasDocument } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ 
        error: 'AI service is not configured. Please add GROQ_API_KEY.' 
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const model = hasDocument 
      ? 'meta-llama/llama-4-scout-17b-16e-instruct'  // Vision model for documents with images
      : 'mixtral-8x7b-32768';  // Text model for regular chat

    await chatWithGroq(messages, model, res);

  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message || 'An error occurred' 
      });
    }
  }
});

// Document processing endpoint
app.post('/api/process-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await processDocument(req.file);
    res.json(result);

  } catch (error) {
    console.error('Document processing error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to process document' 
    });
  }
});

const PORT = process.env.SERVER_PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
