import { useState } from "react";
import { Plus, MessageSquare, LogOut, Menu, MoreVertical, Trash2, Edit2 } from "lucide-react";
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
import { Sheet, SheetTrigger, SheetContent } from "./ui/sheet";

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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-lg font-semibold mb-3">{BRAND_NAME}</h1>
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 text-sm"
          variant="default"
          data-testid="button-new-chat"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative rounded-lg transition-colors ${
                currentConversationId === conv.id ? "bg-sidebar-accent" : ""
              }`}
            >
              <button
                onClick={() => {
                  onSelectConversation(conv.id);
                  if (window.innerWidth < 768) onToggle();
                }}
                className="w-full text-left py-2 pl-3 pr-8 rounded-lg transition-colors flex items-start gap-2 hover:bg-sidebar-accent"
                data-testid={`button-conversation-${conv.id}`}
              >
                <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{conv.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </button>

              <div className="absolute right-0.5 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-options-${conv.id}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
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
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <Button
          onClick={handleLogout}
          variant="ghost"
          className="w-full justify-start gap-2 text-sm"
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sheet */}
      <Sheet open={isOpen} onOpenChange={onToggle}>
        <SheetContent side="left" className="p-0">
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-56 lg:w-64 border-r border-sidebar-border bg-sidebar flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Dialogs */}
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