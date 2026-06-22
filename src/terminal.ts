import * as vscode from 'vscode';

const SHIPYARD_TERMINAL_NAME = 'Shipyard';

// Ctrl-U (U+0015) — clears the current input line before we type the command,
// so that repeated type-don't-execute sends start at a fresh prompt instead of
// concatenating onto a previously-typed-but-unexecuted command.
const CLEAR_LINE = '\u0015';

/** Show the terminal and type the command (clearing the line first). */
function deliver(terminal: vscode.Terminal, cmd: string, autoRun: boolean): void {
  // Guard against a terminal the user closed during a launch delay.
  if (!vscode.window.terminals.includes(terminal)) {
    return;
  }
  terminal.show(); // make the typed command visible
  // `autoRun` controls the trailing newline: true -> execute, false -> leave it
  // typed for review. The leading Ctrl-U guarantees we start at an empty prompt.
  terminal.sendText(CLEAR_LINE + cmd, autoRun);
}

/**
 * Send a Shipyard slash command to a terminal, per the `shipyard.terminalTarget`
 * setting:
 * - `dedicated` (default): a "Shipyard" terminal we own. If it already exists we
 *   send straight to it (Claude Code is presumably running). If we have to create
 *   it, we first run the launch command (`shipyard.launchCommand`, default
 *   `claude`) and send the slash command after `shipyard.launchDelayMs` so it
 *   isn't typed before Claude Code is ready.
 * - `active`: the currently focused terminal. Falls back to the dedicated path
 *   (create + launch) when no terminal is open.
 */
export function sendToTerminal(cmd: string): void {
  const cfg = vscode.workspace.getConfiguration('shipyard');
  const autoRun = cfg.get<boolean>('autoRunCommands', false);
  const target = cfg.get<'dedicated' | 'active'>('terminalTarget', 'dedicated');

  // Active mode: use the focused terminal if there is one.
  if (target === 'active' && vscode.window.activeTerminal) {
    deliver(vscode.window.activeTerminal, cmd, autoRun);
    return;
  }

  // Dedicated mode (or active with no terminal open): reuse our named terminal
  // if present, otherwise create it, launch Claude Code, and send after a delay.
  const existing = vscode.window.terminals.find(
    (t) => t.name === SHIPYARD_TERMINAL_NAME,
  );
  if (existing) {
    deliver(existing, cmd, autoRun);
    return;
  }

  const terminal = vscode.window.createTerminal(SHIPYARD_TERMINAL_NAME);
  terminal.show();

  const launchCommand = cfg.get<string>('launchCommand', 'claude').trim();
  if (!launchCommand) {
    // Launching disabled — just type the command into the fresh shell.
    deliver(terminal, cmd, autoRun);
    return;
  }

  terminal.sendText(launchCommand, true); // start Claude Code (runs with newline)
  const delayMs = Math.max(0, cfg.get<number>('launchDelayMs', 1500));
  setTimeout(() => deliver(terminal, cmd, autoRun), delayMs);
}
