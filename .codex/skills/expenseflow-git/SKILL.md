---
name: expenseflow-git
description: ExpenseFlow repository Git workflow. Use when working in E:\codex\code\expense and Codex needs to inspect status, stage files, commit, push, check remotes, or troubleshoot GitHub connectivity for this repository.
---

# ExpenseFlow Git

Use this skill for Git operations in `E:\codex\code\expense`.

## Repository

- Path: `E:\codex\code\expense`
- Remote: `https://github.com/Lhtoday/easy_expense.git`
- Default branch: `main`

Always include the repository safe-directory override when running Git commands:

```powershell
git -c safe.directory=E:/codex/code/expense status --short --branch
```

## Commit Flow

1. Check status:

```powershell
git -c safe.directory=E:/codex/code/expense status --short --branch
```

2. Stage only intended files:

```powershell
git -c safe.directory=E:/codex/code/expense add <files>
```

3. Commit:

```powershell
git -c safe.directory=E:/codex/code/expense commit -m "<message>"
```

4. Before committing or pushing meaningful code changes, run the relevant checks:

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

## Push Flow

PowerShell/Git direct access to GitHub may fail even when the browser can open GitHub, because the browser may use its own proxy. Known errors:

```text
Failed to connect to github.com port 443 ... Timed out
OpenSSL SSL_connect: Connection was reset in connection to github.com:443
```

The verified push command for this environment is:

```powershell
git -c safe.directory=E:/codex/code/expense -c http.version=HTTP/1.1 -c http.sslVersion=tlsv1.2 push origin main
```

If a local proxy is needed, configure it first. Clash mixed port has been observed at `7890`:

```powershell
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
```

Then still use the verified push command with `HTTP/1.1` and `tlsv1.2`.

## Connectivity Checks

Check remote readability:

```powershell
git -c safe.directory=E:/codex/code/expense -c http.version=HTTP/1.1 -c http.sslVersion=tlsv1.2 ls-remote origin HEAD
```

Check proxy port:

```powershell
Test-NetConnection 127.0.0.1 -Port 7890
```

Check Git proxy config:

```powershell
git config --global --get-regexp "^(http|https)\.proxy"
```

## Notes

- If push fails but `ls-remote` succeeds, retry with the verified push command.
- If writing to `.git` fails in a restricted environment, request escalation rather than changing repository ownership or bypassing Git.
- Do not assume browser GitHub access means Git can reach GitHub.
