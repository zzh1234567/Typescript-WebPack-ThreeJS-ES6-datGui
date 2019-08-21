import * as THREE from "three";
// TODO: OrbitControls import three.js on its own, so the webpack bundle includes three.js twice!
import OrbitControls from "orbit-controls-es6";
import {
  Interaction
} from "three.interaction";

import * as Detector from "../js/vendor/Detector";
import * as DAT from "dat.gui";
import * as checkerboard from "../textures/checkerboard.jpg";
import * as UV_Grid_Sm from "../textures/UV_Grid_Sm.jpg";

//// https://threejs.org/docs/#manual/en/introduction/Import-via-modules
import {
  FBXLoader
} from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  TDSLoader
} from 'three/examples/jsm/loaders/TDSLoader.js';

const CAMERA_NAME = "Perspective Camera";
const DIRECTIONAL_LIGHT_NAME = "Directional Light";
const SPOT_LIGHT_NAME = "Spotlight";

export class Application {

  constructor(opts = {}) {
    if (opts.container) {
      this.container = opts.container;
    } else {
      this.createContainer();
    }
    this.createTooltip();
    this.showHelpers = opts.showHelpers ? true : false;
    this.textureLoader = new THREE.TextureLoader();

    if (Detector.webgl) {
      this.bindEventHandlers();
      this.init();
      this.render();
    } else {
      // console.warn("WebGL NOT supported in your browser!");
      const warning = Detector.getWebGLErrorMessage();
      this.container.appendChild(warning);
    }
  }

  /**
   * Bind event handlers to the Application instance.
   */
  bindEventHandlers() {
    this.handleClick = this.handleClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.handlePostMessage = this.handlePostMessage.bind(this);
    window.addEventListener("message", this.handlePostMessage);
    window.addEventListener("resize", this.handleResize);
  }

  init() {
    this.setupScene();
    this.setupRenderer();
    this.setupCamera();
    const interaction = new Interaction(this.renderer, this.scene, this.camera);
    this.setupLights();
    if (this.showHelpers) {
      this.setupHelpers();
    }
    this.setupRay();
    this.setupControls();
    this.setupGUI();

    ////this.addFloor(1000, 1000);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    // when render is invoked via requestAnimationFrame(this.render) there is
    // no 'this', so either we bind it explicitly or use an es6 arrow function.
    // requestAnimationFrame(this.render.bind(this));
    requestAnimationFrame(() => this.render());
  }

  /**
   * Create a div element which will contain the Three.js canvas.
   */
  createContainer() {
    const elements = document.getElementsByClassName("app");
    if (elements.length !== 1) {
      alert("You need to have exactly ONE <div class='app' /> in your HTML");
    }
    const app = elements[0];
    const div = document.createElement("div");
    div.setAttribute("class", "canvas-container");
    app.appendChild(div);
    this.container = div;
  }

  createTooltip() {
    const elements = document.getElementsByClassName("app");
    if (elements.length !== 1) {
      alert("You need to have exactly ONE <div class='app' /> in your HTML");
    }
    const app = elements[0];
    const div = document.createElement("div");
    div.setAttribute("class", "tooltip");
    app.appendChild(div);
    this.tooltip = div;
  }

  getIntersects() {
    const [x, y] = this.getNDCCoordinates(event, true);
    this.raycaster.setFromCamera({
      x,
      y
    }, this.camera);

    ////return this.raycaster.intersectObjects(this.scene.children);
    return this.raycaster.intersectObject(this.currentMesh, true);
  }

  handleClick(event) {
    const [x, y] = this.getNDCCoordinates(event, true);
    this.raycaster.setFromCamera({
      x,
      y
    }, this.camera);

    const intersects = this.getIntersects();
    if (intersects.length > 0) {
      var res = intersects.filter(function (res) {
        return res && res.object;
      })[0];
      console.log("hancleClick res = ", res);
      if (res && res.object) {
        if (this.currentSubMesh != res.object) {
          this.currentSubMesh = res.object;
          if (this.currentSubMesh != null) {
            this.SetMeshSelection(this.currentSubMesh);
          }
        }
      }
    } else {
      this.SetMeshSelection(null);
    }
  }

