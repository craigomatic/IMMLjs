var imml = {};

imml.timelines = [];

imml.loadFromUri = function (uri) {
    _fetchImmlFromUri(uri, function (xDoc) {
        imml.load(xDoc.firstChild);
    });
}

function _fetchImmlFromUri(uri, completed) {
    var oReq = new XMLHttpRequest();

    oReq.onload = function (e) {
        var xDoc = oReq.responseXML;
        
        completed(xDoc);
    }

    oReq.open("GET", uri);
    oReq.send();
}

imml.fetchIncludes = function (immlNode, completed) {
    var includes = immlNode.querySelectorAll('Include');

    if (includes.length == 0) {
        completed();
    }

    for (var i = 0; i < includes.length; i++) {
        var src = includes[i].getAttribute('Source');

        if (src.length > 0) {
            _fetchImmlFromUri(src, function (xDoc) {
                //guard against bad includes
                if (xDoc == null) {
                    completed();
                }

                for (var j = 0; j < xDoc.children.length; j++) {
                    immlNode.appendChild(xDoc.children[j]);
                }

                if (i == includes.length - 1) {
                    completed();
                }
            });
        }
        else {
            if (i == includes.length - 1) {
                completed();
            }
        }
    }
}

imml.load = function (parentElement) {
    var canvas = document.createElement('canvas');
    canvas.id = 'renderCanvas';

    var immlNode = null;

    if (parentElement != null) {
        immlNode = parentElement;

        //just attach canvas to the body
        document.body.appendChild(canvas);
    }
    else {
        immlNode = document.getElementsByTagName('imml')[0];

        //remove IMML node from scene, attach canvas
        immlNode.parentElement.appendChild(canvas);
        immlNode.parentElement.removeChild(immlNode);
    }

    var engine = new BABYLON.Engine(canvas, true);
    var scene = new BABYLON.Scene(engine);

    var babylonCamera = imml.loadCamera(immlNode, scene);
    babylonCamera.attachControl(canvas, true);

    scene.setActiveCameraByID(babylonCamera.id);

    var gravityVector = _stringToVector3(immlNode.getAttribute('Gravity'));

    if (gravityVector != BABYLON.Vector3.Zero()) {
        scene.enablePhysics(gravityVector, new BABYLON.AmmoJSPlugin());
        scene.collisionsEnabled = true;
    }

    imml.fetchIncludes(immlNode, scene, function () {

        imml.loadLights(immlNode, scene);
        //imml.loadPositionalElements(immlNode, scene);
        imml.loadPrimitives(immlNode, scene);
        imml.loadModels(immlNode, scene);
        imml.loadSounds(immlNode, scene);
    });

    
    var debugLayer = new BABYLON.DebugLayer(scene);
    debugLayer.show(true);

    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener("resize", function () {
        engine.resize();
    });
}

imml.loadCamera = function (immlNode, scene) {
    //<imml camera="someName" >...</imml>

    var activeCamera = immlNode.getAttribute('Camera');

    var cameraNode = null;

    //find camera with matching name
    var allCameras = immlNode.querySelectorAll('Camera');

    for (var i = 0; i < allCameras.length; i++) {
        var item = allCameras.item(i);

        if (item.getAttribute('Name') == activeCamera) {
            cameraNode = item;
            break;
        }
    }

    var cameraName = _valueOrDefault(cameraNode.getAttribute('Name'), 'Camera');
    var cameraPosition = _stringToVector3(cameraNode.getAttribute('Position'));
    var cameraFov = _floatOrDefault(cameraNode.getAttribute('Fov'), 60);
    var cameraNearPlane = _floatOrDefault(cameraNode.getAttribute('NearPlane'), 0.1);
    var cameraFarPlane = _floatOrDefault(cameraNode.getAttribute('FarPlane'), 1000);
    var cameraProjection = _valueOrDefault(cameraNode.getAttribute('Projection'), 'perspective');
    var cameraType = _valueOrDefault(cameraNode.getAttribute('Type'), 'free');


    var babylonCamera = null;

    switch (cameraType) {
        case 'arc': {
            var target = cameraNode.getAttribute('ChaseTarget');
            var targetPosition = BABYLON.Vector3.Zero();

            if (target) {
                //find this node
                var targetNode = immlNode.querySelectorAll('[name=' + target + ']')[0];

                if (targetNode) {
                    targetPosition = _stringToVector3(targetNode.getAttribute('Position'));
                }
            }

            babylonCamera = new BABYLON.ArcRotateCamera(cameraName, 0, 0, 0, targetPosition, scene);
            babylonCamera.setPosition(cameraPosition);

            break;
        }
        default: {
            babylonCamera = new BABYLON.FreeCamera(cameraName, cameraPosition, scene);
            babylonCamera.rotation = _vectorStringToRadians(cameraNode.getAttribute('Rotation'));
            break;
        }
    }

    babylonCamera.minZ = cameraNearPlane;
    babylonCamera.maxZ = cameraFarPlane;
    babylonCamera.fov = _floatToRadians(cameraFov);
    babylonCamera.mode = _resolveCameraMode(cameraProjection);

    return babylonCamera;
}

