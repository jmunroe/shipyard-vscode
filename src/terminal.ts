import * as vscode from 'vscode';

const SHIPYARD_TERMINAL_NAME = 'Shipyard';

// Ctrl-U (U+0015) — clears the current input line before we type the command,
// so that repeated type-don't-execute sends start at a fresh prompt instead of
// concatenating onto a previously-typed-but-unexecuted command.
const CLEAR_LINE = '\u0015';

/** A terminal we own, found by name or freshly created. */
function getOrCreateDedicatedTerminal(): vscode.Terminal {
  return (
    vscode.window.terminals.find((t) => t.name === SHIPYARD_TERMINAL_NAME) ??
    vscode.window.createTerminal(SHIPYARD_TERMINAL_NAME)
  );
}

/**
 * Resolve which terminal to send to, per the `shipyard.terminalTarget` setting:
 * - `dedicated` (default): always a "Shipyard" terminal we own. Predictable —
 *   never hijacks an unrelated focused shell/app. Run Claude Code in it.
 * - `active`: the currently active terminal (falling back to the dedicated one
 *   when none is open). Convenient when Claude Code is focused, but the user
 *   opts into the risk of landing in an unrelated terminal.
 */
function resolveTargetTerminal(): vscode.Terminal {
  const target = vscode.workspace
    .getConfiguration('shipyard')
    .get<'dedicated' | 'active'>('terminalTarget', 'dedicated');

  if (target === 'active') {
    return vscode.window.activeTerminal ?? getOrCreateDedicatedTerminal();
  }
  return getOrCreateDedicatedTerminal();
}

export function sendToTerminal(cmd: string): void {
  const autoRun = vscode.workspace
    .getConfiguration('shipyard')
    .get<boolean>('autoRunCommands', false);
  const terminal = resolveTargetTerminal();
  terminal.show(); // make the typed command visible
  // Clear any partially-typed input first, then type the command. `autoRun`
  // controls the trailing newline: true -> execute, false -> leave it typed for
  // review. The leading Ctrl-U guarantees we start at an empty prompt.
  terminal.sendText(CLEAR_LINE + cmd, autoRun);
}