  SetMeshSelection(currentSubMesh) {
    if (currentSubMesh) {
      if (this.datGui == null) {
        this.setupGUI();
      }
      this.gui.nameMesh = this.currentSubMesh.name;
    } else {
      if (this.datGui != null) {}
    }
  }

  handleMouseMove(event) {
    const [x, y] = this.getNDCCoordinates(event);
  }

  handleResize(event) {
    // console.warn(event);
    const {
      clientWidth,
      clientHeight
    } = this.container;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }
  handlePostMessage(event) {
    // event.origin --发送者的源
    // event.source --发送者的window对象
    // event.data --数据
    console.log("....zzh: handlePostMessage ", event.data);
    if (event.data.srcModel) {
      console.log("....zzh: handlePostMessage event.data.srcModel", event.data.srcModel);
      //此处执行事件
      this.set3DMediaSrc(event.data.srcModel, event.data.srcMaterialConfig);
    }
  }

  showTooltip(interactionEvent) {
    const {
      name,
      uuid,
      type
    } = interactionEvent.target;
    const {
      x,
      y
    } = interactionEvent.data.global;
    const [xScreen, yScreen] = this.getScreenCoordinates(x, y);
    this.tooltip.innerHTML = `<h4>${name} (${type})</h4><br><span>UUID: ${uuid}</span><br><span><em>Click to cast a ray</em></span>`;
    const style = `left: ${xScreen}px; top: ${yScreen}px; visibility: visible; opacity: 0.8`;
    this.tooltip.style = style;
  }

  hideTooltip(interactionEvent) {
    this.tooltip.style = "visibility: hidden";
  }

