import { User, Bot } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <div className={`w-full py-6 px-4 ${isUser ? "bg-background" : "bg-muted/30"}`} data-testid={`message-${role}`}>
      <div className="max-w-4xl mx-auto">
        {isUser ? (
          // User message - right aligned
          <div className="flex gap-3 md:gap-4 justify-end">
            <div className="flex-1 max-w-[85%] md:max-w-[75%] space-y-2">
              <div className="flex justify-end">
                <p className="text-sm font-medium text-muted-foreground">You</p>
              </div>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {content}
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <User className="h-4 w-4 md:h-5 md:w-5" />
            </div>
          </div>
        ) : (
          // AI message - left aligned
          <div className="flex gap-3 md:gap-4 justify-start">
            <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <div className="flex-1 max-w-[85%] md:max-w-[75%] space-y-2">
              <p className="text-sm font-medium text-muted-foreground">AI Assistant</p>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
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
