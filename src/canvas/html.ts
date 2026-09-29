import * as fs from 'node:fs';
import * as vscode from 'vscode';

export const distWebview = (extensionUri: vscode.Uri) => vscode.Uri.joinPath(extensionUri, 'dist', 'webview');

/** HTML for a canvas webview: the built webview index.html with a CSP and rewritten asset URLs. */
export function webviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const root = distWebview(extensionUri);
  const indexPath = vscode.Uri.joinPath(root, 'index.html').fsPath;
  if (!fs.existsSync(indexPath)) {
    return `<!doctype html><html><body style="font-family:sans-serif;padding:2em">
<h3>Canvas webview not built</h3><p>Run <code>npm run build:webview</code> and reopen the canvas.</p></body></html>`;
  }
  const assets = webview.asWebviewUri(vscode.Uri.joinPath(root, 'assets')).toString();
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data: https:`,
    `script-src ${webview.cspSource}`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `font-src ${webview.cspSource}`,
  ].join('; ');
  return fs.readFileSync(indexPath, 'utf8')
    .replace(/(src|href)="\.\/assets\//g, `$1="${assets}/`)
    .replace(/\s+crossorigin(="[^"]*")?/g, '')
    .replace(/<head>/i, `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`);
}
