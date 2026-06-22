import { isLimitReached } from '../../types.js';
import { getProviderLabel } from '../../stdin.js';
import { critical, label, resolveAnsi, getQuotaColor, quotaBar, RESET, RED, YELLOW } from '../colors.js';
import { getAdaptiveBarWidth } from '../../utils/terminal.js';
import { detectProvider } from '../../provider-usage.js';
export function renderUsageLine(ctx) {
    const display = ctx.config?.display;
    const colors = ctx.config?.colors;
    if (display?.showUsage === false) {
        return null;
    }
    // Check if using a known provider model (manual override > auto detect)
    const modelId = ctx.stdin.model?.id;
    const manualProvider = ctx.config.provider?.name;
    const provider = detectProvider(modelId, manualProvider);
    // If we have provider usage data, show it
    if (provider && ctx.providerUsage && ctx.providerUsage.length > 0) {
        // Find usage for the current provider
        const currentProviderUsage = ctx.providerUsage.find(p => p.provider === provider);
        if (currentProviderUsage) {
            return renderProviderUsage(ctx, currentProviderUsage);
        }
    }
    // Fallback to Claude's own rate limits
    if (!ctx.usageData) {
        return null;
    }
    if (getProviderLabel(ctx.stdin)) {
        return null;
    }
    const usageLabel = label('Usage', colors);
    if (isLimitReached(ctx.usageData)) {
        const resetTime = ctx.usageData.fiveHour === 100
            ? formatResetTime(ctx.usageData.fiveHourResetAt)
            : formatResetTime(ctx.usageData.sevenDayResetAt);
        return `${usageLabel} ${critical(`⚠ Limit reached${resetTime ? ` (resets ${resetTime})` : ''}`, colors)}`;
    }
    const threshold = display?.usageThreshold ?? 0;
    const fiveHour = ctx.usageData.fiveHour;
    const sevenDay = ctx.usageData.sevenDay;
    const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);
    if (effectiveUsage < threshold) {
        return null;
    }
    const usageBarEnabled = display?.usageBarEnabled ?? true;
    const sevenDayThreshold = display?.sevenDayThreshold ?? 80;
    const barWidth = getAdaptiveBarWidth();
    if (fiveHour === null && sevenDay !== null) {
        const weeklyOnlyPart = formatUsageWindowPart({
            label: '7d',
            percent: sevenDay,
            resetAt: ctx.usageData.sevenDayResetAt,
            colors,
            usageBarEnabled,
            barWidth,
            forceLabel: true,
        });
        return `${usageLabel} ${weeklyOnlyPart}`;
    }
    const fiveHourPart = formatUsageWindowPart({
        label: '5h',
        percent: fiveHour,
        resetAt: ctx.usageData.fiveHourResetAt,
        colors,
        usageBarEnabled,
        barWidth,
    });
    if (sevenDay !== null && sevenDay >= sevenDayThreshold) {
        const sevenDayPart = formatUsageWindowPart({
            label: '7d',
            percent: sevenDay,
            resetAt: ctx.usageData.sevenDayResetAt,
            colors,
            usageBarEnabled,
            barWidth,
        });
        return `${usageLabel} ${fiveHourPart} | ${sevenDayPart}`;
    }
    return `${usageLabel} ${fiveHourPart}`;
}
function renderProviderUsage(ctx, usage) {
    const colors = ctx.config?.colors;
    const barWidth = getAdaptiveBarWidth();
    const usageLabel = label(usage.providerLabel, colors);
    const prov = ctx.config.provider;
    const warningThreshold = prov?.balanceWarning ?? 10;
    const criticalThreshold = prov?.balanceCritical ?? 5;
    function getBalanceColor(balance) {
        if (balance <= criticalThreshold)
            return resolveAnsi(colors?.critical, RED);
        if (balance <= warningThreshold)
            return resolveAnsi(colors?.warning, YELLOW);
        return '';
    }
    // MiniMax: 显示 5h 窗口 + 周
    if (usage.provider === 'minimax' && usage.limit && usage.remaining !== undefined) {
        const intervalPercent = Math.round((usage.consumed / usage.limit) * 100);
        const intervalColor = getQuotaColor(intervalPercent, colors);
        const intervalReset = formatResetTime(usage.resetAt ?? null);
        const intervalBar = `${intervalColor}${quotaBar(intervalPercent, barWidth, colors)}${RESET}`;
        const intervalText = `${intervalColor}${intervalPercent}%${RESET} (${usage.remaining} left${intervalReset ? `, ${intervalReset}` : ''})`;
        let result = `${usageLabel} ${intervalBar} ${intervalText}`;
        // Weekly if available
        if (usage.weeklyLimit && usage.weeklyRemaining !== undefined) {
            const weeklyPercent = Math.round((usage.weeklyConsumed / usage.weeklyLimit) * 100);
            const weeklyColor = getQuotaColor(weeklyPercent, colors);
            const weeklyReset = formatResetTime(usage.weeklyResetAt ?? null);
            const weeklyBar = `${weeklyColor}${quotaBar(weeklyPercent, barWidth, colors)}${RESET}`;
            const weeklyText = `${weeklyColor}${weeklyPercent}%${RESET} (${usage.weeklyRemaining} left${weeklyReset ? `, ${weeklyReset}` : ''})`;
            result += ` | ${weeklyBar} ${weeklyText}`;
        }
        return result;
    }
    // Kimi: 显示余额(元)
    if (usage.provider === 'kimi' && usage.remaining !== undefined) {
        const remaining = usage.remaining;
        const balanceColor = getBalanceColor(remaining);
        const balanceText = balanceColor
            ? `${balanceColor}¥${remaining.toFixed(2)}${RESET}`
            : `¥${remaining.toFixed(2)}`;
        return `${usageLabel} 余额 ${balanceText}`;
    }
    // DeepSeek: 显示总余额 + 付费/赠送拆分
    if (usage.provider === 'deepseek' && usage.remaining !== undefined) {
        const remaining = usage.remaining;
        const balanceColor = getBalanceColor(remaining);
        const balanceText = balanceColor
            ? `${balanceColor}¥${remaining.toFixed(2)}${RESET}`
            : `¥${remaining.toFixed(2)}`;
        // 如果有付费/赠送数据，显示明细
        if (usage.paid !== undefined && usage.gift !== undefined) {
            const paidText = `¥${usage.paid.toFixed(2)}`;
            const giftText = `¥${usage.gift.toFixed(2)}`;
            return `${usageLabel} ${balanceText} (充${paidText} 赠${giftText})`;
        }
        return `${usageLabel} 余额 ${balanceText}`;
    }
    // Fallback
    return `${usageLabel} ${usage.consumed}`;
}
function formatUsagePercent(percent, colors) {
    if (percent === null) {
        return label('--', colors);
    }
    const color = getQuotaColor(percent, colors);
    return `${color}${percent}%${RESET}`;
}
function formatUsageWindowPart({ label: labelText, percent, resetAt, colors, usageBarEnabled, barWidth, forceLabel = false, }) {
    const usageDisplay = formatUsagePercent(percent, colors);
    const reset = formatResetTime(resetAt);
    if (usageBarEnabled) {
        const body = reset
            ? `${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay} (resets in ${reset})`
            : `${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay}`;
        return forceLabel ? `${labelText}: ${body}` : body;
    }
    return reset
        ? `${labelText}: ${usageDisplay} (resets in ${reset})`
        : `${labelText}: ${usageDisplay}`;
}
function formatResetTime(resetAt) {
    if (!resetAt)
        return '';
    const now = new Date();
    const diffMs = resetAt.getTime() - now.getTime();
    if (diffMs <= 0)
        return '';
    const diffMins = Math.ceil(diffMs / 60000);
    if (diffMins < 60)
        return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        if (remHours > 0)
            return `${days}d ${remHours}h`;
        return `${days}d`;
    }
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
//# sourceMappingURL=usage.js.map