imml.loadTimelines = function (parentNode, scene) {
    var timelineElements = parentNode.querySelectorAll('Timeline');

    for (var i = 0; i < timelineElements.length; i++) {
        var item = timelineElements.item(i);

    }
}

imml.loadPositionalElements = function (parentNode, scene) {
    //positional elements include: anchor, camera, effect, light, model, primitive, sound, widget 

    var loadedElements = [];

    var positionalElements = parentNode.querySelectorAll('Anchor,Camera,Effect,Light,Model,Primitive,Sound,Widget');
    
    for (var i = 0; i < positionalElements.length; i++) {
        var item = positionalElements.item(i);
        
        var parentElement = null;

        switch (item.localName) {
            case "Primitive":
                parentElement = imml.loadPrimitive(item, scene, null);

                break;
        }

        if (item.children.length > 0) {
            //loop through all children, load recursively
            imml.loadPositionalElements(item, scene);

            for (var j = 0; j < item.children.length; j++) {
                imml.loadPositionalElements(item.children[j], scene);
            }
        }        
    }

}

imml.loadPrimitive = function (item, scene, parent) {
    var itemType = item.getAttribute('Type');
    var mesh = null;

    switch (itemType.toLowerCase()) {
        case "box":
            mesh = BABYLON.Mesh.CreateBox(item.getAttribute('Name'), 1, scene);
            mesh.position = _stringToVector3(item.getAttribute('Position'));
            mesh.scaling = _stringToVector3(item.getAttribute('Size'));
            mesh.rotation = _vectorStringToRadians(item.getAttribute('Rotation'));
            
            break;
        case "cylinder":
            var segments = _resolveSegments(item.getAttribute('Complexity'));
            mesh = BABYLON.Mesh.CreateCylinder(item.getAttribute('Name'), 1, 1, 1, segments, segments, scene, false);
            mesh.position = _stringToVector3(item.getAttribute('Position'));
            mesh.scaling = _stringToVector3(item.getAttribute('Size'));
            mesh.rotation = _vectorStringToRadians(item.getAttribute('Rotation'));
            
            break;
        case "sphere":
            //look for complexity attribute, map to segments
            var segments = _resolveSegments(item.getAttribute('Complexity'));
            mesh = BABYLON.Mesh.CreateSphere(item.getAttribute('Name'), segments, 1, scene);
            mesh.position = _stringToVector3(item.getAttribute('Position'));
            mesh.scaling = _stringToVector3(item.getAttribute('Size'));
            mesh.rotation = _vectorStringToRadians(item.getAttribute('Rotation'));
            
            break;
        case "plane":
            var mesh = BABYLON.Mesh.CreatePlane(item.getAttribute('Name'), 1, scene);
            mesh.position = _stringToVector3(item.getAttribute('Position'));
            mesh.rotation = _vectorStringToRadians(item.getAttribute('Rotation'));
            mesh.scaling = _stringToVector3(item.getAttribute('Size'));
            
            break;
    }

    if (parent) {
        mesh.parent = parent;
    }

    _loadPhysics(item, mesh, scene);
    _loadMaterials(item, mesh, scene);
    _loadTriggers(item, mesh, scene);

    return mesh;
}

