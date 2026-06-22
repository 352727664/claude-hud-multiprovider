# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 (2026-06-22)

### 🚀 Features

- **多厂商用量查询引擎** — 支持 MiniMax、Kimi (月之暗面)、DeepSeek 用量实时显示
- **`CLAUDE_HUD_DISABLE` 环境变量** — 设置 `CLAUDE_HUD_DISABLE=1` 即可静默禁用 HUD，无需卸载
- **API Key 多层查找** — 环境变量 → `config.json` `provider.apiKeys` 按优先级自动选取
- **手动指定 Provider** — 在配置中设置 `provider.name` 覆盖自动检测，适用于自定义模型名
- **余额阈值颜色警告** — 余额低于配置阈值时自动显示黄色（警告）或红色（危险）
- **DeepSeek 充值/赠送拆分** — 显示 `¥总余额 (充¥X 赠¥Y)` 明细

### 🔧 Improvements

- **网络异常缓存保留** — API 查询失败时保留上一次成功结果，避免 HUD 闪烁或消失
- **Provider 错误隔离** — 一个厂商 API 异常不影响其他厂商数据获取
- **独立错误日志** — 各厂商 API 错误分别输出 `console.error`，方便排查
- **Provider 配置节** — 配置文件中新增 `provider` 配置节

### 🐛 Bug Fixes

- 修复 `0.0.10` 版本中部分 TypeScript 类型定义不严谨的问题
- 修复网络请求失败时缓存策略过于激进（完全清空）的问题

### 🔒 Security

- API Key 优先读取配置文件而非仅依赖环境变量，减少子进程继承泄露风险

---

## 0.0.11 (Unreleased)

初始 Multi-Provider 分支创建。

### Features

- 支持 MiniMax Coding Plan 用量查询
- 支持 Kimi (月之暗面) 账户余额查询
- 支持 DeepSeek 账户余额查询
- Provider 自动检测（根据 model ID）
- 基于 jarrodwatts/claude-hud v0.0.10

---

## 0.0.10

原始 jarrodwatts/claude-hud 发布版本。见 [CHANGELOG.md](https://github.com/jarrodwatts/claude-hud/blob/main/CHANGELOG.md)。