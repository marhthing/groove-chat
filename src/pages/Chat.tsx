import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { BRAND_NAME } from "@/lib/constants";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const Chat = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
    if (currentConversationId) {
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
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
        role: msg.role as "user" | "assistant"
      })));
    }
  };

  const createNewConversation = async () => {
    // Just clear the current conversation and messages
    // Don't create in database until user sends first message
    setCurrentConversationId(null);
    setMessages([]);
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

  const sendMessage = async (content: string) => {
    if (!session) return;

    setIsLoading(true);

    // Create conversation if needed
    let conversationId = currentConversationId;
    if (!conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: session.user.id })
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
    }

    // Add user message to UI
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database
    const { error: userError } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      role: "user",
      content,
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
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      if (!apiKey) {
        throw new Error("GROQ API key is not configured. Please add VITE_GROQ_API_KEY to your secrets.");
      }

      const response = await fetch(
        `https://api.groq.com/openai/v1/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ 
            model: "mixtral-8x7b-32768",
            messages: [
              {
                role: "system",
                content: "You are a helpful AI assistant. Keep your answers clear, concise, and friendly.",
              },
              ...allMessages,
            ],
            stream: true,
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
      onSelectConversation={setCurrentConversationId}
      onDeleteConversation={deleteConversation}
      onRenameConversation={renameConversation}
      isOpen={isSidebarOpen}
      onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
    />
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-72 border-r border-sidebar-border flex-shrink-0">
        {sidebarContent}
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile menu button - absolute positioned */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden absolute top-3 left-3 z-10"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          data-testid="button-menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full px-4">
                <div className="text-center space-y-3 md:space-y-4 p-4 md:p-8 max-w-md">
                  <h2 className="text-xl md:text-2xl font-semibold">{BRAND_NAME}</h2>
                  <p className="text-sm md:text-base text-muted-foreground">
                    How can I help you today?
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
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
};

export default Chat;