import { Annotation, StateGraph, START, END, messagesStateReducer } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { getChatModel, isAIConfigured } from '@/ai/models';
import { webSearch } from '@/ai/tools/tavily';
import { getFaqContext, searchKnowledge } from '@/ai/retrieval';
import { getAISettings } from '@/lib/settings';
import { logDocumentUsage } from '@/lib/analytics';
import type { ChatMessage } from '@/lib/conversation';

const ChatGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

// Tool-calling node handled by LangGraph's prebuilt ToolNode.
const toolNode = new ToolNode([webSearch]);

async function agentNode(state: typeof ChatGraphState.State) {
  const model = getChatModel().bindTools([webSearch]);
  // The system message stays out of persisted state; it is prepended each turn.
  const systemMessage = state.messages.find((m) => m instanceof SystemMessage);
  const conversation = state.messages.filter((m) => !(m instanceof SystemMessage));
  const response = await model.invoke([...(systemMessage ? [systemMessage] : []), ...conversation]);
  return { messages: [response] };
}

function shouldContinue(state: typeof ChatGraphState.State): 'tools' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) return 'tools';
  return END;
}

const chatGraph = new StateGraph(ChatGraphState)
  .addNode('agent', agentNode)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', shouldContinue, ['tools', END])
  .addEdge('tools', 'agent')
  .compile();

export type RunChatStreamInput = {
  history: ChatMessage[];
  prompt: string;
  image?: string;
  userId: string;
  /** Active workspace, when the user has one — scopes usage analytics. */
  workspaceId?: string;
};

/**
 * Runs the RAG + tool-calling agent graph and returns an async iterable of
 * text chunks suitable for streaming to the client.
 */
export async function runChatStream(
  input: RunChatStreamInput
): Promise<{ stream: AsyncGenerator<string> }> {
  const [aiSettings, faqContext, { context: docContext, sources: docSources }] = await Promise.all([
    getAISettings(input.workspaceId),
    getFaqContext(),
    searchKnowledge(input.prompt),
  ]);

  if (docSources.length > 0) {
    logDocumentUsage(input.userId, docSources, input.workspaceId);
  }

  const systemPromptText = `You are Cally-IO, an advanced AI assistant for customer support and sales.

Your personality should be: ${aiSettings.personality}.
Your response style should be: ${aiSettings.style}.

**Core Instructions:**
1.  **Prioritize Your Knowledge**: You have three sources of information. Use them in this specific order:
    a.  **Image Analysis**: If the user provides an image, it is the most important context. Analyze it first.
    b.  **FAQs**: The "FREQUENTLY ASKED QUESTIONS" context is your highest priority. If the answer is here, use it and state that it comes from the company FAQ.
    c.  **DOCUMENT CONTEXT**: This is your second source of truth. The context is provided below, along with a list of the source file names. If you use information from this context, you MUST cite the file name(s) from the "Source Files" list. Example: "According to the 'product-manual.pdf' document, ...".
    d.  **Web Search Tool**: For questions about competitors, current events, or information not found in your internal knowledge, use the \`webSearch\` tool.

2.  **Consultative Sales Approach**: Act as a consultative partner.
    *   Ask clarifying questions to understand the user's needs.
    *   Connect their problems to specific product features.
    *   Proactively guide the conversation towards a solution, suggesting next steps like a demo or a follow-up.

3.  **Honesty and Escalation**: If you cannot find an answer using any of your tools or knowledge bases, **DO NOT invent an answer**. State that you don't have the information and offer to connect the user with a human specialist.

4.  **Business Context**:
    ${aiSettings.instructions}

**Knowledge Sources Provided for This Turn:**

FREQUENTLY ASKED QUESTIONS:
${faqContext || 'No FAQs provided.'}
---
DOCUMENT CONTEXT:
${docContext || 'No relevant information found in your documents for this query.'}

Source Files:
${docSources.map((s) => `- ${s.fileName}`).join('\n') || 'N/A'}
`;

  const historyMessages: BaseMessage[] = input.history.map((msg) =>
    msg.role === 'user' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
  );

  const userContent: Array<
    { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }
  > = [{ type: 'text', text: input.prompt }];
  if (input.image) {
    userContent.unshift({ type: 'image_url', image_url: { url: input.image } });
  }

  const graphInput = {
    messages: [new SystemMessage(systemPromptText), ...historyMessages, new HumanMessage({ content: userContent })],
  };

  async function* streamGenerator(): AsyncGenerator<string> {
    if (!isAIConfigured()) {
      yield 'AI is not configured. Please ask an administrator to set the GOOGLE_API_KEY environment variable.';
      return;
    }
    const stream = await chatGraph.stream(graphInput, {
      streamMode: 'messages',
      recursionLimit: 25,
    });
    for await (const [chunk, metadata] of stream) {
      if (metadata?.langgraph_node !== 'agent') continue;
      const content = (chunk as { content?: unknown }).content;
      if (typeof content === 'string' && content.length > 0) {
        yield content;
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (part && typeof part === 'object' && part.type === 'text' && part.text) {
            yield part.text;
          }
        }
      }
    }
  }

  return { stream: streamGenerator() };
}
