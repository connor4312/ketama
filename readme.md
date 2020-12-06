# ketama

[![Actions Status](https://github.com/connor4312/ketama/workflows/Run%20Tests/badge.svg)](https://github.com/connor4312/ketama/actions)

Ketama is a JavaScript/TypeScript implementation of the [libketama](https://www.metabrew.com/article/libketama-consistent-hashing-algo-memcached-clients) hash ring. The primary advantage of ketama-style hashing is that it reduces the amount of work which is shuffled to other servers when the hashring membership changes.

    npm install --save ketama

Then hash things:

```js
// alternatively: const { HashRing } = require('ketama');
import { HashRing } from 'ketama';

const ring = new HashRing();

ring.addNode('127.0.0.1'); // add with default weight
ring.addNode('127.0.0.2', 2); // weight of 2 = twice as likely to choose this one

export function onDoWork(input) {
  // hashes the input and choses a server based on it:
  const server = ring.getNode(input);
  doWorkOn(server);
}

export function doWorkOnMultipleServers(input) {
  // picks two "replica" servers from the ring to do work on
  for (const server of ring.getNodes(input, 2)) {
    doWorkOn(server);
  }
}
```

## Table of Contents

- - [HashRing(\[nodes\], \[hashFunction\])](#hashringnodes-hashfunction)
    - [hashRing.addNode(node\[, weight\])](#hashringaddnodenode-weight)
    - [hashRing.removeNode(node)](#hashringremovenodenode)
    - [hashRing.getNode(input)](#hashringgetnodeinput)
    - [hashRing.getNodes(input, replicas)](#hashringgetnodesinput-replicas)
- [Related Projects](#related-projects)

## HashRing(\[nodes], \[hashFunction])

Creates a new `HashRing`, optionally with the initial set of nodes. The nodes can be _either_ a string, or an object with a string property "key" which will be used internally to hash against, for example:

```js
new HashRing(['127.0.0.1', { key: '127.0.0.2', port: 1337 }]);
```

When giving the nodes in the constructor, you can specify a weight by providing an object with the `node` and its `weight`. Weights are proportional; a node with a weight of `2` is twice as likely to be chosen than one with the default weight of `1`. For example:

```js
new HashRing([
  { node: '127.0.0.1', weight: 2 },
  { node: { key: '127.0.0.2', port: 1337 }, weight: 3
]);
```

Finally, you can also specify the hashing function to use. This can be either the name of an algorithm the `require('crypto').createHash` implements, or a custom function that returns an int32 given a Buffer. Defaults to `sha1`. For example:

```js
new HashRing([], 'md5'); // hash with md5 instead
new HashRing([], buf => myCustomHash().readInt32BE()); // custom function
```

### hashRing.addNode(node\[, weight])

Adds a new node to the existing hashring. The node can be _either_ a string, or an object with a string property "key" which will be used internally to hash against.

```js
ring.addNode('127.0.0.1');
ring.addNode({ key: '127.0.0.2', port: 1337 });
```

You can optionally specify a weight as the second argument. Weights are proportional; a node with a weight of `2` is twice as likely to be chosen than one with the default weight of `1`.

If the node already exists, it is replaced; for example, you can call `addNode` multiple times to update a node's weight.

### hashRing.removeNode(node)

Removes a node previously added to the hash ring.

```js
ring.removeNode('127.0.0.1');
```

No-op if the node is not in the ring.

### hashRing.getNode(input)

Gets the node on which work should be done for the given input, which should be either a string or buffer. Returns the object or string originally given to `addNode` or `new HashRing()`, or returns `undefined` if the ring is empty.

```js
const server = ring.getNode(inputData);
doWorkOn(server);
```

### hashRing.getNodes(input, replicas)

Gets the "replicas" number of nodes that should handle the input, which should be either a string or buffer. The returned array length wiill equal the number of replicas, except if there are fewer nodes available than replicas requested, in which case all nodes are returned.

```js
for (const server of ring.getNodes(input, 2)) {
  doWorkOn(server);
}
```

# Related Projects

- [libketama](https://github.com/RJ/ketama) -- the original (with native bindings in other languages)
- [serialx/hashring](https://github.com/serialx/hashring) -- a library I used in services and where I borrowed implemenation pointers from; Go is much easier for me to read than C :)
- [node-hashring](https://github.com/3rd-Eden/node-hashring) -- a prior implementation in JS. It's good but is more complex and makes assumptions about use case; I wanted a very lightweight and generic hashring for use in [another libary](https://github.com/microsoft/etcd3)
