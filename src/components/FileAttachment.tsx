import { X, FileText, Image as ImageIcon, Sheet, FileType } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export interface AttachedFile {
  file: File;
  preview?: string;
  type: 'image' | 'pdf' | 'docx' | 'excel' | 'other';
}

interface FileAttachmentProps {
  attachedFile: AttachedFile;
  onRemove: () => void;
}

export const FileAttachment = ({ attachedFile, onRemove }: FileAttachmentProps) => {
  const { file, preview, type } = attachedFile;

  const getIcon = () => {
    switch (type) {
      case 'image':
        return <ImageIcon className="h-4 w-4" />;
      case 'pdf':
        return <FileText className="h-4 w-4" />;
      case 'docx':
        return <FileType className="h-4 w-4" />;
      case 'excel':
        return <Sheet className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex items-start gap-2 p-2 bg-secondary/50 rounded-lg border border-border">
      {preview && type === 'image' ? (
        <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
          <img src={preview} alt={file.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-12 h-12 rounded bg-secondary">
          {getIcon()}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {type.toUpperCase()}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(file.size)}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={onRemove}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
