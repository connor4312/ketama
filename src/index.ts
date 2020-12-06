import { createHash } from 'crypto';

/**
 * Function that returns an int32 hash of the input (a number between
 * -2147483648 and 2147483647). If your hashing library gives you a Buffer
 * back, a convienent way to get this is `buf.readInt32BE()`.
 */
export type HashFunction = (input: Buffer) => number;

const hashFunctionForBuiltin = (algorithm: string): HashFunction => value =>
  createHash(algorithm).update(value).digest().readInt32BE();

const keyFor = (node: string | { key: string }) => (typeof node === 'string' ? node : node.key);

type HashClock = [hash: number, node: string][];

export class HashRing<TNode extends string | { key: string } = string> {
  /**
   * Base weight of each node in the hash ring. Having a base weight of 1 is
   * not very desirable, since then, due to the ketama-style "clock", it's
   * possible to end up with a clock that's very skewed when dealing with a
   * small number of nodes. Setting to 50 nodes seems to give a better
   * distrubtion, so that load is spread roughly evenly to +/- 5%.
   */
  public static baseWeight = 50;

  private readonly hashFn: HashFunction;
  private clock: HashClock = [];
  private nodes = new Map<string, TNode>();

  constructor(
    initialNodes: ReadonlyArray<TNode | { weight: number; node: TNode }> = [],
    hashFn: string | HashFunction = 'sha1',
  ) {
    this.hashFn = typeof hashFn === 'string' ? hashFunctionForBuiltin(hashFn) : hashFn;
    for (const node of initialNodes) {
      if (typeof node === 'object' && 'weight' in node && 'node' in node) {
        this.addNode(node.node, node.weight);
      } else {
        this.addNode(node);
      }
    }
  }

  /**
   * Add a new node to the ring. If the node already exists in the ring, it
   * will be updated. For example, you can use this to update the node's weight.
   */
  public addNode(node: TNode, weight = 1) {
    if (weight === 0) {
      this.removeNode(node);
    } else if (weight < 0) {
      throw new RangeError(`Cannot add a node to the hashring with weight < 0`);
    } else {
      this.removeNode(node);
      const key = keyFor(node);
      this.nodes.set(key, node);
      this.addNodeToClock(key, Math.round(weight * HashRing.baseWeight));
    }
  }

  /**
   * Removes th enode from the ring. No-op's if the node does not exist.
   */
  public removeNode(node: TNode) {
    const key = keyFor(node);
    if (this.nodes.delete(key)) {
      this.clock = this.clock.filter(([, n]) => n !== key);
    }
  }

  /**
   * Gets the node which should handle the given input. Returns undefined if
   * the hashring has no elements with weight.
   */
  public getNode(input: string | Buffer): TNode | undefined {
    if (this.clock.length === 0) {
      return undefined;
    }

    const index = this.getIndexForInput(input);
    const key = index === this.clock.length ? this.clock[0][1] : this.clock[index][1];

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.nodes.get(key)!;
  }

  private getIndexForInput(input: string | Buffer) {
    const hash = this.hashFn(typeof input === 'string' ? Buffer.from(input) : input);
    return binarySearchRing(this.clock, hash);
  }

  /**
   * Gets the "replicas" number of nodes that should handle the input. The
   * returned array length wiill equal the number of replicas, except if
   * there are fewer nodes available than replicas requested.
   */
  public getNodes(input: string, replicas: number): TNode[] {
    if (replicas >= this.nodes.size) {
      return [...this.nodes.values()];
    }

    const chosen = new Set<string>();

    // We know this will terminate, since we know there are at least as many
    // unique nodes to be chosen as there are replicas
    for (let i = this.getIndexForInput(input); chosen.size < replicas; i++) {
      chosen.add(this.clock[i % this.clock.length][1]);
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return [...chosen].map(c => this.nodes.get(c)!);
  }

  private addNodeToClock(key: string, weight: number) {
    for (let i = weight; i > 0; i--) {
      const hash = this.hashFn(Buffer.from(key + `\0` + i));
      this.clock.push([hash, key]);
    }

    this.clock.sort((a, b) => a[0] - b[0]);
  }
}

function binarySearchRing(ring: HashClock, hash: number) {
  let mid: number;
  let lo = 0;
  let hi = ring.length - 1;

  while (lo <= hi) {
    mid = Math.floor((lo + hi) / 2);

    if (ring[mid][0] >= hash) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }

  return lo;
}
