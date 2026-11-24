import { generateText, tool, jsonSchema, isStepCount } from 'ai';
import { pool } from '../db/pool';
import { chatModel } from '../ai/gemini';
import { retrieve } from '../rag/retriever';
import { runTool } from '../tools/executor';

const CONTEXT_MESSAGES = 20;
const MAX_STEPS = 5;

const SYSTEM_PROMPT = `You are a helpful assistant.
When you are given context snippets labelled [S1], [S2], etc., base your answer on them
and cite the snippets you used inline, like [S1]. If the context does not contain the
answer, say so instead of guessing. Use the available tools when they help answer the question.`;

export async function answer(chatId: string, userText: string) {
  // 1. Store the user message
  await pool.query('INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)', [
    chatId,
    'user',
    userText,
  ]);

  // 2. Context window: last N messages (the one just inserted is last)
  const { rows: history } = await pool.query(
    `SELECT role, content FROM messages
      WHERE chat_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [chatId, CONTEXT_MESSAGES]
  );
  history.reverse();

  // 3. RAG retrieval
  const sources = await retrieve(userText);
  const sourceBlock = sources
    .map((s, i) => {
      const where = [s.doc_name, s.page ? `p.${s.page}` : null, s.heading]
        .filter(Boolean)
        .join(', ');
      return `[S${i + 1}] (${where})\n${s.content}`;
    })
    .join('\n\n');

  // 4. Enabled tools only, converted to AI SDK tools
  const { rows: enabledTools } = await pool.query('SELECT * FROM tools WHERE enabled = TRUE');
  const tools = Object.fromEntries(
    enabledTools.map((t) => [
      t.name,
      tool({
        description: t.description,
        // Cast to Record<string, unknown> so the Schema type resolves to a concrete
        // INPUT instead of `unknown`, satisfying the tool() overload check.
        inputSchema: jsonSchema<Record<string, unknown>>(t.parameters),
        execute: async (args: Record<string, unknown>) => {
          try {
            return await runTool(t, args);
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
    ])
  );

  // 5. Generate. In AI SDK v7 maxSteps was replaced by stopWhen + isStepCount.
  const { text, steps } = await generateText({
    model: chatModel,
    system: SYSTEM_PROMPT,
    messages: [
      ...history.slice(0, -1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content as string,
      })),
      {
        role: 'user' as const,
        content: `Context:\n${sourceBlock || '(no documents matched)'}\n\nQuestion: ${userText}`,
      },
    ],
    tools,
    stopWhen: isStepCount(MAX_STEPS),
  });

  const toolCalls = steps.flatMap((s) =>
    s.toolCalls.map((c, i) => ({
      name: c.toolName,
      args: c.input,
      result: s.toolResults[i]?.output,
    }))
  );

  // 6. Citations from [S1]-style markers
  const usedIndexes = [...new Set([...text.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1])))];
  const citations = usedIndexes
    .map((n) => sources[n - 1])
    .filter(Boolean)
    .map((s) => ({
      chunkId: s.chunk_id,
      docId: s.doc_id,
      docName: s.doc_name,
      page: s.page,
      heading: s.heading,
      snippet: s.content.slice(0, 240),
    }));

  // 7. Save assistant message
  await pool.query(
    'INSERT INTO messages (chat_id, role, content, citations, tool_calls) VALUES ($1, $2, $3, $4, $5)',
    [chatId, 'assistant', text, JSON.stringify(citations), JSON.stringify(toolCalls)]
  );

  return { answer: text, citations, toolCalls };
}
