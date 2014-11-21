var watch = require("watch");
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser({  });
var rest = require('restler');
var fs = require("fs");
var path = require("path");
var es = require("event-stream");
var crypto = require('crypto');
var restify = require('restify');
var walk = require('walk');

var File = require("./file_model");
var config = require("./config");

var mongoose = require('mongoose');
mongoose.connect(config.mongo_connect_string);

if (!process.argv[2]) {
	console.log("Missing directory");
	process.exit(1);
}

var calcChecksum = function(str, algorithm, encoding) {
	return crypto.createHash(algorithm || 'md5').update(str, 'utf8').digest(encoding || 'hex');
}

mailparser.on("end", function(mail) {
	if (mail.attachments) {
		for(var x = 0; x < mail.attachments.length; x++) {
			process_attachment(mail.attachments[x]);
		}
	}
});

var process_attachment = function(attachment) {
	if (attachment.contentType == "application/pdf") {
		console.log("Found PDF", attachment.fileName);
		var filename = "/tmp/" + attachment.generatedFileName;
		fs.writeFile(filename, attachment.content, function() {
			console.log("Wrote", filename);
			fs.readFile(filename, function (err, data) {
				var checksum = calcChecksum(data);
				console.log("Checking if file exits");
				File.findOne({ checksum: checksum }, function(err, data) {
					// console.log(data);
					if (data) {
						console.log("File already uploaded");
						check_queue();
						return true;
					} else {
						console.log("Sending to DocumentCloud")
						rest.post(config.dc_url + '/api/upload.json', {
							multipart: true,
							username: config.dc_username,
							password: config.dc_password,
							data: {
								title: attachment.generatedFileName,
								access: 'public',
								file: rest.file(filename, null, attachment.length, null, attachment.contentType)
							}
						}).on('complete', function(data) {
							console.log(data);
							var file = new File({
								filename: data.title,
								url: data.canonical_url,
								checksum: attachment.checksum,
							});
							file.save();
							console.log("Saved to DocumentCloud");
							// console.log(file);
							check_queue();
						});
					}
				});
			});
		});
	}
};

var dir = path.normalize(process.argv[2]);

watch.createMonitor(dir, function(monitor) {
	console.log("Started watching directory", process.argv[2]);
	monitor.on("created", function(f, stat) {
		var filename = f;
		if (fs.lstatSync(filename).isFile()) {
			console.log("New File Found:", filename);
			fs.createReadStream(filename).pipe(mailparser);
		}
	});
});

var server = restify.createServer({ name: 'alaveteli-documentcloud-api' });
server
	.use(restify.fullResponse())
	.use(restify.bodyParser());

server.get('/file', function(req, res, next) {
	File.find(function(error, files) {
		if (error) {
			res.send(500, "500: Error", error);
			return;
		}
		if (files) {
			res.send(files);
			next();
		} else {
			res.send(404, "404: Files not found");
		}
	})
});

var queue = [];
var check_queue = function() {
	if (queue.length) {
		func = queue.pop();
		func();
	}
}

server.get('/file/:searchq', function (req, res, next) {
	File.findOne({ checksum: req.params.searchq }, function (error, file) {
		if (file) {
			res.send(file);	
		} else {
			File.findOne({ filename: req.params.searchq }, function(error, file) {
				if (file) {
					res.send(file);
				} else {
					res.send(404, "404: File not found");
				}
			});
		}
    	
 	});
});

server.get('/scan', function(req, res, next) {
	//Synchronous walker, else things get out of hand...
	var options = {
		listeners: {
			file: function (root, fileStats, next) {
				var filename = path.join(root, fileStats.name);
				queue.push(function() {fs.createReadStream(filename).pipe(mailparser) });
			}
		}
	}
	var walker = walk.walkSync(dir, options);
	check_queue();
	res.send("Processing files...");
});

server.listen(config.port, function () {
	console.log('%s listening at %s', server.name, server.url)
});

