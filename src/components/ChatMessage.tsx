import { User } from "lucide-react";
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
    <div className={`w-full py-4 ${isUser ? "bg-background" : "bg-muted/30"}`} data-testid={`message-${role}`}>
      <div className="max-w-4xl mx-auto px-4">
        {isUser ? (
          // User message - right aligned
          <div className="flex gap-2 md:gap-3 justify-end">
            <div className="flex flex-col items-end space-y-1">
              <p className="text-xs font-medium text-muted-foreground">You</p>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm max-w-[80%] md:max-w-[500px]">
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </div>
              </div>
            </div>
            <Avatar className="flex-shrink-0 w-8 h-8">
              <AvatarImage src={profilePicture || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{userInitials}</AvatarFallback>
            </Avatar>
          </div>
        ) : (
          // AI message - left aligned
          <div className="flex gap-2 md:gap-3 justify-start">
            <Avatar className="flex-shrink-0 w-8 h-8">
              <AvatarImage src="/ai.jpg" alt={BRAND_NAME} />
              <AvatarFallback className="bg-accent text-accent-foreground text-xs">AI</AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1 min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{BRAND_NAME}</p>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[80%] md:max-w-[500px]">
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
