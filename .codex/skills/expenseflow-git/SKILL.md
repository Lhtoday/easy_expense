---
name: expenseflow-git
description: ExpenseFlow repository Git workflow for E:\codex\code\expense. Use when inspecting status, staging files, committing, pushing to origin/main, checking remotes, handling dubious ownership safe.directory, or troubleshooting GitHub connectivity for this repository.
---

# ExpenseFlow Git

Use this workflow for Git operations in `E:\codex\code\expense`.

## Repository Facts

- Path: `E:\codex\code\expense`
- Remote: `https://github.com/Lhtoday/easy_expense.git`
- Default branch: `main`
- Safe-directory override: `-c safe.directory=E:/codex/code/expense`

Always include the safe-directory override:

```powershell
git -c safe.directory=E:/codex/code/expense status --short --branch
```

## Commit Workflow

1. Inspect status:

```powershell
git -c safe.directory=E:/codex/code/expense status --short --branch
```

2. Inspect diffs for intended files only.
3. Stage only intended files:

```powershell
git -c safe.directory=E:/codex/code/expense add <files>
```

4. Before meaningful code commits, run relevant validation from `docs/testing-guide.md`.
5. Commit with a concise message:

```powershell
git -c safe.directory=E:/codex/code/expense commit -m "<message>"
```

## Push Workflow

PowerShell/Git direct access to GitHub may fail even when the browser can open GitHub because the browser may use its own proxy. Known errors include timeouts and `OpenSSL SSL_connect` resets.

Verified push command for this environment:

```powershell
git -c safe.directory=E:/codex/code/expense -c http.version=HTTP/1.1 -c http.sslVersion=tlsv1.2 push origin main
```

If a local proxy is needed, Clash mixed port has been observed at `7890`:

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

## Connectivity Checks

```powershell
git -c safe.directory=E:/codex/code/expense -c http.version=HTTP/1.1 -c http.sslVersion=tlsv1.2 ls-remote origin HEAD
Test-NetConnection 127.0.0.1 -Port 7890
git config --global --get-regexp "^(http|https)\.proxy"
```

## Guardrails

- Never use destructive Git commands unless the user explicitly asks.
- Never stage unrelated user changes.
- If writing to `.git` fails in a restricted environment, request escalation rather than changing repository ownership.
- If push fails but `ls-remote` succeeds, retry with the verified push command.
- Do not assume browser GitHub access means Git can reach GitHub.
