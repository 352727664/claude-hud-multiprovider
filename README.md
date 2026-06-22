# Claude HUD (Multi-Provider)

基于 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 的 Claude Code 插件，在原版基础上增加了**多平台用量显示**功能，并进行了多项稳定性与体验优化。

**支持的平台**: MiniMax、Kimi (月之暗面)、DeepSeek

---

## 功能特性

### 多厂商用量显示
- **MiniMax** — 显示 5 小时窗口配额 + 周配额，含进度条与重置倒计时
- **Kimi (月之暗面)** — 显示账户余额（元），余额过低时自动变色警告
- **DeepSeek** — 显示总余额，并拆分充值余额与赠送余额

### 稳定性增强
- **`CLAUDE_HUD_DISABLE` 环境变量** — 设置 `CLAUDE_HUD_DISABLE=1 claude` 可完全静默 HUD，无需卸载插件
- **网络异常缓存保留** — API 查询失败时保留上一次成功数据继续显示，避免 HUD 闪烁或消失
- **Provider 隔离** — 一个厂商 API 异常不影响其他厂商的数据获取
- **错误日志** — 每个厂商的 API 错误输出到 `console.error`，方便排查

### 配置灵活
- **API Key 多层查找** — 环境变量 → `config.json` 中 `provider.apiKeys`，按优先级自动选取
- **手动指定 Provider** — 在配置中设置 `provider.name` 覆盖自动检测，适用于自定义模型名
- **余额阈值配置** — 自由设置警告色（默认 10 元）和危险色（默认 5 元）阈值

---

## 效果预览

```
[DeepSeek V4 Flash] │ my-project git:(main)
Context ███░░░░░░░ 29% │ DeepSeek ¥58.20 (充¥50.00 赠¥8.20)
2 CLAUDE.md | 4 rules | 2 MCPs | 3 hooks

[MiniMax-M2.7] │ my-project git:(main)
Context ░░░░░░░░░ 0% │ MiniMax ██░░░░░░░░ 7% (1400 left, 3h 35m) | ███░░░░░░ 30% (10471 left, 2d 3h)

[Kimi] │ my-project git:(main)
Context ██░░░░░░░░ 15% │ Kimi 余额 ¥5.30    ← 余额低于 10 元显示黄色警告
```

---

## 安装

### 前提条件

- Claude Code v1.0.80+
- Node.js 18+ 或 Bun

### 步骤

**1. 安装插件（通过 Claude Code Marketplace）**

```
/plugin marketplace add jarrodwatts/claude-hud
/plugin install claude-hud
```

> 如果你的 fork 已发布到 marketplace，可直接替换为你的 marketplace 地址。

**2. 配置状态栏**

```
/claude-hud:setup
```

重启 Claude Code 后，HUD 即会出现在输入框下方。

**3. 设置 API Key**

HUD 会按以下优先级自动查找各厂商的 API Key：

| 厂商 | 环境变量 | `config.json` 配置 |
|------|---------|-------------------|
| MiniMax | `MINIMAX_CODE_PLAN_KEY` | `provider.apiKeys.minimax` |
| Kimi | `KIMI_API_KEY` 或 `MOONSHOT_API_KEY` | `provider.apiKeys.kimi` |
| DeepSeek | `DEEPSEEK_API_KEY` | `provider.apiKeys.deepseek` |

**推荐方式：通过环境变量设置**

```bash
# 在 ~/.zshrc 或 ~/.bashrc 中添加
export DEEPSEEK_API_KEY="sk-your-deepseek-key"
export MINIMAX_CODE_PLAN_KEY="sk-cp-your-minimax-key"
```

**或通过配置文件设置**

编辑 `~/.claude/plugins/claude-hud/config.json`:

```json
{
  "provider": {
    "apiKeys": {
      "deepseek": "sk-your-deepseek-key",
      "minimax": "sk-cp-your-minimax-key",
      "kimi": "your-kimi-key"
    }
  }
}
```

---

## 配置

插件配置文件位于 `~/.claude/plugins/claude-hud/config.json`。

### 全部配置项

