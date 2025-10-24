import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { BRAND_NAME } from "@/lib/constants";
import { AttachedFile } from "@/components/FileAttachment";
import { processFileUpload, createFileMessageContent } from "@/lib/fileUploadHelper";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
  file_name?: string;
  file_type?: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  shareable_id?: string;
  model_type?: string; // Added to store model type
}

const Chat = () => {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session) {
      loadConversations();
    }
  }, [session]);

  useEffect(() => {
    if (conversationId) {
      setCurrentConversationId(conversationId);
    } else {
      setCurrentConversationId(null);
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  useEffect(() => {
    // Auto-scroll to bottom whenever messages change
    // Use timeout + requestAnimationFrame for more reliable scrolling
    const scrollTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      });
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [messages]);

  const scrollToBottom = () => {
    // Scroll to bottom with a slight delay to ensure DOM is fully rendered
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        });
      });
    }, 100);
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("id, title, updated_at, shareable_id, model_type") // Include model_type
      .order("updated_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } else {
      setConversations(data || []);
    }
  };

  const shareConversation = async () => {
    if (!currentConversationId) {
      toast({
        title: "Error",
        description: "No conversation to share",
        variant: "destructive",
      });
      return;
    }

    const conversation = conversations.find(c => c.id === currentConversationId);
    if (!conversation?.shareable_id) {
      toast({
        title: "Error",
        description: "Shareable link not available",
        variant: "destructive",
      });
      return;
    }

    const shareUrl = `${window.location.origin}/share/${conversation.shareable_id}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Success",
        description: "Share link copied to clipboard!",
      });
    } catch (error) {
      toast({
        title: "Share Link",
        description: shareUrl,
      });
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } else {
      setMessages((data || []).map(msg => ({
        ...msg,
        role: msg.role as "user" | "assistant",
        content: msg.image_url ? `![Generated Image](${msg.image_url})` : msg.content,
        file_name: msg.file_name,
        file_type: msg.file_type,
      })));
      
      // Scroll to bottom after loading messages
      scrollToBottom();

      // Load the model type for the selected conversation
      const conversation = conversations.find(c => c.id === conversationId);
      if (conversation && conversation.model_type) {
        setSelectedModel(conversation.model_type);
      } else {
        // Default to 'chat' if no model_type is found (for older conversations)
        setSelectedModel("chat");
      }
    }
  };

  const createNewConversation = async () => {
    // Navigate to /chat without an ID to start a new conversation
    navigate("/chat");
    setCurrentConversationId(null);
    setMessages([]);
    // Reset selected model to default when creating a new conversation
    setSelectedModel("chat");
  };

  const updateConversationTitle = async (conversationId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
    await supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);
    await loadConversations();
  };

  const deleteConversation = async (conversationId: string) => {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    } else {
      if (currentConversationId === conversationId) {
        navigate("/chat");
        setCurrentConversationId(null);
        setMessages([]);
      }
      await loadConversations();
      toast({
        title: "Success",
        description: "Conversation deleted",
      });
    }
  };

  const renameConversation = async (conversationId: string, newTitle: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ title: newTitle })
      .eq("id", conversationId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to rename conversation",
        variant: "destructive",
      });
    } else {
      await loadConversations();
      toast({
        title: "Success",
        description: "Conversation renamed",
      });
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    if (!session) return;

    try {
      // Create conversation if needed
      let conversationId = currentConversationId;
      if (!conversationId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ 
            user_id: session.user.id, 
            title: `Image: ${prompt.slice(0, 40)}...`,
            model_type: "image-generator" // Save model type for image generation
          })
          .select()
          .single();

        if (error) {
          toast({
            title: "Error",
            description: "Failed to create conversation",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        conversationId = data.id;
        setCurrentConversationId(data.id);
        navigate(`/chat/${data.id}`);
        await loadConversations();
      }

      // Add user message to UI
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: prompt,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Force scroll after adding user message
      setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        });
      }, 50);

      // Save user message to database
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: prompt,
      });

      // Build context-aware prompt by combining previous user prompts
      const previousUserPrompts = messages
        .filter(m => m.role === "user")
        .map(m => m.content)
        .join(", ");

      // Combine previous context with new prompt
      const conversationContext = previousUserPrompts 
        ? `${previousUserPrompts}, ${prompt}`
        : prompt;

      // Use Groq AI to synthesize a clear, coherent prompt for image generation
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("Service temporary unavailable.");
      }

      const synthResponse = await fetch(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: "You are an expert at converting conversational requests into clear, detailed image generation prompts. Take the user's conversation and create a single, coherent, detailed description for an image. Be specific and descriptive. Only respond with the image description, nothing else.",
              },
              {
                role: "user",
                content: `Convert this conversation into a single detailed image prompt: ${conversationContext}`,
              },
            ],
          }),
        }
      );

      if (!synthResponse.ok) {
        throw new Error("Failed to synthesize prompt");
      }

      const synthData = await synthResponse.json();
      const synthesizedPrompt = synthData.choices?.[0]?.message?.content || conversationContext;

      // Generate image using Pollinations.ai with synthesized prompt
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(synthesizedPrompt)}?width=1024&height=1024&nologo=true`;

      // Add assistant message with image to UI
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `![Generated Image](${imageUrl})`,
        created_at: new Date().toISOString(),
        image_url: imageUrl,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Force scroll after adding image
      setTimeout(() => scrollToBottom(), 100);

      // Save assistant message with image_url to database
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: "Generated image",
        image_url: imageUrl,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate image",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string, file?: AttachedFile) => {
    if (!session) return;

    setIsLoading(true);

    // Determine the model to use - check current conversation's model type first
    let modelToUse = selectedModel;
    if (currentConversationId) {
      const conversation = conversations.find(c => c.id === currentConversationId);
      if (conversation?.model_type) {
        modelToUse = conversation.model_type;
      }
    }

    // Handle image generation
    if (modelToUse === "image-generator") {
      await handleImageGeneration(content);
      return;
    }

    // Create conversation if needed FIRST
    let conversationId = currentConversationId;
    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ 
          user_id: session.user.id, 
          model_type: selectedModel // Save the selected model type
        })
        .select()
        .single();

      if (error) {
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      conversationId = data.id;
      setCurrentConversationId(data.id);
      navigate(`/chat/${data.id}`);
    }

    // Show user message IMMEDIATELY in UI (before processing)
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content || '', // Display only user's message
      created_at: new Date().toISOString(),
      file_name: file?.file.name,
      file_type: file?.type,
    };
    setMessages((prev) => [...prev, userMessage]);

    // Force scroll immediately
    setTimeout(() => scrollToBottom(), 50);

    // Process file upload in background (if present)
    let processedDocument = null;
    let actualContent = content;
    
    if (file) {
      try {
        processedDocument = await processFileUpload(file);
        const { content: enhancedContent } = createFileMessageContent(content, processedDocument);
        actualContent = enhancedContent;
      } catch (error: any) {
        toast({
          title: "File Processing Error",
          description: error.message || "Failed to process the uploaded file",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }

    // Save user message to database
    // Store ONLY the user's text, not the document content
    // The AI will get the document content from messagesForAI below
    const { error: userError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: content || '', // Store only user's text
      file_name: processedDocument?.filename,
      file_type: processedDocument?.type,
    });

    if (userError) {
      toast({
        title: "Error",
        description: "Failed to save message",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Update conversation title if this is the first message
    if (messages.length === 0) {
      await updateConversationTitle(conversationId, content);
      // Reload conversations to show the new conversation in sidebar
      await loadConversations();
    }

    // Call AI chat function
    try {
      // Load messages from database (these now only contain user text, not document content)
      const { data: dbMessages } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      
      // Prepare all messages for AI
      const messagesForAI = (dbMessages || []).map(m => ({
        role: m.role,
        content: m.content,
      }));
      
      // For the NEW message only, add enhanced content with document text
      // This ensures the AI gets the document but it's not stored in DB or shown in UI
      messagesForAI.push({
        role: "user",
        content: actualContent, // Enhanced content with document text
      });

      // Optimize context if conversation is getting too long (keep last 10 messages)
      // Reduced from 20 to 10 to ensure we stay within token limits with documents
      const optimizedMessages = messagesForAI.length > 10 
        ? messagesForAI.slice(-10) 
        : messagesForAI;

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("Service temporary unavailable.");
      }

      // Check if the last message contains an image
      const hasImage = processedDocument?.type === 'image';
      
      // Determine model and tools based on selected mode
      let modelToUse = "llama-3.3-70b-versatile";
      let tools = undefined;
      
      if (hasImage) {
        modelToUse = "meta-llama/llama-4-scout-17b-16e-instruct";
      } else if (selectedModel === "research-assistant") {
        modelToUse = "llama-3.3-70b-versatile";
        tools = [{ type: "web_search" }];
      } else if (selectedModel === "problem-solver") {
        modelToUse = "deepseek-r1-distill-llama-70b";
      } else if (selectedModel === "website-analyzer") {
        modelToUse = "llama-3.3-70b-versatile";
        tools = [{ type: "visit_website" }];
      } else if (selectedModel === "deep-research") {
        modelToUse = "llama-3.3-70b-versatile";
        tools = [
          { type: "browser_automation" },
          { type: "web_search" }
        ];
      } else if (selectedModel === "math-solver") {
        modelToUse = "llama-3.3-70b-versatile";
        tools = [{ type: "wolfram_alpha" }];
      }

      // Prepare messages for API
      let apiMessages;
      if (hasImage && processedDocument?.data) {
        // For vision model, send image in the proper format
        apiMessages = [
          {
            role: "system",
            content: "You are an exceptionally intelligent AI with vision capabilities. Analyze images in detail and provide insightful responses."
          },
          ...optimizedMessages.slice(0, -1), // All previous messages except the last one
          {
            role: "user",
            content: [
              {
                type: "text",
                text: actualContent || "What do you see in this image? Provide a detailed analysis."
              },
              {
                type: "image_url",
                image_url: {
                  url: processedDocument.data
                }
              }
            ]
          }
        ];
      } else {
        // For text model, use standard format with mode-specific system prompts
        let systemPrompt = `You are an exceptionally intelligent and insightful AI expert with world-class analytical capabilities. Your purpose is to provide the highest quality responses across all domains.

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
   - Look for counterintuitive findings (e.g., inverse correlations like "more skills = lower salary")
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

        if (selectedModel === "research-assistant") {
          systemPrompt = `You are a Research Assistant with real-time web search capabilities. Your mission is to provide accurate, current, and comprehensive information.

CAPABILITIES:
- You have access to web search to find the latest information
- You can cite sources and provide links
- You stay up-to-date with current events and trends

RESEARCH APPROACH:
1. Use web search for questions requiring current information
2. Cross-reference multiple sources for accuracy
3. Provide citations and links when available
4. Distinguish between facts and opinions
5. Acknowledge when information might be outdated or uncertain

RESPONSE FORMAT:
- Start with a direct answer
- Provide key findings with sources
- Include relevant context and background
- Use bullet points for clarity
- Add "Sources:" section with links when applicable

Remember: Your strength is finding and synthesizing current, accurate information from the web.`;
        } else if (selectedModel === "deep-research") {
          systemPrompt = `You are a Deep Research Analyst with advanced browser automation and parallel web browsing capabilities. You conduct comprehensive, multi-source investigations.

CAPABILITIES:
- Launch up to 10 parallel browsers for simultaneous research
- Deep dive into multiple websites and sources
- Cross-reference information across diverse platforms
- Synthesize complex information from varied sources
- Automated browsing for thorough exploration

RESEARCH METHODOLOGY:
1. **Parallel Investigation**: Launch multiple research threads simultaneously
2. **Deep Analysis**: Go beyond surface-level information
3. **Source Diversity**: Gather from academic, news, forums, and expert sources
4. **Cross-Validation**: Verify information across multiple sources
5. **Comprehensive Synthesis**: Combine findings into coherent insights

RESPONSE FORMAT:
- **Executive Summary**: Key findings upfront
- **Deep Dive**: Detailed analysis from multiple perspectives
- **Source Analysis**: Evaluate source credibility and relevance
- **Conflicting Information**: Highlight disagreements between sources
- **Recommendations**: Based on comprehensive evidence
- **Sources**: Organized list with annotations

USE CASES:
- Competitive analysis requiring multiple company websites
- Academic research needing diverse scholarly sources
- Market research across various platforms
- Comparative product/service analysis
- Complex topic investigation requiring depth

Remember: Your power is in comprehensive, parallel research - not just quick searches.`;
        } else if (selectedModel === "problem-solver") {
          systemPrompt = `You are a Problem Solver using advanced reasoning capabilities. You think through problems step-by-step with explicit logic.

REASONING APPROACH:
1. **Understand**: Clearly restate the problem in your own words
2. **Break Down**: Decompose complex problems into smaller parts
3. **Analyze**: Consider multiple approaches and perspectives
4. **Think Step-by-Step**: Show your reasoning process explicitly
5. **Evaluate**: Weigh pros and cons of different solutions
6. **Conclude**: Provide a clear recommendation with rationale

THINKING STYLE:
- Make your reasoning transparent
- Question assumptions
- Consider edge cases
- Think about second-order effects
- Be systematic and logical
- Show your work like a mathematician or scientist

RESPONSE FORMAT:
Use clear headers like:
- **Problem Analysis**
- **Key Considerations**
- **Step-by-Step Solution**
- **Recommendation**

Remember: Your value is in deep, logical thinking - not just quick answers.`;
        } else if (selectedModel === "website-analyzer") {
          systemPrompt = `You are a Website Analyzer with the ability to visit and extract content from any URL. You provide insightful analysis of web content.

CAPABILITIES:
- Visit any website URL provided by the user
- Extract and analyze webpage content
- Summarize articles, documentation, and web pages
- Identify key points and main themes

ANALYSIS APPROACH:
1. Visit the provided URL
2. Extract the main content
3. Identify the purpose and key messages
4. Summarize in a structured format
5. Highlight important insights or takeaways

RESPONSE FORMAT:
- **Website**: [URL]
- **Summary**: Clear overview in 2-3 sentences
- **Key Points**: Bullet list of main ideas
- **Insights**: Deeper analysis or implications
- **Audience/Purpose**: Who it's for and why

Remember: Focus on extracting value and meaning, not just repeating content.`;
        } else if (selectedModel === "math-solver") {
          systemPrompt = `You are a Math Solver with access to Wolfram Alpha's computational intelligence. You solve mathematical, scientific, and computational problems with precision.

CAPABILITIES:
- Access to Wolfram Alpha for exact computations
- Solve complex mathematical equations and formulas
- Perform scientific calculations and unit conversions
- Generate plots and visualizations
- Access to curated knowledge in math, science, engineering

PROBLEM-SOLVING APPROACH:
1. **Understand**: Clarify the mathematical problem
2. **Method**: Choose the appropriate mathematical approach
3. **Compute**: Use Wolfram Alpha for precise calculations
4. **Explain**: Show step-by-step reasoning
5. **Verify**: Check results for accuracy
6. **Visualize**: Include plots or diagrams when helpful

AREAS OF EXPERTISE:
- Algebra, Calculus, Linear Algebra
- Differential Equations
- Statistics and Probability
- Physics and Chemistry calculations
- Engineering computations
- Unit conversions and dimensional analysis
- Mathematical proofs and theorems

RESPONSE FORMAT:
- **Problem**: Restate the question clearly
- **Approach**: Explain the mathematical method
- **Solution**: Step-by-step calculation with Wolfram Alpha
- **Result**: Clear, precise answer with units
- **Verification**: Check if answer makes sense
- **Visualization**: Include graphs/plots if relevant

EXAMPLES:
- "Solve the differential equation dy/dx = x²y"
- "Calculate the trajectory of a projectile launched at 45° with initial velocity 20m/s"
- "Find the eigenvalues of matrix [[2,1],[1,2]]"
- "Convert 100 km/h to m/s"

Remember: Precision and clarity are paramount. Show your work and explain mathematical concepts clearly.`;
        }

        apiMessages = [
          {
            role: "system",
            content: systemPrompt,
          },
          ...optimizedMessages,
        ];
      }

      const requestBody: any = { 
        model: modelToUse,
        messages: apiMessages,
        stream: true,
      };
      
      if (tools) {
        requestBody.tools = tools;
      }

      const response = await fetch(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Groq API error:", response.status, errorText);
        let errorMessage = "Failed to get AI response";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.error || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let assistantMessageId = crypto.randomUUID();

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const existing = prev.find((m) => m.id === assistantMessageId);
                  if (existing) {
                    return prev.map((m) =>
                      m.id === assistantMessageId
                        ? { ...m, content: assistantContent }
                        : m
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: assistantMessageId,
                      role: "assistant" as const,
                      content: assistantContent,
                      created_at: new Date().toISOString(),
                    },
                  ];
                });
              }
            } catch (e) {
              // Ignore JSON parse errors for partial data
            }
          }
        }
      }

      // Save assistant message to database
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantContent,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  // Sidebar content can be extracted and reused for both mobile and desktop
  const sidebarContent = (
    <ChatSidebar
      conversations={conversations}
      currentConversationId={currentConversationId}
      onNewChat={createNewConversation}
      onSelectConversation={(id) => navigate(`/chat/${id}`)}
      onDeleteConversation={deleteConversation}
      onRenameConversation={renameConversation}
      isOpen={isSidebarOpen}
      onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      selectedModel={selectedModel}
      onSelectModel={(model) => {
        setSelectedModel(model);
        setMessages([]);
        navigate("/chat");
      }}
    />
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-72 border-r border-sidebar-border flex-shrink-0">
        {sidebarContent}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header - Mobile */}
        <div className="flex items-center justify-between p-3 border-b border-border md:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            data-testid="button-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-sm">
              {selectedModel === "image-generator" ? "Image Generator" :
               selectedModel === "research-assistant" ? "Research Assistant" :
               selectedModel === "problem-solver" ? "Problem Solver" :
               selectedModel === "website-analyzer" ? "Website Analyzer" :
               selectedModel === "deep-research" ? "Deep Research" :
               selectedModel === "math-solver" ? "Math Solver" :
               BRAND_NAME}
            </h2>
          </div>
          {currentConversationId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={shareConversation}
              title="Share conversation"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Header - Desktop */}
        <div className="hidden md:flex items-center justify-center p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">
              {selectedModel === "image-generator" ? "Image Generator" :
               selectedModel === "research-assistant" ? "Research Assistant" :
               selectedModel === "problem-solver" ? "Problem Solver" :
               selectedModel === "website-analyzer" ? "Website Analyzer" :
               selectedModel === "deep-research" ? "Deep Research" :
               selectedModel === "math-solver" ? "Math Solver" :
               BRAND_NAME}
            </h2>
          </div>
          {currentConversationId && messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3"
              onClick={shareConversation}
              title="Share conversation"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full px-4">
                <div className="text-center space-y-3 md:space-y-4 p-4 md:p-8 max-w-md">
                  <h2 className="text-xl md:text-2xl font-semibold">
                    {selectedModel === "image-generator" ? "Image Generator" :
                     selectedModel === "research-assistant" ? "Research Assistant" :
                     selectedModel === "problem-solver" ? "Problem Solver" :
                     selectedModel === "website-analyzer" ? "Website Analyzer" :
                     selectedModel === "deep-research" ? "Deep Research" :
                     selectedModel === "math-solver" ? "Math Solver" :
                     BRAND_NAME}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    {selectedModel === "image-generator"
                      ? "Describe the image you'd like to generate"
                      : selectedModel === "research-assistant"
                      ? "Ask me anything - I can search the web for current information"
                      : selectedModel === "problem-solver"
                      ? "Present your problem - I'll think through it step-by-step"
                      : selectedModel === "website-analyzer"
                      ? "Share a URL - I'll analyze and summarize the content"
                      : selectedModel === "deep-research"
                      ? "Ask complex questions requiring comprehensive multi-source research"
                      : selectedModel === "math-solver"
                      ? "Ask mathematical, scientific, or computational questions"
                      : "How can I help you today?"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    fileName={message.file_name}
                    fileType={message.file_type}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <ChatInput 
          onSend={sendMessage} 
          disabled={isLoading}
          placeholder={
            selectedModel === "image-generator" ? "Describe the image you want to generate..." :
            selectedModel === "research-assistant" ? "Ask a question that needs current information..." :
            selectedModel === "problem-solver" ? "Describe your problem or challenge..." :
            selectedModel === "website-analyzer" ? "Paste a URL to analyze..." :
            selectedModel === "deep-research" ? "Ask a complex research question..." :
            selectedModel === "math-solver" ? "Enter your math or science problem..." :
            "Type your message..."
          }
          allowFileUpload={selectedModel !== "image-generator"}
        />
      </div>
    </div>
  );
};

export default Chat;