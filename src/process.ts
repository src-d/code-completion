'use strict';

import { execFile, ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ReadLine, createInterface } from 'readline';

interface CmdOutput {
    stdout: string;
    stderr: string;
}

let binPathCache: { [bin: string]: string | null } = {};

/**
 * Returns the binary with the correct extension (.exe in win32).
 * @param name name of the binary
 */
export const binName = (name: string): string => process.platform === 'win32' 
    ? `${name}.exe` 
    : name;

/**
 * Reports whether the file exists or not.
 * @param file file path
 */
function exists(file: string): boolean {
    try {
		return fs.statSync(file).isFile();
	} catch (e) {
		return false;
	}
}

/**
 * Returns the path of a binary in the PATH environment variable.
 * @param binary binary to search
 */
export function binPath(binary: string): string | null {
    binary = binName(binary);
    if (binPathCache[binary]) {
        return binPathCache[binary];
    }

    const paths: string[] = process.env['PATH'].split(path.delimiter);
    binPathCache[binary] = paths
        .map(p => path.join(p, binary))
        .find((p) => exists(p));
    return binPathCache[binary];
}

/**
 * Executes a command with optional input and returns its result.
 * @param bin binary path
 * @param args arguments of the binary
 * @param stdin optional string to feed to stdin
 */
export function exec(bin: string, args: string[], stdin?: string): Thenable<CmdOutput> {
    return new Promise<CmdOutput>((resolve, reject) => {
        const proc = execFile(bin, args, (err, stdout, stderr) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            resolve({ stdout, stderr });
        });

        if (stdin) {
            proc.stdin.end(stdin);
        }
    });
}

/**
 * A LineExchangeProcess is a process that communicates with another process
 * via stdin and stdout, being the input lines in the stdin and the output
 * lines in the stdout. Every line sent to stdin is a single request that must
 * have one and only one line as a response.
 * @class LineExchangeProcess
 */
export class LineExchangeProcess {
    private rl: ReadLine;
    private proc: ChildProcess;
    private closed: boolean;
    private promises = [];
    private resolvers = [];

    constructor(proc: ChildProcess) {
        this.rl = createInterface({ input: proc.stdout });
        this.proc = proc;

        this.rl.on('line', line => {
            let res = this.resolvers.pop();
            if (res) {
                res(line);
            } else {
                console.error('no resolver for line', line);
            }
        });

        const close = () => {
            console.error('closed proc');
            this.closed = true;
            this.promises = null;
            this.resolvers = null;
        };

        this.rl.on('close', close);
        this.proc.on('close', close);
    }

    /**
     * Writes a line to the process and returns a promise that will be
     * resolved with the line the process outputs to stdout.
     * @param line line to write
     */
    write(line: string): Thenable<string | undefined> {
        return new Promise((resolve, reject) => {
            this.proc.stdin.write(line.trim() + '\n', () => {
                let res;
                this.promises.push(new Promise((resolve, reject) => {
                        res = resolve;
                }));
                this.resolvers.push(res);
                resolve(this.next());
            });
        });
    }

    /**
     * Returns a promises that will be resolved with the next line emitted
     * by the process.
     */
    next(): Thenable<string | undefined> {
        if (this.closed || this.promises.length === 0) {
            console.warn('unable to retrieve next');
            return Promise.resolve(undefined);
        }

        return this.promises.pop();
    }
}