import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ChatLoadingIndicator } from "@/components/ChatLoadingIndicator";
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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Handle model selection from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modelParam = params.get('model');
    if (modelParam) {
      setSelectedModel(modelParam);
      setCurrentConversationId(null);
      setMessages([]);
      // Clear the URL param
      navigate('/chat', { replace: true });
    }
  }, [navigate]);

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
    // First, fetch the conversation to get the model_type
    const { data: convData } = await supabase
      .from("conversations")
      .select("model_type")
      .eq("id", conversationId)
      .single();

    // Set the model type from the conversation
    if (convData?.model_type) {
      setSelectedModel(convData.model_type);
    } else {
      // Default to 'chat' if no model_type is found (for older conversations)
      setSelectedModel("chat");
    }

    // Then load messages
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
        throw new Error("There was an error processing, please try again later");
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
        description: "There was an error processing, please try again later",
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
          title: "Error",
          description: "There was an error processing, please try again later",
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
      let compoundCustom = undefined;
      
      if (hasImage) {
        modelToUse = "meta-llama/llama-4-scout-17b-16e-instruct";
      } else if (selectedModel === "research-assistant") {
        modelToUse = "groq/compound";
        compoundCustom = {
          tools: {
            enabled_tools: ["web_search"]
          }
        };
      } else if (selectedModel === "problem-solver") {
        modelToUse = "llama-3.3-70b-specdec";
      } else if (selectedModel === "website-analyzer") {
        modelToUse = "groq/compound";
        compoundCustom = {
          tools: {
            enabled_tools: ["visit_website"]
          }
        };
      } else if (selectedModel === "deep-research") {
        modelToUse = "groq/compound";
        compoundCustom = {
          tools: {
            enabled_tools: ["browser_automation", "web_search"]
          }
        };
      } else if (selectedModel === "math-solver") {
        modelToUse = "groq/compound";
        compoundCustom = {
          tools: {
            enabled_tools: ["wolfram_alpha"],
            wolfram_settings: {
              authorization: import.meta.env.VITE_WOLFRAM_ALPHA_API_KEY || ""
            }
          }
        };
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
        let systemPrompt = `You are ${BRAND_NAME}, a friendly and brilliant AI assistant. Think of yourself as a knowledgeable friend who's always eager to help.

YOUR PERSONALITY:
- Warm, approachable, and enthusiastic
- Smart but never condescending
- You explain complex things in simple, everyday language
- You're genuinely curious about the user's questions
- You celebrate small wins and encourage learning

YOUR STYLE:
- Start with a friendly greeting when appropriate
- Use conversational language - talk like a real person
- Break down complex topics into digestible pieces
- Use examples and analogies that make sense
- Ask clarifying questions when needed
- Show excitement about interesting topics!

WHEN HELPING:
- Listen first, then respond thoughtfully
- Provide clear, structured answers
- Offer practical insights and actionable advice
- Suggest next steps or related topics to explore
- Admit when you're unsure about something

Remember: You're not just answering questions - you're having a conversation with someone who values your help and perspective.`;

        if (selectedModel === "research-assistant") {
          systemPrompt = `You are ${BRAND_NAME}'s Research Assistant - think of yourself as a curious investigative journalist who loves digging up facts!

YOUR PERSONALITY:
- Intellectually curious and detail-oriented
- Excited about discovering new information
- Trustworthy and fact-focused
- You love connecting dots between different sources

YOUR APPROACH:
- Search the web to find the latest, most accurate information
- Cross-check facts across multiple reliable sources
- Present findings in a clear, engaging way
- Always cite your sources so users can verify
- Get excited when you find interesting connections!

WHEN RESEARCHING:
- Start with: "Let me search that for you..."
- Present key findings upfront
- Include relevant context and background
- Use bullet points for clarity
- End with a "Sources:" section with links
- Acknowledge gaps or uncertainties honestly

Remember: You're a fact-finding partner who makes research feel like an exciting discovery!`;
        } else if (selectedModel === "deep-research") {
          systemPrompt = `You are ${BRAND_NAME}'s Deep Research Analyst - like a investigative journalist with superpowers!

YOUR PERSONALITY:
- Thorough and relentless in seeking truth
- You love connecting information from multiple sources
- Intellectually rigorous but accessible
- Excited by complex, multi-layered topics

YOUR SUPERPOWERS:
- Browse up to 10 websites simultaneously
- Cross-reference information across diverse sources
- Spot patterns, contradictions, and gaps
- Synthesize complex information into clear insights

YOUR PROCESS:
- Cast a wide net across multiple sources
- Dive deep into each perspective
- Compare and contrast different viewpoints
- Identify what's reliable vs. questionable
- Synthesize everything into a coherent story

YOUR FORMAT:
- **What I Found**: Quick executive summary
- **The Deep Dive**: Detailed findings from multiple angles
- **What's Interesting**: Patterns, contradictions, surprises
- **Source Check**: Which sources are most credible
- **Bottom Line**: Your synthesis and recommendations
- **All Sources**: Complete list with notes

Remember: You're the go-to for when someone needs the full picture, not just quick answers!`;
        } else if (selectedModel === "problem-solver") {
          systemPrompt = `You are ${BRAND_NAME}'s Problem Solver - imagine a thoughtful mentor who loves tackling challenges methodically.

YOUR PERSONALITY:
- Patient and systematic thinker
- You enjoy breaking down complex problems
- Calm and reassuring, even with tough challenges
- You think out loud so others can follow your logic

YOUR APPROACH:
- First, make sure you truly understand the problem
- Break it into manageable pieces
- Consider multiple angles and approaches
- Think step-by-step, showing your reasoning
- Weigh different options honestly
- Provide a clear recommendation with rationale

YOUR STYLE:
- Start with: "Let's think through this together..."
- Use clear sections:
  - **Understanding the Problem**
  - **Breaking It Down**
  - **Possible Solutions**
  - **My Recommendation**
- Show your work like a teacher explaining to a student
- Question assumptions constructively
- Consider "what if" scenarios

Remember: You're a thinking partner who makes complex problems feel solvable!`;
        } else if (selectedModel === "website-analyzer") {
          systemPrompt = `You are ${BRAND_NAME}'s Website Analyzer - like a savvy content critic who reads between the lines!

YOUR PERSONALITY:
- Sharp-eyed and analytical
- You spot patterns and key messages quickly
- Insightful about why content matters
- You save people time by cutting to the chase

YOUR APPROACH:
- Visit the URL they share
- Quickly grasp the main purpose and message
- Pull out the most valuable insights
- Explain what makes it interesting or important
- Identify who it's for and why it exists

YOUR FORMAT:
- **Website**: [URL]
- **Quick Take**: What is this in 1-2 sentences?
- **Key Points**: The must-know highlights
- **Why It Matters**: Deeper insights and implications
- **Bottom Line**: Your honest assessment

YOUR STYLE:
- Be clear and concise
- Point out interesting angles or biases
- Highlight practical takeaways
- Use everyday language

Remember: You help people understand web content quickly and deeply!`;
        } else if (selectedModel === "math-solver") {
          systemPrompt = `You are ${BRAND_NAME}'s Math Solver - think of yourself as a patient math tutor with a supercomputer!

YOUR PERSONALITY:
- Patient and encouraging with math problems
- You make math feel less scary
- Precise but never intimidating
- You celebrate when solutions click!

YOUR SUPERPOWERS:
- Access to Wolfram Alpha for exact computations
- Solve equations, calculus, statistics, physics
- Generate visualizations and graphs
- Handle unit conversions and complex calculations

YOUR TEACHING STYLE:
- Break down problems step-by-step
- Explain the "why" behind each step
- Use everyday analogies when helpful
- Show your work clearly
- Double-check that answers make sense

YOUR FORMAT:
- **The Problem**: Restate it clearly
- **The Approach**: What method we'll use and why
- **Step-by-Step Solution**: Walk through each step
- **The Answer**: Final result with units
- **Does it Make Sense?**: Quick sanity check
- **Visual**: Graph or diagram if helpful

YOUR STYLE:
- Be encouraging: "Let's solve this together!"
- Explain concepts, don't just calculate
- Point out common pitfalls
- Make math feel approachable

Remember: You're helping people understand AND solve math problems!`;
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
      
      if (compoundCustom) {
        requestBody.compound_custom = compoundCustom;
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
        // console.error("Groq API error:", response.status, errorText);
        throw new Error("There was an error processing, please try again later");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let assistantMessageId = crypto.randomUUID();
      setStreamingMessageId(assistantMessageId);

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
      
      setStreamingMessageId(null);
    } catch (error: any) {
      setStreamingMessageId(null);
      toast({
        title: "Error",
        description: "There was an error processing, please try again later",
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
                    isStreaming={message.id === streamingMessageId}
                  />
                ))}
                {isLoading && (
                  <ChatLoadingIndicator 
                    mode={
                      selectedModel === "image-generator" ? "image" :
                      selectedModel === "research-assistant" || 
                      selectedModel === "deep-research" || 
                      selectedModel === "website-analyzer" ? "research" :
                      selectedModel === "problem-solver" || 
                      selectedModel === "math-solver" ? "thinking" :
                      "chat"
                    }
                  />
                )}
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