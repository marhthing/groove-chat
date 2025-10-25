import { useState, useRef } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { FileAttachment, AttachedFile } from "./FileAttachment";
import { VoiceRecorder } from "./VoiceRecorder";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSend: (message: string, file?: AttachedFile) => void;
  disabled?: boolean;
  placeholder?: string;
  allowFileUpload?: boolean;
}

export const ChatInput = ({ 
  onSend, 
  disabled, 
  placeholder = "Type your message...",
  allowFileUpload = true
}: ChatInputProps) => {
  const [input, setInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileType = (file: File): AttachedFile['type'] => {
    const mimeType = file.type;
    const fileName = file.name.toLowerCase();
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';
    if (mimeType === 'text/csv' || fileName.endsWith('.csv')) return 'csv';
    return 'other';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileType = getFileType(file);

    // Validate file type
    const allowedTypes = ['image', 'pdf', 'docx', 'excel', 'csv'];
    if (!allowedTypes.includes(fileType)) {
      toast({
        title: "Unsupported file type",
        description: "Supported: Images, PDF, Word, Excel, CSV",
        variant: "destructive",
      });
      return;
    }

    // Different size limits for different file types
    if (fileType === 'image') {
      // Groq vision model limit is 4MB for base64 encoded images
      if (file.size > 4 * 1024 * 1024) {
        toast({
          title: "Image too large",
          description: "Maximum image size is 4MB (Groq vision model limit)",
          variant: "destructive",
        });
        return;
      }
    } else {
      // Other document types can be up to 20MB
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 20MB",
          variant: "destructive",
        });
        return;
      }
    }

    // Create preview for images
    if (fileType === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFile({
          file,
          preview: reader.result as string,
          type: fileType,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setAttachedFile({
        file,
        type: fileType,
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachedFile) && !disabled) {
      onSend(input.trim(), attachedFile || undefined);
      setInput("");
      setAttachedFile(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceTranscription = (transcribedText: string) => {
    setInput(transcribedText);
  };

  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-background p-2 md:p-3 safe-bottom">
      <div className="max-w-4xl mx-auto space-y-2">
        {attachedFile && (
          <FileAttachment
            attachedFile={attachedFile}
            onRemove={() => setAttachedFile(null)}
          />
        )}
        
        <div className="flex gap-2">
          {allowFileUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.docx,.xlsx,.xls"
                onChange={handleFileSelect}
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || !!attachedFile}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </>
          )}
          
          <VoiceRecorder
            onTranscriptionComplete={handleVoiceTranscription}
            disabled={disabled}
            onRecordingStateChange={handleRecordingStateChange}
          />
          
          {!isRecording && (
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="min-h-[50px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none text-sm md:text-base"
              disabled={disabled}
              data-testid="input-message"
            />
          )}
          <Button 
            type="submit" 
            size="icon" 
            disabled={disabled || (!input.trim() && !attachedFile)}
            className="h-[50px] w-[50px] md:h-[60px] md:w-[60px] flex-shrink-0"
            data-testid="button-send"
          >
            <Send className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
        </div>
      </div>
    </form>
  );
};
