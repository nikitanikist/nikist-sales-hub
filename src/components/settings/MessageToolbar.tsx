import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Paperclip, Smile, Bold, Italic, Braces, BarChart3 } from 'lucide-react';
import { TEMPLATE_VARIABLES } from '@/hooks/useMessageTemplates';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface MessageToolbarProps {
  onAttachClick: () => void;
  onInsertText: (before: string, after?: string) => void;
  onInsertVariable: (variable: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function MessageToolbar({
  onAttachClick,
  onInsertText,
  onInsertVariable,
  textareaRef,
}: MessageToolbarProps) {
  const handleBold = () => {
    const textarea = textareaRef?.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      
      if (selectedText) {
        // Wrap selected text with *
        onInsertText(`*${selectedText}*`);
      } else {
        // Insert bold markers and position cursor
        onInsertText('*', '*');
      }
    } else {
      onInsertText('*', '*');
    }
  };

  const handleItalic = () => {
    const textarea = textareaRef?.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);
      
      if (selectedText) {
        onInsertText(`_${selectedText}_`);
      } else {
        onInsertText('_', '_');
      }
    } else {
      onInsertText('_', '_');
    }
  };

  return (
    <div className="flex items-center gap-1 border-t pt-3">
      {/* Attachment button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onAttachClick}
        title="Attach media"
        className="h-9 w-9"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      {/* Emoji button (placeholder) */}
      <Button
        variant="ghost"
        size="icon"
        disabled
        title="Emoji (coming soon)"
        className="h-9 w-9"
      >
        <Smile className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Bold */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBold}
        title="Bold (*text*)"
        className="h-9 w-9"
      >
        <Bold className="h-4 w-4" />
      </Button>

      {/* Italic */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleItalic}
        title="Italic (_text_)"
        className="h-9 w-9"
      >
        <Italic className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Variable picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            title="Insert variable"
            className="h-9 w-9"
          >
            <Braces className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <p className="text-sm font-medium px-2 py-1 text-muted-foreground">
            Insert Variable
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 text-xs"
                onClick={() => onInsertVariable(v.key)}
                title={v.description}
              >
                {v.key}
              </Badge>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Poll/Survey placeholder */}
      <Button
        variant="ghost"
        size="icon"
        disabled
        title="Poll (coming soon)"
        className="h-9 w-9"
      >
        <BarChart3 className="h-4 w-4" />
      </Button>
    </div>
  );
}
