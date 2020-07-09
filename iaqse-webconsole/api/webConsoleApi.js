const fs = require("fs");
const path = require("path");
const myjdb = require("../myjdb");
const siteBuilder = require("../../buildtools/sitebuilder");
const utils = require("../../buildtools/utils");
const Zip = require("adm-zip");
 
module.exports = function(app, mountPoint) {
    let sharedSocket;
    app.io.on('connection', (socket)=> { 
        sharedSocket = socket;
    });
      

    app.post('/'+mountPoint+'/api/gettable', function(req, res) {
        const tableName = req.body.tableName;
        const table = myjdb.getTable(tableName);

        if(table) {
            res.json(table);
        } else {
            res.status(400).send("Table not found");
        }

    });

    app.post('/'+mountPoint+'/api/settable', function(req, res) {

        const table = req.body.table; 
        const result = myjdb.setTable(table);

        res.send({result: result});

    });

    app.post('/'+mountPoint+'/api/remove', function(req, res) {

        const tableName = req.body.tableName; 
        const idPath = req.body.idPath;
        const result = myjdb.remove(tableName, idPath);

        res.send({result: result});

    });

    app.post('/'+mountPoint+'/api/add', function(req, res) {

        const objectToAdd = req.body.obj;
        const tableName = req.body.tableName; 
        const idPath = req.body.idPath;
        const insertPosition = req.body.insertPosition;
        const result = myjdb.add(objectToAdd, tableName, idPath, insertPosition);

        res.send({result: result});

    });

    app.post('/'+mountPoint+'/api/update', function(req, res) {

        const newObj = req.body.obj;
        const tableName = req.body.tableName; 
        const idPath = req.body.idPath; 
        const result = myjdb.update(tableName, idPath, newObj);

        res.send({result: result});

    });

    app.post('/'+mountPoint+'/api/reorder', function(req, res) {

        const tableName = req.body.tableName; 
        const idPath = req.body.idPath; 
        const position = req.body.position;
        const result = myjdb.reorder(tableName, idPath, position);

        res.send({result: result});

    });

    app.post('/'+mountPoint+'/api/showtables', function(req, res) {
       res.send({result: myjdb.showtables()});
    });

    app.post('/'+mountPoint+'/api/reset', function(req, res) {
        myjdb.init();
        res.send({result: myjdb.showtables()});
    });

    app.post('/'+mountPoint+'/api/crearpagina', function(req, res) {
        const route = req.body.route;
        const isView = req.body.view;

        const desti = path.resolve(path.join("./ejs-pages", route.ejs + ".ejs"));
        try {
            if(fs.statSync(desti)){
                res.send({result: false, msg: "The file already exists"});
                return;
            }
        } catch(ex){}

        const dname = path.dirname(desti);
        try {
            fs.statSync(dname);
        } catch(ex){
            fs.mkdirSync(dname);
        }

        let font = "";

        if(isView) {
            font = `
            <!-- Això és una vista d'exemple. Modifiqueu-ne el contingut -->
            <div class="row">
                    <h4>Vista: ${route.title}</h4>
                    <p> <button ng-click="sampleAction()" class="btn btn-primary">Acció de prova</button></p>
                    <p ng-bind="missatge"></p>
            </div>
            
            <script>
                app.controller("${route.controller}Controller", ["$scope", "$filter", "httpService", function ($scope, $filter, httpService) {
                    $scope.missatge = "";
                    $scope.sampleAction = function() {
                        $scope.missatge = "Benvingut a angularjs!";
                    };
                }]);
            </script>`;
        } else {
             font = `
<!-- Això és una pàgina d'exemple. Modifiqueu el contingut de la pàgina -->
<div class="row">
        <h4>Pàgina: ${route.title}</h4>
        <ul>
            <li ng-repeat="item in sampleList">
                <span ng-bind="item"></span>
            </li>
        </ul>
</div>

<!-- Aquí s'injectaran les vistes -->
<div ng-view id="routedContent">
</div>

<script>
    app.controller("mainController", ["$scope", "httpService", function ($scope, httpService) {
        <% if(config.remoteURL) { %>
        httpService.hit(location.href, "PAGE");
        <% } %>
        $scope.sampleList = ["A", "B", "C", "D"];
    }]);
</script>`;
        }
        
        try {
            fs.writeFileSync(desti, font, {encoding: 'utf8'});
        } catch(ex) {
            res.send({result: false, msg: ex});
            return;
        }
        res.send({result: true});
    });
 
    const _persist = function(table, development) {
        // Pot contenir opcionalment una taula per actualitzar primer
        let result = true;
        let msgs = [];
        if(table) {
            if(Array.isArray(table)) {
                table.forEach((aTable)=> {
                    const r = myjdb.setTable(aTable);
                    if(!r) {
                        msgs.push("Cannot settable ", aTable.name);
                    }
                    result = result && r;
                })
            } else { 
                const r = myjdb.setTable(table);
                if(!r) {
                    msgs.push("Cannot settable ", table.name);
                }
                result = result && r;
            }
        }
        // Ara desa a disc totes les taules que han estat settable!
        const r = myjdb.persist();
        if(!r) {
            msgs.push("Cannot persist to disc");
        }
        result = result && r;

        // Torna a generar el site (en local)
        
        siteBuilder({
            type: 'pages',  //all or database
            development: development
        });
        
        // reload client web page
        if(development) {
            app.io.emit('reload-event', {event: 'reload'});
            if(sharedSocket) {
                sharedSocket.broadcast.emit('reload-event', {event: 'reload'});
            }
        }

        return {result: result, msg: msgs.join(". ")};
    }


    app.post('/'+mountPoint+'/api/persist', function(req, res) {
        const resData = _persist(req.body.table, true);
        res.send(resData);
    });


    app.post('/'+mountPoint+'/api/listsnapshots', function(req, res) {

        const files = fs.readdirSync(path.resolve("./database-snapshots"));

        let snapshots = files.map((file)=> {
            const parts = file.split("_");
            let fecha = parts[1];
            let hora = parts[2];
          
            hora = hora.replace(".zip",""); 
            const fecha_parts = fecha.split("-");
            const hora_parts = hora.split("-");
 
            return {
                file: file,
                date: new Date(fecha_parts[2], fecha_parts[1]-1, fecha_parts[0],
                                hora_parts[0], hora_parts[1], hora_parts[2] )
            }
        });
        // orderna per date DESC
        snapshots = snapshots.sort((a, b) => b.date - a.date);
 
        res.json(snapshots);

    });

    app.post('/'+mountPoint+'/api/createsnapshot', function(req, res) {
        let result = myjdb.createSnapshot();
        res.json({result: result});
    });

    app.post('/'+mountPoint+'/api/restoresnapshot', function(req, res) {
 
        const snapshot = req.body.snapshot;
        if(!snapshot) {
            res.json({result: false, msg: 'A snapshot obj is expected'})
        }

        const newSnapshot = myjdb.createSnapshot();
        let result = newSnapshot != null;

        result =  result && myjdb.restoreSnapshot(snapshot.file);
         
        res.json({result: result});
    });

    const copyDirRecursive = function(sourceFolder, sourceRelative, targetFolder, zip, encoding) {

        if(!fs.existsSync(targetFolder)) {
            fs.mkdirSync(targetFolder, {recursive: true});
        }

        const dirFiles = fs.readdirSync(sourceFolder);
        dirFiles.forEach( (fileName) => {
            const file = path.join(sourceFolder, fileName);
            const stat = fs.statSync(file);
            if(stat.isFile()){
                const data = fs.readFileSync(path.join(sourceFolder, fileName), {encoding: encoding});
                fs.writeFileSync(path.join(targetFolder, fileName), data, {encoding: encoding});
                zip.addFile(sourceRelative + fileName, Buffer.alloc(data.length, data));
            } 
         });

         // Miram els directoris
         dirFiles.forEach( (fileName) => {
            const file = path.join(sourceFolder, fileName);
            const stat = fs.statSync(file);
            if(stat.isDirectory()){
                const sourceRelative2 = sourceRelative +  fileName+"/"; 
                copyDirRecursive(path.join(sourceFolder, fileName), sourceRelative2,
                                 path.join(targetFolder, fileName), zip, encoding);
            }
         });
 
    }

    app.post('/'+mountPoint+'/api/publish', function(req, res) {

        // En primer lloc fa la compilació (deshabilitant el hot deploy)
        const resData = _persist(req.body.table, false); 
        if(resData.result) {
              // Compilació correcta
          
            try {
                    // Tot seguit copia els fitxers al directori
                    // Determina el directori desti
                    const config = utils.requireJSON("./config/config.json");
                    const pubDir = config.publicationFolder;
                    if(!pubDir || !fs.existsSync(pubDir)) {
                        res.json({result: false, msg:'Publication folder not set or does not exist'});
                        return;
                    }
                    const routes = utils.requireJSON("./config/routes.json");
                    const baseurl = routes.baseurl; 

                    const sourceFolder = path.resolve(
                        path.join("./static", baseurl)
                    );

                    // Després desa una còpia en l'històric de publicacions /web-history
                    const zip = new Zip();
                    // Copia la compilació al lloc publicat 
                    copyDirRecursive(sourceFolder, "", pubDir, zip, config.encoding);  
                    const now = new Date();
                    const dateStr = now.getDate()+"-"+(now.getMonth()+1)+"-"+now.getFullYear()+"_"+now.getHours()+"-"+now.getMinutes()+"-"+now.getSeconds();
                    const historyFilename = "web-history_" + dateStr + ".zip";
                    zip.writeZip(path.resolve(path.join("./web-history", historyFilename))); 
                    res.json({result: true});
             } catch(ex) {
                console.log(ex);
                res.json({result: false});
             }
        } else {
            res.json(resData);
        }

    });

};