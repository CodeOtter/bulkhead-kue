var Bulkhead = require('bulkhead'),
	async = require('async'),
	Kue = require('kue'),
	_ = require('lodash');

/**
 * The Queue service quickly integrates LearnBoost's Kue into a SailsJS project as a Bulkhead service
 */
module.exports = new function(){

	var self = this,
		queues = {};

	Bulkhead.service.call(this, '', {
		'number': function(criteria, next) {
			Kue.Job.get(criteria, function(err, result) {
				next(err, result ? result.data : result);
			});
		},
		'string': function(criteria, next) {
			Kue.Job.getByState(criteria, 0, -1, 'desc', function(err, result) {
				next(err, result ? result.data : result);
			});
		},
		'object': function(criteria, next) {
			criteria.type = criteria.type || '*';
			criteria.state = criteria.state || '*';
			criteria.from = criteria.from || 0;
			criteria.to = criteria.to || -1;
			criteria.order = criteria.order || 'desc';

			Kue.Job.getByType(criteria.type, criteria.state, criteria.from, criteria.to, criteria.order, function(err, result) {
				next(err, result ? result.data : result);
			});
		}
	});

	/**
	 * Accesses a registered queue.  If the queue does not exist, the service will create one.
	 * @param	String		Name of the queue
	 * @param	Object		Configuration object (port, host, auth)
	 * @return	Object		LearnBoost Kue instance
	 */
	self.queue = function(name, config) {
		if(queues[name] === undefined) {
			if(config === undefined) {
				config = {};
			}

			config.port = config.port || sails.config.sockets.port;
			config.host = config.host || sails.config.sockets.host;
			config.auth = config.auth || sails.config.sockets.pass;

			queues[name] = Kue.createQueue(config);
		}
		return queues[name];
	};

	/**
	 * Shuts down a queue
	 * @param	String		Name of the queue
	 * @param	Function	Callback to fire when finished
	 */
	self.shutdown = function(name, callback) {
		queues[name].shutdown(callback);
	};

	/**
	 * Empties a queue of all entries
	 * @param	String		Name of the queue
	 * @param	Function	Callback to fire when finished
	 */
	self.flush = function(name, callback) {
		var client = QueueService.queue(name).client;
		if(client) {
			client.flushdb(callback);
		}
	};
	
	/**
	 * 
	 */
	self.events = {
		cleanup: function(id, result) {
			Kue.Job.get(id, function(err, job) {
				if(err) return;
				job.remove(function(err) {
					if(err) throw err;
				});
			});
		},
		log: function(job) {
			console.log(job);
		}
	};
	
	/**
	 * Creates a job for a queue
	 * @param	String		Name of the queue
	 * @param	String		Name of the job type
	 * @param	Mixed		Data to attach to the job
	 * @param	Function	Callback to fire when the job is processed
	 * @param	Function	Callback to fire when the job creation is done
	 * @param	Object		Job configuration object (priority, attempts, delay, backoff, events)
	 */
	self.create = function(queue, type, data, completed, done, config) {
		var job = self.queue(queue).create(type, data);
		if(!config) {
			config = {};
		}

		if(config.priority === undefined || config.priority === null) {
			config.priority = 'normal';
		}
		job.priority(config.priority);

		if(config.attempts === undefined || config.attempts === null) {
			config.attempts = 1;
		}
		job.attempts(config.attempts);

		if(config.delay !== undefined && config.delay !== null) {
			// @TODO: implement moment to allow jobs to expire at specific times
			job.delay(config.delay);
		}

		if(config.backoff !== undefined || config.backoff !== null) {
			job.backoff(config.backoff);
		}

		if(config.events === undefined || config.events === null) {
			config.events = {
				'complete': function() { console.log('complete'); console.log(arguments); },
				'failed attempt': function() { console.log('failed attempt'); console.log(arguments); },
				'failed': function() { console.log('failed'); console.log(arguments); },
				'promotion': function() { console.log('promotion'); console.log(arguments); },
				'progress': function() { console.log('progress'); console.log(arguments); },
				'job complete': function() { console.log('job complete'); console.log(arguments); },
				'job failed': function() { console.log('job failed'); console.log(arguments); },
				'error': function() { console.log('job failed'); console.log(arguments); }
			};
		}
		
		if(completed) {
			config.events.complete = function(results) {
				completed(results, job);
			};
		}

		for(var i in config.events) {
			job.on(i, config.events[i]);
		}

		job.save(function(err) {
			if(err)
				return self.result(false, done, data, job, err);

			return self.result(job.data, done, data);
		});
	};

	/**
	 * Removes matching jobs from a queue
	 * @param	Criteria	Bulkhead service criteria
	 * @param	Function	Callback to fire when finished
	 */
	self.remove = function(criteria, done) {
		var self = this;
		this.find(criteria, function(err, results) {
			// Get accounts
			if(err)
				return self.result(false, done, criteria, 'message queue failure', err);
			if(results.isEmpty())
				return self.result(false, done, criteria, 'no jobs found');

			async.concat(results.responses(), function(record, next) {
				Kue.Job.remove(record.id, function(err) {
					next(err, new Bulkhead.result(record, true));
				});
			}, function(err, results) {
				// Package the result
				return done(err, self.result(results));
			});
		});
	};
		
	/**
	 * Processes all jobs in a queue of a specific job type
	 * @param	String		Name of the queue
	 * @param	String		Name of the job type
	 * @param	Mixed		If a Number, how many jobs to process.  If a Function, will be called back per job being processed. 
	 * @param	Function	Callback to fire when finished
	 */
	self.process = function(queue, type, perProcess, done) {
		var queue = self.queue(queue);
		if(perProcess === undefined || perProcess === null) {
			perProcess = 1;
		}
		queue.process(type, perProcess, done);
	};
};
