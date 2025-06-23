'use client';

import * as React from 'react';
import { Paperclip, SendHorizontal, Bot, User, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { Message, DocumentChunk } from '@/lib/types';

export function ChatPanel() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: input, history: messages }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get response from server.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';
      let sources: DocumentChunk[] = [];
      const assistantMessageId = (Date.now() + 1).toString();

      // Add a placeholder for the assistant's message
      setMessages((prev) => [...prev, { id: assistantMessageId, role: 'assistant', content: '' }]);
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        try {
            const data = JSON.parse(chunk);
            if(data.type === 'sources') {
                sources = data.sources;
            } else if (data.type === 'chunk') {
                assistantResponse += data.content;
                setMessages((prev) =>
                    prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? { ...msg, content: assistantResponse }
                        : msg
                    )
                );
            }
        } catch (error) {
            // If JSON.parse fails, it might be a malformed chunk.
            // In a production app, you might want more robust error handling.
            console.error("Error parsing stream chunk:", error);
        }
      }
      
      // Final update with sources
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: assistantResponse, sources: sources }
            : msg
        )
      );

    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow bg-card border rounded-lg shadow-sm">
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex items-start gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="p-2 bg-primary/10 rounded-full">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
              )}
      
              <div
                className={cn(
                  'max-w-xl rounded-lg p-3 whitespace-pre-wrap',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}
              >
                <p>{message.content}</p>
                 {message.role === 'assistant' && isLoading && messages[messages.length-1].id === message.id && (
                     <Loader2 className="h-4 w-4 animate-spin mt-2" />
                 )}
                 {message.sources && message.sources.length > 0 && (
                    <Accordion type="single" collapsible className="w-full mt-4">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>Sources ({message.sources.length})</AccordionTrigger>
                            <AccordionContent>
                               <div className="space-y-2">
                                 {message.sources.map((source, index) => (
                                     <div key={index} className="p-2 bg-background/50 rounded-md text-xs">
                                         <p className="font-bold flex items-center gap-2"><FileText className="h-4 w-4" /> {source.fileName}</p>
                                         <p className="mt-1 text-muted-foreground truncate">{source.chunkText}</p>
                                     </div>
                                 ))}
                               </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}
              </div>
      
              {message.role === 'user' && (
                <div className="p-2 bg-muted rounded-full">
                  <User className="h-6 w-6 text-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            value={input}
            onChange={handleInputChange}
            placeholder="Ask a question about your documents..."
            className="pr-20 min-h-[40px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute top-1/2 right-3 -translate-y-1/2 flex gap-2">
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
