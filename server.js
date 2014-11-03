var watch = require("watch");
var MailParser = require("mailparser").MailParser;
var mailparser = new MailParser({ streamAttachments: true });
var rest = require('restler');
var fs = require("fs");
var path = require("path");
var config = require("./config");

if (!process.argv[2]) {
	console.log("Missing directory");
	process.exit(1);
}


mailparser.on("attachment", function(attachment) {
	if (attachment.contentType == "application/pdf") {
		console.log("Found PDF", attachment.fileName);
		attachment.stream.on("finish", function(a, b, c) {
			console.log("Finish", a, b, c);
		})
		var filename = "/tmp/" + attachment.generatedFileName;
		var output = fs.createWriteStream(filename).on("finish", function() {
			console.log("Wrote", filename);
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
			});
		});
		attachment.stream.pipe(output);

	}
});

var dir = path.join(__dirname, process.argv[2]);

console.log(dir);
watch.createMonitor(dir, function(monitor) {
	console.log("Started watching directory", process.argv[2]);
	monitor.on("created", function(f, stat) {
		var filename = f;
		console.log("New File Created", filename);
		fs.createReadStream(filename).pipe(mailparser);
	});
})