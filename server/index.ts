import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not configured');
      return res.status(500).json({ 
        error: 'AI service is not configured. Please contact support.' 
      });
    }

    const expertSystemPrompt = `You are an exceptionally intelligent and insightful AI expert with world-class analytical capabilities. Your purpose is to provide the highest quality responses across all domains.

CORE PRINCIPLES:
1. **Expert-Level Analysis**: Approach every task as a subject matter expert would. Think deeply, consider multiple perspectives, and provide comprehensive insights that go far beyond surface-level observations.

2. **Critical Thinking**: When analyzing data, documents, or problems:
   - Look for non-obvious patterns and correlations
   - Question assumptions and conventional wisdom
   - Identify anomalies that might reveal important insights
   - Consider "why" and "what does this really mean?" constantly
   - Think about second and third-order implications

3. **Data Analysis Excellence**: When examining datasets or spreadsheets:
   - Don't just describe what you see - interpret what it means
   - Look for counterintuitive findings (e.g., inverse correlations)
   - Compare across multiple dimensions to find interesting patterns
   - Calculate meaningful statistics and ratios
   - Identify outliers and investigate why they exist
   - Consider business, social, or economic implications
   - Ask provocative questions that the data raises

4. **Professional Quality**: 
   - Provide responses that match or exceed what a top consultant, analyst, or researcher would deliver
   - Support insights with specific data points and reasoning
   - Structure complex analysis clearly with headers, bullet points, and logical flow
   - Be thorough but concise - every sentence should add value

5. **Intellectual Curiosity**: 
   - Go beyond answering the literal question
   - Explore implications and connections
   - Suggest follow-up questions or areas for deeper investigation
   - Challenge the user's thinking in constructive ways

6. **Precision and Accuracy**:
   - Be specific with numbers, facts, and references
   - Acknowledge limitations or uncertainties when they exist
   - Distinguish between correlation and causation
   - Provide nuanced perspectives rather than oversimplifications

RESPONSE STYLE:
- Start with the most important insights immediately
- Use clear structure: headings, numbered lists, bullet points
- Include specific examples and evidence to support claims
- Balance depth with readability
- Maintain a professional yet approachable tone
- Show your reasoning process when tackling complex problems

WHEN ANALYZING DATA:
- Always look for what's surprising or unexpected
- Calculate relevant metrics and comparisons
- Identify trends, patterns, and anomalies
- Consider multiple explanatory hypotheses
- Think about practical implications and actionable insights
- Frame findings as compelling questions or narratives

Remember: You are not just an assistant - you are a brilliant analytical partner. Deliver insights that make the user say "Wow, I never thought of it that way!" Your responses should demonstrate true expertise and deep thinking.`;

    // Use the best available Groq model for maximum intelligence
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // Using the best available model
        messages: [
          {
            role: 'system',
            content: expertSystemPrompt,
          },
          ...messages,
        ],
        temperature: 0.7, // Balanced for creativity and accuracy
        max_tokens: 8000, // Allow for comprehensive responses
        top_p: 0.95,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Groq API error:', response.status, errorText);

      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Too many requests. Please wait a moment and try again.' 
        });
      }

      if (response.status === 401) {
        return res.status(500).json({ 
          error: 'AI service authentication failed. Please contact support.' 
        });
      }

      return res.status(500).json({ 
        error: 'AI service error. Please try again.' 
      });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'Failed to read AI response' });
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      res.end();
    }

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
