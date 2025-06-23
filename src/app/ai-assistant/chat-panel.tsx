'use client';

import { useState, useRef, useEffect } from 'react';
import type { Models } from 'appwrite';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, Loader2, CornerDownLeft } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
        body: JSON.stringify({ query: input }),
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
          {messages.length === 0 && (
              <div className="text-center text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold">AI Sales Assistant</h2>
                  <p className="mt-2">Ask me anything about sales, leads, or strategy.</p>
              </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
              {message.role === 'assistant' && (
                <Avatar className="w-8 h-8">
                  <AvatarFallback><Bot /></AvatarFallback>
                </Avatar>
              )}
              <div className={`rounded-lg p-3 max-w-lg ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>
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
            placeholder="Ask your sales assistant..."
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
