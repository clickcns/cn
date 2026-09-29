#!/usr/bin/env node
/**
 * 개발 포트를 쓰는 이전 dev 프로세스를 끝낸다. `pnpm dev`·`dev:server`·`dev:web`·`dev:admin`이
 * turbo를 띄우기 전에 부른다. 사용: node scripts/free-dev-ports.mjs 3210 5210 5211
 *
 * 왜 남는가(2026-09, turbo 2.11.2·Windows에서 확인): turbo는 자신이나 실행기(node_modules/.bin/turbo)가
 * 끝나면 그 아래 작업(vite·nest·서버)을 함께 끝낸다. 그러나 실행기 **위**의 프로세스(pnpm·스크립트용
 * 셸·편집기나 에이전트가 띄운 셸)만 끝나면 실행기와 turbo가 부모 없이 그대로 돌며 포트를 잡는다.
 * 이것은 우리 스크립트가 아니라 프로세스를 끝내는 쪽의 문제라 여기서 다음 실행 때 치운다.
 *
 * 포트를 잡은 프로세스만 끝내면 그 프로세스를 띄운 watch(nest start --watch 등)가 남아 다시 포트를
 * 잡으므로, 위로 거슬러 올라가 이전 dev 실행 묶음(turbo·pnpm·스크립트용 셸)의 맨 위를 트리째 끝낸다.
 * 사용자가 쓰는 셸(PowerShell·bash 창 등)과 지금 이 스크립트를 띄운 프로세스는 건드리지 않는다.
 */
import { execFileSync } from "node:child_process";
import { basename } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ports = process.argv.slice(2).map(Number).filter(Number.isInteger);
const isWindows = process.platform === "win32";

/** 포트를 LISTEN 중인 프로세스 id. */
function listeningPids() {
  const pids = new Map();
  if (isWindows) {
    // 프로토콜 주소 외부주소 상태 PID — IPv4·IPv6(vite는 ::1만 잡기도 한다)를 모두 본다.
    const output = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    for (const line of output.split(/\r?\n/)) {
      const [proto, local, , state, pid] = line.trim().split(/\s+/);
      if (proto !== "TCP" || state !== "LISTENING") continue;
      const port = Number(local.slice(local.lastIndexOf(":") + 1));
      if (ports.includes(port) && Number(pid) > 4) pids.set(Number(pid), port);
    }
    return pids;
  }
  for (const port of ports) {
    try {
      const output = execFileSync(
        "lsof",
        ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"],
        { encoding: "utf8" },
      );
      for (const pid of output.split(/\s+/).filter(Boolean)) {
        pids.set(Number(pid), port);
      }
    } catch {
      // lsof는 찾은 게 없으면 1로 끝난다.
    }
  }
  return pids;
}

/** 모든 프로세스의 id·부모 id·이름·명령줄. */
function processTable() {
  if (isWindows) {
    const script =
      "[Console]::OutputEncoding=[Text.Encoding]::UTF8;" +
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress";
    const output = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    return JSON.parse(output).map((p) => ({
      pid: p.ProcessId,
      ppid: p.ParentProcessId,
      name: p.Name ?? "",
      args: p.CommandLine ?? "",
    }));
  }
  const output = execFileSync(
    "ps",
    ["-A", "-o", "pid=", "-o", "ppid=", "-o", "args="],
    {
      encoding: "utf8",
    },
  );
  return output
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, args]) => ({
      pid: Number(pid),
      ppid: Number(ppid),
      name: basename(args.split(/\s+/)[0] ?? ""),
      args,
    }));
}

/** dev 실행에 쓰이는 명령(pnpm·turbo·vite·nest 등). 명령줄에 이것이 보여야 dev 실행 묶음으로 본다. */
const DEV_COMMAND =
  /\b(pnpm|turbo|vite|npm-cli|cross-env|free-dev-ports)\b|\bnest(\.js)?\b.*\bstart\b/i;

