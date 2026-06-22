import { readStdin, getUsageFromStdin } from './stdin.js';
import { parseTranscript } from './transcript.js';
import { render } from './render/index.js';
import { countConfigs } from './config-reader.js';
import { getGitStatus } from './git.js';
import { loadConfig } from './config.js';
import { parseExtraCmdArg, runExtraCmd } from './extra-cmd.js';
import { getClaudeCodeVersion } from './version.js';
import { getMemoryUsage } from './memory.js';
import { getProviderUsage } from './provider-usage.js';
/**
 * Returns true when the HUD is disabled via the CLAUDE_HUD_DISABLE env var.
 * Supports: CLAUDE_HUD_DISABLE=1 / true / yes (disabled)
 *           CLAUDE_HUD_DISABLE=0 / false / off / no / '' (enabled)
 */
export declare function isHudDisabled(env?: NodeJS.ProcessEnv): boolean;
export type MainDeps = {
    readStdin: typeof readStdin;
    getUsageFromStdin: typeof getUsageFromStdin;
    parseTranscript: typeof parseTranscript;
    countConfigs: typeof countConfigs;
    getGitStatus: typeof getGitStatus;
    loadConfig: typeof loadConfig;
    parseExtraCmdArg: typeof parseExtraCmdArg;
    runExtraCmd: typeof runExtraCmd;
    getClaudeCodeVersion: typeof getClaudeCodeVersion;
    getMemoryUsage: typeof getMemoryUsage;
    getProviderUsage: typeof getProviderUsage;
    render: typeof render;
    now: () => number;
    log: (...args: unknown[]) => void;
};
export declare function main(overrides?: Partial<MainDeps>): Promise<void>;
export declare function formatSessionDuration(sessionStart?: Date, now?: () => number): string;
//# sourceMappingURL=index.d.ts.map