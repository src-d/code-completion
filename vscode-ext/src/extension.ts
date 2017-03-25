'use strict';

import { 
    DocumentFilter, languages, ExtensionContext,
} from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import GoCompletionProvider from './autocompletion';
import { LineExchangeProcess, binPath } from './process';

const GO_CODE: DocumentFilter = { language: 'go', scheme: 'file' };
const TRIGGER_CHARS: string[] = ['.', ' ', '\n', '(', ')', '\t', ',', '[', ']', '{', '}'];
let proc: ChildProcess;
const python = binPath('python3') || binPath('python');

export function activate(context: ExtensionContext) {
    console.log('Extension has been activated');
    const 
    proc = spawn(python, [`${context.extensionPath}/../relevance/relevance.py`]);
    proc.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    proc.on('close', (code, signal) => {
        console.error('relevance process died', code, signal);
    });
 
    context.subscriptions.push(languages.registerCompletionItemProvider(
        GO_CODE,
        new GoCompletionProvider(new LineExchangeProcess(proc)),
        ...TRIGGER_CHARS,
    ));
}

export function deactivate() {
    console.log('Extension has been deactivated');
    if (proc) {
        proc.kill();
    }
}