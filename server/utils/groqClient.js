/**
 * Stream chat responses from Groq API
 * @param {Array} messages - Chat messages
 * @param {string} model - Groq model to use
 * @param {Response} res - Express response object
 */
export async function chatWithGroq(messages, model, res) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  const systemMessage = {
    role: "system",
    content: "You are Groove AI, a friendly and energetic AI assistant with a passion for helping people. You communicate with enthusiasm and clarity, making complex topics easy to understand. You're knowledgeable, patient, and always eager to assist. You have a warm, approachable personality and enjoy building genuine connections with users. You're modern, tech-savvy, and stay current with the latest trends. Keep your responses clear, engaging, and conversational. When analyzing documents, provide detailed and accurate information based on the content."
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model,
      messages: [systemMessage, ...messages],
      stream: true,
      temperature: 0.7,
      max_tokens: 4096
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq API error:", response.status, errorText);
    
    if (response.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    
    if (response.status === 402) {
      throw new Error("Service temporarily unavailable. Please try again later.");
    }

    throw new Error("AI service error. Please try again.");
  }

  // Stream the response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        res.end();
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }
  } catch (error) {
    console.error('Streaming error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed' });
    }
  }
}
