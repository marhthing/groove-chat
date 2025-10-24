import { Plus, MessageSquare, LogOut, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const ChatSidebar = ({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  isOpen,
  onToggle,
}: ChatSidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: "Failed to sign out",
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden bg-background/80 backdrop-blur-sm border border-border shadow-sm"
        onClick={onToggle}
        data-testid="button-menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div
        className={`fixed lg:static inset-y-0 left-0 z-40 w-72 md:w-80 lg:w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-3 md:p-4 border-b border-sidebar-border">
            <Button
              onClick={onNewChat}
              className="w-full justify-start gap-2 text-sm md:text-base"
              variant="default"
              data-testid="button-new-chat"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3 md:p-4">
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    onSelectConversation(conv.id);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className={`w-full text-left p-2.5 md:p-3 rounded-lg transition-colors flex items-start gap-2 hover:bg-sidebar-accent ${
                    currentConversationId === conv.id
                      ? "bg-sidebar-accent"
                      : ""
                  }`}
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs md:text-sm font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          <Separator />

          <div className="p-3 md:p-4">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-2 text-sm md:text-base"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={onToggle}
          data-testid="overlay-sidebar"
        />
      )}
    </>
  );
};
