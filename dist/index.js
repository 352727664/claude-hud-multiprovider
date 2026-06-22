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
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
/**
 * Returns true when the HUD is disabled via the CLAUDE_HUD_DISABLE env var.
 * Supports: CLAUDE_HUD_DISABLE=1 / true / yes (disabled)
 *           CLAUDE_HUD_DISABLE=0 / false / off / no / '' (enabled)
 */
export function isHudDisabled(env = process.env) {
    const value = env.CLAUDE_HUD_DISABLE?.trim().toLowerCase();
    if (value === undefined || value === '') {
        return false;
    }
    return value !== '0' && value !== 'false' && value !== 'off' && value !== 'no';
}
export async function main(overrides = {}) {
    if (isHudDisabled()) {
        // Print nothing — skip all work for the ~300ms polling loop
        return;
    }
    const deps = {
        readStdin,
        getUsageFromStdin,
        parseTranscript,
        countConfigs,
        getGitStatus,
        loadConfig,
        parseExtraCmdArg,
        runExtraCmd,
        getClaudeCodeVersion,
        getMemoryUsage,
        getProviderUsage,
        render,
        now: () => Date.now(),
        log: console.log,
        ...overrides,
    };
    try {
        const stdin = await deps.readStdin();
        if (!stdin) {
            // Running without stdin - this happens during setup verification
            const isMacOS = process.platform === 'darwin';
            deps.log('[claude-hud] Initializing...');
            if (isMacOS) {
                deps.log('[claude-hud] Note: On macOS, you may need to restart Claude Code for the HUD to appear.');
            }
            return;
        }
        const transcriptPath = stdin.transcript_path ?? '';
        const transcript = await deps.parseTranscript(transcriptPath);
        const { claudeMdCount, rulesCount, mcpCount, hooksCount } = await deps.countConfigs(stdin.cwd);
        const config = await deps.loadConfig();
        const gitStatus = config.gitStatus.enabled
            ? await deps.getGitStatus(stdin.cwd)
            : null;
        // Usage comes only from Claude Code's official stdin rate_limits fields.
        let usageData = null;
        if (config.display.showUsage !== false) {
            usageData = deps.getUsageFromStdin(stdin);
        }
        // Provider usage - fetched for all configured providers
        const providerApiKeys = config.provider?.apiKeys;
        const providerUsage = await deps.getProviderUsage(providerApiKeys);
        const extraCmd = deps.parseExtraCmdArg();
        const extraLabel = extraCmd ? await deps.runExtraCmd(extraCmd) : null;
        const sessionDuration = formatSessionDuration(transcript.sessionStart, deps.now);
        const claudeCodeVersion = config.display.showClaudeCodeVersion
            ? await deps.getClaudeCodeVersion()
            : undefined;
        const memoryUsage = config.display.showMemoryUsage && config.lineLayout === 'expanded'
            ? await deps.getMemoryUsage()
            : null;
        const ctx = {
            stdin,
            transcript,
            claudeMdCount,
            rulesCount,
            mcpCount,
            hooksCount,
            sessionDuration,
            gitStatus,
            usageData,
            memoryUsage,
            providerUsage,
            config,
            extraLabel,
            claudeCodeVersion,
        };
        deps.render(ctx);
    }
    catch (error) {
        deps.log('[claude-hud] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
}
export function formatSessionDuration(sessionStart, now = () => Date.now()) {
    if (!sessionStart) {
        return '';
    }
    const ms = now() - sessionStart.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1)
        return '<1m';
    if (mins < 60)
        return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
}
const scriptPath = fileURLToPath(import.meta.url);
const argvPath = process.argv[1];
const isSamePath = (a, b) => {
    try {
        return realpathSync(a) === realpathSync(b);
    }
    catch {
        return a === b;
    }
};
if (argvPath && isSamePath(argvPath, scriptPath)) {
    void main();
}
//# sourceMappingURL=index.js.map