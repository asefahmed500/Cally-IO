'use client';
import * as React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2, Paperclip, ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/ai/flows/conversational-chat';
import { useToast } from '@/hooks/use-toast';
import { storage, appwriteStorageBucketId } from '@/lib/appwrite-client';
import { ID, Permission, Role, type Models } from 'appwrite';
import { processDocument } from '@/ai/flows/process-document';
import { logInteraction } from '@/ai/flows/log-metrics';
import { v4 as uuidv4 } from 'uuid';

async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extend the Message type to include a client-side ID
type ChatMessage = Message & { id: string };

export function ChatPanel({
  disabled,
  user,
}: {
  disabled?: boolean;
  user: Models.User<Models.Preferences>;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [feedbackSent, setFeedbackSent] = React.useState<Set<string>>(new Set());
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    toast({
      title: 'Uploading document...',
      description: `Processing "${file.name}". This may take a moment.`,
    });

    try {
      const bucketId = await appwriteStorageBucketId();
      if (!bucketId) {
        throw new Error('Appwrite storage bucket not configured.');
      }
      
      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        Permission.read(Role.label('admin')), // Admins can read all files
      ];

      // 1. Upload file to Appwrite Storage with permissions
      const fileUploadResponse = await storage.createFile(
        bucketId,
        ID.unique(),
        file,
        permissions
      );
      const documentId = fileUploadResponse.$id;

      // 2. Convert file to data URI for processing
      const fileDataUri = await fileToDataUri(file);

      // 3. Call the Genkit flow to process the document
      await processDocument({
        fileDataUri,
        fileName: file.name,
        documentId,
      });

      toast({
        title: 'Success!',
        description: `"${file.name}" has been processed and is ready for questions.`,
      });
    } catch (error: any) {
      console.error('Error processing document:', error);
      toast({
        variant: 'destructive',
        title: 'Error processing document',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsLoading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFeedback = async (message: ChatMessage, feedback: 'good' | 'bad') => {
    if (feedbackSent.has(message.id)) return; // Prevent duplicate feedback

    setFeedbackSent(prev => new Set(prev).add(message.id));
    toast({
        title: 'Feedback Received',
        description: "Thank you! We'll use your feedback to improve."
    });
    
    try {
      await logInteraction({ messageId: message.id, feedback });
    } catch (error) {
      console.error("Failed to log feedback", error);
      // Optionally notify user of failure, but for now we fail silently
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input, id: uuidv4() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let modelResponse = '';
    const plainHistory: Message[] = messages.map(({role, content}) => ({role, content}));

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          history: plainHistory, // Send history *before* the new user message
          prompt: input,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Add a placeholder for the model's response
      const modelMessageId = uuidv4();
      setMessages((prev) => [
        ...prev,
        { role: 'model', content: '', id: modelMessageId },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        modelResponse += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.id === modelMessageId) {
             lastMessage.content = modelResponse;
          }
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Error fetching chat response:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to get a response from the AI assistant.',
      });
       setMessages((prev) => prev.filter(m => m.id !== userMessage.id));

    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: 'smooth',
        });
      }
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100%-4rem)]">
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="space-y-6 pr-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground p-8">
              {disabled ? 'Please configure the application to enable chat.' : 'Start a conversation with Cally-IO.'}
            </div>
          )}
          {messages.map((message, index) => {
            const isEscalation = message.role === 'model' && (
                message.content.toLowerCase().includes('specialist') ||
                message.content.toLowerCase().includes('human expert')
            );
            return (
                <div
                key={message.id}
                className={cn(
                    'flex items-start gap-4',
                    message.role === 'user' ? 'justify-end' : ''
                )}
                >
                {message.role === 'model' && (
                    <Avatar className="h-8 w-8">
                    <AvatarFallback>
                        <Bot />
                    </AvatarFallback>
                    </Avatar>
                )}
                <div className="flex flex-col gap-2">
                    <div
                        className={cn(
                        'max-w-prose rounded-lg p-3 text-sm',
                        message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                    >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.role === 'model' && message.content && !isLoading && (
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">
                                {isEscalation ? 'Escalation suggested for accuracy.' : 'Generated with high confidence.'}
                            </p>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message, 'good')} disabled={feedbackSent.has(message.id)}>
                                    <ThumbsUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message, 'bad')} disabled={feedbackSent.has(message.id)}>
                                    <ThumbsDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                {message.role === 'user' && (
                    <Avatar className="h-8 w-8">
                    <AvatarFallback>
                        <User />
                    </AvatarFallback>
                    </Avatar>
                )}
                </div>
            )
        })}
          {isLoading && messages[messages.length-1]?.role === 'user' && (
            <div className="flex items-start gap-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot />
                </AvatarFallback>
              </Avatar>
              <div className="max-w-md rounded-lg p-3 text-sm bg-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="mt-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.txt"
            disabled={isLoading || disabled}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || disabled}
          >
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach Document</span>
          </Button>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything..."
            className="flex-1"
            disabled={isLoading || disabled}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim() || disabled}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
