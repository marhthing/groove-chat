import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    // console.log("Chat request received with messages:", messages.length);

    const AI_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!AI_API_KEY) {
      // console.error("AI service is not configured");
      throw new Error("The service is currently unavailable. Please try again later.");
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mixtral-8x7b-32768",
        messages: [
          {
            role: "system",
            content: "You are Groove AI, a friendly and energetic AI assistant with a passion for helping people. You communicate with enthusiasm and clarity, making complex topics easy to understand. You're knowledgeable, patient, and always eager to assist. You have a warm, approachable personality and enjoy building genuine connections with users. You're modern, tech-savvy, and stay current with the latest trends. Keep your responses clear, engaging, and conversational.",
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // console.error("AI gateway error:", response.status, errorText);
      
      return new Response(
        JSON.stringify({ error: "There was an error processing, please try again later" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // console.log("Streaming response from AI gateway");
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    // console.error("Chat error:", e);
    return new Response(
      JSON.stringify({ error: "There was an error processing, please try again later" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});