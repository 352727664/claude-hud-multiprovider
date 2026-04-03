# Claude HUD (MiniMax Edition)

基于 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 的 Claude Code 插件，在原版基础上增加了 **MiniMax Coding Plan 用量显示**功能。

当使用 MiniMax 模型时，HUD 会实时显示当前周期的请求配额使用情况。

![MiniMax Usage](https://img.shields.io/badge/MiniMax-Usage%20Display-blue)

## 功能特性

- **Context 健康度** - 实时显示上下文窗口使用比例
- **Model 显示** - 显示当前使用的模型名称
- **Git 状态** - 显示当前分支和提交状态
- **MiniMax 用量** - 使用 MiniMax 模型时显示配额余量
  - 5小时窗口已用/限额/剩余
  - 周配额已用/限额/剩余
  - 自动重置时间

## 效果预览

```
[MiniMax-M2.7] │ my-project git:(main)
Context ░░░░░░░░░ 0% │ MiniMax ██░░░░░░░░ 7% (1400 left, 3h 35m) | ███░░░░░░ 30% (10471 left, 2d 3h)
```

## 安装

### 前提条件

- Claude Code v1.0.80+
- Node.js 18+ 或 Bun
- MiniMax Coding Plan API Key

### 步骤

**1. 安装插件**

```bash
/plugin marketplace add jarrodwatts/claude-hud
/plugin install claude-hud
```

**2. 配置状态栏**

```
/claude-hud:setup
```

**3. 设置 MiniMax API Key**

HUD 会自动从以下位置查找 API Key（按优先级）：

1. 环境变量 `MINIMAX_CODE_PLAN_KEY`
2. 环境变量 `ANTHROPIC_AUTH_TOKEN`
3. `~/.openclaw/openclaw.json` 中的 `minimaxCodePlanKey` 字段
4. `~/.config/minimax-code-plan/key`

推荐设置环境变量：

```bash
# 在 ~/.zshrc 或 ~/.bashrc 中添加
export MINIMAX_CODE_PLAN_KEY="sk-cp-your-key-here"
```

**4. 重启 Claude Code**

完全退出并重新启动，HUD 将自动检测 MiniMax 模型并显示用量。

## 配置

插件配置文件位于 `~/.claude/plugins/claude-hud/config.json`。

### 可用配置项

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `display.showUsage` | `true` | 显示用量信息 |
| `display.usageBarEnabled` | `true` | 用量显示为进度条 |
| `display.usageThreshold` | `0` | 显示用量的最低阈值 |
| `display.sevenDayThreshold` | `80` | 显示周用量百分比阈值 |

### 颜色自定义

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `colors.context` | `green` | Context 进度条颜色 |
| `colors.usage` | `brightBlue` | 用量条颜色 |
| `colors.warning` | `yellow` | 警告色 |
| `colors.critical` | `red` | 满额/超限颜色 |

支持的颜色：`dim`, `red`, `green`, `yellow`, `magenta`, `cyan`, `brightBlue`, `brightMagenta`，或使用 256 色编号 (`0-255`) 或十六进制 (`#rrggbb`)。

## 故障排除

**MiniMax 用量不显示？**

1. 确认当前使用的是 MiniMax 模型（非 Anthropic Claude 模型）
2. 确认 API Key 配置正确且有效
3. 检查 Claude Code 是否正常获取到 MiniMax 模型的用量数据

**用量数据不准确？**

MiniMax API 返回的是实时配额数据，如有疑问可访问 [MiniMax Dashboard](https://platform.minimaxi.com) 核实。

## 开发

```bash
git clone https://github.com/your-username/claude-hud-minimax
cd claude-hud
npm ci
npm run build
```

### 测试

```bash
# 测试 MiniMax 用量模块
node -e "import('./dist/minimax-usage.js').then(m => m.getMinimaxUsage().then(r => console.log(JSON.stringify(r, null, 2))))"

# 测试 HUD 输出
echo '{"model":{"id":"MiniMax-M2.7"}}' | node dist/index.js
```

## 致谢

本项目基于 [jarrodwatts/claude-hud](https://github.com/jarrodwatts/claude-hud) 开发。

感谢原作者 [Jarrod Watts](https://github.com/jarrodwatts) 创建了这么好用的 HUD 插件。

## License

MIT
