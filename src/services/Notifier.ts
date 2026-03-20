import * as vscode from 'vscode';
import type { INotifier } from '../interfaces';

/**
 * SRP: Responsible only for surfacing messages to the user via VS Code API.
 */
export class VSCodeNotifier implements INotifier {
  info(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  warn(message: string): void {
    vscode.window.showWarningMessage(message);
  }

  error(message: string): void {
    vscode.window.showErrorMessage(message);
  }
}
