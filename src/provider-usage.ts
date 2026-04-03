/**
 * Multi-Provider Coding Plan Usage Module
 * 支持 MiniMax、Kimi、火山引擎等多家的用量查询
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ProviderUsage {
  provider: string;           // 'minimax' | 'kimi' | 'volcengine'
  providerLabel: string;      // 显示名称
  consumed: number;           // 当前周期已消耗
  limit?: number;            // 限额（如果有）
  remaining?: number;        // 剩余（如果有）
  unit: string;              // 'requests' | 'tokens' | 'yuan'
  resetAt?: Date;           // 重置时间（如果有）
  weeklyConsumed?: number;   // 周已消耗（如果有）
  weeklyLimit?: number;     // 周限额（如果有）
  weeklyRemaining?: number; // 周剩余（如果有）
  weeklyResetAt?: Date;   // 周重置时间（如果有）
  intervalLabel?: string;    // 时间窗口标签，如 "5h"
}

// 缓存
interface UsageCache {
  data: ProviderUsage[] | null;
  timestamp: number;
}

let cache: UsageCache = {
  data: null,
  timestamp: 0,
};

const CACHE_TTL_MS = 60_000; // 1分钟缓存

// ============= MiniMax =============
async function fetchMinimaxUsage(apiKey: string): Promise<ProviderUsage | null> {
  const url = 'https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'MM-API-Source': 'Claude-HUD',
      },
    });

    if (!response.ok) return null;

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

    if (!data.model_remains || data.model_remains.length === 0) return null;

    const model = data.model_remains.find(m => m.model_name.includes('MiniMax-M')) ?? data.model_remains[0];
    const intervalRemaining = model.current_interval_usage_count;
    const intervalLimit = model.current_interval_total_count;
    const intervalConsumed = intervalLimit - intervalRemaining;
    const weeklyRemaining = model.current_weekly_usage_count;
    const weeklyLimit = model.current_weekly_total_count;
    const weeklyConsumed = weeklyLimit - weeklyRemaining;

    return {
      provider: 'minimax',
      providerLabel: 'MiniMax',
      consumed: intervalConsumed,
      limit: intervalLimit,
      remaining: intervalRemaining,
      unit: 'requests',
      resetAt: new Date(model.end_time),
      weeklyConsumed,
      weeklyLimit,
      weeklyRemaining,
      intervalLabel: '5h',
    };
  } catch {
    return null;
  }
}

// ============= Kimi (月之暗面) =============
async function fetchKimiUsage(apiKey: string): Promise<ProviderUsage | null> {
  const url = 'https://api.moonshot.cn/v1/users/me/balance';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { code?: number; data?: {
      available_balance: number;
      voucher_balance: number;
      cash_balance: number;
    } };

    if (!data || data.code !== 0 || !data.data) return null;

    const { available_balance, voucher_balance, cash_balance } = data.data;

    return {
      provider: 'kimi',
      providerLabel: 'Kimi',
      consumed: 0,
      remaining: available_balance,
      unit: 'yuan',
      // Kimi 没有限额概念，只有余额
    };
  } catch {
    return null;
  }
}

// ============= DeepSeek =============
async function fetchDeepSeekUsage(apiKey: string): Promise<ProviderUsage | null> {
  const url = 'https://api.deepseek.com/user/balance';

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = await response.json() as { is_available?: boolean; balance_infos?: Array<{
      currency: string;
      total_balance: string;
      granted_balance: string;
      topped_up_balance: string;
    }> };

    if (!data || !data.is_available || !data.balance_infos || data.balance_infos.length === 0) {
      return null;
    }

    const balanceInfo = data.balance_infos[0];
    const totalBalance = parseFloat(balanceInfo.total_balance) || 0;

    return {
      provider: 'deepseek',
      providerLabel: 'DeepSeek',
      consumed: 0,
      remaining: totalBalance,
      unit: 'yuan',
      // DeepSeek 没有限额概念，只有余额
    };
  } catch {
    return null;
  }
}

// ============= API Key 获取 =============
interface ProviderConfig {
  minimax?: string;
  kimi?: string;
  deepseek?: string;
}

async function getProviderKeys(): Promise<ProviderConfig> {
  const config: ProviderConfig = {};

  // MiniMax API Key
  const minimaxKey = process.env.MINIMAX_CODE_PLAN_KEY
    || process.env.ANTHROPIC_AUTH_TOKEN;
  if (minimaxKey?.startsWith('sk-cp-')) {
    config.minimax = minimaxKey;
  }

  // Kimi API Key
  const kimiKey = process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY;
  if (kimiKey?.startsWith('sk-')) {
    config.kimi = kimiKey;
  }

  // DeepSeek API Key
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey?.startsWith('sk-')) {
    config.deepseek = deepseekKey;
  }

  return config;
}

// ============= 主函数 =============
export async function getProviderUsage(): Promise<ProviderUsage[]> {
  const now = Date.now();

  // 检查缓存
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const keys = await getProviderKeys();
  const results: ProviderUsage[] = [];

  // 并行获取所有 provider 的数据
  const promises: Promise<void>[] = [];

  if (keys.minimax) {
    promises.push(
      fetchMinimaxUsage(keys.minimax).then(data => {
        if (data) results.push(data);
      })
    );
  }

  if (keys.kimi) {
    promises.push(
      fetchKimiUsage(keys.kimi).then(data => {
        if (data) results.push(data);
      })
    );
  }

  if (keys.deepseek) {
    promises.push(
      fetchDeepSeekUsage(keys.deepseek).then(data => {
        if (data) results.push(data);
      })
    );
  }

  await Promise.all(promises);

  if (results.length > 0) {
    cache = { data: results, timestamp: now };
  }

  return results;
}

// ============= 模型检测 =============
export function detectProvider(modelId?: string): string | null {
  if (!modelId) return null;
  const lower = modelId.toLowerCase();

  if (lower.includes('minimax') || lower.includes('minimax-m')) {
    return 'minimax';
  }
  if (lower.includes('kimi') || lower.includes('moonshot') || lower.includes('-kimi')) {
    return 'kimi';
  }
  if (lower.includes('deepseek')) {
    return 'deepseek';
  }

  return null;
}
