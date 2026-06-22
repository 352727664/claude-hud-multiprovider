/**
 * Multi-Provider Usage Module
 * 支持 MiniMax、Kimi、DeepSeek 等厂商的用量查询
 * 支持从环境变量和配置文件中获取 API Key
 * 网络异常时保留缓存数据，不中断 HUD 显示
 */
export interface ProviderUsage {
    provider: string;
    providerLabel: string;
    consumed: number;
    limit?: number;
    remaining?: number;
    unit: string;
    resetAt?: Date;
    weeklyConsumed?: number;
    weeklyLimit?: number;
    weeklyRemaining?: number;
    weeklyResetAt?: Date;
    intervalLabel?: string;
    /** 已充值余额（DeepSeek 等） */
    paid?: number;
    /** 赠送余额（DeepSeek 等） */
    gift?: number;
}
/**
 * 获取所有已配置 provider 的用量数据
 * - 缓存有效期内直接返回缓存
 * - 并行查询所有 provider
 * - 网络异常时保留旧缓存，避免 HUD 闪烁
 */
export declare function getProviderUsage(inlineApiKeys?: Record<string, string>): Promise<ProviderUsage[]>;
/**
 * 检测当前模型是否为已知的国产 Provider
 * @param modelId 模型名称
 * @param manualOverride 用户手动指定的 provider 名称（从 config 读取）
 */
export declare function detectProvider(modelId?: string, manualOverride?: string): string | null;
//# sourceMappingURL=provider-usage.d.ts.map