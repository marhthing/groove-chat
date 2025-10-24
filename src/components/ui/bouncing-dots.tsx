
import { cn } from "@/lib/utils";

interface BouncingDotsProps {
  className?: string;
}

export const BouncingDots = ({ className }: BouncingDotsProps) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
      <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
    </div>
  );
};
