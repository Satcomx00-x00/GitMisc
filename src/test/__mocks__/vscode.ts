/**
 * Lightweight test double for the 'vscode' module.
 * Aliased via vitest.config.ts so every import of 'vscode' in tests resolves here.
 * withProgress immediately invokes its callback so command tests run without a host.
 */

export const window = {
  withProgress: (
    _opts: unknown,
    fn: (progress: { report: () => void }) => Promise<void>,
  ): Promise<void> => fn({ report: () => {} }),
  showWarningMessage: (_msg: string) => Promise.resolve(undefined),
  showErrorMessage: (_msg: string) => Promise.resolve(undefined),
  showInformationMessage: (_msg: string) => Promise.resolve(undefined),
  activeTextEditor: undefined,
};

export const ProgressLocation = {
  SourceControl: 15,
  Window: 10,
  Notification: 1,
};

export const workspace = {
  workspaceFolders: undefined as undefined,
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  openTextDocument: (_path: string) => Promise.resolve({}),
};

export const window_showTextDocument = () => Promise.resolve();

export const extensions = {
  getExtension: (_id: string) => undefined,
};

export const chat = {
  createChatParticipant: (
    _id: string,
    _handler: unknown,
  ): { iconPath: unknown; dispose: () => void } => ({
    iconPath: undefined,
    dispose: () => {},
  }),
};

export class Uri {
  static file(path: string) {
    return { fsPath: path, scheme: 'file' };
  }
}

export class Disposable {
  constructor(private callOnDispose: () => void) {}
  dispose() {
    this.callOnDispose();
  }
}

export class ThemeIcon {
  constructor(public readonly id: string) {}
}