function _loadPhysics(item, mesh, scene) {
    var physicsNodes = item.querySelectorAll('Physics');

    if (physicsNodes.length > 0) {

        var physicsNode = physicsNodes.item(0);
        var enabled = _boolOrDefault(physicsNode.getAttribute('Enabled'), false);

        if (!enabled) {
            return;
        }

        var movable = _boolOrDefault(physicsNode.getAttribute('Movable'), false);
        var weight = _floatOrDefault(physicsNode.getAttribute('Weight'), 0);
        var centre = _stringToVector3(physicsNode.getAttribute('Centre'));
        var imposter = _resolveImposter(physicsNode.getAttribute('Bounding'));

        var interactionNodes = physicsNode.querySelectorAll('Interaction')

        //just take the first one (if any) and assume that instead of this interaction being applied to a specific element, it applies to all elements

        var friction = 0;
        var restitution = 0;

        if (interactionNodes.length > 0) {
            var interactionNode = interactionNodes.item(0);

            friction = _floatOrDefault(interactionNode.getAttribute('StaticFriction'), 0); //just use static friction, ignore dynamic friction value
            restitution = _floatOrDefault(interactionNode.getAttribute('Elasticity'), 0);
        }

        mesh.physicsImpostor = new BABYLON.PhysicsImpostor(mesh, imposter, { mass: weight, friction: friction, restitution: restitution }, scene);
        mesh.checkCollisions = true;
        mesh.applyGravity = true;
    }
}

imml.loadPrimitives = function(immlNode, scene) {
    //<primitive type="Box" >...</primitive>

    var primitives = immlNode.querySelectorAll('Primitive');

    for (var i = 0; i < primitives.length; i++) {
        var item = primitives.item(i);

        imml.loadPrimitive(item, scene, null);
    }
}

imml.loadModels = function (immlNode, scene) {
    //<model source="models\somemodel.json" >...</model>

    var models = immlNode.querySelectorAll('model');

    for (var i = 0; i < models.length; i++) {
        var item = models.item(i);

        BABYLON.SceneLoader.ImportMesh(item.getAttribute('Name'), "/", item.getAttribute('Source'), scene, function (meshArray) {
            meshArray[0].position = _stringToVector3(item.getAttribute('Position'));
            meshArray[0].rotation = _vectorStringToRadians(item.getAttribute('Rotation'));
            meshArray[0].scaling = _stringToVector3(item.getAttribute('Size'));
            
            _loadTriggers(item, meshArray[0], scene);
            //_loadMaterials(item, mesh, scene);
        });
    }
}

imml.loadLights = function (immlNode, scene) {
    //<light position="0,10,0" type="Point" ConstantAttenuation="0.5" LinearAttenuation="0.6" QuadraticAttenuation="0.2" >...</light>

    var lights = immlNode.querySelectorAll('Light');

    for (var i = 0; i < lights.length; i++) {
        var item = lights.item(i);
        var lightType = item.getAttribute('Type') == undefined ? 'point' : item.getAttribute('Type');

        switch (lightType.toLowerCase()) {
            case "point":
                var pointLight = new BABYLON.PointLight(item.getAttribute('Name'), _stringToVector3(item.getAttribute('Position')), scene);
                pointLight.diffuse = _stringToColour3(item.getAttribute('Diffuse'));
                pointLight.range = _floatOrDefault(item.getAttribute('Range'), 20);
                pointLight.specular = _stringToColour3(item.getAttribute('Specular'));

                break;
            case "spot":
                var spotLight = new BABYLON.SpotLight(item.getAttribute('Name'), _stringToVector3(item.getAttribute('Position')), _vectorStringToRadians(item.getAttribute('Rotation')), _floatOrDefault(item.getAttribute('InnerCone'), 1), _floatOrDefault(item.getAttribute('Falloff'), 1), scene);
                spotLight.diffuse = _stringToColour3(item.getAttribute('Diffuse'));
                //spotLight.range = _floatOrDefault(item.getAttribute('range'), 20);
                spotLight.specular = _stringToColour3(item.getAttribute('Specular'));
                spotLight.intensity = 1;

                break;
            case "directional":
                var directionalLight = new BABYLON.DirectionalLight(item.getAttribute('Name'), _vectorStringToRadians(item.getAttribute('Rotation')), scene);
                directionalLight.diffuse = _stringToColour3(item.getAttribute('Diffuse'));
                directionalLight.position = _stringToVector3(item.getAttribute('Position'));
                directionalLight.range = _floatOrDefault(item.getAttribute('Range'), 20);
                directionalLight.intensity = 0.5;

                break;
        }
    }
}

