import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  startMeetingSchema,
  startMeetingHandler,
  getMeetingStatusSchema,
  getMeetingStatusHandler,
  getMinutesSchema,
  getMinutesHandler,
  compactMinutesSchema,
  compactMinutesHandler,
  executeTasksSchema,
  executeTasksHandler,
  getAgentTreeHandler,
  respondToMentionSchema,
  respondToMentionHandler,
  getMentionsSchema,
  getMentionsHandler,
  cancelMeetingSchema,
  cancelMeetingHandler,
  listMeetingsSchema,
  listMeetingsHandler,
  getTaskReportSchema,
  getTaskReportHandler,
  createCapabilitySchema,
  createCapabilityHandler,
  getCostSummarySchema,
  getCostSummaryHandler,
  chainMeetingSchema,
  chainMeetingHandler,
  addTranscriptSchema,
  addTranscriptHandler,
  generateMinutesSchema,
  generateMinutesHandler,
} from './tools/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'open-coleslaw',
    version: '0.1.0',
  });

  // 1. start-meeting
  server.tool(
    'start-meeting',
    'Create a new meeting record with topic and agenda. Returns meetingId and recommended departments. Does NOT run the meeting.',
    startMeetingSchema,
    startMeetingHandler,
  );

  // 2. get-meeting-status
  server.tool(
    'get-meeting-status',
    'Get the status of a specific meeting or all active meetings',
    getMeetingStatusSchema,
    getMeetingStatusHandler,
  );

  // 3. get-minutes
  server.tool(
    'get-minutes',
    'Retrieve meeting minutes in full, summary, or tasks-only format',
    getMinutesSchema,
    getMinutesHandler,
  );

  // 4. compact-minutes
  server.tool(
    'compact-minutes',
    'Compact meeting minutes into a structured, department-assigned task list',
    compactMinutesSchema,
    compactMinutesHandler,
  );

  // 5. execute-tasks
  server.tool(
    'execute-tasks',
    'Get the task list from compacted minutes for agent dispatch. Does NOT spawn workers.',
    executeTasksSchema,
    executeTasksHandler,
  );

  // 6. get-agent-tree
  server.tool(
    'get-agent-tree',
    'Return the full agent hierarchy tree',
    getAgentTreeHandler,
  );

  // 7. respond-to-mention
  server.tool(
    'respond-to-mention',
    'Respond to a pending @mention with a decision',
    respondToMentionSchema,
    respondToMentionHandler,
  );

  // 8. get-mentions
  server.tool(
    'get-mentions',
    'List @mentions filtered by status and/or meeting',
    getMentionsSchema,
    getMentionsHandler,
  );

  // 9. cancel-meeting
  server.tool(
    'cancel-meeting',
    'Cancel an active meeting and clean up its agents and workers',
    cancelMeetingSchema,
    cancelMeetingHandler,
  );

  // 10. list-meetings
  server.tool(
    'list-meetings',
    'List meetings with optional status filter and pagination',
    listMeetingsSchema,
    listMeetingsHandler,
  );

  // 11. get-task-report
  server.tool(
    'get-task-report',
    'Generate a task execution report for a meeting with per-department breakdown',
    getTaskReportSchema,
    getTaskReportHandler,
  );

  // 12. create-capability
  server.tool(
    'create-capability',
    'Create a new extension capability (hook, skill, command, asset, or loop)',
    createCapabilitySchema,
    createCapabilityHandler,
  );

  // 13. get-cost-summary
  server.tool(
    'get-cost-summary',
    'Get cost summary for a specific meeting or overall across all meetings',
    getCostSummarySchema,
    getCostSummaryHandler,
  );

  // 14. chain-meeting
  server.tool(
    'chain-meeting',
    'Create a new meeting chained from a previous meeting, using its minutes as context. Does NOT run the meeting.',
    chainMeetingSchema,
    chainMeetingHandler,
  );

  // 15. add-transcript
  server.tool(
    'add-transcript',
    'Add a transcript entry to a meeting. Used to record speaker contributions during meeting phases.',
    addTranscriptSchema,
    addTranscriptHandler,
  );

  // 16. generate-minutes
  server.tool(
    'generate-minutes',
    'Generate PRD minutes from all stored transcripts for a meeting. Marks the meeting as completed.',
    generateMinutesSchema,
    generateMinutesHandler,
  );

  return server;
}
