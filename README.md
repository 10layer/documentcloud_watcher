# DocumentCloud Mailsync

This node.js app watches a directory for new mails, checks them for attachments, and if it finds attachments, sends them to [DocumentCloud](https://www.documentcloud.org/home).

Written for [AskAfrica](http://askafrica.info), which runs on [Alavateli](http://alaveteli.org/).

##Installation

Edit config.js and put in your relevant settings.

```
npm install
```


##Usage

```
node server.js /var/www/alaveteli/alaveteli/files
```

##Testing

```
mkdir files
node server.js files
cp test files/test
```

License: [MIT](http://opensource.org/licenses/MIT)