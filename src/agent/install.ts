import * as os from 'node:os';
import * as vscode from 'vscode';
import guide from '../../agent/skill.md';
import { HARNESSES, renderInstall, renderRefresh, type Harness, type HarnessId } from './skills';

// "VS Canvas: Install Agent Skills": writes the canvas guide for the agent harnesses the user picks.

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

function rootOf(h: Harness): vscode.Uri | undefined {
  return h.scope === 'user' ? vscode.Uri.file(os.homedir()) : vscode.workspace.workspaceFolders?.[0]?.uri;
}

/** Writes the guide for one harness. Returns the file and whether it changed. */
export async function installSkill(h: Harness): Promise<{ uri: vscode.Uri; changed: boolean }> {
  const root = rootOf(h);
  if (!root) throw new Error('Open a folder first: project skills are written into the workspace.');
  const uri = vscode.Uri.joinPath(root, ...h.path.split('/'));
  const next = renderInstall(h, guide, await readText(uri));
  if (next !== undefined) await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
  return { uri, changed: next !== undefined };
}

/**
 * Rewrites guides installed earlier by "Install Agent Skills" so they follow the current guide. Only files VS Canvas
 * already manages are touched; nothing is created and the user is never prompted.
 */
export async function refreshInstalledSkills(): Promise<void> {
  for (const h of HARNESSES) {
    try {
      const root = rootOf(h);
      if (!root) continue;
      const uri = vscode.Uri.joinPath(root, ...h.path.split('/'));
      const next = renderRefresh(h, guide, await readText(uri));
      if (next !== undefined) await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
    } catch {
      // best effort
    }
  }
}

/** Harnesses that look in use here (their config exists), plus Claude Code for the project by default. */
async function detected(): Promise<Set<HarnessId>> {
  const out = new Set<HarnessId>(['claude-project']);
  for (const h of HARNESSES) {
    const root = rootOf(h);
    if (!root) continue;
    for (const p of h.detect) if (await exists(vscode.Uri.joinPath(root, ...p.split('/')))) out.add(h.id);
  }
  return out;
}

export async function installAgentSkills(preselect?: HarnessId[]): Promise<void> {
  const hasFolder = !!vscode.workspace.workspaceFolders?.length;
  const pre = preselect ? new Set(preselect) : await detected();
  const items = HARNESSES.filter((h) => hasFolder || h.scope === 'user').map((h) => ({
    label: h.label,
    description: h.detail,
    picked: pre.has(h.id),
    harness: h,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    title: 'Install agent skills',
    placeHolder: 'Teach your coding agents to use the canvas. Pick the agents you use.',
  });
  if (!picked?.length) return;

  const written: { h: Harness; uri: vscode.Uri; changed: boolean }[] = [];
  const failed: string[] = [];
  for (const { harness } of picked) {
    try {
      written.push({ h: harness, ...(await installSkill(harness)) });
    } catch (e) {
      failed.push(`${harness.label}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (failed.length) void vscode.window.showErrorMessage(`VS Canvas: could not install ${failed.join('; ')}`);
  if (!written.length) return;

  const changed = written.filter((w) => w.changed);
  const summary = changed.length
    ? `Installed the canvas guide for ${changed.map((w) => w.h.label).join(', ')}.`
    : 'The canvas guide is already up to date for the agents you picked.';
  const open = 'Open';
  const pick = await vscode.window.showInformationMessage(
    `${summary} Agents also get short usage instructions from the MCP server itself.`,
    ...(written.length === 1 ? [open] : []),
  );
  if (pick === open) await vscode.window.showTextDocument(written[0].uri);
}
