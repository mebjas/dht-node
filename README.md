# dht-node
Did my course on distributed systems by Dr Indranil Gupta (UIUC) long back and have wanted to try out the principles explained in the course. We use distributed systems alot in our development pipelines but most of the concepts are abstracted out by the cloud solutions. I work for Azure, and we use concepts like scheduling, queuing, distributed caching all the time but most of these are provided as a SaaS offering. So I'm picking this up as a fun exercise to refresh the underlying concepts.


### A key-value store, or key-value database, is a data storage paradigm designed for storing, retrieving, and managing associative arrays, a data structure more commonly known today as a dictionary or hash. A distributed KV store is one where data is replicated across different nodes such that there is:
 - High Availability, and
 - No single point of failure

## Distributed Key Value Store
This will provide simple abstraction for CRUD operation on a key value pair. The operations will be exposed using simple rest calls like
````
POST http://localhost:8000/d/key -d "value"
GET http://localhost:8001/d/key
DELETE http://localhost:8002/d/key
````
I'll follow a cassandra like architecture where nodes maintain a virtual ring topology and location of key is retrieved based on hash function. Few things I'll follow:

 - Consistency type: Strong, Quorum based
 - Membership protocol: SWIM
 - No auth, No ssl
 - local clocks will be used, as they are already in sync with system clock.
 - The data will be stored in memory (in context of the process), no commit logs will be maintained; If all process die or some most die before replication data will be lost; 

## Setup and tests
Pre requisite
 - Download nodejs and npm for windows
 - Clone this repo: `git clone https://github.com/mebjas/dht-node.git`
 - CD to process dir: `cd process` - this path contain the code for process
 - Install the libraries - `npm install`
 - Run Tests - `npm test`
 - Initialize 24 nodes: `cd ..\ && .\init.cmd`

To run just `N` nodes skip the last step and manually invoke an instance using:
```cmd
node process\index.js <portno> <introducer>
```
`<portno>` - port number or this instance

`<introducer>` - port number of the introducer to which join request will be sent; Not needed for first instance - it will assume itself to be first instance because of this; I didn't go for any automatic discovery or centralized discovery mechanism here;

## Top level architecture
```
    ___________________________
    [ Rest + No Auth + No SSL ]
    ---------------------------
         _______________
         [ Application ]
         ---------------

___________   _______________   _________________
[ Storage ]   [ Replication ]   [ Stabalization ]
-----------   ---------------   -----------------
        _________________________
        [ Virtual Ring Topology ]
        -------------------------

        _______________________
        [ Membership Protocol ]
        -----------------------
```

## TASK 1.1: Membership Protocol
Implementing SWIM Protocol, where the membership gossips are piggibacked on PING, PING_REQ, JOINREQ, ACK responses. In a given protocol period a node will select a random node and send a ping. If it get's ACK well and good. It'd stay idle till completion of protocol period. If it doesn't get an ack, it'd send a ping request to K random nodes, and they will ping the target node. If any of then send an ack with in the target period the node is conisedered alive else it's moved to suspicions state; it no one confirms it's alive in time < 2 * protocol period - it's removed from the list;

These screenshots are when 8 nodes were joined and two of them crashed

![* nodes joined](./screenshot/membership.PNG)

![* nodes joined](./screenshot/membership_fd.PNG)

Detecting failures in 24 nodes :D 
![* nodes joined](./screenshot/membership_fd_24.PNG)

## TASK 1.2: Testing Membership Protocol

1. Simple unit testing using mocha framework for node js. It's pretty new to me but seems pretty powerful. I have done basic testing will do advanced ones later. Also since the library depends on HTTP calls some mocks / stubs shall be needed.
2. To Be Done is e2e testing of membership protocol<br>
        - create nodes<br>
        - JOIN nodes<br>
        - FAILURES & Failure detection<br>
        - Time to detection, accuracy of detection<br>
        - congestion / message drop emulation<br>
        - high load setup <br>

## TASK 2.1: Virtual ring topology
Now that underlying membership protocol works reasonably well and it can both detect failures and disemminate information in Gossip style to other nodes we can build the next layer - the virtual topology.

Each node is a member of the ring and their position is calculated based on a hash function of this format:
```js
hash: function(key) {
        return key - 8080;
}

positionInRing = hash(sha1(port).substr(0, 40))
```
### ~~Note: this function is very crude and has only been tested to give collision free ids to each port in range [8080, 8100]. Some collisions were observed beyond this range. If you are reproducing, you are adviced to instantiate nodes with similar range or change the hash function to a more appropriate one; This one gives value between [0, 600].~~
### Changed hash function to be as simple as `key - 8080`. It can take values between 8080 & 8336 and give a unique ring id between `[0, 256)`. Thus max ring size if 256 for now; 

### Some other points
 - Any no of nodes can be created; given their hash shouldn't collide;
 - Max Replication per key was set to 3, can be tested with more;
 - Quorum count in this case was sent to 2;

Flow:
1. For every request (CRUD) the hash of key is computed and it gives an index in range `[0, no of nodes)`. Replications are done in this index to next `X` nodes in ring (given by `MaxReplicationCount`). If no of nodes is less than this value all nodes replicate all key value pair;
2. Requests are sent to all replicas and once the quorum has replied with +ve response the response is sent to client - CRUD;
3. In case of failure to obtain a quorum request is replied with failure;


## TASK 2.2: Test Virtual ring topology
TBD

## TASK 3.1: Storage Replication & Stabalisation
Storage of data is abstracted out by `datastore.js`. Replication is done based on above mentioned approach; If during a read, members in a qourum respond with diff value - latest value is sent to client and `read-repair` for stale values is initiated;

### Task 3.1.2: Stabalisation - TBD
Stabalisation need to be done every time a new node joins or leaves the system.

## TASK 3.2: Test Storage Replication & Stabalisation
TBD

## TASK 4: Rest API + Test - final
To the client the nodes expose three apis

/Get a Key
```
GET /s/key?key=key9 HTTP/1.1
Host: localhost:8083
```

/Set a key
```
POST /s/key HTTP/1.1
Host: localhost:8080
Content-Type: application/json

{
	"key": "key9",
	"value": "value9"
}
```

/Delete a key
```
DELETE /s/key?key=key9 HTTP/1.1
Host: localhost:8081
```
## References:
 - Coursera Cloud Computing Concepts, Part 1 - [https://www.coursera.org/learn/cloud-computing/home/welcome](https://www.coursera.org/learn/cloud-computing/home/welcome)
 - Building a Distributed Fault-Tolerant Key-Value Store - [http://blog.fourthbit.com/2015/04/12/building-a-distributed-fault-tolerant-key-value-store](http://blog.fourthbit.com/2015/04/12/building-a-distributed-fault-tolerant-key-value-store)
 - Consistent hashing in Cassandra - [https://blog.imaginea.com/consistent-hashing-in-cassandra/](https://blog.imaginea.com/consistent-hashing-in-cassandra/)



