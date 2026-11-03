# Ola Me — API research and client tooling

## Purpose

This repository contains source code, documentation, and local fixtures for
understanding and improving the Ola Me client integration. The project is used
by the repository owner for authorized, defensive software development and
interoperability research on applications and devices they control.

The preferred outcome is reproducible source code and documentation. Runtime
observations should be converted into sanitized fixtures before they are used
by tests or examples.

## Scope

- Analyze and improve the code and documentation in this repository.
- Use mock, replay, or redacted captures for local development and tests.
- Keep changes limited to this repository unless the owner explicitly asks for
  another location.
- Treat live accounts, messages, user profiles, cookies, tokens, and network
  captures as private data.

## Safety and privacy rules

- Never commit, print, or store passwords, API keys, access tokens, cookies,
  authorization headers, or personal user data.
- Do not ask for or extract plaintext credentials.
- Do not send messages, modify profiles, or perform other external side
  effects during ordinary development tasks.
- Do not use ADB, Frida, remote control, or live network requests unless a
  task explicitly requires a narrowly scoped, authorized test.
- Prefer static analysis, mocks, replay fixtures, and read-only checks.
- Redact sensitive values before adding a capture to `docs/`, `work/`, or a
  test fixture. Runtime logs may contain private data and are not source of
  truth.

## Working agreement for coding agents

Before editing, inspect only the files relevant to the requested change and
state the planned files. Make the smallest local change, run the relevant
tests or static checks, and report the exact result.

Unless the owner explicitly requests otherwise, an agent must not:

- commit, push, deploy, or publish changes;
- access credentials or live user data;
- kill or launch applications on a device;
- send chat messages or other network-side effects.

When a task needs runtime evidence, use a sanitized capture or a local mock
first. Keep live-device actions in a separate, explicitly approved task.

## Repository layout

- `docs/` — API and investigation notes.
- `scripts/nodejs/` — TypeScript Ola API client and CLIs; the test account goes in
  `scripts/nodejs/.env` (see [docs/api/nodejs-login.md](docs/api/nodejs-login.md)).
- `work/` — generated inventories and runtime captures; treat as sensitive.
- `olaachat/` — app-related analysis inputs and inventories.

## Secrets

Use environment variables or a local secret manager for development-only
values. Do not put secrets in this README, source files, documentation, git
history, or captured logs. If a secret appears in a capture, stop using that
capture, redact it, and rotate the secret.