imml.loadSounds = function (immlNode, scene) {
    //<sound source="audio\track.mp3" >...</model>

    var sounds = immlNode.querySelectorAll('Sound');

    for (var i = 0; i < sounds.length; i++) {
        var item = sounds.item(i);
        var loop = _boolOrDefault(item.getAttribute('Loop'), false);
        var spatial = _boolOrDefault(item.getAttribute('Spatial'), true);
        var enabled = _boolOrDefault(item.getAttribute('Enabled'), true);
        var volume = _floatOrDefault(item.getAttribute('Volume'), 1);

        var babylonSound = new BABYLON.Sound(item.getAttribute('Name'), item.getAttribute('Source'), scene, function () {
            //ready to play callback
            _loadTriggers(item, babylonSound, scene);
        },
        {
            autoplay: enabled,
            loop: loop,
            volume: volume,
            spatialSound: spatial 
        });
    }
}

function _loadTriggers(item, mesh, scene) {
    var triggers = item.querySelectorAll('Trigger');

    for (var i = 0; i < triggers.length; i++) {
        var item = triggers.item(i);

        var event = item.getAttribute('Event').toLowerCase();
        var target = item.getAttribute('Target');

        //handle loaded immediately here
        if (event == "loaded") {
            window[target](mesh);
        }
        
        mesh.actionManager = new BABYLON.ActionManager(scene);
        
        mesh.actionManager.registerAction(new BABYLON.ExecuteCodeAction(
        {
            trigger: _resolveTrigger(event),
            parameter: mesh
        },
        function (actionEvent) {
            window[target](actionEvent);
        }));
    }
}

function _resolveTrigger(event) {
    switch(event)
    {
        case "mouseclick": {
            return BABYLON.ActionManager.OnLeftPickTrigger;
        }
        case "keydown": {
            return BABYLON.ActionManager.OnKeyDownTrigger;
        }
        case "keyup": {
            return BABYLON.ActionManager.OnKeyUpTrigger;
        }
        case "mousehover": {
            return BABYLON.ActionManager.OnPointerOverTrigger;
        }
        case "mouseleave": {
            return BABYLON.ActionManager.OnPointerOutTrigger;
        }
    }

    return BABYLON.ActionManager.NothingTrigger;
}

function _loadMaterials(item, mesh, scene) {
    //TODO: support multiple materials 

    var foundMaterial = item.querySelectorAll('Material')[0];
    var foundTexture = item.querySelectorAll('Texture')[0];
    var foundVideo = item.querySelectorAll('Video')[0];

    if (foundTexture) {
        var material = new BABYLON.StandardMaterial("", scene);
        material.diffuseTexture = new BABYLON.Texture(foundTexture.getAttribute('Source'), scene);
        material.diffuseTexture.uScale = _floatOrDefault(item.getAttribute('TileU'), 1);
        material.diffuseTexture.vScale = _floatOrDefault(item.getAttribute('TileV'), 1);
        material.diffuseTexture.uOffset = _floatOrDefault(item.getAttribute('OffsetU'), 0);
        material.diffuseTexture.vOffset = _floatOrDefault(item.getAttribute('OffsetV'), 0);

        if (foundMaterial) {
            material.diffuseColor = _stringToColour3(foundMaterial.getAttribute('Diffuse'));
            material.emissiveColor = _stringToColour3(foundMaterial.getAttribute('Emissive'));
        }

        material.backFaceCulling = false;//Allways show the front and the back of an element
        mesh.material = material;
    }
    else if (foundVideo) {
        var material = new BABYLON.StandardMaterial("", scene);
        var size = { width: 640, height: 360 }; //TODO: remove hardcode
        var srcArray = [];
        srcArray[0] = foundVideo.getAttribute('Source');

        material.diffuseTexture = new BABYLON.VideoTexture("", srcArray, size, scene);
        material.diffuseTexture.uScale = _floatOrDefault(item.getAttribute('TileU'), 1);
        material.diffuseTexture.vScale = _floatOrDefault(item.getAttribute('TileV'), 1);
        material.diffuseTexture.uOffset = _floatOrDefault(item.getAttribute('OffsetU'), 0);
        material.diffuseTexture.vOffset = _floatOrDefault(item.getAttribute('OffsetV'), 0);

        if (foundMaterial) {
            material.diffuseColor = _stringToColour3(foundMaterial.getAttribute('Diffuse'));
            material.emissiveColor = _stringToColour3(foundMaterial.getAttribute('Emissive'));
        }

        material.backFaceCulling = false;
        mesh.material = material;
    }
    else if (foundMaterial) {
        //put standard material onto the mesh
        var material = new BABYLON.StandardMaterial("", scene);
        material.diffuseColor = _stringToColour3(foundMaterial.getAttribute('Diffuse'));
        material.emissiveColor = _stringToColour3(foundMaterial.getAttribute('Emissive'));
        material.backFaceCulling = false;

        mesh.material = material;
    }
}

