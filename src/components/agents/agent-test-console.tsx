'use client'

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Bot, User, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { testAgentText } from '@/app/agents/actions';

type Turn = {
  role: 'user' | 'agent';
  content: string;
  sources?: { fileName: string }[];
};

export function AgentTestConsole({ agentId, canManage }: { agentId: string; canManage: boolean }) {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  if (!canManage) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Only roles with agent management can run tests.
      </p>
    );
  }

  const send = async () => {
    const message = input.trim();
    if (!message || isLoading) return;
    setInput('');
    setIsLoading(true);
    setTurns((prev) => [...prev, { role: 'user', content: message }]);

    try {
      const result = await testAgentText(agentId, message);
      if (result.error) {
        setTurns((prev) => [...prev, { role: 'agent', content: `⚠ ${result.error}` }]);
      } else {
        setTurns((prev) => [
          ...prev,
          { role: 'agent', content: result.reply, sources: result.sources },
        ]);
      }
    } catch {
      setTurns((prev) => [...prev, { role: 'agent', content: '⚠ Test request failed.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[420px] flex-col gap-3">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto border p-4">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-medium">Simulation ready</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Ask a question a customer might ask. The agent answers with its configured
              personality, retrieving from its bound knowledge sources.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {turns.map((turn, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3',
                  turn.role === 'user' && 'justify-end'
                )}
              >
                {turn.role === 'agent' && (
                  <span className="flex size-8 shrink-0 items-center justify-center bg-secondary">
                    <Bot className="size-4" />
                  </span>
                )}
                <div className={cn('max-w-[80%]', turn.role === 'user' && 'flex flex-col items-end')}>
                  <div
                    className={cn(
                      'p-3 text-sm',
                      turn.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                  </div>
                  {turn.sources && turn.sources.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {turn.sources.map((source) => (
                        <Badge key={source.fileName} variant="outline" className="gap-1 text-xs">
                          <FileText className="size-3" />
                          {source.fileName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {turn.role === 'user' && (
                  <span className="flex size-8 shrink-0 items-center justify-center bg-secondary">
                    <User className="size-4" />
                  </span>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Agent is thinking...
              </div>
            )}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a test question..."
          disabled={isLoading}
        />
        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
