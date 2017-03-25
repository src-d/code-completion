'use strict';

import {
	CompletionItemProvider,
	TextDocument, Position, CancellationToken,
	CompletionItem, CompletionItemKind, Uri, Range,
} from 'vscode';
import { exec, binPath, LineExchangeProcess } from './process';

const assignRegex = /([a-zA-Z][a-zA-Z0-9]*) *:?= *$/;
const methodRegex = /([a-zA-Z][a-zA-Z0-9]*)\.$/;

export default class GoCompletionProvider implements CompletionItemProvider {
	private configured: boolean;
	private relevanceSorter: LineExchangeProcess;
	private suggester: LineExchangeProcess;

	constructor(relevanceSorter: LineExchangeProcess, suggester: LineExchangeProcess) {
		this.relevanceSorter = relevanceSorter;
		this.suggester = suggester;
	}

	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionItem[]> {
		const text = document.getText();
		const pos = document.offsetAt(position);

		// don't suggest tokens if the previous line has text but the current one is empty
		if (!document.lineAt(position.line-1).isEmptyOrWhitespace 
			&& document.lineAt(position.line).isEmptyOrWhitespace) {
			return Promise.resolve([]);
		}

		const line = document.getText(document.lineAt(position.line).range);
		if (inString(line, position.character)) {
			return Promise.resolve([]);
		}

		return this.ensureConfigured().then(() => {
			return Promise.all([
				autocompleteSymbol(pos, text)
					.then(items => this.sortedCompletions(line, position.character, items)),
				this.tokenize(pos, text)
					.then(tokens => this.suggestNextTokens(tokens)),
			]).then(([completions, suggestions]) => {
				return processSuggestions(
					document,
					position,
					completions,
					suggestions,
				);
			});
		});
	}

	ensureConfigured(): Thenable<void> {
		const config = new Promise<void>((resolve, reject) => {
			if (this.configured) {
				return resolve();
			}

			const gocode = binPath('gocode');
			return Promise.all([
				exec(gocode, ['set', 'propose-builtins', 'false']),
				exec(gocode, ['set', 'autobuild', 'true']),
			]).then(_ => {
				this.configured = true;
			});
		});

		return Promise.all([config])
			.then(_ => Promise.resolve());
	}

	sortByRelevance(ident: string, items: CompletionItem[]): Thenable<CompletionItem[]> {
		items = items.filter(c => c.label !== ident);
		return this.relevanceSorter
			.write([ident, ...items.map(c => c.label)].join(','))
			.then(line => {
				if (line) {
					const sorted = line.split(',');
					return items
						.sort((a, b) => sorted.indexOf(a.label) - sorted.indexOf(b.label));
				}

				return items;
			});
	}

	sortedCompletions(line: string, pos: number, items: CompletionItem[]): Thenable<CompletionItem[]> {
		const lineTilPos = line.substring(0, pos).trim();
		let ident;
		if (methodRegex.test(lineTilPos)) {
			ident = methodRegex.exec(lineTilPos)[1];
		} else if (assignRegex.test(lineTilPos)) {
			ident = assignRegex.exec(lineTilPos)[1];
		}

		if (ident) {
			return this.sortByRelevance(ident, items);
		}

		return Promise.resolve(items);
	}

	tokenize(position: number, text: string): Thenable<string> {
		const tokenizer = binPath('tokenizer');
		return new Promise<string>((resolve, reject) => {
			exec(tokenizer, [`-pos=${position}`], text)
				.then(out => {
					if (out.stdout.startsWith('!ERR')) {
						reject(out.stdout.substr(out.stdout.indexOf(':')));
					} else {
						resolve(out.stdout);
					}
				});
		});
	}

	suggestNextTokens(tokens: string): Thenable<string[]> {
		return this.suggester.write(tokens.trim())
			.then(line => {
				return line
					.trim()
					.split(' ');
			});
	}
}

function autocompleteSymbol(position: number, text: string): Thenable<CompletionItem[]> {
	const gocode = binPath('gocode');
	return exec(gocode, ['-f=json', 'autocomplete', 'c' + position], text)
		.then(output => {
			const suggestions = <[number, GocodeSuggestion[]]>JSON.parse(output.stdout);
			return suggestions[1].map(s => {
				return {
					label: s.name,
					kind: classToKind(s.class),
					detail: s.type,
				};
			}).filter(s => s.kind != null);
		});
}