function _boolOrDefault(attribValue, defaultValue) {
    if (!attribValue || attribValue.length == 0) {
        return defaultValue;
    }

    return attribValue.toLowerCase() == "true";
}

function _floatOrDefault(attribValue, defaultValue) {
    if (!attribValue || attribValue.length == 0) {
        return defaultValue;
    }

    return parseFloat(attribValue);
}

function _resolveCameraMode(modeString) {

    switch (modeString) {
        case 'isometric': {
            return BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        }
    }


    return BABYLON.Camera.PERSPECTIVE_CAMERA;
}

function _resolveImposter(boundingValue) {

    if (!boundingValue) {
        boundingValue = "convexhull";
    }

    switch (boundingValue.toLowerCase()) {
        case "box":
            return BABYLON.PhysicsImpostor.BoxImpostor;
        case "convexhull":
            return BABYLON.PhysicsImpostor.ConvexHullImpostor;
        case "sphere":
            return BABYLON.PhysicsImpostor.SphereImpostor;
        case "cylinder":
            return BABYLON.PhysicsImpostor.CylinderImpostor;
    }

    return BABYLON.PhysicsImpostor.ConvexHullImpostor;
}

function _resolveSegments(segmentValue) {

    if (!segmentValue) {
        segmentValue = "medium";
    }

    switch(segmentValue.toLowerCase())
    {
        case "veryhigh":
            return 32;
        case "high":
            return 24;
        case "medium":
            return 18;
        case "low":
            return 12;
        case "verylow":
            return 4;
    }

    return 18;
}

function _valueOrDefault(value, defaultValue) {
    if (!value || value.length == 0) {
        return defaultValue;
    }

    return value;
}

function _stringToColour3(colourString) {
    if (!colourString || colourString.length == 0) {
        return new BABYLON.Color3(0, 0, 0);
    }

    try {
        
        var colourInt = parseInt(colourString.replace(/[^0-9A-F]/gi, ''), 16);
        var r = (colourInt >> 16) & 255;
        var g = (colourInt >> 8) & 255;
        var b = colourInt & 255;

        return new BABYLON.Color3(r / 255, g / 255, b / 255);
    }
    catch (ex) {
        return new BABYLON.Color3(0, 0, 0);
    }
}

function _stringToVector3(vectorString) {

    if (!vectorString || vectorString.length == 0) {
        return BABYLON.Vector3.Zero();
    }

    try {
        vectorString = vectorString.split(',');

        return new BABYLON.Vector3(parseFloat(vectorString[0]), parseFloat(vectorString[1]), parseFloat(vectorString[2]));
    }
    catch (ex) {
        return BABYLON.Vector3.Zero();
    }
}

function _vectorStringToRadians(vectorString) {
    if (!vectorString || vectorString.length == 0) {
        return BABYLON.Vector3.Zero();
    }

    try {
        vectorString = vectorString.split(',');

        var conversionFactor = Math.PI / 180;

        return new BABYLON.Vector3(
            parseFloat(vectorString[0]) * conversionFactor,
            parseFloat(vectorString[1]) * conversionFactor,
            parseFloat(vectorString[2]) * conversionFactor);
    }
    catch (ex) {
        return BABYLON.Vector3.Zero();
    }
}

function _floatToRadians(float) {
    return float * (Math.PI / 180);
}