  /**
   * Setup a Three.js scene.
   * Setting the scene is the first Three.js-specific code to perform.
   */
  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.autoUpdate = true;
    // Let's say we want to define the background color only once throughout the
    // application. This can be done in CSS. So here we use JS to get a property
    // defined in a CSS.
    const style = window.getComputedStyle(this.container);
    const color = new THREE.Color(style.getPropertyValue("background-color"));
    this.scene.background = "#F7F7F7";
    this.scene.fog = null;
    // Any Three.js object in the scene (and the scene itself) can have a name.
    this.scene.name = "My Three.js Scene";
  }

  /**
   * Create a Three.js renderer.
   * We let the renderer create a canvas element where to draw its output, then
   * we set the canvas size, we add the canvas to the DOM and we bind event
   * listeners to it.
   */
  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    // this.renderer.setClearColor(0xd3d3d3);  // it's a light gray
    this.renderer.setClearColor(0x222222); // it's a dark gray
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    const {
      clientWidth,
      clientHeight
    } = this.container;
    this.renderer.setSize(clientWidth, clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener("click", this.handleClick);
    this.renderer.domElement.addEventListener(
      "mousemove",
      this.handleMouseMove
    );
  }

  setupCamera() {
    const fov = 75;
    const {
      clientWidth,
      clientHeight
    } = this.container;
    const aspect = clientWidth / clientHeight;
    const near = 0.1;
    const far = 10000;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.name = CAMERA_NAME;
    this.camera.position.set(100, 100, 200);
    this.camera.lookAt(this.scene.position);
  }

  setupLights() {
    this.scene.add(new THREE.AmbientLight(0x444444));
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 20, 20);

    light.castShadow = true;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;

    //告诉平行光需要开启阴影投射
    light.castShadow = true;

    this.scene.add(light);
  }

  setupLights2() {
    const dirLight = new THREE.DirectionalLight(0x4682b4, 1); // steelblue
    dirLight.name = DIRECTIONAL_LIGHT_NAME;
    dirLight.position.set(120, 30, -200);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 10;
    this.scene.add(dirLight);

    const spotLight = new THREE.SpotLight(0xffaa55);
    spotLight.name = SPOT_LIGHT_NAME;
    spotLight.position.set(120, 30, 0);
    spotLight.castShadow = true;
    dirLight.shadow.camera.near = 10;
    this.scene.add(spotLight);

    const ambientLight = new THREE.AmbientLight(0xffaa55);
    this.scene.add(ambientLight);
  }

  setupHelpers() {
    const gridHelper = new THREE.GridHelper(2000, 16);
    gridHelper.name = "Floor GridHelper";
    this.scene.add(gridHelper);

    // XYZ axes helper (XYZ axes are RGB colors, respectively)
    const axesHelper = new THREE.AxesHelper(75);
    axesHelper.name = "XYZ AzesHelper";
    this.scene.add(axesHelper);
    /****
    const dirLight = this.scene.getObjectByName(DIRECTIONAL_LIGHT_NAME);

    const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 10);
    dirLightHelper.name = `${DIRECTIONAL_LIGHT_NAME} Helper`;
    this.scene.add(dirLightHelper);

    const dirLightCameraHelper = new THREE.CameraHelper(dirLight.shadow.camera);
    dirLightCameraHelper.name = `${DIRECTIONAL_LIGHT_NAME} Shadow Camera Helper`;
    this.scene.add(dirLightCameraHelper);

    const spotLight = this.scene.getObjectByName(SPOT_LIGHT_NAME);

    const spotLightHelper = new THREE.SpotLightHelper(spotLight);
    spotLightHelper.name = `${SPOT_LIGHT_NAME} Helper`;
    this.scene.add(spotLightHelper);

    const spotLightCameraHelper = new THREE.CameraHelper(
      spotLight.shadow.camera
    );
    spotLightCameraHelper.name = `${SPOT_LIGHT_NAME} Shadow Camera Helper`;
    this.scene.add(spotLightCameraHelper);
     */
  }

  setupRay() {
    this.raycaster = new THREE.Raycaster();
  }

  /**
   * Add a floor object to the scene.
   * Note: Three.js's TextureLoader does not support progress events.
   * @see https://threejs.org/docs/#api/en/loaders/TextureLoader
   */
  addFloor(width, height) {
    const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
    const onLoad = texture => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(4, 4);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
      });
      const floor = new THREE.Mesh(geometry, material);
      floor.name = "Floor";
      floor.position.y = -0.5;
      floor.rotation.x = Math.PI / 2;
      this.scene.add(floor);

      floor.cursor = "pointer";
      floor.on("mouseover", this.showTooltip);
      floor.on("mouseout", this.hideTooltip);
    };

    const onProgress = undefined;

    const onError = event => {
      alert(`Impossible to load the texture ${checkerboard}`);
    };
    this.textureLoader.load(checkerboard, onLoad, onProgress, onError);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enabled = true;
    this.controls.minDistance = 1; //设置相机距离原点的最远距离
    this.controls.maxDistance = 1500;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.enableDamping = true;

    /****
     //设置控制器的中心点
    controls.target.set(0, 100, 0);
    // 如果使用animate方法时，将此函数删除
    //controls.addEventListener( 'change', render );
    // 使动画循环使用时阻尼或自转 意思是否有惯性
    controls.enableDamping = true;
    //动态阻尼系数 就是鼠标拖拽旋转灵敏度
    //controls.dampingFactor = 0.25;
    //是否可以缩放
    controls.enableZoom = true;
    //是否自动旋转
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    //设置相机距离原点的最远距离
    controls.minDistance = 1;
    //设置相机距离原点的最远距离
    controls.maxDistance = 2000;
    //是否开启右键拖拽
    controls.enablePan = true;
     */
  }
  ////////////////////////////////////////////////////////////////////////////////
  //// 在这里设置MaterialConfig UI
  ////////////////////////////////////////////////////////////////////////////////
  setupGUI() {
    if (this.datGui)
      return;
    //声明一个保存需求修改的相关数据的对象
    this.gui = {
      nameMesh: "",
      color: {
        h: 350,
        s: 0.9,
        v: 0.3
      }, // Hue, saturation, value
      offsetX: 0,
      offsetY: 0,
      repeatX: 1,
      repeatY: 1,
      rotation: 0,
      centerX: 0.5,
      centerY: 0.5,
      RepeatWrapping: true,
      animation: true,
      helper: true //模型辅助线
    };

    this.datGui = new DAT.GUI();
    var MaterialConfigScrollView = this.datGui.addFolder("产品配色清单");


    this.datGui.add(this.gui, "nameMesh", "没选中").name("当前选中部件").listen();
    /****
    var cameraFolder = this.datGui
      .addFolder("相机控制");
    cameraFolder
      .add(this.camera.position, "x")
      .name("Camera X")
      .min(0)
      .max(100);
    cameraFolder
      .add(this.camera.position, "y")
      .name("Camera Y")
      .min(0)
      .max(100);
    cameraFolder
      .add(this.camera.position, "z")
      .name("Camera Z")
      .min(0)
      .max(100);
 */

    var fabricFolder = this.datGui.addFolder("面料系列");
    fabricFolder.addColor(this.gui, "color").onChange(() => this.updateUV());
    //// https://stackoverflow.com/questions/49546169/represent-a-three-js-gui-button-with-an-icon
    var obj = {
      setTexture: () => {
        if (this.currentSubMesh != null) {
          var loader = new THREE.TextureLoader();
          var texture = loader.load(UV_Grid_Sm, this.render);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.matrixAutoUpdate = false; // 设置纹理属性matrixAutoUpdate为false以后，纹理将通过matrix属性设置的矩阵更新纹理显示
          this.currentSubMesh.material = new THREE.MeshBasicMaterial({
            map: texture
          });
        }
      }
    };
    var fourth = fabricFolder.add(obj, "setTexture"); ////.name(this.srcModel);
    var fourthStyle = fourth.domElement.previousSibling.style;

    fourthStyle.backgroundImage = 'url(https://cdn1.iconfinder.com/data/icons/hawcons/32/700035-icon-77-document-file-css-16.png)';
    fourthStyle.backgroundRepeat = 'repeat';
    fourthStyle.backgroundPosition = 'left';
    fourthStyle.backgroundColor = 'white';
    fourthStyle.color = 'black';

    var uvFolder = this.datGui.addFolder("配色设置");
    //将设置属性添加到gui当中，gui.add(对象，属性，最小值，最大值）
    uvFolder.add(this.gui, "offsetX", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "offsetY", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "repeatX", 0.25, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "repeatY", 0.25, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "rotation", -2.0, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "centerX", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this.gui, "centerY", 0.0, 1.0).onChange(() => this.updateUV());
    /****
    uvFolder.add(this.gui, "RepeatWrapping").onChange(() => function (e) {
      var material = this.currentSubMesh.material;
      if (e) {
        material.map.wrapS = material.map.wrapT = THREE.RepeatWrapping; //设置为可循环
      } else {
        material.map.wrapS = material.map.wrapT = THREE.ClampToEdgeWrapping; //设置会默认的最后一像素伸展
      }

      material.map.needsUpdate = true;
    });
     */
    this.datGui.close();
  }

  //更新纹理贴图的方法
  updateUV() {
    // 一种方法，直接全写在一个方法内
    //texture.matrix.setUvTransform( API.offsetX, API.offsetY, API.repeatX, API.repeatY, API.rotation, API.centerX, API.centerY );
    ////console.log("currentSubMesh.material ...", this.currentSubMesh.material);
    if (this.currentSubMesh.material != null && this.currentSubMesh.material.map != null) {
      ////console.log("currentSubMesh.material.map ...", this.currentSubMesh.material.map);
      // 另一种方法，分开写
      this.currentSubMesh.material.map.matrix
        .identity() //矩阵重置
        .translate(-this.gui.centerX, -this.gui.centerY) //设置中心点
        .rotate(this.gui.rotation) // 旋转
        .scale(this.gui.repeatX, this.gui.repeatY) //缩放
        .translate(this.gui.centerX, this.gui.centerY) //设置中心点
        .translate(this.gui.offsetX, this.gui.offsetY); //偏移
    }
  }

  set3DMediaSrc(src, materialConfig) {
    this.srcModel = src;
    this.srcMaterialConfig = materialConfig;

    console.log('加载和解析 materialConfig = ', materialConfig);

    if ((materialConfig !== null && materialConfig !== undefined && materialConfig !== '')) {

      if (this.parseXml == null) {
        if (typeof window.DOMParser != "undefined") {
          this.parseXml = function (xmlStr) {
            return (new window.DOMParser()).parseFromString(xmlStr, "text/xml");
          };
        } else if (typeof window.ActiveXObject != "undefined" &&
          new window.ActiveXObject("Microsoft.XMLDOM")) {
          this.parseXml = function (xmlStr) {
            var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM");
            xmlDoc.async = "false";
            xmlDoc.loadXML(xmlStr);
            return xmlDoc;
          };
        } else {
          throw new Error("No XML parser found");
        }
      }
      var xmlDoc = this.parseXml(materialConfig);
      var materials = xmlDoc.getElementsByTagName("materials");
      var childNodes = materials[0].childNodes;

      //// Parse Materials
      for (var i = 0; i < childNodes.length; i++) {
        var childNode = childNodes[i];
        console.log("childNode = ", childNode);
      };
      console.log("element....", xmlDoc.getElementsByTagName("defaultTransform")[0].childNodes[0].nodeValue);
    }
    //加载模型
    var loader = null;
    if (this.srcModel.indexOf(".fbx") || this.srcModel.indexOf(".FBX")) {
      loader = new FBXLoader();
    } else if (this.srcModel.indexOf(".3ds") || srcModel.indexOf(".3DS")) {
      loader = new TDSLoader();
    }

    if (loader != null) {
      loader.load(this.srcModel, (mesh) => {
        console.log('mesh加载 = ', mesh);
        this.currentMesh = mesh;

        //设置模型的每个部位都可以投影
        mesh.traverse(function (child) {
          if (child.isMesh) {
            console.log('设置模型的每个部位都可以投影 child = ', child);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.scene.add(mesh);
        console.log('mesh加载完成，并放入到场景了。set3DMediaSrc srcModel = ', this.srcModel);
      });
    }
  }

  /**
   * Convert screen coordinates into Normalized Device Coordinates [-1, +1].
   * @see https://learnopengl.com/Getting-started/Coordinate-Systems
   */
  getNDCCoordinates(event, debug) {
    const {
      clientHeight,
      clientWidth,
      offsetLeft,
      offsetTop,
    } = this.renderer.domElement;

    const xRelativePx = event.clientX - offsetLeft;
    const x = (xRelativePx / clientWidth) * 2 - 1;

    const yRelativePx = event.clientY - offsetTop;
    const y = -(yRelativePx / clientHeight) * 2 + 1;

    if (debug) {
      const data = {
        "Screen Coords (px)": {
          x: event.screenX,
          y: event.screenY
        },
        "Canvas-Relative Coords (px)": {
          x: xRelativePx,
          y: yRelativePx
        },
        "NDC (adimensional)": {
          x,
          y
        },
      };
      ////console.table(data, ["x", "y"]);
    }
    return [x, y];
  }

  getScreenCoordinates(xNDC, yNDC) {
    const {
      clientHeight,
      clientWidth,
      offsetLeft,
      offsetTop,
    } = this.renderer.domElement;

    const xRelativePx = ((xNDC + 1) / 2) * clientWidth;
    const yRelativePx = -0.5 * (yNDC - 1) * clientHeight;
    const xScreen = xRelativePx + offsetLeft;
    const yScreen = yRelativePx + offsetTop;
    return [xScreen, yScreen];
  }
}
