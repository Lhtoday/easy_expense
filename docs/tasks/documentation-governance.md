# 文档治理与编码

## 目标

保持项目文档可读、及时、使用 UTF-8 编码，并同时服务人工维护和 AI 协作。

## 业务背景

ExpenseFlow 的财务规则、流程状态、启动方式、验收标准和 AI 协作都依赖文档。如果文档漂移、在终端显示异常，或遗漏合规规则，即使代码能编译，后续改动也可能破坏审计追溯和财务控制。

## 范围

- 验证关键 Markdown 文档可以按 UTF-8 正常读取。
- 补充 PowerShell 编码显示问题的处理说明。
- 保持 `docs/project-status.md` 与已完成阶段和下一阶段一致。
- 保持 `docs/development-roadmap.md` 与阶段范围变化一致。
- 维护后续任务和进行中任务的任务卡。
- 维护端到端验收剧本，作为共享人工验收清单。

## 不包含

- 不为了统一风格重写全部历史进度记录。
- 不修改业务代码。
- 不在未遵守 `docs/startup-guide.md` 的情况下修改启动命令。

## 相关文件或模块

- `AGENTS.md`
- `docs/ai-collaboration-guide.md`
- `docs/project-status.md`
- `docs/development-roadmap.md`
- `docs/e2e-acceptance-script.md`
- `docs/tasks/`
- `docs/domain/`

## 领域规则

- 必要状态流转：文档必须与已实现状态机和领域文档保持一致。
- 必要审计行为：核心模块文档必须写明需要的审计记录和权限检查。
- 必要权限检查：高风险操作必须在任务卡和验收文档中明确标注。
- 预算或会计影响：文档必须区分在途、已审批、实际发生和已释放预算金额，并说明凭证生成只能生成草稿。

## 验收标准

- `docs/project-status.md` 展示最新已完成阶段和正确的下一阶段。
- `docs/development-roadmap.md` 可以按 UTF-8 正常读取，并反映推荐阶段顺序。
- `docs/e2e-acceptance-script.md` 覆盖管理员配置、员工提交、主管审批、财务审核、出纳付款、审计复核和关键异常分支。
- 每张活跃任务卡都包含目标、范围、不包含内容、领域规则、验收标准、验证命令、文档更新和风险。
- Shell 说明中提到 PowerShell 显示问题可用 `Get-Content -Encoding UTF8` 验证。
- 文档变更不得改写无关业务事实。

## 验证命令

```powershell
Get-Content -Encoding UTF8 docs\project-status.md
Get-Content -Encoding UTF8 docs\development-roadmap.md
Get-Content -Encoding UTF8 docs\e2e-acceptance-script.md
```

## 文档更新

- `docs/project-status.md`
- `docs/tasks/README.md`
- `docs/tasks/task-template.md`
- `docs/e2e-acceptance-script.md`

## 风险

- 终端输出乱码可能被误判为文件内容损坏。
- 过度重写状态文档可能抹掉有价值的历史上下文。
- 任务卡如果遗漏财务规则，可能诱导实现“测试通过但合规失败”。
