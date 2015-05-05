let fs = require('fs')
let path = require('path')
let express = require('express')
let morgan = require('morgan')
let nodeify = require('bluebird-nodeify')
let mime = require('mime-types')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs').argv
let nssocket = require('nssocket')

//use of promise
require('songbird')

//let dirName = argv.dir || process.cwd()
//const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 8000
//const TCP_PORT = 6785

//const ROOT_DIR = path.resolve(dirName)
const LIST_TCP_EVENT_MAP = {
 'create': 'CREATE',
 'update': 'UPDATE',
 'remove' : 'DELETE',
 'ack': 'ACK'
}

let ROOT_DIR = argv.dir ? path.resolve(argv.dir) : path.resolve(process.cwd())
console.log(" ROOT DIR", ROOT_DIR)

let app = express()

let tcpSocket
let tcpServer = nssocket.createServer(function (socket) {   	
	console.log(`Client connected to TCP port 6785`)
   	tcpSocket = socket
   	tcpSocket.data([LIST_TCP_EVENT_MAP.ack], function (data) { 
		console.log(data.message) //log the client ack
	})
}).listen(6785);


//if(NODE_ENV === 'development') {
//	app.use(morgan('dev'))
//}

app.listen(PORT, () => console.log(`Server LISTENING on http://127.0.0.1:${PORT}`))

app.get('*', setFileMeta, sendHeaders, (req, res) => {
	//res.body is already set from sendHeaders
	if(res.body) {
		return res.json(res.body)
	}
	console.log(" req.filePath", req.filePath)
	fs.createReadStream(req.filePath).pipe(res)
})

app.head('*', setFileMeta, sendHeaders, (req, res) => {
	res.end()
})

app.delete('*', setFileMeta, (req, res, next) => {
	//only call next if fails
	async () => {
		if(!req.stat) return res.status(400).send('Invalid Path') 
		let isDir = req.stat.isDirectory();
		if(isDir){
			await rimraf.promise(req.filePath)
		} else await fs.promise.unlink(req.filePath)		

		// if a client exists sync the data to client
		if(tcpSocket) {			
			let payload = outboundTCP('delete', req.url, isDir)   	
			tcpSocket.send([LIST_TCP_EVENT_MAP.remove], payload);						
		}

		res.end()
	}().catch(next) //only want to call next if it fails, since it is the last
})

app.put('*', setFileMeta, setDirInfo, (req, res, next) => {
	let filePath = req.filePath
    let isEndWithSlash = req.filePath.charAt(filePath.length - 1) === path.sep
    let isFile = path.extname(req.filePath) !== ''
    let isDirectory = isEndWithSlash || !isFile
    let dirPath = isDirectory ? req.filePath : path.dirname(filePath)
	async () => {
		if(req.stat) return res.status(405).send('File does exists') //res.send(405, 'File does exists')

		await mkdirp.promise(dirPath)

		if (!req.isDir) {
			req.pipe(fs.createWriteStream(req.filePath))
		}

		if(tcpSocket) {
			let data = await fs.promise.readFile(req.filePath, {encoding: 'base64'})
			let payload = outboundTCP('create', req.url, req.isDir, data).catch(e => console.log(e.stack))   	
			tcpSocket.send([LIST_TCP_EVENT_MAP.create], payload);
		}
		res.end()
	}().catch(next)
})

app.post('*', setFileMeta, setDirInfo, (req, res, next) => {
	async () => {
		if(!req.stat) return res.status(405).send('File doesnt exists')//res.send(405, 'File doesnt exists')
		if(req.isDir) return res.status(405).send('It is a directory') //res.send(405, 'It is a directory')
						 
		await fs.promise.truncate(req.filePath, 0)	
		req.pipe(fs.createWriteStream(req.filePath))		

		if(tcpSocket) {
			let data = await fs.promise.readFile(req.filePath, {encoding: 'base64'})
			let payload = outboundTCP('update', req.url, req.isDir, data)   	
			tcpSocket.send([LIST_TCP_EVENT_MAP.update], payload);
		}

		res.end()
	}().catch(next)
})

function outboundTCP(action, path, isDir, contents) {
	return	{
	    "action": action,
	    "path": path,
	    "type": isDir ? 'dir': 'file',
	    "contents": contents || null,
	    "updated": new Date().getTime()
	};
}

function setDirInfo(req, res, next) {
	let filePath = req.filePath;	
	let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
	let hasExt = path.extname(filePath) !== ''
	req.isDir = endsWithSlash || !hasExt
	req.dirPath = req.isDir ? filePath : path.dirname(filePath)
	next()
}

function setFileMeta (req, res, next) {	
	req.filePath = path.resolve(path.join(ROOT_DIR, req.url))	
	if(req.filePath.indexOf(ROOT_DIR) !== 0) {
		return res.status(400).send('Invalid Path')//res.send(400, 'Invalid path')
		//return
	}
	fs.promise
	.stat(req.filePath).then(stat => req.stat = stat, () => req.stat = null)
	.nodeify(next)
}

function sendHeaders (req, res, next) {
	nodeify(async () => {		
		if(req.stat.isDirectory()) {			
			let files = await fs.promise.readdir(req.filePath)			
			res.body = JSON.stringify(files)
			res.setHeader('Content-Length', res.body.length)
			res.setHeader('Content-type', 'application/json')
			return
		}		
		res.setHeader('Content-Length', req.stat.size)
		let contentType = mime.contentType(path.extname(req.filePath))
		res.setHeader('Content-type', contentType)
	}(), next)	
}