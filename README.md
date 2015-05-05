## Node Dropbox

This is a basic Dropbox clone to sync files across multiple remote folders.

Time spent: `25 hours`

### Features

#### Required

- [x] Client can make GET requests to get file or directory contents
- [x] Client can make HEAD request to get just the GET headers 
- [x] Client can make PUT requests to create new directories and files with content
- [x] Client can make POST requests to update the contents of a file (changed it to using PUT to update per discussion in the forum)
- [x] Client can make DELETE requests to delete files and folders
- [x] Server will serve from `--dir` or cwd as root
- [x] Client will sync from server over TCP to cwd or CLI `dir` argument

### Optional

- [ ] Client and User will be redirected from HTTP to HTTPS
- [ ] Server will sync from client over TCP
- [ ] Client will preserve a 'Conflict' file when pushed changes preceeding local edits
- [ ] Client can stream and scrub video files (e.g., on iOS)
- [ ] Client can download a directory as an archive
- [ ] Client can create a directory with an archive
- [ ] User can connect to the server using an FTP client


## Implemented CRUD server

Create/Update a new file/folder  using PUT
```shellscript
curl -v "http://127.0.0.1:8000/foo" -X PUT
curl -v "http://127.0.0.1:8000/foo2/bar2" -X PUT

#create a file with content "some-content"
curl -v "http://127.0.0.1:8000/foo/bar.js" -d "some-content" -X PUT 

#update a file with content "new content"
curl -v "http://127.0.0.1:8000/foo/bar.js" -d "new content -X PUT
```

GET info from file/folder
```shellscript
 curl -v "http://127.0.0.1:8000/" -X GET
 curl -v "http://127.0.0.1:8000/foo/bar.js" -X GET
 curl -v "http://127.0.0.1:8000/foo/bar.js" --head
```

DELETE file/folder(recursively)
```shellscript
curl -v "http://127.0.0.1:8000/foo/bar.js" -X DELETE
curl -v "http://127.0.0.1:8000/foo/" -X DELETE
```
#### usage and gif reference




## client-server tcp connection

Setup a tcp server using nssocket and used to sync the changes on the server to client

 - the server emit a event like create/update or delete
 - that event get listened by the TCP server
 - tcp server catch the event, it pushes the event to the client(client.js) and executes the operation on the client
 - the remote server uses /tmp/server folder and the tcp client uses /tmp/client folder. 

#### usage and gif reference
