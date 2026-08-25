export interface N8nNodeTrace {
  nodeName: string;
  status: 'completed' | 'failed' | 'running';
  durationMs: number;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  category: string;
  webhookUrl: string;
  webhookPath: string;
  status: 'active' | 'inactive' | 'error';
  triggerType: string;
  nodesCount: number;
  avgExecutionTimeMs: number;
  totalRuns: number;
  successRate: number;
  errorCount: number;
  lastRun: string;
  tags: string[];
}

export interface N8nExecutionLog {
  id: string;
  workflowId: string;
  workflowName: string;
  webhookUrl: string;
  status: 'success' | 'error' | 'running' | 'waiting';
  httpStatus: number;
  durationMs: number;
  triggerSource: string;
  leadName?: string;
  leadEmail?: string;
  payload: any;
  response: any;
  errorMessage?: string;
  timestamp: string;
  nodeTrace: N8nNodeTrace[];
}

export interface N8nSystemStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  totalErrors: number;
  overallSuccessRate: number;
  averageLatencyMs: number;
  n8nInstanceHost: string;
  lastHealthCheck: string;
}

export interface N8nAutofixRemediation {
  rootCause: string;
  fixSteps: string[];
  recommendedNodeConfig: string;
  confidenceScore: number;
}

export async function fetchN8nWorkflowsAndStats(): Promise<{
  workflows: N8nWorkflow[];
  stats: N8nSystemStats;
}> {
  try {
    const res = await fetch('/api/n8n/workflows');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch workflows`);
    }
    const data = await res.json();
    return {
      workflows: data.workflows || [],
      stats: data.stats || {
        totalWorkflows: 5,
        activeWorkflows: 5,
        totalExecutions: 391,
        totalErrors: 5,
        overallSuccessRate: 98.7,
        averageLatencyMs: 350,
        n8nInstanceHost: 'enjywork.app.n8n.cloud',
        lastHealthCheck: new Date().toISOString()
      }
    };
  } catch (err: any) {
    console.warn('Fallback to local workflow state:', err);
    return {
      workflows: [],
      stats: {
        totalWorkflows: 5,
        activeWorkflows: 5,
        totalExecutions: 391,
        totalErrors: 5,
        overallSuccessRate: 98.7,
        averageLatencyMs: 350,
        n8nInstanceHost: 'enjywork.app.n8n.cloud',
        lastHealthCheck: new Date().toISOString()
      }
    };
  }
}

export async function fetchN8nExecutionLogs(statusFilter: string = 'all', limit: number = 25): Promise<{
  executions: N8nExecutionLog[];
  totalCount: number;
  errorCount: number;
}> {
  try {
    const query = new URLSearchParams({ limit: String(limit), status: statusFilter });
    const res = await fetch(`/api/n8n/executions?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch execution logs`);
    }
    const data = await res.json();
    return {
      executions: data.executions || [],
      totalCount: data.totalCount || 0,
      errorCount: data.errorCount || 0
    };
  } catch (err) {
    console.warn('Execution logs fetch error:', err);
    return {
      executions: [],
      totalCount: 0,
      errorCount: 0
    };
  }
}

export async function triggerN8nWorkflowTest(params: {
  workflowId: string;
  payload: any;
  targetUrl?: string;
}): Promise<{
  success: boolean;
  execution: N8nExecutionLog;
}> {
  const res = await fetch('/api/n8n/test-trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Trigger failed');
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  return await res.json();
}

export async function analyzeN8nErrorWithAi(params: {
  errorMessage: string;
  nodeName?: string;
  payload?: any;
  httpStatus?: number;
}): Promise<N8nAutofixRemediation> {
  const res = await fetch('/api/n8n/autofix-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: Failed to generate AI autofix`);
  }

  const data = await res.json();
  return data.remediation;
}
