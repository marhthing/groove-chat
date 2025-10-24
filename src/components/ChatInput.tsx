import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = ({ onSend, disabled, placeholder = "Type your message..." }: ChatInputProps) => {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-background p-2 md:p-3 safe-bottom">
      <div className="max-w-4xl mx-auto flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="min-h-[50px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none text-sm md:text-base"
          disabled={disabled}
          data-testid="input-message"
        />
        <Button 
          type="submit" 
          size="icon" 
          disabled={disabled || !input.trim()}
          className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] flex-shrink-0"
          data-testid="button-send"
        >
          <Send className="h-4 w-4 md:h-5 md:w-5" />
        </Button>
      </div>
    </form>
  );
};
