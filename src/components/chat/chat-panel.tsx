'use client';
import * as React from 'react';
import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, User, Bot, Loader2, Paperclip, ThumbsUp, ThumbsDown, X, Volume2, Square, Download, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/ai/flows/conversational-chat';
import { useToast } from '@/hooks/use-toast';
import { appwriteStorageBucketId, storage } from '@/lib/appwrite-client';
import { ID, Permission, Role, type Models } from 'appwrite';
import { processDocument } from '@/ai/flows/process-document';
import { logInteraction } from '@/ai/flows/log-metrics';
import { v4 as uuidv4 } from 'uuid';
import { ConversationStarters } from './conversation-starters';
import { Skeleton } from '../ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';


async function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Extend the Message type to include an ID and optional image data
export type ChatMessage = Message & { id: string, image?: string };

type AudioPlaybackState = {
  messageId: string | null;
  status: 'idle' | 'loading' | 'playing';
};

function ChatSkeleton() {
    return (
        <div className="space-y-6 pr-4">
            <div className="flex items-start gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-16 w-64" />
                </div>
            </div>
            <div className="flex items-start gap-4 justify-end">
                 <div className="flex flex-col gap-2 items-end">
                    <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
             <div className="flex items-start gap-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-12 w-56" />
                </div>
            </div>
        </div>
    )
}

