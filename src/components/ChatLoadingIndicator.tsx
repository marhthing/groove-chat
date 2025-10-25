import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BRAND_NAME } from "@/lib/constants";

interface ChatLoadingIndicatorProps {
  mode?: "chat" | "image" | "research" | "thinking";
}

export const ChatLoadingIndicator = ({ mode = "chat" }: ChatLoadingIndicatorProps) => {
  const getMessage = () => {
    switch (mode) {
      case "image":
        return "Generating image...";
      case "research":
        return "Researching...";
      case "thinking":
        return "Thinking...";
      default:
        return "";
    }
  };

  const message = getMessage();

  return (
    <div className="w-full py-2 bg-muted/30" data-testid="loading-indicator">
      <div className="max-w-4xl mx-auto px-3">
        <div className="flex gap-2 md:gap-3 justify-start">
          <Avatar className="flex-shrink-0 w-8 h-8">
            <AvatarImage src="/ai.jpg" alt={BRAND_NAME} />
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">AI</AvatarFallback>
          </Avatar>
          <div className="flex flex-col space-y-1 min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">{BRAND_NAME}</p>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-3 py-2 shadow-sm max-w-[80%] md:max-w-[500px]">
              <div className="flex items-center gap-2">
                {message && <span className="text-sm text-muted-foreground">{message}</span>}
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
