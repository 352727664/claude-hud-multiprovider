/**
 * Multi-Provider Usage Module
 * 支持 MiniMax、Kimi、DeepSeek 等厂商的用量查询
 * 支持从环境变量和配置文件中获取 API Key
 * 网络异常时保留缓存数据，不中断 HUD 显示
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { getHudPluginDir } from './claude-config-dir.js';

export interface ProviderUsage {
  provider: string;           // 'minimax' | 'kimi' | 'deepseek'
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
  /** 已充值余额（DeepSeek 等） */
  paid?: number;
  /** 赠送余额（DeepSeek 等） */
  gift?: number;
}

interface UsageCache {
  data: ProviderUsage[] | null;
  timestamp: number;
  hadData: boolean;         // 标记是否曾经成功获取过数据
}

let cache: UsageCache = {
  data: null,
  timestamp: 0,
  hadData: false,
};

const CACHE_TTL_MS = 60_000; // 1分钟缓存

// ============= API Key 多层查找 =============

interface ProviderKeys {
  minimax?: string;
  kimi?: string;
  deepseek?: string;
}

/**
 * 从 HudConfig 文件中读取 provider API Key 的配置
 */
function readProviderConfigFileRecord(): Record<string, string> {
  const configDir = getHudPluginDir(os.homedir());
  const configPath = path.join(configDir, 'config.json');

  try {
    if (!fs.existsSync(configPath)) return {};

    const raw = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as Record<string, unknown>;

    // 支持在 config.json 中配置 provider.apiKeys
    const providerConfig = config.provider as Record<string, unknown> | undefined;
    if (!providerConfig || typeof providerConfig !== 'object') return {};

    const apiKeys = (providerConfig as Record<string, unknown>).apiKeys as Record<string, string> | undefined;
    if (!apiKeys || typeof apiKeys !== 'object') return {};

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(apiKeys)) {
      if (typeof value === 'string' && value.length > 0) {
        result[key.toLowerCase()] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * 按优先级查找 API Key
 * 1. 环境变量
 * 2. config.json 中的 provider.apiKeys
 * 3. 传入的 inlineKeys（来自运行时加载的配置）
 */
async function getProviderKeys(inlineKeys?: Record<string, string>): Promise<ProviderKeys> {
  const keys: ProviderKeys = {};
  const configKeys = readProviderConfigFileRecord();
  // inlineKeys 优先于文件配置（因为可能已经由 loadConfig 解析过）
  const fileKeys = { ...configKeys, ...inlineKeys };

  // MiniMax
  const minimaxKey = process.env.MINIMAX_CODE_PLAN_KEY
    || fileKeys.minimax;
  if (minimaxKey?.startsWith('sk-cp-')) {
    keys.minimax = minimaxKey;
  }

  // Kimi (月之暗面)
  const kimiKey = process.env.KIMI_API_KEY
    || process.env.MOONSHOT_API_KEY
    || fileKeys.kimi;
  if (kimiKey) {
    keys.kimi = kimiKey;
  }

  // DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY
    || fileKeys.deepseek;
  if (deepseekKey) {
    keys.deepseek = deepseekKey;
  }

  return keys;
}

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

    if (!response.ok) {
      console.error(`[claude-hud] MiniMax API error: ${response.status} ${response.statusText}`);
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
      console.error('[claude-hud] MiniMax: no model_remains in response');
      return null;
    }

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
  } catch (err) {
    console.error('[claude-hud] MiniMax fetch error:', err instanceof Error ? err.message : err);
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

    if (!response.ok) {
      console.error(`[claude-hud] Kimi API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as { code?: number; data?: {
      available_balance: number;
      voucher_balance: number;
      cash_balance: number;
    } };

    if (!data || data.code !== 0 || !data.data) {
      console.error('[claude-hud] Kimi: unexpected response format');
      return null;
    }

    const { available_balance, voucher_balance, cash_balance } = data.data;

    return {
      provider: 'kimi',
      providerLabel: 'Kimi',
      consumed: 0,
      remaining: available_balance,
      unit: 'yuan',
    };
  } catch (err) {
    console.error('[claude-hud] Kimi fetch error:', err instanceof Error ? err.message : err);
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

    if (!response.ok) {
      console.error(`[claude-hud] DeepSeek API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json() as {
      is_available?: boolean;
      balance_infos?: Array<{
        currency: string;
        total_balance: string;
        granted_balance: string;
        topped_up_balance: string;
      }>;
    };

    if (!data || !data.is_available || !data.balance_infos || data.balance_infos.length === 0) {
      console.error('[claude-hud] DeepSeek: unexpected response format');
      return null;
    }

    const balanceInfo = data.balance_infos[0];
    const totalBalance = parseFloat(balanceInfo.total_balance) || 0;
    const grantedBalance = parseFloat(balanceInfo.granted_balance) || 0;
    const toppedUpBalance = parseFloat(balanceInfo.topped_up_balance) || 0;

    return {
      provider: 'deepseek',
      providerLabel: 'DeepSeek',
      consumed: 0,
      remaining: totalBalance,
      paid: toppedUpBalance,
      gift: grantedBalance,
      unit: 'yuan',
    };
  } catch (err) {
    console.error('[claude-hud] DeepSeek fetch error:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ============= 主函数 =============

/**
 * 获取所有已配置 provider 的用量数据
 * - 缓存有效期内直接返回缓存
 * - 并行查询所有 provider
 * - 网络异常时保留旧缓存，避免 HUD 闪烁
 */
export async function getProviderUsage(inlineApiKeys?: Record<string, string>): Promise<ProviderUsage[]> {
  const now = Date.now();

  // 缓存有效期内直接返回
  if (cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.data;
  }

  const keys = await getProviderKeys(inlineApiKeys);
  const results: ProviderUsage[] = [];

  // 并行获取所有 provider 的数据（每个 promise 独立 try-catch）
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
    // 成功获取到数据，更新缓存
    cache = { data: results, timestamp: now, hadData: true };
    return results;
  }

  // 没有结果但缓存中有历史数据 → 保留旧缓存（网络异常降级）
  if (cache.hadData && cache.data) {
    return cache.data;
  }

  // 无数据也无缓存
  return results;
}

// ============= 模型检测 =============

/**
 * 检测当前模型是否为已知的国产 Provider
 * @param modelId 模型名称
 * @param manualOverride 用户手动指定的 provider 名称（从 config 读取）
 */
export function detectProvider(modelId?: string, manualOverride?: string): string | null {
  // 手动指定优先级最高
  if (manualOverride) {
    const lower = manualOverride.toLowerCase();
    if (['minimax', 'kimi', 'deepseek'].includes(lower)) {
      return lower;
    }
  }

  if (!modelId) return null;
  const lower = modelId.toLowerCase();

  if (lower.includes('minimax') || lower.includes('minimax-m')) {
    return 'minimax';
  }
  if (lower.includes('kimi') || lower.includes('moonshot')) {
    return 'kimi';
  }
  if (lower.includes('deepseek')) {
    return 'deepseek';
  }

  return null;
}
