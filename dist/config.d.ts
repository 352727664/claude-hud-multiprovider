export type LineLayoutType = 'compact' | 'expanded';
export type AutocompactBufferMode = 'enabled' | 'disabled';
export type ContextValueMode = 'percent' | 'tokens' | 'remaining' | 'both';
export type HudElement = 'project' | 'context' | 'usage' | 'memory' | 'environment' | 'tools' | 'agents' | 'todos';
export type HudColorName = 'dim' | 'red' | 'green' | 'yellow' | 'magenta' | 'cyan' | 'brightBlue' | 'brightMagenta';
/** A color value: named preset, 256-color index (0-255), or hex string (#rrggbb). */
export type HudColorValue = HudColorName | number | string;
export interface HudColorOverrides {
    context: HudColorValue;
    usage: HudColorValue;
    warning: HudColorValue;
    usageWarning: HudColorValue;
    critical: HudColorValue;
    model: HudColorValue;
    project: HudColorValue;
    git: HudColorValue;
    gitBranch: HudColorValue;
    label: HudColorValue;
    custom: HudColorValue;
}
export declare const DEFAULT_ELEMENT_ORDER: HudElement[];
export interface HudConfig {
    lineLayout: LineLayoutType;
    showSeparators: boolean;
    pathLevels: 1 | 2 | 3;
    elementOrder: HudElement[];
    gitStatus: {
        enabled: boolean;
        showDirty: boolean;
        showAheadBehind: boolean;
        showFileStats: boolean;
    };
    provider: {
        /** 手动指定 provider 名称，优先级高于自动检测 */
        name?: string;
        /** 阈值：余额低于此值时显示警告色 */
        balanceWarning: number;
        /** 阈值：余额低于此值时显示危险色 */
        balanceCritical: number;
        /** API Keys 配置文件（可选，也可用环境变量） */
        apiKeys?: Record<string, string>;
    };
    display: {
        showModel: boolean;
        showProject: boolean;
        showContextBar: boolean;
        contextValue: ContextValueMode;
        showConfigCounts: boolean;
        showDuration: boolean;
        showSpeed: boolean;
        showTokenBreakdown: boolean;
        showUsage: boolean;
        usageBarEnabled: boolean;
        showTools: boolean;
        showAgents: boolean;
        showTodos: boolean;
        showSessionName: boolean;
        showClaudeCodeVersion: boolean;
        showMemoryUsage: boolean;
        autocompactBuffer: AutocompactBufferMode;
        usageThreshold: number;
        sevenDayThreshold: number;
        environmentThreshold: number;
        customLine: string;
    };
    colors: HudColorOverrides;
}
export declare const DEFAULT_CONFIG: HudConfig;
export declare function getConfigPath(): string;
export declare function mergeConfig(userConfig: Partial<HudConfig>): HudConfig;
export declare function loadConfig(): Promise<HudConfig>;
//# sourceMappingURL=config.d.ts.map