#### Provider 配置

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `provider.name` | `""` | 手动指定 provider 名称，优先级高于自动检测（可选值: `minimax`, `kimi`, `deepseek`）|
| `provider.balanceWarning` | `10` | 余额低于此值时显示黄色警告 |
| `provider.balanceCritical` | `5` | 余额低于此值时显示红色危险 |
| `provider.apiKeys` | `{}` | 各厂商的 API Key 配置对象 |

#### 显示配置

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `display.showUsage` | `true` | 显示用量信息 |
| `display.usageBarEnabled` | `true` | 用量显示为进度条 |
| `display.usageThreshold` | `0` | 显示用量的最低阈值 |
| `display.sevenDayThreshold` | `80` | 显示周用量百分比阈值 |
| `display.showTools` | `false` | 显示工具活动行 |
| `display.showAgents` | `false` | 显示 Agent 状态行 |
| `display.showTodos` | `false` | 显示 Todo 进度行 |
| `display.showDuration` | `false` | 显示会话持续时间 |
| `display.showConfigCounts` | `false` | 显示配置计数（CLAUDE.md、规则、MCP、钩子）|

### 颜色自定义

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `colors.context` | `green` | Context 进度条颜色 |
| `colors.usage` | `brightBlue` | 用量条颜色 |
| `colors.warning` | `yellow` | 警告色 |
| `colors.usageWarning` | `brightMagenta` | 用量警告色 |
| `colors.critical` | `red` | 满额/超限颜色 |
| `colors.model` | `cyan` | 模型名称颜色 |
| `colors.project` | `yellow` | 项目路径颜色 |

支持的颜色值：`dim`, `red`, `green`, `yellow`, `magenta`, `cyan`, `brightBlue`, `brightMagenta`，256 色编号 (`0-255`)，或十六进制 (`#rrggbb`)。

### 示例配置

```json
{
  "provider": {
    "name": "deepseek",
    "balanceWarning": 20,
    "balanceCritical": 10
  },
  "display": {
    "showUsage": true,
    "showDuration": true,
    "showConfigCounts": true,
    "showTools": true,
    "showAgents": true,
    "showTodos": true
  },
  "colors": {
    "context": "cyan",
    "usage": "cyan",
    "warning": "yellow",
    "critical": "red",
    "model": "cyan"
  }
}
```

---

## 临时禁用 HUD

无需从 settings.json 中移除配置，设置环境变量即可完全静默：

```bash
# 禁用 HUD
CLAUDE_HUD_DISABLE=1 claude

# 禁用值: 1, true, yes, on
# 启用值: 0, false, off, no, 或不设置
```

---

## 代码结构

```
src/
├── index.ts            # 入口 + CLAUDE_HUD_DISABLE 检测
├── provider-usage.ts   # 多厂商用量查询引擎
├── stdin.ts            # Claude Code stdin 解析
├── config.ts           # 配置加载与合并
├── types.ts            # 类型定义
├── render/
│   └── lines/
│       └── usage.ts    # 用量渲染（含余额颜色警告）
└── ...
```

---

## 开发

```bash
git clone https://github.com/352727664/claude-hud-multiprovider
cd claude-hud-multiprovider
npm ci
npm run build

# 测试 HUD 输出
echo '{"model":{"id":"deepseek-v4-flash","display_name":"DeepSeek V4 Flash"},"context_window":{"current_usage":{"input_tokens":45000},"context_window_size":200000},"transcript_path":"/tmp/test.jsonl"}' | node dist/index.js
```

---

## 优化记录

| 版本 | 优化内容 |
|------|---------|
| 0.0.11 | 添加 `CLAUDE_HUD_DISABLE` 环境变量支持 |
| 0.0.11 | 网络异常时保留缓存数据，不中断 HUD 显示 |
| 0.0.11 | API Key 多层查找（环境变量 + 配置文件） |
| 0.0.11 | 手动指定 provider 覆盖自动检测 |
| 0.0.11 | 余额阈值颜色警告（黄色/红色） |
| 0.0.11 | DeepSeek 显示充值/赠送余额拆分 |
| 0.0.11 | Provider 错误独立日志输出 |
| 0.0.10 | 初始 Multi-Provider 版本（MiniMax、Kimi、DeepSeek） |

---

## 致谢

本项目基于 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 开发。

感谢原作者 [Jarrod Watts](https://github.com/jarrodwatts) 创建了这么好用的 HUD 插件。

## License

MIT