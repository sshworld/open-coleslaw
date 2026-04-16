import { z } from 'zod';
import { ExtensionManager } from '../extension/extension-manager.js';
import type { CapabilityType } from '../extension/capability-registry.js';
import type { GenerateRequest } from '../extension/generator.js';

export const createCapabilitySchema = {
  type: z
    .enum(['hook', 'skill', 'command', 'asset', 'loop'])
    .describe('Type of capability to create'),
  name: z.string().describe('Name for the new capability'),
  description: z.string().describe('What the capability does'),
  trigger: z.string().describe('When the capability should be triggered'),
  userRequest: z
    .string()
    .optional()
    .describe('Original user request that triggered creation'),
};

export async function createCapabilityHandler({
  type,
  name,
  description,
  trigger,
  userRequest,
}: {
  type: 'hook' | 'skill' | 'command' | 'asset' | 'loop';
  name: string;
  description: string;
  trigger: string;
  userRequest?: string;
}): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  try {
    const manager = new ExtensionManager();
    await manager.init();

    const request: GenerateRequest = {
      type: type as CapabilityType,
      name,
      description,
      trigger,
      userRequest: userRequest ?? description,
    };

    const result = await manager.createCapability(request);

    const output = {
      status: 'created',
      capability: {
        type: result.capability.type,
        name: result.capability.name,
        description: result.capability.description,
        trigger: result.capability.trigger,
        isBuiltIn: result.capability.isBuiltIn,
      },
      filePath: result.filePath,
      summary: result.summary,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
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
