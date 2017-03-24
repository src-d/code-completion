'use strict';

import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface CmdOutput {
    stdout: string;
    stderr: string;
}

let binPathCache: { [bin: string]: string | null } = {};

const binName = (name: string): string => process.platform === 'win32' 
    ? `${name}.exe` 
    : name;

function exists(file: string): boolean {
    try {
		return fs.statSync(file).isFile();
	} catch (e) {
		return false;
	}
}

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