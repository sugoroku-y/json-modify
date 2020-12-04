import {unescape, evaluate, parsePath, modify} from './json-editor';

test('unescape', () => {
  expect(unescape("\\t\\r\\n\\x22\\'\\u3032")).toBe('\t\r\n"\'\u3032');
  expect(unescape('abc123あいう')).toBe('abc123あいう');
});
test('evaluate', () => {
  expect(evaluate('null')).toBe(null);
  expect(evaluate('true')).toBe(true);
  expect(evaluate('false')).toBe(false);
  expect(evaluate('-0.1')).toBe(-0.1);
  expect(evaluate('-1.')).toBe(-1);
  expect(evaluate('-.1')).toBe(-0.1);
  expect(evaluate('-.1e5')).toBe(-0.1e5);
  expect(evaluate('-.1e+5')).toBe(-0.1e5);
  expect(evaluate('-.1e-5')).toBe(-0.1e-5);
  expect(evaluate('+0.1')).toBe(0.1);
  expect(evaluate('+1.')).toBe(1);
  expect(evaluate('+.1')).toBe(0.1);
  expect(evaluate('+.1e5')).toBe(0.1e5);
  expect(evaluate('+.1e+5')).toBe(0.1e5);
  expect(evaluate('+.1e-5')).toBe(0.1e-5);
  expect(evaluate('0.1')).toBe(0.1);
  expect(evaluate('1.')).toBe(1);
  expect(evaluate('.1')).toBe(0.1);
  expect(evaluate('.1e5')).toBe(0.1e5);
  expect(evaluate('.1e+5')).toBe(0.1e5);
  expect(evaluate('.1e-5')).toBe(0.1e-5);
  expect(evaluate('undefined')).toBe('undefined');
  expect(evaluate("'string'")).toBe('string');
});

test('parsePath', () => {
  expect(parsePath('test')).toEqual([{type: 'object', path: '', name: 'test'}]);
  expect(() => parsePath('')).toThrow('wholepath must not be empty.');
  expect(() => parsePath('test[+1+]')).toThrow(
    'One of the prefix `+` and the sufix `+` can be specified.: `test`'
  );
});

test('modify', () => {
  let obj;
  expect((obj = modify(obj, 'set layer1.layer2.layer3[1]=true'))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
    },
  });
  expect((obj = modify(obj, 'set layer1.layer2_2.layer3=12'))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
      layer2_2: {
        layer3: 12,
      },
    },
  });
  expect((obj = modify(obj, 'delete layer1.layer2_2.layer3'))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
      layer2_2: {},
    },
  });
  expect((obj = modify(obj, 'delete layer2.layer2_2.layer3'))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
      layer2_2: {},
    },
  });
  expect((obj = modify(obj, 'set layer1.layer2_2.layer3[+]=1'))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
      layer2_2: {
        layer3: [1],
      },
    },
  });
  expect((obj = modify(obj, "set layer1.layer2_2.layer3[1+]='test'"))).toEqual({
    layer1: {
      layer2: {
        layer3: [undefined, true],
      },
      layer2_2: {
        layer3: [1, undefined, 'test'],
      },
    },
  });
  expect((obj = modify(obj, "set layer1.layer2_2.layer3[+1]='test2'"))).toEqual(
    {
      layer1: {
        layer2: {
          layer3: [undefined, true],
        },
        layer2_2: {
          layer3: [1, 'test2', undefined, 'test'],
        },
      },
    }
  );
  expect(
    modify(undefined, "set layer1['layer2-2'].layer3[+1]='test2'")
  ).toEqual({
    layer1: {
      'layer2-2': {
        layer3: [undefined, 'test2'],
      },
    },
  });
});

test('modify exception', () => {
  expect(() => modify(undefined, 'unknown command')).toThrow(
    'Unrecognized command'
  );
  expect(() => modify({test: 12}, 'set test.test=1')).toThrow(
    '`test` should be object, but is number.'
  );
  expect(() => modify({test: [12]}, 'delete test.test')).toThrow(
    '`test` should be object, but is array.'
  );
  expect(() => modify({test: {a: 12}}, 'delete test[1]')).toThrow(
    '`test` should be array, but is object.'
  );
  expect(() => modify({test: null}, 'delete test[1]')).toThrow(
    '`test` should be array, but is null.'
  );
  expect(() => modify({test: {}}, 'delete test[1]')).toThrow(
    '`test` should be array, but is object.'
  );
  expect(() => modify({test: 'string'}, 'delete test[1]')).toThrow(
    '`test` should be array, but is string.'
  );
  expect(() => modify(undefined, 'delete test[+]')).toThrow(
    '`+` can be specified in the set command: test[+]'
  );
  expect(() => modify({}, 'delete test[')).toThrow('Unrecognized path: test[');
});
