import * as assert from 'assert';

import { 
    inString, getFuncArg, findArgNum, platformBin,
    sortedItems,
} from '../src/autocompletion';

suite("Autocompletion Tests", () => {
    test('inString', () => {
        [
            { input: '`foo ` + `a` + 3', pos: 13, expected: false },
            { input: 'foo(\'bar baz\\\' with inner """\')', pos: 29, expected: true },
            { input: '" foo bar \'baz\'"', pos: 13, expected: true },
            { input: 'return a + b', pos: 10, expected: false },
        ].forEach(({ input, pos, expected }) => {
            assert.equal(
                inString(input, pos), 
                expected,
                input,
            );
        });
    });

    test('findArgNum', () => {
        [
            { call: '()', pos: 1, expected: 1 },
            { call: '(foo(2, 3), bar(1), )', pos: 20, expected: 3 },
            { call: '(foo(2, 3), bar[1], )', pos: 16, expected: 2 },
            { call: '(foo{2, 3}, bar{1}, )', pos: 8, expected: 1 },
        ].forEach(({ call, pos, expected }) => {
            assert.equal(findArgNum(call, pos), expected, call);
        });
    });

    test('platformBin', () => {
        [
            { platform: 'linux', bin: 'foo', expected: 'foo_linux' },
            { platform: 'darwin', bin: 'foo', expected: 'foo_darwin' },
            { platform: 'win32', bin: 'foo', expected: 'foo_win32' },
        ].forEach(({ platform, bin, expected }) => {
            assert.equal(
                platformBin(platform, bin), 
                expected,
                `${platform} ${bin}`,    
            );
        })
    });

    test('getFuncArg', () => {
        [
            { type: 'func(format string, a ...interface{})', expected: 'format', num: 1 },
            { type: 'func(format string, a ...interface{})', expected: 'a', num: 2 },
            { type: 'func(fn func(int, string) string, val int)', expected: 'fn', num: 1 },
            { type: 'func(fn func(int, string) string, val map[string]interface{})', expected: 'val', num: 2 },
            { type: 'func(a, b, c string, fn func(func(), int) int)', expected: 'a', num: 1 },
            { type: 'func(a, b, c string, fn func(func(), int) int)', expected: 'b', num: 2 },
            { type: 'func(a, b, c string, fn func(func(), int) int)', expected: 'c', num: 3 },
            { type: 'func(a, b, c string, fn func(func(), int) int)', expected: 'fn', num: 4 },
            { type: 'func(a, b, c string, fn func(func(), int) int)', expected: undefined, num: 5 },
        ].forEach(({ type, expected, num }) => {
            assert.equal(
                getFuncArg({ value: { type } }, num), 
                expected,
                `${type} ${num}`,
            );
        });
    });

    test('sortedItems', () => {
        const items = [
            { label: 'foo' },
            { label: 'bar' },
            { label: 'baz' },
        ];

        assert.deepEqual(
            sortedItems(items, ['baz', 'foo', 'qux']).map(i => i.label),
            ['baz', 'foo'],
        );
    });
});