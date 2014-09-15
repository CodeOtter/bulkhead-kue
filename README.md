bulkhead-kue
============

A Bulkhead plugin that easily integrates LearnBoost's Kue into a SailJS project.

## Installation

`npm install bulkhead-kue`

Then, in the `config/bootstrap.js` file of your SailsJS project directory, replace the default `cb()` with:

```javascript
require('bulkhead').plugins.initialize(sails, cb);
```

If you are using `Bulkhead-Kue` with [Bulkhead-Test](https://github.com/CodeOtter/bulkhead-test), the suite has to be lifted like this:

```javascript
var Suite = require('bulkhead-test');
Suite.lift(null, function() {
	QueueService.flush(queueName);
});
```

## Usage

To create new jobs in a queue, do the following:

```javascript
var QueueService = require('bulkhead-kue');
QueueService.create('SomeQueue', 'SomeJobType', { name: 'bob' }, function(results, job) {
	// Callback that is fired when the job is processed.
	console.log(results.name) // Outputs 'bob'
	console.log(job.id) // Outputs 1
}, function(err, results) {
	// Callback that is fired when the job is saved into the queue
	console.log(results.response().name) // Outputs 'bob'
});
```

> **NOTE**:
>
> If you create a new job on a queue that has not been created yet, `.create()` will create the queue as well.

To get access to the queue and it's [Kue methods](https://github.com/LearnBoost/kue/blob/0.8.3/lib/kue.js#L84), do the following:

```javascript
QueueService.queue('SomeQueue');
```

To find jobs [by their processing state](https://github.com/LearnBoost/kue/blob/0.8.3/lib/queue/job.js#L125), the search criteria should be a string:

```javascript
QueueService.find('inactive', function(err, result) {
	console.log(result.response().name); // Outputs 'bob'
});
```

To find jobs by their ID, the search criteria should be a number:

```javascript
QueueService.find(1, function(err, result) {
	console.log(result.response().name); // Outputs 'bob'
});
```

To find jobs by [complex criteria](https://github.com/LearnBoost/kue/blob/0.8.3/lib/queue/job.js#L142), the search criteria should be an object:

```javascript
QueueService.find({
	type: 'SomeJobType',
	state: '*',
	from: 0,
	to: -1,
	order: 'desc'
}, function(err, result) {
	console.log(result.response().name); // Outputs 'bob'
});
```

To process all jobs in a queue, do the following:

```javascript
QueueService.process(queueName, type, null, function(job, next) {
    // Callback that is fired per job being processed
	console.log(job.data.name) // Outputs 'bob'
	next(undefined, job.data); // Moves on to the next job to process
});
```

[Read the official Kue documentation for more advanced usage.](https://github.com/LearnBoost/kue)