import { getAgentTree } from '../storage/index.js';

export async function getAgentTreeHandler(): Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}> {
  try {
    const tree = getAgentTree('orchestrator-root');

    const result = {
      root: tree,
      hasAgents: tree !== null,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        { type: 'text', text: JSON.stringify({ error: message }, null, 2) },
      ],
      isError: true,
    };
  }
}
