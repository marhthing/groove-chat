
import { useState } from "react";
import { Plus, MessageSquare, LogOut, MoreVertical, Trash2, Edit2, Settings, ImageIcon, Sparkles, Search, Brain, Globe } from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { BRAND_NAME } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sheet, SheetContent } from "./ui/sheet";

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
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  selectedModel?: string;
  onSelectModel?: (model: string) => void;
}

export const ChatSidebar = ({
  conversations,
  currentConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  isOpen,
  onToggle,
  selectedModel = "chat",
  onSelectModel = () => {},
}: ChatSidebarProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [newTitle, setNewTitle] = useState("");

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

  const handleDeleteClick = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConv(conv);
    setDeleteDialogOpen(true);
  };

  const handleRenameClick = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedConv(conv);
    setNewTitle(conv.title);
    setRenameDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedConv) {
      onDeleteConversation(selectedConv.id);
      setDeleteDialogOpen(false);
      setSelectedConv(null);
    }
  };

  const confirmRename = () => {
    if (selectedConv && newTitle.trim()) {
      onRenameConversation(selectedConv.id, newTitle.trim());
      setRenameDialogOpen(false);
      setSelectedConv(null);
      setNewTitle("");
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="p-4">
        <h1 className="text-xl font-semibold mb-4">{BRAND_NAME}</h1>
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="default"
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 px-3">
        {/* GPTs Section */}
        <div className="py-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3">
            AI Models
          </h2>
          <div className="space-y-1">
            <button
              onClick={() => {
                onSelectModel("chat");
                if (window.innerWidth < 768) onToggle();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedModel === "chat" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Sparkles className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-medium">Chat Assistant</span>
            </button>
            <button
              onClick={() => {
                onSelectModel("image-generator");
                if (window.innerWidth < 768) onToggle();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedModel === "image-generator" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <ImageIcon className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <span className="text-sm font-medium">Image Generator</span>
            </button>
            <button
              onClick={() => {
                onSelectModel("research-assistant");
                if (window.innerWidth < 768) onToggle();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedModel === "research-assistant" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Search className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-sm font-medium">Research Assistant</span>
            </button>
            <button
              onClick={() => {
                onSelectModel("problem-solver");
                if (window.innerWidth < 768) onToggle();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedModel === "problem-solver" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Brain className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="text-sm font-medium">Problem Solver</span>
            </button>
            <button
              onClick={() => {
                onSelectModel("website-analyzer");
                if (window.innerWidth < 768) onToggle();
              }}
              className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors ${
                selectedModel === "website-analyzer" ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
              }`}
            >
              <Globe className="h-4 w-4 text-cyan-500 flex-shrink-0" />
              <span className="text-sm font-medium">Website Analyzer</span>
            </button>
          </div>
        </div>

        <Separator className="my-2" />

        {/* Chats Section */}
        <div className="py-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3">
            Chats
          </h2>
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group relative rounded-lg transition-colors ${
                  currentConversationId === conv.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
                }`}
              >
                <div className="flex items-center gap-2 pr-2">
                  <button
                    onClick={() => {
                      onSelectConversation(conv.id);
                      if (window.innerWidth < 768) onToggle();
                    }}
                    className="flex-1 text-left p-3 rounded-lg flex items-start gap-3 min-w-0"
                    data-testid={`button-conversation-${conv.id}`}
                  >
                    <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-options-${conv.id}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => handleRenameClick(conv, e)}
                        data-testid={`button-rename-${conv.id}`}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleDeleteClick(conv, e)}
                        className="text-destructive focus:text-destructive"
                        data-testid={`button-delete-${conv.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      <Separator />

      {/* Footer with Settings and Sign Out */}
      <div className="p-4 border-t space-y-2">
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          onClick={() => navigate("/settings")}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
        <Button 
          variant="ghost" 
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sheet */}
      <Sheet open={isOpen} onOpenChange={onToggle}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar - rendered in Chat.tsx */}
      {sidebarContent}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the conversation
              "{selectedConv?.title}" and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename conversation</DialogTitle>
            <DialogDescription>
              Enter a new title for this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter conversation title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    confirmRename();
                  }
                }}
                data-testid="input-rename-title"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename} disabled={!newTitle.trim()} data-testid="button-confirm-rename">
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
