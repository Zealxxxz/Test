function earth() {
    //latlonData
    //countryLookup
    //countryColorMap
    var timeBins = [{
        "data": [{
            "i": "Algeria",
            "wc": "mil",
            "e": "Australia",
            "v": 2479
        },
        {
            "i": "New Zealand",
            "wc": "mil",
            "e": "Australia",
            "v": 1986
        },
        {
            "i": "Singapore",
            "wc": "mil",
            "e": "Australia",
            "v": 1233210
        },
        {
            "i": "United Kingdom",
            "wc": "mil",
            "e": "Australia",
            "v": 37576
        },
        ],
        "t": 2010
    }];
    var masterContainer = document.getElementById('visualization'); //不知道
    var overlay = document.getElementById('visualization'); //不知道
    var mapIndexedImage; //纹理贴图1
    var mapOutlineImage; //纹理贴图2
    var camera, scene, renderer; //摄像机，场景 渲染器
    var lookupCanvas;
    var lookupTexture;
    var rotating; //对象的集合
    var visualizationMesh;
    var mapUniforms;
    //----------------
    var countryData = new Object();
    loadGeoData(latlonData);
    function loadGeoData(latlonData) {
        var sphereRad = 1;
        var rad = 100;
        for (var i in latlonData.countries) {
            var country = latlonData.countries[i];
            country.countryCode = i;
            country.countryName = countryLookup[i];
            var lon = country.lon - 90;
            var lat = country.lat;
            var phi = Math.PI / 2 - lat * Math.PI / 180 - Math.PI * 0.01;
            var theta = 2 * Math.PI - lon * Math.PI / 180 + Math.PI * 0.06;
            var center = new THREE.Vector3();
            center.x = Math.sin(phi) * Math.cos(theta) * rad;
            center.y = Math.cos(phi) * rad;
            center.z = Math.sin(phi) * Math.sin(theta) * rad;
            country.center = center;
            countryData[country.countryName] = country
        }
    }
    //-----------------
    var selectableCountries = [];
    var allCountries = [];
    for (var i in countryLookup) {
        allCountries.push(countryLookup[i]);
    }
    for (var i in timeBins) {
        var bin = timeBins[i].data;
        for (var s in bin) {
            var set = bin[s];
            var exporterName = set.e.toUpperCase();
            var importerName = set.i.toUpperCase();
            if ($.inArray(exporterName, selectableCountries) < 0) selectableCountries.push(exporterName);
            if ($.inArray(importerName, selectableCountries) < 0) selectableCountries.push(importerName)
        }
    }
    var weaponLookup = {
        'Military Weapons': 'mil',
        'Civilian Weapons': 'civ',
        'Ammunition': 'ammo',
    };
    var reverseWeaponLookup = {
        'ammo': 'Ammunition',
        'mil': 'Military Weapons',
        'civ': 'Civilian Weapons',
    };
    var categoryColors = {
        'mil': 0xdd380c,
        'civ': 0x3dba00,
        'ammo': 0x154492,
    }
    var cwidth = $('#earthArea').width(); //容器宽度
    var cheight = $('#earthArea').height(); //容器高度
    var selectedCountry = null; //被选中的国家
    var previouslySelectedCountry = null; //
    var selectionData;
    //控制相关
    var dragging = false; //旋转还是拖拽的开关
    var rotateVX = 0,
    rotateVY = 0;
    var rotateXMax = 90 * Math.PI / 180;
    var rotateTargetX = undefined;
    var rotateTargetY = undefined;
    var keyboard = new THREEx.KeyboardState();
    var rotateX = 0,
    rotateY = 0;
    var markers = []; //标签？
    var EarthModel = {
        init: function() {
            if (!window.requestAnimationFrame) {
                window.requestAnimationFrame = (function() {
                    return window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
                    function(callback, element) {
                        window.setTimeout(callback, 1000 / 60)
                    }
                })()
            }
            start();
            function start(e) {
                if (!Detector.webgl) {
                    Detector.addGetWebGLMessage()
                } else {
                    mapIndexedImage = new Image();
                    mapIndexedImage.src = 'images/map_indexed.png';
                    mapIndexedImage.onload = function() {
                        mapOutlineImage = new Image();
                        mapOutlineImage.src = 'images/map_outline.png';
                        mapOutlineImage.onload = function() {
                            initScene();
                            animate(); //旋转拉近等动画
                        }
                    }
                }
            }
            function initScene() {
                scene = new THREE.Scene();
                scene.matrixAutoUpdate = false;
                scene.add(new THREE.AmbientLight(0x505050));
                // light1 = new THREE.SpotLight(0xeeeeee, 3);
                // light1.position.x = 730;
                // light1.position.y = 520;
                // light1.position.z = 626;
                // light1.castShadow = true;
                // scene.add(light1);
                // light2 = new THREE.PointLight(0x222222, 14.8);
                // light2.position.x = -640;
                // light2.position.y = -500;
                // light2.position.z = -1000;
                // scene.add(light2);
                rotating = new THREE.Object3D();
                scene.add(rotating);
                lookupCanvas = document.createElement('canvas');
                lookupCanvas.width = 256;
                lookupCanvas.height = 1;
                lookupTexture = new THREE.Texture(lookupCanvas);
                lookupTexture.magFilter = THREE.NearestFilter;
                lookupTexture.minFilter = THREE.NearestFilter;
                lookupTexture.needsUpdate = true;
                var indexedMapTexture = new THREE.Texture(mapIndexedImage);
                indexedMapTexture.needsUpdate = true;
                indexedMapTexture.magFilter = THREE.NearestFilter;
                indexedMapTexture.minFilter = THREE.NearestFilter;
                var outlinedMapTexture = new THREE.Texture(mapOutlineImage);
                outlinedMapTexture.needsUpdate = true;
                var uniforms = {
                    'mapIndex': {
                        type: 't',
                        value: 0,
                        texture: indexedMapTexture
                    },
                    'lookup': {
                        type: 't',
                        value: 1,
                        texture: lookupTexture
                    },
                    'outline': {
                        type: 't',
                        value: 2,
                        texture: outlinedMapTexture
                    },
                    'outlineLevel': {
                        type: 'f',
                        value: 1
                    },
                };
                mapUniforms = uniforms;
                var shaderMaterial = new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    vertexShader: document.getElementById('globeVertexShader').textContent,
                    fragmentShader: document.getElementById('globeFragmentShader').textContent,
                });
                var sphere = new THREE.Mesh(new THREE.SphereGeometry(100, 40, 40), shaderMaterial);
                sphere.doubleSided = false;
                sphere.rotation.x = Math.PI;
                sphere.rotation.y = -Math.PI / 2;
                sphere.rotation.z = Math.PI;
                sphere.id = "base";
                rotating.add(sphere);
                //制造3D线的对象
                buildDataVizGeometries(timeBins);
                function buildDataVizGeometries(linearData) {
                    //var loadLayer = document.getElementById('loading');
                    //console.log("linearData",linearData)
                    for (var i in linearData) {
                        var yearBin = linearData[i].data;
                        var count = 0;
                        for (var s in yearBin) {
                            var set = yearBin[s];
                            var exporterName = set.e.toUpperCase();
                            var importerName = set.i.toUpperCase();
                            exporter = countryData[exporterName];
                            importer = countryData[importerName];
                            if (exporter === undefined || importer === undefined) continue;
                            //这里直接画线了
                            set.lineGeometry = makeConnectionLineGeometry(exporter, importer, set.v, set.wc);
                        }
                    }
                    function makeConnectionLineGeometry(exporter, importer, value, type) {
                        ////console.log("exporter",exporter);
                        ////console.log("importer",exporter);
                        ////console.log("value",exporter);
                        ////console.log("exporter",exporter);
                        ////console.log( "zealxxxz",exporter,importer,value,type);
                        var globeRadius = 1000;
                        var vec3_origin = new THREE.Vector3(0, 0, 0);
                        if (exporter.countryName == undefined || importer.countryName == undefined) return undefined;
                        var distanceBetweenCountryCenter = exporter.center.clone().subSelf(importer.center).length();
                        var anchorHeight = globeRadius + distanceBetweenCountryCenter * 0.7;
                        var start = exporter.center;
                        var end = importer.center;
                        var mid = start.clone().lerpSelf(end, 0.5);
                        var midLength = mid.length();
                        mid.normalize();
                        mid.multiplyScalar(midLength + distanceBetweenCountryCenter * 0.7);
                        var normal = (new THREE.Vector3()).sub(start, end);
                        //!---
                        normal.normalize();
                        //!---
                        var distanceHalf = distanceBetweenCountryCenter * 0.5;
                        var startAnchor = start;
                        var midStartAnchor = mid.clone().addSelf(normal.clone().multiplyScalar(distanceHalf));
                        var midEndAnchor = mid.clone().addSelf(normal.clone().multiplyScalar( - distanceHalf));
                        var endAnchor = end;
                        var splineCurveA = new THREE.CubicBezierCurve3(start, startAnchor, midStartAnchor, mid);
                        var splineCurveB = new THREE.CubicBezierCurve3(mid, midEndAnchor, endAnchor, end);
                        var vertexCountDesired = Math.floor(distanceBetweenCountryCenter * 0.02 + 6) * 2;
                        var points = splineCurveA.getPoints(vertexCountDesired);
                        points = points.splice(0, points.length - 1);
                        points = points.concat(splineCurveB.getPoints(vertexCountDesired));
                        points.push(vec3_origin);
                        var val = value * 0.0003;
                        var size = (10 + Math.sqrt(val));
                        size = constrain(size, 0.1, 60);
                        THREE.Curve.Utils.createLineGeometry = function(points) {
                            //console.log(points);
                            var geometry = new THREE.Geometry();
                            for (var i = 0; i < points.length; i++) {
                                geometry.vertices.push(points[i])
                            }
                            return geometry
                        };
                        var curveGeometry = THREE.Curve.Utils.createLineGeometry(points);
                        curveGeometry.size = size;
                        return curveGeometry
                    }
                }
                visualizationMesh = new THREE.Object3D();
                rotating.add(visualizationMesh);
                var Selection = function() {
                    this.selectedYear = '2010';
                    this.selectedCountry = 'UNITED STATES';
                    this.exportCategories = new Object();
                    this.importCategories = new Object();
                    for (var i in weaponLookup) {
                        this.exportCategories[i] = true;
                        this.importCategories[i] = true
                    }
                    this.getExportCategories = function() {
                        var list = [];
                        for (var i in this.exportCategories) {
                            if (this.exportCategories[i]) list.push(i)
                        }
                        return list
                    }
                    this.getImportCategories = function() {
                        var list = [];
                        for (var i in this.importCategories) {
                            if (this.importCategories[i]) list.push(i)
                        }
                        return list
                    }
                };
                selectionData = new Selection();
                //selectionData = selection;
                //这里是重点
                var b = [];
                for (var i in countryLookup) {
                    b.push(countryLookup[i]);
                }
                //显示内容线，但应该还有其他操作
                EarthModel.selectVisualization(timeBins, '2010', ['CHINA']);

                renderer = new THREE.WebGLRenderer({
                    antialias: false
                });
                //------------------------
                renderer.setSize(cwidth, cheight);
                //renderer.setSize(400, 300);
                renderer.autoClear = false;
                renderer.sortObjects = false;
                renderer.generateMipmaps = false;
                document.getElementById('earthArea').appendChild(renderer.domElement);
                var mouseX = 0,
                mouseY = 0,
                pmouseX = 0,
                pmouseY = 0;
                var pressX = 0,
                pressY = 0;
                function onDocumentMouseMove(event) {
                    pmouseX = mouseX;
                    pmouseY = mouseY;
                    mouseX = event.clientX - cwidth * 0.5;
                    mouseY = event.clientY - cheight * 0.5;
                    if (dragging) {
                        if (keyboard.pressed("shift") == false) {
                            rotateVY += (mouseX - pmouseX) / 2 * Math.PI / 180 * 0.3;
                            rotateVX += (mouseY - pmouseY) / 2 * Math.PI / 180 * 0.3
                        } else {
                            camera.position.x -= (mouseX - pmouseX) * .5;
                            camera.position.y += (mouseY - pmouseY) * .5
                        }
                    }
                }
                function onDocumentMouseDown(event) {
                    if (event.target.className.indexOf('noMapDrag') !== -1) {
                        return;
                    }
                    dragging = true;
                    pressX = mouseX;
                    pressY = mouseY;
                    rotateTargetX = undefined;
                    rotateTargetX = undefined
                }
                function onDocumentMouseUp(event) {
                    //d3Graphs.zoomBtnMouseup();
                    dragging = false;
                    histogramPressed = false
                }
                function onClick(event) {
                    if (Math.abs(pressX - mouseX) > 3 || Math.abs(pressY - mouseY) > 3) {
                        return;
                    }
                    function getPickColor() { //除了赋值还进行了大量其他操作：清理地球等
                        var affectedCountries = undefined;
                        if (visualizationMesh.children[0] !== undefined) {
                            affectedCountries = visualizationMesh.children[0].affectedCountries;
                            //affectedCountries=allCountries;
                        }
                        //highlightCountry([]);
                        rotating.remove(visualizationMesh);
                        mapUniforms['outlineLevel'].value = 0;
                        lookupTexture.needsUpdate = true;
                        renderer.autoClear = false;
                        renderer.autoClearColor = false;
                        renderer.autoClearDepth = false;
                        renderer.autoClearStencil = false;
                        renderer.preserve;
                        renderer.clear();
                        renderer.render(scene, camera); //到这里算是清空了
                        //--------------------创建gl对象并负责收集鼠标数据
                        var gl = renderer.context;
                        gl.preserveDrawingBuffer = true;
                        var mx = (mouseX + renderer.context.canvas.width / 2);
                        var my = ( - mouseY + renderer.context.canvas.height / 2);
                        mx = Math.floor(mx);
                        my = Math.floor(my);
                        var buf = new Uint8Array(4);
                        //console.log('buf',buf);这里获得了参数
                        gl.readPixels(mx, my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
                        //---------------------------------
                        //console.log('buf',buf);
                        renderer.autoClear = true;
                        renderer.autoClearColor = true;
                        renderer.autoClearDepth = true;
                        renderer.autoClearStencil = true;
                        gl.preserveDrawingBuffer = false;
                        mapUniforms['outlineLevel'].value = 1;
                        rotating.add(visualizationMesh);

                        if (affectedCountries !== undefined) {
                            //highlightCountry(affectedCountries);
                        }
                        return buf[0]
                    }
                    var pickColorIndex = getPickColor();
                    //这里通过pickColorIndex在countryColorMap中遍历查找到了相应的国家名称
                    for (var i in countryColorMap) {
                        var countryCode = i;
                        var countryColorIndex = countryColorMap[i];
                        if (pickColorIndex == countryColorIndex) {
                            var countryName = countryLookup[countryCode];
                            if (countryName === undefined) {
                                return;
                            }
                            //if ($.inArray(countryName, selectableCountries) <= -1) {
                            //    alert("message");
                            //    return;
                            //}
                            var selection = selectionData;
                            selection.selectedCountry = countryName;
                            console.log(selection.selectedCountry);
                            //画线高亮
                            EarthModel.selectVisualization(timeBins, selection.selectedYear, [selection.selectedCountry]);
                            return;
                        }
                    }
                }
                function onMouseWheel(event) {
                    var delta = 0;
                    if (event.wheelDelta) {
                        delta = event.wheelDelta / 120;
                    } else if (event.detail) {
                        delta = -event.detail / 3;
                    }
                    function handleMWheel(delta) {
                        camera.scale.z += delta * 0.1;
                        camera.scale.z = constrain(camera.scale.z, 0.7, 5.0);
                    }
                    if (delta) {
                        handleMWheel(delta);
                    }
                    event.returnValue = false;
                }
                document.addEventListener('mousemove', onDocumentMouseMove, true);
                document.addEventListener('mousedown', onDocumentMouseDown, true);
                document.addEventListener('mouseup', onDocumentMouseUp, false);
                masterContainer.addEventListener('click', onClick, true);
                masterContainer.addEventListener('mousewheel', onMouseWheel, false);
                masterContainer.addEventListener('DOMMouseScroll',
                function(e) {
                    var evt = window.event || e;
                    onMouseWheel(evt)
                },
                false);
                camera = new THREE.PerspectiveCamera(12, cwidth / cheight, 1, 20000);
                camera.position.z = 1400;
                camera.position.y = 0;
                //camera.lookAt(scene.width / 2, scene.height / 2);
                scene.add(camera);
                var windowResize = THREEx.WindowResize(renderer, camera)
            }
            function animate() {
                if (rotateTargetX !== undefined && rotateTargetY !== undefined) {
                    rotateVX += (rotateTargetX - rotateX) * 0.012;
                    rotateVY += (rotateTargetY - rotateY) * 0.012;
                    if (Math.abs(rotateTargetX - rotateX) < 0.1 && Math.abs(rotateTargetY - rotateY) < 0.1) {
                        rotateTargetX = undefined;
                        rotateTargetY = undefined
                    }
                }
                rotateX += rotateVX;
                rotateY += rotateVY;
                rotateVX *= 0.98;
                rotateVY *= 0.98;
                if (dragging || rotateTargetX !== undefined) {
                    rotateVX *= 0.6;
                    rotateVY *= 0.6
                }
                if (rotateX < -rotateXMax) {
                    rotateX = -rotateXMax;
                    rotateVX *= -0.95
                }
                if (rotateX > rotateXMax) {
                    rotateX = rotateXMax;
                    rotateVX *= -0.95
                }
                //TWEEN.update();
                rotating.rotation.x = rotateX;
                rotating.rotation.y = rotateY;

                renderer.clear();
                renderer.render(scene, camera);

                requestAnimationFrame(animate);
            }
        },
        run: function() {
            EarthModel.init();
        },
        selectVisualization: function(linearData, year, countries) {
            var exportCategories = ['"Military Weapons"', "Civilian Weapons", "Ammunition"];
            var importCategories = exportCategories;
            var cName = countries[0].toUpperCase(); //当前选中的国家
            $("#hudButtons .countryTextInput").val(cName);
            previouslySelectedCountry = selectedCountry;
            selectedCountry = countryData[countries[0].toUpperCase()];
            selectedCountry.summary = {
                imported: {
                    mil: 0,
                    civ: 0,
                    ammo: 0,
                    total: 0,
                },
                exported: {
                    mil: 0,
                    civ: 0,
                    ammo: 0,
                    total: 0,
                },
                total: 0,
                //historical: getHistoricalData(selectedCountry),
            };

            // //???????
            // for (var i in countryData) {
            //     var country = countryData[i];
            //     country.exportedAmount = 0;
            //     country.importedAmount = 0;
            //     country.mapColor = 0
            // }
            for (var i in selectableCountries) {
                removeMarkerFromCountry(selectableCountries[i])
            }
            function removeMarkerFromCountry(countryName) {
                countryName = countryName.toUpperCase();
                var country = countryData[countryName];
                if (country === undefined) return;
                if (country.marker === undefined) return;
                var index = markers.indexOf(country.marker);
                if (index >= 0) markers.splice(index, 1);
                var container = document.getElementById('visualization');
                container.removeChild(country.marker);
                country.marker = undefined;
            }
            while (visualizationMesh.children.length > 0) {
                var c = visualizationMesh.children[0];
                visualizationMesh.remove(c)
            }
            //????????
            var mesh = getVisualizedMesh(timeBins, year, countries, exportCategories, importCategories);
            console.log('mesh', mesh);

            ////console.log("mesh",mesh);
            visualizationMesh.add(mesh);

            if (mesh.affectedCountries.length == 0) {
                mesh.affectedCountries.push(cName);
            }
            //标签相关
            for (var i in mesh.affectedCountries) {
                var countryName = mesh.affectedCountries[i];
                var country = countryData[countryName];
                //attachMarkerToCountry(countryName, country.mapColor)
            }

            //和地图高亮相关
            //alert(mesh.affectedCountries);
            //allCountries
            EarthModel.highlightCountry(mesh.affectedCountries);
            //highlightCountry(allCountries);
            //------------------------点选后自动居中的函数
            if (previouslySelectedCountry !== selectedCountry) {
                if (selectedCountry) {
                    rotateTargetX = selectedCountry.lat * Math.PI / 180;
                    var targetY0 = -(selectedCountry.lon - 9) * Math.PI / 180;
                    var piCounter = 0;
                    while (true) {
                        var targetY0Neg = targetY0 - Math.PI * 2 * piCounter;
                        var targetY0Pos = targetY0 + Math.PI * 2 * piCounter;
                        if (Math.abs(targetY0Neg - rotating.rotation.y) < Math.PI) {
                            rotateTargetY = targetY0Neg;
                            break
                        } else if (Math.abs(targetY0Pos - rotating.rotation.y) < Math.PI) {
                            rotateTargetY = targetY0Pos;
                            break
                        }
                        piCounter++;
                        rotateTargetY = wrap(targetY0, -Math.PI, Math.PI)
                    }
                    rotateVX *= 0.6;
                    rotateVY *= 0.6;
                    function wrap(value, min, rangeSize) {
                        rangeSize -= min;
                        while (value < min) {
                            value += rangeSize
                        }
                        return value % rangeSize
                    }
                }
            }
            //------------------------
            //标签相关
            function attachMarkerToCountry(countryName, importance) {
                countryName = countryName.toUpperCase();
                var country = countryData[countryName];
                if (country === undefined) return;
                var container = document.getElementById('visualization');
                var template = document.getElementById('marker_template');
                var marker = template.cloneNode(true);
                country.marker = marker;
                container.appendChild(marker);
                marker.countryName = countryName;
                marker.importance = importance;
                marker.selected = false;
                marker.hover = false;
                if (countryName === selectedCountry.countryName.toUpperCase()) marker.selected = true;
                marker.setPosition = function(x, y, z) {
                    this.style.left = x + 'px';
                    this.style.top = y + 'px';
                    this.style.zIndex = z;
                }
                marker.setVisible = function(vis) {
                    if (!vis) this.style.display = 'none';
                    else {
                        this.style.display = 'inline';
                    }
                }
                var countryLayer = marker.querySelector('#countryText');
                marker.countryLayer = countryLayer;
                var detailLayer = marker.querySelector('#detailText');
                marker.detailLayer = detailLayer;
                marker.jquery = $(marker);
                marker.setSize = function(s) {
                    var detailSize = Math.floor(2 + s * 0.5);
                    //this.detailLayer.style.fontSize = detailSize + 'pt';
                    this.detailLayer.style.fontSize = 10 + 'pt';
                    var totalHeight = detailSize * 2;
                    //this.style.fontSize = totalHeight * 1.125 + 'pt';
                    this.style.fontSize = 10 + 'pt';
                    if (detailSize <= 8) {
                        this.countryLayer.style.marginTop = "0px";
                    } else {
                        this.countryLayer.style.marginTop = "-1px";
                    }
                }
                marker.update = function() {
                    var matrix = rotating.matrixWorld;
                    var abspos = matrix.multiplyVector3(country.center.clone());
                    var screenPos = screenXY(abspos);
                    var s = 0.3 + camera.scale.z * 1;
                    var importanceScale = this.importance / 5000000;
                    importanceScale = constrain(importanceScale, 0, 18);
                    s += importanceScale;
                    if (this.tiny) s *= 0.75;
                    if (this.selected) s = 30;
                    if (this.hover) s = 15;
                    this.setSize(s);
                    this.setVisible((abspos.z > 60) && s > 3);
                    var zIndex = Math.floor(1000 - abspos.z + s);
                    if (this.selected || this.hover) zIndex = 10000;
                    this.setPosition(screenPos.x, screenPos.y, zIndex);
                    function screenXY(vec3) {
                        var projector = new THREE.Projector();
                        var vector = projector.projectVector(vec3.clone(), camera);
                        var result = new Object();
                        var windowWidth = cwidth;
                        result.x = Math.round(vector.x * (windowWidth / 2)) + windowWidth / 2;
                        result.y = Math.round((0 - vector.y) * (cheight / 2)) + cheight / 2;
                        return result;
                    }
                }
                var nameLayer = marker.querySelector('#countryText');
                var tiny = (importance < 20000000) && (!marker.selected);
                marker.tiny = tiny;
                nameLayer.innerHTML = countryName.replace(' ', '&nbsp;');
                var importExportText = "";
                if (country.exportedAmount > 0 && country.importedAmount > 0) {
                    importExportText += "攻击类型:&nbsp;" + numberWithCommas(country.importedAmount) + "<br />设备类型:&nbsp;" + numberWithCommas(country.exportedAmount)
                } else if (country.exportedAmount > 0 && country.importedAmount == 0) {
                    importExportText += "设备类型:&nbsp;" + numberWithCommas(country.exportedAmount) + "<br />&nbsp;"
                } else if (country.exportedAmount == 0 && country.importedAmount > 0) {
                    importExportText += "攻击类型:&nbsp;" + numberWithCommas(country.importedAmount) + "<br />&nbsp;"
                }
                function numberWithCommas(x) {
                    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                }
                marker.importExportText = importExportText;
                var markerOver = function(e) {
                    this.detailLayer.innerHTML = importExportText;

                    this.hover = true
                }
                var markerOut = function(e) {
                    this.detailLayer.innerHTML = "";
                    this.hover = false
                }
                if (!tiny) {
                    detailLayer.innerHTML = importExportText;
                } else {
                    marker.addEventListener('mouseover', markerOver, false);
                    marker.addEventListener('mouseout', markerOut, false)
                }
                var markerSelect = function(e) {
                    var selection = selectionData;
                    EarthModel.selectVisualization(timeBins, selection.selectedYear, [this.countryName], selection.getExportCategories(), selection.getImportCategories())
                };
                marker.addEventListener('click', markerSelect, true);
                markers.push(marker)
            }
            function getVisualizedMesh(linearData, year, countries, exportCategories, importCategories) {
                var exportColor = 0xdd380c;
                var importColor = 0x154492;
                for (var i in countries) {
                    countries[i] = countries[i].toUpperCase()
                }
                //var indexFromYear = parseInt(year) - 1992;
                //if (indexFromYear >= timeBins.length) indexFromYear = timeBins.length - 1;
                var affectedCountries = [];
                var bin = linearData[0].data; //bin就是lineData
                ////console.log("bin",linearData);
                var linesGeo = new THREE.Geometry();
                var lineColors = [];
                var particlesGeo = new THREE.Geometry(); //line对象的数据，极其重要
                var particleColors = []; //材质颜色，为啥是数组
                for (i in bin) {
                    var set = bin[i];
                    var exporterName = set.e.toUpperCase();
                    var importerName = set.i.toUpperCase();
                    var relevantExport = $.inArray(exporterName, countries) >= 0;
                    var relevantImport = $.inArray(importerName, countries) >= 0;
                    var useExporter = relevantExport;
                    var useImporter = relevantImport;
                    var categoryName = reverseWeaponLookup[set.wc];
                    var relevantExportCategory = relevantExport && $.inArray(categoryName, exportCategories) >= 0;
                    var relevantImportCategory = relevantImport && $.inArray(categoryName, importCategories) >= 0;
                    //判断验证，没有数据则不执行
                    //if ((useImporter || useExporter) && (relevantExportCategory || relevantImportCategory)) {
                    if (true) {
                        if (set.lineGeometry === undefined) continue;
                        var thisLineIsExport = false;
                        if (exporterName == selectedCountry.countryName) {
                            thisLineIsExport = true;
                        }
                        //颜色添加 16进制转换为RGB 传入颜色
                        var lineColor = thisLineIsExport ? new THREE.Color(exportColor) : new THREE.Color(importColor);
                        var lastColor;
                        for (s in set.lineGeometry.vertices) {
                            var v = set.lineGeometry.vertices[s];
                            lineColors.push(lineColor);
                            lastColor = lineColor
                        }
                        //-------------------
                        THREE.GeometryUtils.merge(linesGeo, set.lineGeometry);
                        //-------------------
                        var particleColor = lastColor.clone();
                        //console.log(particleColor);
                        var points = set.lineGeometry.vertices;
                        var particleCount = Math.floor(set.v / 8000 / set.lineGeometry.vertices.length) + 1;
                        particleCount = constrain(particleCount, 1, 100);
                        var particleSize = set.lineGeometry.size;
                        for (var s = 0; s < particleCount; s++) {
                            var desiredIndex = s / particleCount * points.length;
                            var rIndex = constrain(Math.floor(desiredIndex), 0, points.length - 1);
                            var point = points[rIndex];
                            var particle = point.clone();
                            particle.moveIndex = rIndex;
                            particle.nextIndex = rIndex + 1;
                            if (particle.nextIndex >= points.length) particle.nextIndex = 0;
                            particle.lerpN = 0;
                            particle.path = points;
                            //重要内容
                            particlesGeo.vertices.push(particle);
                            particle.size = particleSize;
                            particleColors.push(particleColor)
                        }
                        //还是筛选项
                        //if ($.inArray(exporterName, affectedCountries) < 0) {
                        if (true) {
                            affectedCountries.push(exporterName)
                        }
                        //if ($.inArray(importerName, affectedCountries) < 0) {
                        if (true) {
                            affectedCountries.push(importerName)
                        }

                        var vb = set.v;
                        var exporterCountry = countryData[exporterName];
                        if (exporterCountry.mapColor === undefined) {
                            exporterCountry.mapColor = vb
                        } else {
                            exporterCountry.mapColor += vb
                        }
                        var importerCountry = countryData[importerName];
                        if (importerCountry.mapColor === undefined) {
                            importerCountry.mapColor = vb
                        } else {
                            importerCountry.mapColor += vb
                        }
                        exporterCountry.exportedAmount += vb;
                        importerCountry.importedAmount += vb;
                        if (exporterCountry == selectedCountry) {
                            selectedCountry.summary.exported[set.wc] += set.v;
                            selectedCountry.summary.exported.total += set.v
                        }
                        if (importerCountry == selectedCountry) {
                            selectedCountry.summary.imported[set.wc] += set.v;
                            selectedCountry.summary.imported.total += set.v
                        }
                        if (importerCountry == selectedCountry || exporterCountry == selectedCountry) {
                            selectedCountry.summary.total += set.v;
                            //console.log("selectedCountry",selectedCountry)
                        }
                    }
                }
                linesGeo.colors = lineColors;
                //以下暂时不考虑
                var splineOutline = new THREE.Line(linesGeo, new THREE.LineBasicMaterial({
                    color: 0xffffff,
                    opacity: 1.0,
                    blending: THREE.AdditiveBlending,
                    transparent: true,
                    depthWrite: false,
                    vertexColors: true,
                    linewidth: 1
                }));
                splineOutline.renderDepth = false;
                //shader
                attributes = {
                    size: {
                        type: 'f',
                        value: []
                    },
                    customColor: {
                        type: 'c',
                        value: []
                    }
                };
                uniforms = {
                    amplitude: {
                        type: "f",
                        value: 1.0
                    },
                    color: {
                        type: "c",
                        value: new THREE.Color(0xffffff)
                    },
                    texture: {
                        type: "t",
                        value: 0,
                        texture: THREE.ImageUtils.loadTexture("images/particleA.png")
                    },
                };
                var shaderMaterial = new THREE.ShaderMaterial({
                    uniforms: uniforms,
                    attributes: attributes,
                    vertexShader: document.getElementById('vertexshader').textContent,
                    fragmentShader: document.getElementById('fragmentshader').textContent,
                    blending: THREE.AdditiveBlending,
                    depthTest: true,
                    depthWrite: false,
                    transparent: true,
                });
                //特效纹理
                var particleGraphic = THREE.ImageUtils.loadTexture("images/map_mask.png");

                //特效材质
                var particleMat = new THREE.ParticleBasicMaterial({
                    map: particleGraphic,
                    color: 0xffffff,
                    size: 60,
                    blending: THREE.NormalBlending,
                    transparent: true,
                    depthWrite: false,
                    vertexColors: true,
                    sizeAttenuation: true
                });
                particlesGeo.colors = particleColors;
                //console.log(particleColors)
                var pSystem = new THREE.ParticleSystem(particlesGeo, shaderMaterial);
                pSystem.dynamic = true;
                splineOutline.add(pSystem); //添加THREEJS属性
                var vertices = pSystem.geometry.vertices;
                var values_size = attributes.size.value;
                var values_color = attributes.customColor.value;
                for (var v = 0; v < vertices.length; v++) {
                    values_size[v] = pSystem.geometry.vertices[v].size;
                    values_color[v] = particleColors[v]
                }
                pSystem.update = function() {
                    for (var i in this.geometry.vertices) {
                        var particle = this.geometry.vertices[i];
                        var path = particle.path;
                        var moveLength = path.length;
                        particle.lerpN += 0.05;
                        if (particle.lerpN > 1) {
                            particle.lerpN = 0;
                            particle.moveIndex = particle.nextIndex;
                            particle.nextIndex++;
                            if (particle.nextIndex >= path.length) {
                                particle.moveIndex = 0;
                                particle.nextIndex = 1;
                            }
                        }
                        var currentPoint = path[particle.moveIndex];
                        var nextPoint = path[particle.nextIndex];
                        particle.copy(currentPoint);
                        particle.lerpSelf(nextPoint, particle.lerpN)
                    }
                    this.geometry.verticesNeedUpdate = true;
                };
                splineOutline.affectedCountries = affectedCountries;
                //console.log("splineOutline",splineOutline);
                return splineOutline
            }
        },
        highlightCountry: function(countries) {
            var countryCodes = [];
            for (var i in countries) {
                var code = findCode(countries[i]);
                countryCodes.push(code)
            }
            function findCode(countryName) {
                countryName = countryName.toUpperCase();
                for (var i in countryLookup) {
                    if (countryLookup[i] === countryName) return i
                }
                return 'not found';
            }
            var ctx = lookupCanvas.getContext('2d');
            ctx.clearRect(0, 0, 256, 1);
            var pickMask = countries.length == 0 ? 0 : 1;
            var oceanFill = 10 * pickMask;
            ctx.fillStyle = 'rgb(' + oceanFill + ',' + oceanFill + ',' + oceanFill + ')';
            ctx.fillRect(0, 0, 1, 1);
            for (var i in countryCodes) {
                var countryCode = countryCodes[i];
                var colorIndex = countryColorMap[countryCode];
                var mapColor = countryData[countries[i]].mapColor;
                var fillCSS = '#333333';
                if (countryCode === selectedCountry.countryCode) {
                    fillCSS = '#eeeeee';
                    ctx.fillStyle = fillCSS;
                    ctx.fillRect(colorIndex, 0, 1, 1);
                }
            }
            lookupTexture.needsUpdate = true;
        }
    }
    EarthModel.run();
    function constrain(v, min, max) {
        if (v < min) {
            v = min;
        } else if (v > max) {
            v = max;
        }
        return v;
    }
}

$(document).ready(function() {
    earth();
});