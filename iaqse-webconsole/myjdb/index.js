const fs = require('fs');
const fsutils = require('../../buildtools/fsutils');
const uuid = require('uuid'); 
const path = require('path');
const Zip = require('adm-zip'); 

const ensureIdsOnObjects = function(contents) {
    if(Array.isArray(contents)) {

        contents.forEach( e => ensureIdsOnObjects(e) );

    } else if(typeof(contents) === 'object' && !Array.isArray(contents)) {
        if(!contents.id) {
            contents.id = uuid.v4();
        }
        Object.keys(contents).forEach( (key) => {
            if(Array.isArray(contents[key])) {
                ensureIdsOnObjects(contents[key]);
            }
        });
    }
}

let inMemoryDB = {};

// Create snapshot from the current in memory db
const createSnapshot = function() {
     let newSnap = null;
     fsutils.mkDirByPathSync(path.resolve("./database-snapshots"));
     const now = new Date();
     let dateStr = now.getDate()+"-"+(now.getMonth()+1)+"-"+now.getFullYear()+"_"+now.getHours()+"-"+now.getMinutes()+"-"+now.getSeconds();
     const contingut = JSON.stringify(inMemoryDB, null, 2);
     try {
        const zip = new Zip();
        zip.addFile("dbsnap_"+ dateStr +".json", Buffer.alloc(contingut.length, contingut)); 
        const fileName = "./database-snapshots/dbsnap_"+ dateStr +".zip";
        zip.writeZip(path.resolve(fileName));
        newSnap = {
            file: "dbsnap_"+ dateStr +".zip",
            date: now
        };
     } catch(ex) {
         console.log(ex);
     }
     return newSnap;
} 

// Reads and restores an old snapshot from a given filename
const restoreSnapshot = function(fileName) {
    try {
       const zipContents = new Zip(path.resolve("./database-snapshots/"+fileName)); 
       const zipEntries = zipContents.getEntries();
       
       let oldDatabaseRaw = null;

       zipEntries.forEach( (entry) => {
           if(entry.entryName == fileName.replace(".zip", ".json")) {
                oldDatabaseRaw = entry.getData().toString('utf8');
           }
       }); 
       const oldDatabase = JSON.parse(oldDatabaseRaw);
        
       Object.keys(oldDatabase).forEach( (tableName) => {

            const tableContents = oldDatabase[tableName];
            if(tableName.indexOf("/") < 0) {
                tableName = "database/"+ tableName + ".json";
            }
            const fileDest = path.resolve(path.join("./", tableName));
            fs.writeFileSync(fileDest, JSON.stringify(tableContents, null, 2), {encoding: 'utf8'});

       });

       return true;
    } catch(ex) {
        console.log(ex);
    }
    return false;
} 

// Carrega tota la db en memoria
const init = function() {
    // elimina possibles elements anteriors
    inMemoryDB = {};

    const configFiles = fs.readdirSync('./config');
    configFiles.forEach( (fileName) => {
        if(fileName.endsWith(".json")) {
            const rawContent = fs.readFileSync("./config/"+fileName, {encoding: 'utf8'});
            fileName = fileName.replace(".json", "");
            fileName = 'config/' + fileName;
            const contents = JSON.parse(rawContent);
            if(fileName == "config/routes") {
                 // all objects in contents must have an id field, if not (it must be created)!
                 ensureIdsOnObjects(contents.pages);
            }
            inMemoryDB[fileName] = {
                name: fileName,
                modified: false,
                contents: contents
            };
        }
    });

    const databaseFiles = fs.readdirSync('./database');
    databaseFiles.forEach( (fileName) => {
        if(fileName.endsWith(".json")) {
            const rawContent = fs.readFileSync("./database/"+fileName, {encoding: 'utf8'});
            fileName = fileName.replace(".json", "");
            const contents = JSON.parse(rawContent);
            // all objects in contents must have an id field, if not (it must be created)!
            ensureIdsOnObjects(contents);
            inMemoryDB[fileName] = {
                name: fileName,
                modified: false,
                contents: contents
            };
        }
    });


     // Crea un snapshot (o còpia de seguretat) cada pic que es llegeix
    createSnapshot();

    return inMemoryDB;
};


const persist = function() {
    // persisteix les taules modificades a disc 
    let changes = true;
    Object.keys(inMemoryDB).forEach( (tableName)=> {
        try {
            const table = inMemoryDB[tableName];
            if(table && table.modified) {
                let outputFile = "./";
                if(tableName.indexOf("/") < 0) {
                    outputFile += "database/";
                }
                outputFile += tableName + ".json";
                const content = JSON.stringify(table.contents, null, 2); 
                fs.writeFileSync(outputFile, content, {encoding: 'utf8'});
                table.modified = false;
            }
        } catch(ex) {
            changes = false;
        } 
    });
    return changes;
};

// Obté tota la taula
const getTable = function(tableName) {
    return inMemoryDB[tableName];
};

// replaces the entire table
const setTable = function(table) { 
    table.modified = true;
    let existeix = false;
    if(inMemoryDB[table.name]) {
        existeix = true;
    }
    inMemoryDB[table.name] = table;
    return existeix;
};

