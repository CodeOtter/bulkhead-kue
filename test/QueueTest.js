var Suite = require('bulkhead-test'),
	assert = require('assert'),
	QueueService = require('../api/services/QueueService'),

	queueName = 'testQueue',
	type = 'testType';

describe.only('QueueService', function() {
	Suite.lift(null, function() {
		QueueService.flush(queueName);
	});

	describe('Base Class', function() {
		it('should equeue a job then process it', function(done) {
			QueueService.create(queueName, type, { name: 'bob' }, function(results, job) {
				// Job processed
				assert.ok(results.name === 'bob');
				assert.ok(job.id === 1);
				// Shutting down a queue unblocks the BLPOP callback on QueueService.process
				QueueService.shutdown(queueName, done);
			}, function(err, results) {
				// Save completed
				if(err) assert.fail();
				assert.ok(results.response().name === 'bob');

				// Process the job
				QueueService.process(queueName, type, null, function(job, next) {
					assert.ok(job.data.name === 'bob');
					next(undefined, job.data);
				});
			});	
		});
		
		it('should enqueue a job then search for it by ID', function(done) {
			QueueService.create(queueName, type, { name: 'ted' }, null, function(err, results) {
				// Save completed
				if(err) assert.fail(err);

				// Process the job
				QueueService.find(2, function(err, result) {
					if(err) assert.fail(err);
					assert.ok(result.response().name === 'ted');
					done();
				});
			});	
		});

		it('should enqueue a job then fail searching by ID', function(done) {
			// Process the job
			QueueService.find(3, function(err, result) {
				if(!err) assert.fail();
				assert.ok(err.toString() === 'Error: job "3" doesnt exist');
				assert.ok(result.response() === undefined);
				done();
			});
		});
	});
});