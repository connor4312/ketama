import * as assert from 'assert';
import { HashRing } from '.';

const assertProbabilities = (
  probs: { [key: string]: number },
  getNodes: (v: string) => (string | undefined)[],
  delta = 0.05,
) => {
  const actual: { [key: string]: number } = {};
  const samples = 1000;
  for (let i = 0; i < samples; i++) {
    for (const value of getNodes(String(i))) {
      if (!value) {
        throw new Error('unexpected undefined');
      }

      actual[value] = (actual[value] || 0) + 1 / samples;
    }
  }

  for (const key of Object.keys(probs)) {
    if (Math.abs(actual[key] - probs[key]) > delta) {
      console.log('expected:', probs, 'actual:', actual);
      throw new Error('unexpected probability');
    }
  }
};

const assertSingleProbabilities = (r: HashRing, probs: { [key: string]: number }) =>
  assertProbabilities(probs, v => [r.getNode(v)]);

it('constructs without weights', () => {
  assertSingleProbabilities(new HashRing(['a', 'b', 'c']), {
    a: 1 / 3,
    b: 1 / 3,
    c: 1 / 3,
  });
});

it('constructs with weights', () => {
  assertSingleProbabilities(new HashRing(['a', 'b', { node: 'c', weight: 2 }]), {
    a: 1 / 4,
    b: 1 / 4,
    c: 1 / 2,
  });
});

it('adds a node to the ring', () => {
  const r = new HashRing<string>(['a', 'b', 'c']);
  r.addNode('d');
  assertSingleProbabilities(r, {
    a: 1 / 4,
    b: 1 / 4,
    c: 1 / 4,
    d: 1 / 4,
  });
});

it('updates an existing node weight', () => {
  const r = new HashRing<string>(['a', 'b', 'c']);
  r.addNode('c', 2);
  assertSingleProbabilities(r, {
    a: 1 / 4,
    b: 1 / 4,
    c: 1 / 2,
  });
});

it('removes a node from the ring', () => {
  const r = new HashRing<string>(['a', 'b', 'c']);
  r.removeNode('c');
  assertSingleProbabilities(r, {
    a: 1 / 2,
    b: 1 / 2,
  });
});

it('no-ops if a node does not exist', () => {
  const r = new HashRing<string>(['a', 'b', 'c']);
  r.removeNode('q');
});

it('returns undefined from getNode on empty ring', () => {
  assert.strictEqual(undefined, new HashRing().getNode('x'));
});

it('returns all nodes when replicas insufficient ', () => {
  assert.deepStrictEqual([], new HashRing().getNodes('x', 2));
  assert.deepStrictEqual(['a'], new HashRing(['a']).getNodes('x', 2));
});

it('returns replicas correctly ', () => {
  assert.deepStrictEqual(['b', 'c'], new HashRing(['a', 'b', 'c']).getNodes('x', 2));
});

it('returns replica with correct probabilities ', () => {
  const r = new HashRing(['a', 'b', { node: 'c', weight: 2 }]);
  assertProbabilities(
    {
      a: (1 / 4) * 2,
      b: (1 / 4) * 2,
      c: (1 / 2) * 2,
    },
    v => r.getNodes(v, 2),
    0.15,
  );
});
