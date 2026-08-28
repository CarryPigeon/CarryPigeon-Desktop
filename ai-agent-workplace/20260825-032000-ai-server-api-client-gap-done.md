# 上线前服务端 API 客户端缺口核对

- 时间：20260825-032000
- 作者：ai
- 任务：server-api-client-gap
- 状态：done

## 任务目标

在客户端-服务端联调之后，对照服务端全部 HTTP/WS，找出客户端未实现或未接到产品路径的接口，供即将上线测试使用。

## 影响模块

- 只改桌面仓 `ai-agent-workplace/` 记录
- 不改服务端
- 不改客户端正式源码（本轮是核对，不是补功能）

## 允许修改范围

- `ai-agent-workplace/server-api-client-gap.md`
- `ai-agent-workplace/README.md`
- `ai-agent-workplace/joint-debug-findings.md` 追加索引

## 禁止边界

- 不改服务端任何文件
- 不把 reactions / 文件库补成服务端能力
- 不把 domain-only 邀请/搜索/转让强行接到客户端

## 治理文档

- 服务端 `docs/api/API.md`
- 服务端 `HttpRouteContractTests`
- 客户端 `contract-matrix.md`

## 验收标准

- 服务端 Controller 路由逐条对照客户端 adapter 与 UI 调用链
- 区分：已接通 / adapter 未接线 / 服务端未暴露 HTTP / 客户端多余 404
- 给出上线可测与不可测清单

## 结果

见 `server-api-client-gap.md`。
