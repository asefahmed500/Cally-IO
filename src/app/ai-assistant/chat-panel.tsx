'use client';

import { useState, useRef, useEffect } from 'react';
import type { Models } from 'appwrite';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, Loader2, FileText, CornerDownLeft } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Source {
  type: 'document';
  title: string;
  content: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
}

// Simple utility to parse sources from the AI's markdown response
function parseSources(text: string): Source[] {
  const sources: Source[] = [];
  const sourcesSection = text.split('**Sources:**')[1];
  if (!sourcesSection) return sources;

  // Regex to find list items starting with * or - and capture the filename and content
  const sourceRegex = /[\*\-]\s*\*\*(.*?)\*\*:\s*([\s\S]*?)(?=\n[\*\-]|\n*$)/g;
  let match;
  while ((match = sourceRegex.exec(sourcesSection)) !== null) {
    sources.push({
      type: 'document',
      title: match[1].trim(),
      content: match[2].trim(),
    });
  }
  return sources;
}

export function ChatPanel({ user }: { user: Models.User<Models.Preferences> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userInput]);
    setInput('');
    setIsLoading(true);

    const assistantId = (Date.now() + 1).toString();
    const assistantStartingMessage: Message = { id: assistantId, role: 'assistant', content: '' };
    setMessages((prev) => [...prev, assistantStartingMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input, userId: user.$id }),
      });

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        const chunk = decoder.decode(value, { stream: true });
        
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + chunk } : msg
          )
        );
      }
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: 'Sorry, something went wrong while fetching an answer.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // After the stream is complete, parse sources from the final message content
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !lastMessage.sources) {
        const parsed = parseSources(lastMessage.content);
        if (parsed.length > 0) {
          setMessages(prev => prev.map(msg => msg.id === lastMessage.id ? { ...msg, sources: parsed } : msg));
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);


  // Auto-scroll to bottom
  useEffect(() => {
    const scrollDiv = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (scrollDiv) {
        scrollDiv.scrollTop = scrollDiv.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col flex-grow h-full border rounded-lg">
      <ScrollArea className="flex-grow p-4" ref={scrollAreaRef}>
        <div className="space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-lg p-3 max-w-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                 {message.sources && message.sources.length > 0 && (
                    <div className="mt-4">
                        <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="item-1">
                                <AccordionTrigger>View Sources ({message.sources.length})</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2">
                                    {message.sources.map((source, idx) => (
                                        <div key={idx} className="p-2 text-xs border rounded-md bg-background">
                                            <p className="font-semibold truncate">
                                                <FileText className="inline-block w-3 h-3 mr-1" />
                                                {source.title}
                                            </p>
                                            <p className="mt-1 text-muted-foreground line-clamp-3">{source.content}</p>
                                        </div>
                                    ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                )}
              </div>
              {message.role === 'user' && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback><User /></AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
           {isLoading && messages[messages.length-1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback><Bot /></AvatarFallback>
              </Avatar>
              <div className="flex items-center p-3 rounded-lg bg-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-4 border-t">
        <form onSubmit={handleSubmit} className="relative flex gap-2">
          <Input
            name="prompt"
            placeholder="Ask a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            autoComplete="off"
          />
          <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-10" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CornerDownLeft className="w-4 h-4" />}
             <span className="sr-only">Send</span>
          </Button>
        </form>
         <p className="mt-2 text-xs text-center text-muted-foreground">
            AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
