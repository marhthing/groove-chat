import React, { useState, useEffect } from "react";
import { User, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import "katex/dist/katex.min.css";

// Configure marked with KaTeX extension and GFM (tables, strikethrough, etc.)
const katexOptions = {
  throwOnError: false,
  output: 'html'
};

marked.use(markedKatex(katexOptions));

marked.setOptions({
  gfm: true,
  breaks: true,
});

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
  fileName?: string;
  fileType?: string;
}

export const ChatMessage = ({ role, content, fileName, fileType }: ChatMessageProps) => {
  const isUser = role === "user";
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [userInitials, setUserInitials] = useState("U");

  const getFileIcon = () => {
    switch (fileType) {
      case 'image':
        return <ImageIcon className="h-3 w-3" />;
      case 'pdf':
        return <FileText className="h-3 w-3" />;
      case 'excel':
      case 'csv':
        return <FileSpreadsheet className="h-3 w-3" />;
      case 'docx':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

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

  const convertMathDelimiters = (text: string) => {
    // First, convert \[ \] to $$ $$ for display math
    text = text.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, math) => {
      return `$$${math}$$`;
    });
    
    // Convert \( \) to $ $ for inline math
    text = text.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, math) => {
      return `$${math}$`;
    });
    
    // Also handle standalone [math] on its own line (for backwards compatibility)
    text = text.replace(/(?:^|\n)\[\s*([\s\S]*?)\s*\](?:\n|$)/g, (match, math) => {
      const hasLatexCommands = math.match(/\\[a-zA-Z]{2,}/);
      const hasMathSymbols = math.match(/[+\-*/=<>^_×÷±∓√∫∑∏∂∆∇∞≈≠≤≥]|\\[a-zA-Z]|\(\s*[a-zA-Z0-9]|[a-zA-Z0-9]\s*\)/);
      
      if (hasLatexCommands || hasMathSymbols) {
        const prefix = match.startsWith('\n') ? '\n' : '';
        const suffix = match.endsWith('\n') ? '\n' : '';
        return `${prefix}$$${math.trim()}$$${suffix}`;
      }
      return match;
    });
    
    return text;
  };

  const renderContent = (text: string) => {
    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/;
    const match = text.match(imageRegex);
    
    if (match) {
      const imageUrl = match[2];
      return (
        <img 
          src={imageUrl} 
          alt="Generated" 
          className="rounded-lg max-w-full h-auto"
          style={{ maxHeight: '512px' }}
        />
      );
    }
    
    // Parse markdown for assistant messages
    if (!isUser) {
      // Convert math delimiters before parsing
      const processedText = convertMathDelimiters(text);
      const htmlContent = marked.parse(processedText, { async: false }) as string;
      return (
        <div 
          className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:mb-4 prose-headings:mb-3 prose-headings:mt-6 prose-ul:my-4 prose-ol:my-4 prose-li:my-1 [&_.katex]:text-inherit [&_.katex]:overflow-x-auto [&_.katex]:overflow-y-hidden [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display>.katex]:whitespace-normal prose-table:border-collapse prose-table:w-full prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-700 prose-th:px-4 prose-th:py-2 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:px-4 prose-td:py-2"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      );
    }
    
    return (
      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
        {text}
      </div>
    );
  };

  return (
    <div className={`w-full py-2 ${isUser ? "bg-background" : "bg-muted/30"}`} data-testid={`message-${role}`}>
      <div className="max-w-4xl mx-auto px-3">
        {isUser ? (
          // User message - right aligned
          <div className="flex gap-2 md:gap-3 justify-end">
            <div className="flex flex-col items-end space-y-1">
              <p className="text-xs font-medium text-muted-foreground">You</p>
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3 py-2 shadow-sm max-w-[80%] md:max-w-[500px]">
                {fileName && (
                  <Badge variant="secondary" className="mb-2 gap-1">
                    {getFileIcon()}
                    <span className="text-xs">{fileName}</span>
                  </Badge>
                )}
                {renderContent(content)}
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
                {renderContent(content)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
