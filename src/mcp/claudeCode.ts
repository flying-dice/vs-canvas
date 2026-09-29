import * as vscode from 'vscode';
import { installSkill } from '../agent/install';
import { harnessById } from '../agent/skills';
import { MCP_SERVER_NAME, mcpJsonUrl, mergeMcpJson } from './port';

// Keeps Claude Code's project config (.mcp.json in the first workspace folder) pointing at this window's MCP server,
// so `claude` run in the project talks to the canvas for that project.

const DISMISSED_KEY = 'vsCanvas.claudeCode.dismissed';

type Mode = 'ask' | 'always' | 'never';

async function readText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
  } catch {
    return undefined;
  }
}

function mcpJsonUri(): vscode.Uri | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder && vscode.Uri.joinPath(folder.uri, '.mcp.json');
}

async function write(uri: vscode.Uri, text: string | undefined, url: string): Promise<boolean> {
  const next = mergeMcpJson(text, url);
  if (next === undefined) return false;
  await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(next));
  return true;
}

/**
 * Called whenever the server URL changes. Updates an existing entry silently; otherwise follows
 * `vsCanvas.claudeCode.mcpJson` ('ask' offers once per workspace).
 */
export async function syncClaudeCodeConfig(url: string, state: vscode.Memento, log: (m: string) => void): Promise<void> {
  const uri = mcpJsonUri();
  if (!uri) return;
  const text = await readText(uri);
  try {
    if (mcpJsonUrl(text) !== undefined) {
      if (await write(uri, text, url)) log(`Updated ${MCP_SERVER_NAME} in .mcp.json to ${url}`);
      return;
    }
    const mode = vscode.workspace.getConfiguration('vsCanvas').get<Mode>('claudeCode.mcpJson', 'ask');
    if (mode === 'never') return;
    if (mode === 'always') {
      if (await write(uri, text, url)) log(`Added ${MCP_SERVER_NAME} to .mcp.json (${url})`);
      return;
    }
    if (state.get<boolean>(DISMISSED_KEY)) return;
    const add = 'Add to .mcp.json';
    const never = "Don't ask again";
    const pick = await vscode.window.showInformationMessage(
      `Connect Claude Code to this workspace's canvas? VS Canvas can add its MCP server (${url}) to .mcp.json so ` +
        '`claude` run in this project uses it.',
      add,
      'Not now',
      never,
    );
    if (pick === add) await setUpClaudeCode(url);
    else if (pick === never) await state.update(DISMISSED_KEY, true);
  } catch (e) {
    log(`Could not update .mcp.json: ${e instanceof Error ? e.message : e}`);
  }
}

/** Command: write (or update) the entry now and explain the next step. */
export async function setUpClaudeCode(url: string | undefined): Promise<void> {
  const uri = mcpJsonUri();
  if (!uri) return void vscode.window.showWarningMessage('VS Canvas: open a folder to set up Claude Code for it.');
  if (!url) return void vscode.window.showWarningMessage('VS Canvas: the MCP server is not running.');
  const text = await readText(uri);
  try {
    const changed = await write(uri, text, url);
    const open = 'Open .mcp.json';
    const skill = 'Install Claude Code skill';
    const pick = await vscode.window.showInformationMessage(
      `${changed ? 'Added' : 'Already set:'} "${MCP_SERVER_NAME}" in .mcp.json (${url}). Run \`claude\` in this ` +
        'folder; it asks you to approve the project server the first time. Install the skill so Claude Code knows ' +
        'when and how to use the canvas.',
      skill,
      open,
    );
    if (pick === open) await vscode.window.showTextDocument(uri);
    if (pick === skill) {
      try {
        const { uri: skillUri } = await installSkill(harnessById('claude-project')!);
        void vscode.window.showInformationMessage(`Installed the VS Canvas skill at ${vscode.workspace.asRelativePath(skillUri)}.`);
      } catch (e) {
        void vscode.window.showErrorMessage(`VS Canvas: could not install the skill (${e instanceof Error ? e.message : e}).`);
      }
    }
  } catch (e) {
    void vscode.window.showErrorMessage(
      `VS Canvas: .mcp.json is not valid JSON, so it was left unchanged (${e instanceof Error ? e.message : e}).`,
    );
  }
}
