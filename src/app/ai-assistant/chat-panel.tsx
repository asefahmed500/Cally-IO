'use client';

import { useState } from 'react';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type Models } from 'appwrite';

import { runAssistant, type AssistantOutput } from '@/ai/flows/rag-retrieval-flow';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User, Loader2, FileText } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const formSchema = z.object({
  prompt: z.string().min(1, 'Please enter a question.'),
});
type FormValues = z.infer<typeof formSchema>;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: AssistantOutput['sources'];
}

export function ChatPanel({ user }: { user: Models.User<Models.Preferences> }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: '' },
  });

  const { control } = form;
  const { isSubmitting } = useFormState({ control });

  const onSubmit = async (data: FormValues) => {
    setIsLoading(true);
    const userMessage: Message = { role: 'user', content: data.prompt };
    setMessages((prev) => [...prev, userMessage]);
    form.reset();

    try {
      const response = await runAssistant({ query: data.prompt, userId: user.$id });
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error(error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, something went wrong while fetching an answer.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-grow h-full border rounded-lg">
      <ScrollArea className="flex-grow p-4">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
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
           {isLoading && (
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
          <Input
            name="prompt"
            placeholder="Ask a question..."
            disabled={isSubmitting}
            autoComplete="off"
            {...form.register('prompt')}
          />
          <Button type="submit" disabled={isSubmitting}>
            Send
          </Button>
        </form>
         <p className="mt-2 text-xs text-center text-muted-foreground">
            AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </div>
  );
}
