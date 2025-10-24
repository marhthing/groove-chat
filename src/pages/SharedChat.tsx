import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessage } from "@/components/ChatMessage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BRAND_NAME } from "@/lib/constants";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  image_url?: string;
}

interface Conversation {
  title: string;
}

const SharedChat = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSharedConversation();
  }, [shareId]);

  const loadSharedConversation = async () => {
    if (!shareId) return;

    try {
      // Load conversation by shareable_id
      const { data: convData, error: convError } = await supabase
        .from("conversations")
        .select("id, title")
        .eq("shareable_id", shareId)
        .single();

      if (convError || !convData) {
        toast({
          title: "Error",
          description: "Shared conversation not found",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setConversation(convData);

      // Load messages
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, created_at, image_url")
        .eq("conversation_id", convData.id)
        .order("created_at", { ascending: true });

      if (messagesError) {
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        });
      } else {
        setMessages((messagesData || []).map(msg => ({
          id: msg.id,
          role: msg.role as "user" | "assistant",
          content: msg.image_url ? `![Generated Image](${msg.image_url})` : msg.content,
          created_at: msg.created_at,
          image_url: msg.image_url || undefined,
        })));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load shared conversation",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <p className="text-xl font-semibold">Conversation not found</p>
          <Button onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{conversation.title}</h1>
            <p className="text-sm text-muted-foreground">Shared conversation from {BRAND_NAME}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="w-full">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-4 text-center">
        <p className="text-sm text-muted-foreground mb-2">
          This is a shared conversation. Sign in to start your own chat.
        </p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    </div>
  );
};

export default SharedChat;