// id ='98234jn-skdjfhd9-3323-ff44'
// or
// id = '98234jn-skdjfhd9-3323-ff44:list'
const _findObjById = function(list, id) {
    const idParts = id.split(":");
    if(Array.isArray(list)) {
        const nn = list.length;
        for(let i=0; i<nn; i++) {
            const obj = list[i];
            if(typeof(obj)==='object' && obj.id === idParts[0]) {
                if(idParts.length==1) {
                    return obj;
                } else {
                    return obj[idParts[1]];
                };
            }
        }
    } else if(typeof(list) === 'object') {
        if(idParts.length == 2 && idParts[0].trim()=="") {
            // Cas d'accedir a la propietat d'un objecte :xxx/
            return list[idParts[1]];
        } else {
            if(list.id == idParts[0]) {
                if(idParts.length==1) {
                    return list;
                } else {
                    return list[idParts[1]];
                }
            }
        }
    }
    return null;
};
 
// more precise methods
// idPath are a sequence of id like id1:prop1/id2:prop2/id3:prop3/···/idn
const select = function(tableName, idPath) {
    const workingTable = inMemoryDB[tableName];
    if(!workingTable) {
        return null;
    }
    idPath = idPath || "";
    if(idPath.length === 0 || idPath.trim() === 0 || idPath.trim() === "/") {
        return {obj: workingTable.contents,
                parent: null};
    }
    const idParts = idPath.split("/");
    const nn = idParts.length;
    if(nn === 0) {
        return null;
    }
    let i = 0;
    let parent = workingTable.contents;
    let obj = _findObjById(parent, idParts[i]);
    i++;
    while(obj!=null && i < nn) {
        parent = obj;
        obj = _findObjById(obj, idParts[i]);
        i++;
    }
    return {obj: obj, parent: parent};
}

const remove = function(tableName, idPath) {
    const workingTable = inMemoryDB[tableName];
    let success = false;
    if(!workingTable) {
        return success;
    }
    try {
        const foundObj = select(tableName, idPath);
        if(foundObj != null) {
            const pos = foundObj.parent.indexOf(foundObj.obj);
            if(pos >= 0) {
                const deletedItems = foundObj.parent.splice(pos, 1);
                success = deletedItems.length > 0;
            } 
        }  
    } catch(ex) {
    }
    if(success) {
        workingTable.modified = true;
    }
    return success;
};

/**
 * db=[{id:1, }, {id:2, }, ....., {id:n, }]
 * add({...}, 'db', '/', 2?);
 * @param {*} tableName 
 * @param {*} idPathContainer 
 */
const add = function(objToInsert, tableName, idPathContainer, insertPosition) {
    idPathContainer = idPathContainer || "/";
    const workingTable = inMemoryDB[tableName];
    let generatedId = null;
    if(!workingTable) {
        return null;
    }
    try {
        const foundObj = select(tableName, idPathContainer);
        if(foundObj && foundObj.obj) {
            const container = foundObj.obj;
            // Genera una id pel nou objecte
            generatedId  = uuid.v4();
            objToInsert.id = generatedId;
            if(typeof(insertPosition) !== 'undefined') {
                container.splice(insertPosition, 0, objToInsert);
            } else {
                container.push(objToInsert);
            } 
        }
    } catch(ex){ 
        console.log(ex);
    }
    if(generatedId) {
        workingTable.modified = true;
    }
    return objToInsert;
};

const update = function(tableName, idPath, newObj) {
    const workingTable = inMemoryDB[tableName];
    let success = false;
    if(!workingTable) {
        return success;
    }
    try {
        const foundObj = select(tableName, idPath);
        if(foundObj) {
            const parent = foundObj.parent;
            const pos = parent.indexOf(foundObj.obj);
            parent[pos] = newObj;
            success = true;
        }
    } catch(ex){
        success = false;
    }
    if(success) {
        workingTable.modified = true;
    }
    return success;
};

const reorder = function(tableName, idPath, newPosition) {
    const workingTable = inMemoryDB[tableName];
    let success = false;
    if(!workingTable) {
        return success;
    }
    try {
        const foundObj = select(tableName, idPath);
        if(foundObj && foundObj.parent && foundObj.obj) {
            const parent = foundObj.parent;
            const pos = parent.indexOf(foundObj.obj);
            if(pos >= 0) {
                const removedElems = parent.splice(pos, 1);
                if(removedElems.length === 1) {
                    parent.splice(newPosition, 0, removedElems[0]);
                    success = true;
                }
            }
        }
    } catch(ex){
        console.log(ex);
        success = false;
    }
    if(success) {
        workingTable.modified = true;
    }
    return success;
};

const getModified = function(tableName) {
    return ((inMemoryDB[tableName] || {}).modified) || false;
};
 
const showTables = function() {
  return Object(inMemoryDB).keys()
    .map( key => inMemoryDB[key] )
    .map( tbs => {return {name: tbs.name, modified: tbs.modified, rows: tbs.contents.length}});
}

init();

module.exports = {
    init: init,
    persist: persist,
    getTable: getTable,
    setTable: setTable,
    remove: remove,
    select: select,
    add: add,
    update: update,
    reorder: reorder,
    getModified: getModified,
    showTables: showTables,
    _findObjById: _findObjById,
    createSnapshot: createSnapshot,
    restoreSnapshot: restoreSnapshot
};