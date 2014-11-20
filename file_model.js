var mongoose = require("mongoose");
var Schema       = mongoose.Schema;

var Objectid = mongoose.Schema.Types.ObjectId;

var FileSchema   = new Schema({
	filename: String,
	url: String,
	checksum: { type: String, index: { unique: true } },
	upload_date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('File', FileSchema);