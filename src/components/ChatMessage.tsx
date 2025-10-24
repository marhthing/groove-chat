import { User, Bot } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === "user";
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("U");

  useEffect(() => {
    if (isUser) {
      const loadProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("profile_picture, first_name, last_name")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setProfilePicture(profile.profile_picture);
            const initials = `${profile.first_name?.charAt(0) || ""}${profile.last_name?.charAt(0) || ""}`.toUpperCase();
            setUserInitials(initials || "U");
          }
        }
      };
      loadProfile();
    }
  }, [isUser]);

  return (
    <div className={`w-full py-6 px-4 ${isUser ? "bg-background" : "bg-muted/30"}`} data-testid={`message-${role}`}>
      <div className="max-w-4xl mx-auto">
        {isUser ? (
          // User message - right aligned
          <div className="flex gap-3 md:gap-4 justify-end">
            <div className="flex flex-col items-end space-y-2">
              <p className="text-sm font-medium text-muted-foreground">You</p>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[85%] md:max-w-[600px]">
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </div>
              </div>
            </div>
            <Avatar className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10">
              <AvatarImage src={profilePicture || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
            </Avatar>
          </div>
        ) : (
          // AI message - left aligned
          <div className="flex gap-3 md:gap-4 justify-start">
            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{BRAND_NAME}</p>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm max-w-[85%] md:max-w-[600px]">
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
