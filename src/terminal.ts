import * as vscode from 'vscode';

export function sendToTerminal(cmd: string): void {
  const autoRun = vscode.workspace
    .getConfiguration('shipyard')
    .get<boolean>('autoRunCommands', false);
  const terminal = vscode.window.activeTerminal ?? vscode.window.createTerminal();
  terminal.show();                 // make the typed command visible
  terminal.sendText(cmd, autoRun); // 2nd arg = addNewLine → executes when true
}
