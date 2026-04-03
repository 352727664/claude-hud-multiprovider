/**
 * MiniMax Coding Plan 用量获取模块
 * 直接调用 MiniMax API 获取当前用量，不依赖外部 JSON
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// 缓存
interface MiniMaxUsageCache {
  data: MiniMaxUsage | null;
  timestamp: number;
}

let cache: MiniMaxUsageCache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60_000; // 1分钟缓存

export interface MiniMaxUsage {
  intervalConsumed: number;      // 当前周期已用请求数
  intervalLimit: number;        // 当前周期限额
  intervalRemaining: number;     // 当前周期剩余
  intervalResetAt: Date;        // 当前周期重置时间
  weeklyConsumed: number;       // 本周已用请求数
  weeklyLimit: number;          // 本周限额
  weeklyRemaining: number;      // 本周剩余
  weeklyResetAt: Date;          // 本周重置时间
  estimatedTokens: number;      // 估算 tokens (5h窗口)
  estimatedWeeklyTokens: number; // 估算 tokens (周)
}

export interface MiniMaxSubscriptionSnapshot {
  subscription: {
    planLabel: string;
    consumed: number;
    limit: number;
    remaining: number;
    unit: string;
    cycleStart: string;
    cycleEnd: string;
    resetAt: string;
    secondaryPlanLabel: string;
    secondaryConsumed: number;
    secondaryLimit: number;
    secondaryRemaining: number;
    secondaryCycleStart: string;
    secondaryCycleEnd: string;
    secondaryResetAt: string;
    estimatedTokens: number;
    estimatedWeeklyTokens: number;
  };
  meta: {
    source: string;
    fetchedAt: string;
    estimatedTps: number;
    estimatedAvgResponseSeconds: number;
  };
}

/**
 * 获取 MiniMax Coding Plan API Key
 * 优先级：环境变量 > openclaw config > MiniMax config
 */
async function getMinimaxApiKey(): Promise<string | null> {
  // 1. 环境变量 MINIMAX_CODE_PLAN_KEY
  const envKey = process.env.MINIMAX_CODE_PLAN_KEY;
  if (envKey) return envKey;

  // 2. ANTHROPIC_AUTH_TOKEN (Claude Code settings.json 常用这个存 MiniMax key)
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN;
  if (authToken && authToken.startsWith('sk-cp-')) return authToken;

  // 3. openclaw config: ~/.openclaw/openclaw.json
  try {
    const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    if (fs.existsSync(openclawConfigPath)) {
      const content = fs.readFileSync(openclawConfigPath, 'utf-8');
      const config = JSON.parse(content);
      const key = config.minimaxCodePlanKey ?? config.minimax_code_plan_key ?? config.MINIMAX_CODE_PLAN_KEY;
      if (key && typeof key === 'string' && key.startsWith('sk-cp-')) {
        return key;
      }
    }
  } catch {
    // ignore
  }

  // 4. MiniMax config: ~/.config/minimax-code-plan/key
  try {
    const minimaxConfigPath = path.join(os.homedir(), '.config', 'minimax-code-plan', 'key');
    if (fs.existsSync(minimaxConfigPath)) {
      const key = fs.readFileSync(minimaxConfigPath, 'utf-8').trim();
      if (key.startsWith('sk-cp-')) {
        return key;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * 调用 MiniMax API 获取用量
 */
async function fetchMinimaxUsageFromApi(apiKey: string): Promise<MiniMaxUsage | null> {
  const url = 'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains';
  const estimatedTps = Number(process.env.MINIMAX_ESTIMATED_TPS ?? '50');
  const estimatedAvgResponseSeconds = Number(process.env.MINIMAX_AVG_RESPONSE_SECONDS ?? '3');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'MM-API-Source': 'Claude-HUD',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as { model_remains?: Array<{
      current_interval_usage_count: number;
      current_interval_total_count: number;
      remains_time: number;
      current_weekly_usage_count: number;
      current_weekly_total_count: number;
      model_name: string;
      start_time: number;
      end_time: number;
      weekly_start_time: number;
      weekly_end_time: number;
    }> };

    if (!data.model_remains || data.model_remains.length === 0) {
      return null;
    }

    // 使用第一个模型（通常是 MiniMax-M*）
    const model = data.model_remains.find(m => m.model_name.includes('MiniMax-M')) ?? data.model_remains[0];

    // current_interval_usage_count 实际上是剩余配额
    const intervalRemaining = model.current_interval_usage_count;
    const intervalLimit = model.current_interval_total_count;
    const intervalConsumed = intervalLimit - intervalRemaining;

    const weeklyRemaining = model.current_weekly_usage_count;
    const weeklyLimit = model.current_weekly_total_count;
    const weeklyConsumed = weeklyLimit - weeklyRemaining;

    // 估算 tokens: requests × seconds × TPS
    const estimatedTokens = Math.round(intervalConsumed * estimatedAvgResponseSeconds * estimatedTps);
    const estimatedWeeklyTokens = Math.round(weeklyConsumed * estimatedAvgResponseSeconds * estimatedTps);

    return {
      intervalConsumed,
      intervalLimit,
      intervalRemaining,
      intervalResetAt: new Date(model.end_time),
      weeklyConsumed,
      weeklyLimit,
      weeklyRemaining,
      weeklyResetAt: new Date(model.weekly_end_time),
      estimatedTokens,
      estimatedWeeklyTokens,
    };
  } catch {
    return null;
  }
}

/**
 * 获取 MiniMax 用量（带缓存）
 */
export async function getMinimaxUsage(): Promise<MiniMaxUsage | null> {
  const now = Date.now();

  // 检查缓存
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const apiKey = await getMinimaxApiKey();
  if (!apiKey) {
    return null;
  }

  const data = await fetchMinimaxUsageFromApi(apiKey);
  if (data) {
    cache = { data, timestamp: now };
  }

  return data;
}

/**
 * 判断是否 MiniMax 模型
 */
export function isMinimaxModel(modelId?: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return lower.includes('minimax') || lower.includes('minimax-m');
}

/**
 * 格式化配额显示
 */
export function formatQuota(used: number, limit: number, remaining: number): string {
  return `${used}/${limit} (${remaining} left)`;
}
