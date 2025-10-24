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
    // Double requestAnimationFrame to ensure DOM has fully updated and painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    });
  }, [messages]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    });
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

      // Optimize context if conversation is getting too long (keep last 20 messages)
      const optimizedMessages = messagesForAI.length > 20 
        ? messagesForAI.slice(-20) 
        : messagesForAI;

      const response = await fetch(
        `http://localhost:3001/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            messages: optimizedMessages,
          }),
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
              {selectedModel === "image-generator" ? "Image Generator" : BRAND_NAME}
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
              {selectedModel === "image-generator" ? "Image Generator" : BRAND_NAME}
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
                    {selectedModel === "image-generator" ? "Image Generator" : BRAND_NAME}
                  </h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    {selectedModel === "image-generator"
                      ? "Describe the image you'd like to generate"
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
          placeholder={selectedModel === "image-generator" ? "Describe the image you want to generate..." : "Type your message..."}
          allowFileUpload={selectedModel !== "image-generator"}
        />
      </div>
    </div>
  );
};

export default Chat;