export function ChatPanel({
  disabled,
  user,
  isChatActive = true,
}: {
  disabled?: boolean;
  user: Models.User<Models.Preferences>;
  isChatActive?: boolean;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreview, setImagePreview] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = React.useState(true);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = React.useState<Set<string>>(new Set());
  const [audioState, setAudioState] = React.useState<AudioPlaybackState>({ messageId: null, status: 'idle' });
  const [isClearConfirmOpen, setIsClearConfirmOpen] = React.useState(false);
  const [isClearing, startClearingTransition] = React.useTransition();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();
  const effectiveDisabled = disabled || !isChatActive;

  React.useEffect(() => {
    if (effectiveDisabled) {
        setIsHistoryLoading(false);
        return;
    }
    const fetchHistory = async () => {
      setIsHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch('/api/chat/history');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to fetch history');
        }
        setMessages(data);
      } catch (error: any) {
        console.error(error);
        setHistoryError(error.message || 'Could not load chat history.');
      } finally {
        setIsHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [toast, effectiveDisabled]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const resetFileInput = () => {
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isDocument = ['pdf', 'docx', 'txt'].includes(fileExtension || '');
    const isImage = ['png', 'jpg', 'jpeg', 'webp'].includes(fileExtension || '');
    
    if (isImage) {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        resetFileInput();
        return;
    }

    if (isDocument) {
        if (!appwriteStorageBucketId) {
             toast({
                variant: 'destructive',
                title: 'Storage Not Configured',
                description: 'Please set the Appwrite storage bucket ID in your environment variables.',
            });
            return;
        }
        setIsLoading(true);
        toast({
        title: 'Uploading document...',
        description: `Processing "${file.name}". This may take a moment.`,
        });

        try {
        const bucketId = appwriteStorageBucketId;
        
        const permissions = [
            Permission.read(Role.user(user.$id)),
            Permission.update(Role.user(user.$id)),
            Permission.delete(Role.user(user.$id)),
            Permission.read(Role.label('admin')),
        ];

        const fileUploadResponse = await storage.createFile(bucketId, ID.unique(), file, permissions);
        const documentId = fileUploadResponse.$id;
        const fileDataUri = await fileToDataUri(file);

        await processDocument({ fileDataUri, fileName: file.name, documentId });

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
        resetFileInput();
        }
        return;
    }

    toast({
        variant: 'destructive',
        title: 'Unsupported File Type',
        description: 'Please upload a PDF, DOCX, TXT, PNG, JPG, or WEBP file.'
    });
    resetFileInput();
  };

  const handleFeedback = async (message: ChatMessage, feedback: 'good' | 'bad') => {
    if (!message.id) return;
    if (feedbackSent.has(message.id)) return;

    setFeedbackSent(prev => new Set(prev).add(message.id!));
    toast({
        title: 'Feedback Received',
        description: "Thank you! We'll use your feedback to improve."
    });

    let prompt: string | undefined = undefined;
    if (feedback === 'bad') {
        const messageIndex = messages.findIndex(m => m.id === message.id);
        if (messageIndex > 0) {
            const potentialUserMessage = messages[messageIndex - 1];
            if (potentialUserMessage?.role === 'user') {
                prompt = potentialUserMessage.content;
            }
        }
    }
    
    try {
      await logInteraction({ messageId: message.id, feedback, prompt });
    } catch (error) {
      console.error("Failed to log feedback", error);
    }
  }

  const handleExportChat = () => {
    if (messages.length === 0) {
      toast({
        title: 'Cannot Export',
        description: 'There are no messages in the current conversation.',
      });
      return;
    }

    const formattedChat = messages
      .map(msg => {
        let content = msg.content;
        if (msg.image) {
            content = `[Image Attached] ${content}`;
        }
        return `${msg.role === 'user' ? 'You' : 'Cally-IO'}: ${content}`;
      })
      .join('\n\n---\n\n');

    const blob = new Blob([formattedChat], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `cally-io-chat-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
        title: 'Export Successful',
        description: 'Your chat history has been downloaded.',
    });
  };

  const handleClearHistory = () => {
    startClearingTransition(async () => {
        setIsClearConfirmOpen(false); // Close the dialog
        
        // Optimistically clear UI
        const originalMessages = messages;
        setMessages([]);

        try {
            const response = await fetch('/api/chat/history/clear', { method: 'POST' });
            if (!response.ok) {
                throw new Error("Failed to clear history on the server.");
            }
            toast({
                title: 'History Cleared',
                description: 'Your conversation has been reset.',
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not clear your chat history. Your messages have been restored.',
            });
            // Revert on failure
            setMessages(originalMessages);
        }
    });
  };

  const handlePlayAudio = async (message: ChatMessage) => {
    // Stop any currently playing audio
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
    }

    // If the clicked message was already playing, just stop it.
    if (audioState.status === 'playing' && audioState.messageId === message.id) {
        setAudioState({ messageId: null, status: 'idle' });
        return;
    }

    if (!message.id) return;
    setAudioState({ messageId: message.id, status: 'loading' });

    try {
        const response = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: message.content }),
        });

        if (!response.ok) {
            throw new Error('Failed to generate audio.');
        }

        const { audioDataUri } = await response.json();
        
        audioRef.current = new Audio(audioDataUri);
        audioRef.current.play();
        setAudioState({ messageId: message.id, status: 'playing' });

        audioRef.current.onended = () => {
            setAudioState({ messageId: null, status: 'idle' });
            audioRef.current = null;
        };

    } catch (error) {
        console.error('Error playing audio:', error);
        toast({
            variant: 'destructive',
            title: 'Audio Error',
            description: 'Could not play the audio for this message.',
        });
        setAudioState({ messageId: null, status: 'idle' });
    }
  }

  const sendMessage = async (prompt: string) => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);

    let imageDataUri: string | undefined = undefined;
    if (imageFile && imagePreview) {
        imageDataUri = await fileToDataUri(imageFile);
    }

    const userMessage: ChatMessage = { role: 'user', content: prompt, id: uuidv4(), image: imageDataUri };
    setMessages((prev) => [...prev, userMessage]);
    
    // Clear inputs immediately
    setInput('');
    setImageFile(null);
    setImagePreview(null);
    
    const modelMessageId = uuidv4();
    // Add a placeholder for the model's response
    setMessages((prev) => [ ...prev, { role: 'model', content: '', id: modelMessageId }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          image: imageDataUri,
        }),
      });

      if (!response.body) throw new Error('No response body');
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
            // Check if the error is JSON and has a message property
            const errorJson = JSON.parse(errorText);
            if (errorJson.message) {
                errorMessage = errorJson.message;
            }
        } catch (e) {
            // Not a JSON error, so we use the raw text.
        }
        throw new Error(errorMessage || 'The API returned an unspecified error.');
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let modelResponse = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        modelResponse += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages.length > 0 ? newMessages[newMessages.length - 1] : undefined;
          if (lastMessage && lastMessage.id === modelMessageId) {
             lastMessage.content = modelResponse;
          }
          return newMessages;
        });
      }
    } catch (error: any) {
      console.error('Error fetching chat response:', error);
      const errorMessage = `I'm sorry, but I encountered an error: ${error.message}`;
      setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages.length > 0 ? newMessages[newMessages.length - 1] : undefined;
          if (lastMessage && lastMessage.id === modelMessageId) {
             lastMessage.content = errorMessage;
          }
          return newMessages;
        });
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to get a response from the AI assistant.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }
    }
  }, [messages]);
  
  // Cleanup audio on unmount
  React.useEffect(() => {
    return () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.onended = null;
        }
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2 mb-2 border-b">
        <h3 className="text-lg font-semibold">Conversation</h3>
        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsClearConfirmOpen(true)}
                disabled={messages.length === 0 || isLoading || isClearing}
            >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportChat}
                disabled={messages.length === 0 || isLoading}
            >
                <Download className="mr-2 h-4 w-4" />
                Export
            </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
        {isHistoryLoading ? (
            <ChatSkeleton />
        ) : historyError ? (
             <Alert variant="destructive" className="m-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error Loading Chat History</AlertTitle>
              <AlertDescription>
                {historyError}
              </AlertDescription>
            </Alert>
        ) : (
            <div className="space-y-6 pr-4">
            {messages.length === 0 && !effectiveDisabled && (
                <ConversationStarters onStarterClick={sendMessage} />
            )}
            {messages.length === 0 && effectiveDisabled && (
                <div className="text-center text-muted-foreground p-8">
                {disabled ? 'Please configure the application to enable chat.' : 'Chat is currently unavailable.'}
                </div>
            )}
            {messages.map((message) => {
                const isThisMessageLoadingAudio = audioState.status === 'loading' && audioState.messageId === message.id;
                const isThisMessagePlayingAudio = audioState.status === 'playing' && audioState.messageId === message.id;

                const lastMessage = messages[messages.length-1];
                const isLastMessage = lastMessage && lastMessage.id === message.id;
                const isModelTyping = isLoading && isLastMessage && message.role === 'model';

                return (
                    <div key={message.id} className={cn('flex items-start gap-4', message.role === 'user' ? 'justify-end' : '')}>
                    {message.role === 'model' && (
                        <Avatar className="h-8 w-8"><AvatarFallback><Bot /></AvatarFallback></Avatar>
                    )}
                    <div className="flex flex-col gap-2 max-w-prose">
                        <div className={cn(
                            'rounded-lg p-3 text-sm',
                            message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                        )}>
                            {message.image && (
                                <Image src={message.image} alt="User upload" width={300} height={200} className="rounded-md mb-2" />
                            )}
                            
                            {message.content ? (
                                <p className="whitespace-pre-wrap">{message.content}</p>
                            ) : ( isModelTyping && <Loader2 className="h-5 w-5 animate-spin" /> )}
                        </div>
                        {message.role === 'model' && message.content && !isModelTyping && (
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePlayAudio(message)} disabled={audioState.status === 'loading'}>
                                    {isThisMessageLoadingAudio ? <Loader2 className="h-4 w-4 animate-spin" /> : (isThisMessagePlayingAudio ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />)}
                                </Button>
                                <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message, 'good')} disabled={!!message.id && feedbackSent.has(message.id)}>
                                        <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleFeedback(message, 'bad')} disabled={!!message.id && feedbackSent.has(message.id)}>
                                        <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    {message.role === 'user' && (
                        <Avatar className="h-8 w-8"><AvatarFallback><User /></AvatarFallback></Avatar>
                    )}
                    </div>
                )
            })}
            </div>
        )}
      </ScrollArea>
      <div className="mt-4">
        {imagePreview && (
          <div className="relative w-24 h-24 mb-2 rounded-md overflow-hidden">
            <Image src={imagePreview} alt="Image preview" layout="fill" objectFit="cover" />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-1 right-1 h-6 w-6"
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            disabled={isLoading || effectiveDisabled}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isLoading || effectiveDisabled}>
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach File</span>
          </Button>
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder={effectiveDisabled ? 'Chat is currently unavailable' : 'Ask anything...'}
            className="flex-1"
            disabled={isLoading || effectiveDisabled}
          />
          <Button type="submit" size="icon" disabled={isLoading || (!input.trim() && !imageFile) || effectiveDisabled}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>

       <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This will permanently clear your current conversation history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
                className="bg-destructive hover:bg-destructive/90"
                onClick={handleClearHistory}
                disabled={isClearing}
            >
                {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, clear history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}
