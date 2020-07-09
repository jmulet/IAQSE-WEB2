 window.myjdb = function(mountPoint, self) {
    var inMemoryDB = {};

    // Carrega tota la db en memoria
    var init = function() {
         inMemoryDB = {};
        return inMemoryDB;
    };

    var interface = {};
 
    // carrega la taula del servidor
    var loadTable = function(tableName, onSuccess, onError) {
        return axios.post("/" + mountPoint + "/api/gettable", { tableName: tableName }).then(function (res) {
            inMemoryDB[tableName] = res.data;  
            self[tableName.replace("/","_")] = res.data.contents;
            onSuccess && onSuccess();
            self.$toast.add({ severity: 'info', summary: "S'ha carregat la taula " + tableName, life: 3000 });
        }, function (err) {
            self.inici_carousel = {};
            self.$toast.add({ severity: 'error', summary: "No s'ha pogut carregar la taula " + tableName});
            onError && onError();
        });  
    };

    // Obté tota la taula en memòria
    var getTable = function(tableName) {
        return inMemoryDB[tableName];
    };

    var getContents = function(tableName) {
        if(inMemoryDB[tableName]) {
            return inMemoryDB[tableName].contents;
        }
        return null;
    };

    // synchronizes the entire table with server
    var sync = function(tableName, onSuccess, onError) { 
        var tableName2 = tableName;
        if(tableName.indexOf("/")>=0) {
            tableName2 = tableName.replace("/", "_");
        } 
        var table = {
            name: tableName,
            modified: true,
            contents: self[tableName2]
        };
        if(!table) {
            onError && onError('Table does not exist');
        } 
        axios.post("/"+mountPoint+"/api/settable", {table: table}).then(function(res) {
            if(res.data.result) {
                self.$toast.add({ severity: 'info', summary: "S'ha sincronitzat " + tableName, life: 3000 });
                onSuccess && onSuccess();
            } else {
                self.$toast.add({ severity: 'error', summary: "No s'ha pogut sincronitzar " + tableName });
                onError && onError();
            }
        }, function(err) {
            console.log(err);
            self.$toast.add({ severity: 'error', summary: "No s'ha pogut sincronitzar " + tableName });
            onError && onError();
        });
    };

    // id ='98234jn-skdjfhd9-3323-ff44'
    // or
    // id = '98234jn-skdjfhd9-3323-ff44:list'
    // or
    //     ':list' si el contenidor és un objecte
    var _findObjById = function(list, id) {
        var idParts = id.split(":");
        if(Array.isArray(list)) {
            var nn = list.length;
            for(var i=0; i<nn; i++) {
                var obj = list[i];
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
    var select = function(tableName, idPath) {
        var workingTable = inMemoryDB[tableName];
        if(!workingTable) {
            return null;
        }
        idPath = idPath || "";
        if(idPath.length === 0 || idPath.trim() === 0 || idPath.trim() === "/") {
            return {obj: workingTable.contents,
                    parent: null};
        }
        var idParts = idPath.split("/");
        var nn = idParts.length;
        if(nn === 0) {
            return null;
        }
        var i = 0;
        var parent = workingTable.contents;
        var obj = _findObjById(parent, idParts[i]);
        i++;
        while(obj!=null && i < nn) {
            parent = obj;
            obj = _findObjById(obj, idParts[i]);
            i++;
        }
        return {obj: obj, parent: parent};
    }

    var remove = function(tableName, idPath, onSuccess, onError) {
        var workingTable = interface[tableName];
        
        if(!workingTable) {
            onError && onError();
        }
        // Primer ho fa en remot i després en local
        axios.post("/" + mountPoint + "/api/remove", { tableName: tableName , idPath: idPath}).then(function (res) {

            if(res.data.result) {
                var success = false;
                try {
                    var foundObj = select(tableName, idPath);
                    if(foundObj != null) {
                        var pos = foundObj.parent.indexOf(foundObj.obj);
                        if(pos >= 0) {
                            var deletedItems = foundObj.parent.splice(pos, 1);
                            success = deletedItems.length > 0;
                        } 
                    }  
                } catch(ex) {
                }
                if(success) { 
                    self.$toast.add({ severity: 'info', summary: "S'ha esborrat id="+idPath + " de " + tableName, life: 3000 });
                    onSuccess && onSuccess();
                } else {
                    self.$toast.add({ severity: 'error', summary: "Error esborrat id="+idPath + " de " + tableName});
                    onError && onError();
                }
            } else {
                self.$toast.add({ severity: 'error', summary: "Error esborrat id="+idPath + " de " + tableName });
                onError && onError();
            }

        }, function(err) {
            onError && onError();
        });
 
    };

    /**
     * db=[{id:1, }, {id:2, }, ....., {id:n, }]
     * add({...}, 'db', '/', 2?);
     * @param {*} tableName 
     * @param {*} idPathContainer 
     */
    var add = function(objToInsert, tableName, idPathContainer, insertPosition, onSuccess, onError) {
        idPathContainer = idPathContainer || "/";
        var workingTable = interface[tableName];
       
        if(!workingTable) {
            onError && onError();
        }
        axios.post("/" + mountPoint + "/api/add", { obj: objToInsert, tableName: tableName , idPath: idPathContainer, insertPosition: insertPosition})
            .then(function (res) {
                var objToInsert = res.data.result;
                if(objToInsert) {
                    try {
                        var foundObj = select(tableName, idPathContainer);
                        if(foundObj && foundObj.obj) {
                            var container = foundObj.obj;
                            if(typeof(insertPosition) !== 'undefined') {
                                container.splice(insertPosition, 0, objToInsert);
                            } else {
                                container.push(objToInsert);
                            } 
                        }
                        if(objToInsert.id) {
                        //S'ha inserit
                        self.$toast.add({ severity: 'success', summary: "S'ha inserit l'objecte " + objToInsert.id + " a " + tableName, life: 3000 });
                        onSuccess && onSuccess(objToInsert.id);
                        } 
                    } catch(ex){ 
                        console.log(ex);
                        self.$toast.add({ severity: 'error', summary: "No s'ha pogut inserir l'objecte a " + tableName});
                        onError && onError();
                    }
                } else{
                    self.$toast.add({ severity: 'error', summary: "No s'ha pogut inserir l'objecte a " + tableName});
                    onError && onError();
                }
            },
            function(err) {
                console.log(err);
                self.$toast.add({ severity: 'error', summary: "No s'ha pogut inserir l'objecte a " + tableName});
                onError && onError();
            });
       
        
        
    };

    var update = function(tableName, idPath, newObj, onSuccess, onError) {
        var workingTable = interface[tableName]; 
        if(!workingTable) {
            onError && onError();
        }
        axios.post("/" + mountPoint + "/api/update", {tableName: tableName , idPath: idPath, obj: newObj})
        .then(function (res) {
            var success = res.data.result;
            if(success) {
                try { 
                    var foundObj = select(tableName, idPath);
                    if(foundObj) {
                        var parent = foundObj.parent;
                        var pos = parent.indexOf(foundObj.obj);
                        // no modificam l'objecte, només les propietats
                        var props = Object.keys(newObj);
                        for(var i=0; i < props.length; i++) {
                            var key = props[i];
                            parent[pos][key] = newObj[key]; 
                        }
                        success = true;
                    }
                } catch(ex){
                    console.log(ex);
                    success = false;
                }
                if(success) {
                    onSuccess && onSuccess();
                    self.$toast.add({ severity: 'success', summary: "S'ha modificat l'objecte " + idPath + " de " + tableName, life: 3000 });
                } else{
                    onError && onError();
                    self.$toast.add({ severity: 'error', summary: "No s'ha pogut modificat l'objecte "+idPath+" de " + tableName });
                }
            } else {
                onError && onError();
                self.$toast.add({ severity: 'error', summary: "No s'ha pogut modificat l'objecte "+idPath+" de " + tableName});
            }
        },
        function(err) {
            self.$toast.add({ severity: 'error', summary: "No s'ha pogut modificat l'objecte "+idPath+" de " + tableName});
            onError && onError();
        });

        
    };

    var reorder = function(tableName, idPath, newPosition) {
        var workingTable = interface[tableName];
        var success = false;
        if(!workingTable) {
            return success;
        }
        try {
            var foundObj = select(tableName, idPath);
            if(foundObj && foundObj.parent && foundObj.obj) {
                var parent = foundObj.parent;
                var pos = parent.indexOf(foundObj.obj);
                if(pos >= 0) {
                    var removedElems = parent.splice(pos, 1);
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

    var getModified = function(tableName) {
        return ((inMemoryDB[tableName] || {}).modified) || false;
    };
    
    var showTables = function() {
        var out = [];
        var keys = Object(inMemoryDB).keys();
        for(var i=0; i < keys.length; i++) {
            var tbs = inMemoryDB[key];
            out.push({name: tbs.name, modified: tbs.modified, rows: tbs.contents.length});
        }
        return out;
    };
 
    var persist = function() {
        var tablesNames = Object.keys(inMemoryDB);
        var nn = tablesNames.length;
        // In the first place sync all tables modified locally
        var modifiedTables = [];
        for(var i=0; i < nn; i++) {
            var table = inMemoryDB[tablesNames[i]];
            if(table.modified) {
                modifiedTables.push(table); 
            }
        } 
        return axios.post("/"+mountPoint+"/api/persist", {table: modifiedTables}).then(function(res){ 
            if(res.data.result) {
                for(var i=0; i < nn; i++) {
                    var table = inMemoryDB[tablesNames[i]];
                    table.modified = false;
                }  
            }  
            return res.data.result
        }, function(err){
            return err;
        });
    };

    init();

    // exports
    interface.init = init;
    interface.loadTable =  loadTable;
    interface.sync = sync;
    interface.getTable =  getTable;
    interface.getContents =  getContents; 
    interface.remove = remove;
    interface.select = select;
    interface.add = add;
    interface.update = update;
    interface.reorder = reorder;
    interface.getModified = getModified;
    interface.showTables = showTables;
    interface.persist = persist;
     
    return interface;
};