function isAlpha(code: number): boolean {
	return (code > 47 && code < 58) ||
		(code > 64 && code < 91) ||
		(code > 96 && code < 123);
}

interface GocodeSuggestion {
	class: string;
	name: string;
	type: string;
}

function classToKind(cls: string): CompletionItemKind {
	switch (cls) {
		case 'func':
			return CompletionItemKind.Function;
		case 'package':
			return CompletionItemKind.Module;
		case 'var':
			return CompletionItemKind.Variable;
		case 'type':
			return CompletionItemKind.Class;
		case 'const':
			return CompletionItemKind.Variable;
		default:
			return null;
	}
}

function processSuggestions(document: TextDocument, pos: Position, completions: CompletionItem[], suggestions: string[]): CompletionItem[] {
	if (suggestions.length === 0) {
		return completions;
	}

	const result = [];
	let completionsAdded = [];
	suggestions.forEach((suggestion, i) => {
		let [s, confidence] = suggestion.split('@');
		s = s.startsWith("'") ? s.substring(1, s.length - 1) : s;
		if (Number(confidence) < 0.3) {
			return;
		}

		if (s === 'ID_S' && completionsAdded.length != completions.length) {
			result.push(...completions
				.filter(c => completionsAdded.indexOf(c.label) < 0)
				.map((c, j) => withSortKey(c, i, j)));
			completionsAdded.push(completions.map(c => c.label));
		} else if (s.startsWith('ID_LIT_')) {
			if (s === 'ID_LIT_BOOL') {
				result.push([
					{ label: 'true', insertText: 'true', kind: CompletionItemKind.Keyword },
					{ label: 'false', insertText: 'false', kind: CompletionItemKind.Keyword },
				].map((c, j) => withSortKey(c, i, j)));
			}

			if (completionsAdded.length !== completions.length) {
				const toAdd = completions.filter(c => completionsAdded.indexOf(c.label) < 0)
					.filter(isOfType(s.substring(s.lastIndexOf('_')+1).toLowerCase()))
					.map((c, j) => withSortKey(c, i, s === 'ID_LIT_BOOL' ? j + 2 : j));
				result.push(...toAdd);
				completionsAdded.push(toAdd.map(c => c.label));
			}
		} else if (!s.startsWith('ID_')) {
			const prefix = requiresNewLine(s, document.lineAt(pos.line).isEmptyOrWhitespace) ? '\n' : '';
			result.push(withSortKey({
				label: s,
				insertText: prefix + s,
				kind: CompletionItemKind.Keyword,
			}, i));
		}
	});

	return result;
}

const newLineKeywords = ['if', 'for', 'select', 'switch', 'defer', 'go'];

function requiresNewLine(suggestion: string, isEmpty: boolean): boolean {
	return newLineKeywords.indexOf(suggestion) >= 0 && !isEmpty;
}

function withSortKey(item: CompletionItem, i: number, j: number = 0): CompletionItem {
	item.sortText = `${i}${j}`;
	return item;
}

function inString(line: string, pos: number): boolean {
	let idx;
	if (inQuoted(line, pos, '"') || inQuoted(line, pos, "'")) {
		return true;
	} else if ((idx = line.indexOf('`')) < pos) {
		const n = Array.from(line.substring(idx, pos)).filter(c => c === '`').length;
		return n % 2 > 0;
	}

	return false;
}

function inQuoted(line: string, pos: number, quote: string): boolean {
	let idx = line.indexOf(quote);
	let inStr = false;
	if (idx >= 0 && idx < pos) {
		inStr = true;
		while (idx >= 0 && idx < pos) {
			idx = line.indexOf(quote, idx+1);
			if (idx-1 >= 0 && line.charAt(idx-1) != '\\') {
				inStr = !inStr;
			}
		}
	}
	return inStr;
}

const typeMapping: { [k: string]: string[] | string } = {
	'int': ['uint8', 'byte', 'int8', 'int16', 'uint16', 'int32', 'uint32', 'int', 'uint', 'int64', 'uint64', 'uintptr'],
	'imag': ['complex128', 'complex256'],
	'string': 'string',
	'char': 'rune',
	'bool': 'bool',
	'float': ['float32', 'float64'],
};

function isOfType(typ: string): (CompletionItem) => boolean {
	const t = typeMapping[typ];
	if (Array.isArray(t)) {
		return c => t.indexOf(c.detail) >= 0;
	}
	return (c) => c.detail === t;
}