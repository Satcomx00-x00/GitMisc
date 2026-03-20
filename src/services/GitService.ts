import * as vscode from 'vscode';
import type { DiffResult, GitAPI, GitExtension, Repository } from '../types';
import type { IGitService } from '../interfaces';

/**
 * SRP: Responsible only for interacting with the VS Code Git extension.
 * Lazily acquires the Git API on first use and caches it.
 */
export class GitService implements IGitService {
  private api: GitAPI | undefined;

  isAvailable(): boolean {
    return this.ensureAPI();
  }

  getRepository(): Repository | undefined {
    if (!this.ensureAPI()) {
      return undefined;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    if (activeUri) {
      for (const repo of this.api!.repositories) {
        if (activeUri.fsPath.startsWith(repo.rootUri.fsPath)) {
          return repo;
        }
      }
    }

    return this.api!.repositories[0];
  }

  async getDiff(repo: Repository): Promise<DiffResult> {
    // Prefer staged changes
    let diff = await repo.diff(true);
    let files = repo.state.indexChanges.map((c) => this.basename(c.uri.fsPath));

    // Fall back to unstaged
    if (!diff.trim()) {
      diff = await repo.diff(false);
      files = repo.state.workingTreeChanges.map((c) => this.basename(c.uri.fsPath));
    }

    return { diff, files };
  }

  // ── Private ──

  private ensureAPI(): boolean {
    if (this.api) {
      return true;
    }
    const ext = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!ext?.isActive) {
      return false;
    }
    this.api = ext.exports.getAPI(1);
    return true;
  }

  private basename(fsPath: string): string {
    const sep = fsPath.lastIndexOf('/');
    return sep >= 0 ? fsPath.slice(sep + 1) : fsPath;
  }
}
