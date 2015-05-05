let nssocket = require('nssocket')
let fs = require('fs')
let path = require('path')
let rimraf = require('rimraf')
let mkdirp = require('mkdirp')
let argv = require('yargs').argv

require('songbird')

let dirName = argv.dir || path.join(process.cwd(), 'client-files')

//const TCP_PORT = 6785
const ROOT_DIR = path.resolve(dirName)
const LIST_TCP_EVENT_MAP = {
 'create': 'CREATE',
 'update': 'UPDATE',
 'remove' : 'DELETE',
 'ack': 'ACK'
}

let outboundTCP = new nssocket.NsSocket({
	reconnect: true
})

// PUT request
outboundTCP.data([LIST_TCP_EVENT_MAP.create], (payload) =>{	
	writeDataToFile(payload).catch(e => console.log);
})

// POST request
outboundTCP.data([LIST_TCP_EVENT_MAP.update], (payload) => {
	writeDataToFile(payload).catch(e => console.log);
})

//  DELETE request
outboundTCP.data([LIST_TCP_EVENT_MAP.remove], (payload) => {
	async () => {	
		logSocketReq(payload);
		let filePath = path.resolve(path.join(ROOT_DIR, payload.path))
		
		if(payload.type === 'dir'){
			await rimraf.promise(filePath)
		} else await fs.promise.unlink(filePath)			

		sendSuccessAck(payload.action)
	}().catch(e => console.log)
})

outboundTCP.connect(6785);

function getDirPath(filePath, type) {	
	let endsWithSlash = filePath.charAt(filePath.length-1) === path.sep
	let hasExt = path.extname(filePath) !== ''
	let isDir = type === 'dir' ?  true : false
	let dirPath = isDir ? filePath : path.dirname(filePath)
	return dirPath;
}

function logSocketReq(payload) {
	console.log(payload);
}

function sendSuccessAck(actionType) {
	// send a message back to server
	tcpClient.send([TCP_EVENT_MAP.ack], {'message': `${actionType} action success`})
}

async function writeDataToFile (payload) {
	logSocketReq(payload);
	let filePath = path.resolve(path.join(ROOT_DIR, payload.path))
	if(payload.action === 'create') {
		let dirPath = getDirPath(filePath, payload.type)
		// create the directory path first
		await mkdirp.promise(dirPath)
	} else if(payload.action === 'update') {
		// turncate existing file
		await fs.promise.truncate(filePath, 0)	
	}
	
	if(payload.type === 'file') {
		//write payload.contents to that filePath
		await fs.promise.writeFile(filePath, payload.contents, {encoding: 'base64'});
	}
	sendSuccessAck(payload.action)
}