/**
 * dev 실행 묶음에 드는 프로세스인지.
 * - turbo, 그리고 명령줄에 dev 명령이 보이는 node·pnpm·npm
 * - 스크립트를 돌리는 셸(`cmd /c`, `sh -c`)은 무엇을 돌리든 연결 고리로 보고 지나간다
 *   (nest가 서버를, cross-env가 nest를 `cmd /c`로 띄운다).
 * 그 밖의 node(예: Claude Code·편집기)와 대화형 셸(PowerShell·bash 창 등)에서는 멈춘다.
 */
function isDevProcess(proc) {
  const name = proc.name.toLowerCase().replace(/\.exe$/, "");
  const args = ` ${proc.args} `;
  if (name === "turbo") return true;
  if (name === "cmd") return /\s\/c\s/i.test(args);
  if (["sh", "bash", "zsh", "dash"].includes(name)) {
    return /\s-c\s/.test(args) || DEV_COMMAND.test(args);
  }
  if (["node", "pnpm", "npm", "npx"].includes(name)) {
    return DEV_COMMAND.test(args);
  }
  return false;
}

/** 지금 이 스크립트와 그 조상(새로 띄우는 pnpm dev 쪽). 끝내면 안 된다. */
function selfAndAncestors(byPid) {
  const pids = new Set();
  for (let pid = process.pid; pid && !pids.has(pid);) {
    pids.add(pid);
    pid = byPid.get(pid)?.ppid;
  }
  return pids;
}

/** 포트를 잡은 프로세스에서 위로 올라가 이전 dev 실행 묶음의 맨 위를 찾는다. */
function devRoot(pid, byPid, protectedPids) {
  let current = byPid.get(pid);
  if (!current) return pid;
  for (;;) {
    const parent = byPid.get(current.ppid);
    if (!parent || protectedPids.has(parent.pid) || !isDevProcess(parent)) {
      return current.pid;
    }
    current = parent;
  }
}

function killTree(rootPid, table) {
  if (isWindows) {
    execFileSync("taskkill", ["/PID", String(rootPid), "/T", "/F"], {
      stdio: "ignore",
    });
    return;
  }
  // 자식부터 끝낸다(부모가 먼저 죽으면 자식이 다른 부모에 붙는다).
  const children = (pid) =>
    table
      .filter((p) => p.ppid === pid)
      .flatMap((p) => [...children(p.pid), p.pid]);
  for (const pid of [...children(rootPid), rootPid]) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // 이미 끝났다.
    }
  }
}

const busy = listeningPids();
if (busy.size > 0) {
  const table = processTable();
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const protectedPids = selfAndAncestors(byPid);
  const roots = new Map();
  for (const [pid, port] of busy) {
    if (protectedPids.has(pid)) continue;
    const root = devRoot(pid, byPid, protectedPids);
    roots.set(root, [...(roots.get(root) ?? []), port]);
  }
  for (const [root, rootPorts] of roots) {
    const name = byPid.get(root)?.name ?? "알 수 없음";
    console.log(
      `[free-dev-ports] 이전 프로세스를 끝냅니다(포트 ${rootPorts.join(", ")}): ${name} (PID ${root})`,
    );
    try {
      killTree(root, table);
    } catch {
      // 그사이 끝났을 수 있다. 아래에서 포트가 비었는지 다시 본다.
    }
  }

  // 포트가 실제로 빌 때까지 잠깐 기다린다.
  for (let i = 0; i < 25 && listeningPids().size > 0; i++) await sleep(200);
  const still = listeningPids();
  if (still.size > 0) {
    const detail = [...still]
      .map(([pid, port]) => `${port}(PID ${pid})`)
      .join(", ");
    console.error(
      `[free-dev-ports] 포트를 비우지 못했습니다: ${detail}. 직접 끝낸 뒤 다시 실행해 주세요`,
    );
    process.exit(1);
  }
}
