import type { ParsedCommitMessage } from '../types';
import type { IResponseParser } from '../interfaces';

/**
 * SRP: Responsible only for parsing the AI response into a structured commit message.
 *
 * Expected AI output format (Copilot-style):
 *   ```text
 *   type(scope): short description
 *
 *   optional body
 *   ```
 *
 * Fallback: if the response is not wrapped in a ```text code block, the entire
 * raw response is used directly as a Git commit message (first line = subject,
 * rest = body after an optional blank separator line).
 */
export class ResponseParser implements IResponseParser {
  private static readonly TEXT_CODE_BLOCK_RE = /```text\s*([\s\S]+?)\s*```/;

  parse(raw: string): ParsedCommitMessage {
    const trimmed = raw.trim();
    const match = ResponseParser.TEXT_CODE_BLOCK_RE.exec(trimmed);
    const commitMessage = (match?.[1] ?? trimmed).trim();

    return ResponseParser.splitIntoSubjectAndBody(commitMessage);
  }

  private static splitIntoSubjectAndBody(message: string): ParsedCommitMessage {
    const lines = message.split('\n');
    const subject = lines[0]?.trim() ?? '';

    // Standard Git format: subject line, optional blank line, body
    let bodyStart = 1;
    if (lines[1]?.trim() === '') {
      bodyStart = 2;
    }

    const bodyLines = lines.slice(bodyStart);

    // Trim trailing blank lines
    while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1]?.trim() === '') {
      bodyLines.pop();
    }

    return { subject, body: bodyLines.join('\n') };
  }
}
