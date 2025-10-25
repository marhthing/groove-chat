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
import { processFileUpload, createFileMessageContent, ProcessedDocument, StructuredData } from "@/lib/fileUploadHelper";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
  file_name?: string;
  file_type?: string;
  metadata?: any;
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
    } else {
      setMessages([]);
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
        content: msg.content,
        file_name: msg.file_name,
        file_type: msg.file_type,
        metadata: msg.metadata,
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
    // Generate a short, meaningful title (max 30 chars)
    let title = firstMessage.trim();

    // Remove markdown, URLs, and extra whitespace
    title = title.replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
                 .replace(/\[.*?\]\(.*?\)/g, '') // Remove links
                 .replace(/https?:\/\/\S+/g, '') // Remove URLs
                 .replace(/\s+/g, ' ') // Normalize whitespace
                 .trim();

    // Create a short summary
    if (title.length > 30) {
      // Try to cut at a word boundary
      const words = title.slice(0, 30).split(' ');
      if (words.length > 1) {
        words.pop(); // Remove last potentially cut word
        title = words.join(' ') + '...';
      } else {
        title = title.slice(0, 27) + '...';
      }
    }

    // Fallback if title is empty
    if (!title || title === '...') {
      title = 'New Chat';
    }

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
            title: `Image: ${prompt.slice(0, 20)}${prompt.length > 20 ? '...' : ''}`,
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
        content: "",
        created_at: new Date().toISOString(),
        image_url: imageUrl,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Force scroll after adding image
      setTimeout(() => scrollToBottom(), 100);

      // Save assistant message with image_url to database, including metadata
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: "",
        image_url: imageUrl,
        // Add metadata here, specifically author/name
        metadata: {
          author: BRAND_NAME,
          name: BRAND_NAME
        }
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

  const handleChartGeneration = async (prompt: string, chartType: string, processedFile?: ProcessedDocument) => {
    if (!session) return;

    try {
      let conversationId = currentConversationId;
      if (!conversationId) {
        const { data, error } = await supabase
          .from("conversations")
          .insert({ 
            user_id: session.user.id, 
            title: `Chart: ${prompt.slice(0, 20)}${prompt.length > 20 ? '...' : ''}`,
            model_type: "chart-generation"
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

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: `${prompt} (${chartType} chart)`,
        created_at: new Date().toISOString(),
        file_name: processedFile?.filename,
        file_type: processedFile?.type,
      };
      setMessages((prev) => [...prev, userMessage]);

      setTimeout(() => scrollToBottom(), 50);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: `${prompt} (${chartType} chart)`,
        file_name: processedFile?.filename,
        file_type: processedFile?.type,
      });

      let chartSpec = null;
      let textContent = "Here's your chart:";
      
      // Check if we have structured data from an uploaded file
      if (processedFile?.structuredData && processedFile.structuredData.columns.length > 0) {
        const { columns, rows } = processedFile.structuredData;
        
        // Parse the prompt to extract column names using token-based matching
        // This approach avoids regex complexity and handles all special characters
        const mentionedColumns: string[] = [];
        
        // Normalize: convert to lowercase and split into tokens
        const normalizeText = (text: string) => 
          text.toLowerCase()
            .replace(/[""'']/g, '') // Remove quotes
            .split(/[\s,;:.!?()\\[\]{}]+/) // Split on whitespace and punctuation
            .filter(t => t.length > 0);
        
        const promptTokens = normalizeText(prompt);
        
        // Find all matching columns with their match positions and lengths
        const matches: Array<{ col: string; position: number; length: number }> = [];
        
        for (const col of columns) {
          if (!col) continue;
          
          const colTokens = normalizeText(col);
          if (colTokens.length === 0) continue;
          
          // For single-token columns - find ALL occurrences
          if (colTokens.length === 1) {
            for (let i = 0; i < promptTokens.length; i++) {
              if (promptTokens[i] === colTokens[0]) {
                matches.push({ col, position: i, length: 1 });
              }
            }
          } else {
            // For multi-token columns - find ALL consecutive appearances
            for (let i = 0; i <= promptTokens.length - colTokens.length; i++) {
              let match = true;
              for (let j = 0; j < colTokens.length; j++) {
                if (promptTokens[i + j] !== colTokens[j]) {
                  match = false;
                  break;
                }
              }
              if (match) {
                matches.push({ col, position: i, length: colTokens.length });
              }
            }
          }
        }
        
        // Sort matches: prefer longer matches (more specific), then by position
        matches.sort((a, b) => {
          if (b.length !== a.length) return b.length - a.length;
          return a.position - b.position;
        });
        
        // Remove overlapping matches - keep the longer/more specific ones
        const selectedMatches: typeof matches = [];
        const usedPositions = new Set<number>();
        
        for (const match of matches) {
          let overlaps = false;
          for (let i = 0; i < match.length; i++) {
            if (usedPositions.has(match.position + i)) {
              overlaps = true;
              break;
            }
          }
          
          if (!overlaps) {
            selectedMatches.push(match);
            for (let i = 0; i < match.length; i++) {
              usedPositions.add(match.position + i);
            }
          }
        }
        
        // Extract column names in the order they appeared in the prompt
        selectedMatches.sort((a, b) => a.position - b.position);
        mentionedColumns.push(...selectedMatches.map(m => m.col));
        
        // Determine which columns to use
        let xColumn = 0;
        let yColumn = 1;
        
        if (mentionedColumns.length >= 2) {
          xColumn = columns.indexOf(mentionedColumns[0]);
          yColumn = columns.indexOf(mentionedColumns[1]);
          
          // Validate we found distinct columns
          if (xColumn === yColumn) {
            toast({
              title: "Error",
              description: "Please specify two different columns to plot",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else if (mentionedColumns.length === 1) {
          // Only one column mentioned - use first column as X, mentioned as Y
          xColumn = 0;
          yColumn = columns.indexOf(mentionedColumns[0]);
          if (yColumn === 0) yColumn = 1; // Avoid same column
        }
        
        // Validate columns exist and are different
        if (xColumn === yColumn || xColumn >= columns.length || yColumn >= columns.length) {
          toast({
            title: "Error",
            description: `Could not identify columns. Available columns: ${columns.join(', ')}`,
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
        
        // Build the chart data from file
        const chartData = rows.map(row => ({
          x: row[xColumn] !== undefined ? row[xColumn] : '',
          y: typeof row[yColumn] === 'number' ? row[yColumn] : parseFloat(String(row[yColumn])) || 0
        }));
        
        chartSpec = {
          type: chartType,
          title: `${columns[yColumn]} vs ${columns[xColumn]}`,
          description: `Chart from ${processedFile.filename}`,
          xAxis: {
            label: columns[xColumn]
          },
          yAxis: {
            label: columns[yColumn]
          },
          datasets: [
            {
              label: columns[yColumn],
              data: chartData
            }
          ]
        };
        
        textContent = `Here's your chart from ${processedFile.filename} showing ${columns[yColumn]} vs ${columns[xColumn]}:`;
      } else {
        // No file data - use AI to generate sample data
        const apiKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!apiKey) {
          throw new Error("Service temporary unavailable.");
        }

        const chartPrompt = `You are a data visualization assistant. Generate a ${chartType} chart based on this request: "${prompt}"

Return ONLY a valid JSON object in this exact format (no other text):
{
  "type": "${chartType}",
  "title": "Chart title here",
  "description": "Brief description",
  "xAxis": {
    "label": "X-axis label"
  },
  "yAxis": {
    "label": "Y-axis label"
  },
  "datasets": [
    {
      "label": "Dataset name",
      "data": [
        {"x": "Category 1", "y": 10},
        {"x": "Category 2", "y": 20}
      ]
    }
  ]
}

Important:
- For ${chartType} charts, use appropriate data structure
- For scatter charts, use numeric x values
- For pie charts, use category names for x
- Include realistic sample data based on the request
- Return ONLY the JSON object, no markdown formatting or code blocks`;

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "user",
                content: chartPrompt
              }
            ],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          throw new Error("Chart generation failed");
        }

        const data = await response.json();
        const messageContent = data.choices[0]?.message?.content || "";
        
        try {
          const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            chartSpec = JSON.parse(jsonMatch[0]);
          } else {
            chartSpec = JSON.parse(messageContent);
          }
        } catch (parseError) {
          console.error("Failed to parse chart JSON:", parseError);
          toast({
            title: "Error",
            description: "Failed to generate chart data. Please try again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }
      
      const assistantMessageId = crypto.randomUUID();

      const metadata = {
        chartSpec,
        rawModelResponse: processedFile ? `Generated from file: ${processedFile.filename}` : '',
      };

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: textContent,
        created_at: new Date().toISOString(),
        metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      // Multiple scroll attempts to ensure chart is visible
      setTimeout(() => scrollToBottom(), 50);
      setTimeout(() => scrollToBottom(), 200);
      setTimeout(() => scrollToBottom(), 500);

      await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: textContent,
        metadata,
      });

      if (messages.length === 0) {
        await updateConversationTitle(conversationId, prompt);
        await loadConversations();
      }
    } catch (error: any) {
      console.error("Chart generation error:", error);
      toast({
        title: "Error",
        description: "There was an error processing, please try again later",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (content: string, file?: AttachedFile, chartType?: string) => {
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

    // Handle chart generation
    if (modelToUse === "chart-generation" && chartType) {
      // Process file if attached
      let processedFile: ProcessedDocument | undefined = undefined;
      if (file) {
        try {
          processedFile = await processFileUpload(file);
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to process uploaded file",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }
      
      await handleChartGeneration(content, chartType, processedFile);
      return;
    }

    // STEP 1: Show user message in UI immediately (instant feedback)
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content || '',
      created_at: new Date().toISOString(),
      file_name: file?.file.name,
      file_type: file?.type,
    };
    setMessages((prev) => [...prev, userMessage]);

    // STEP 2: Create conversation if needed (wait for completion)
    let conversationId = currentConversationId;
    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ 
          user_id: session.user.id, 
          model_type: selectedModel
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
      navigate(`/chat/${data.id}`, { replace: true });
    }

    // STEP 3: Process file if present (wait for completion)
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

    // STEP 4: Save user message to database (wait for completion)
    const { error: userError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: content || '',
      file_name: file?.file.name,
      file_type: file?.type,
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

    // STEP 5: Update title and reload sidebar if first message (wait for both)
    if (messages.length === 0) {
      await updateConversationTitle(conversationId, content);
      await loadConversations();
    }

    // STEP 6: NOW start AI processing (everything above is complete)

    // Call AI chat function
    try {
      // Load messages from database (these now contain user text, not document content)
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
              <div className="flex items-center justify-center h-full px-4 pb-32 md:pb-0">
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
              <div className="w-full pb-32 md:pb-0">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                    fileName={message.file_name}
                    fileType={message.file_type}
                    imageUrl={message.image_url}
                    isStreaming={message.id === streamingMessageId}
                    metadata={message.metadata}
                  />
                ))}
                {isLoading && (
                  <ChatLoadingIndicator 
                    mode={
                      selectedModel === "image-generator" ? "image" :
                      selectedModel === "chart-generation" ? "thinking" :
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

        <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto z-10">
          <ChatInput 
            onSend={sendMessage} 
            disabled={isLoading}
            selectedModel={selectedModel}
            placeholder={
              selectedModel === "image-generator" ? "Describe the image you want to generate..." :
              selectedModel === "chart-generation" ? "Upload a CSV/Excel file or describe data to visualize..." :
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
    </div>
  );
};

export default Chat;