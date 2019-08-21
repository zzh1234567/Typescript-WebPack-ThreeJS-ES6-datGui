import * as THREE from 'three'
import * as Detector from "../js/vendor/Detector";
import * as DAT from 'dat.gui';
import { OrbitControls } from 'three-orbitcontrols-ts';
import { Interaction } from "three.interaction";

////import * as checkerboard from "../textures/checkerboard.jpg";
////import * as UV_Grid_Sm from "../textures/UV_Grid_Sm.jpg";

const checkerboard = "textures/checkerboard.jpg"; //// 开发时，是在build/textures文件夹下
const UV_Grid_Sm = "textures/UV_Grid_Sm.jpg";
//// https://threejs.org/docs/#manual/en/introduction/Import-via-modules
import {
  FBXLoader as THREEFBXLoader
} from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  TDSLoader as THREETDSLoader
} from 'three/examples/jsm/loaders/TDSLoader.js';


const CAMERA_NAME = "Perspective Camera";
const DIRECTIONAL_LIGHT_NAME = "Directional Light";
const SPOT_LIGHT_NAME = "Spotlight";

class guiStruct {
  public nameMesh: string;
  public color: THREE.Color;

  public offsetX: Number;
  public offsetY: Number;
  public repeatX: Number;
  public repeatY: Number;
  public rotation: Number;
  public centerX: Number;
  public centerY: Number;
  public RepeatWrapping: Boolean;
  public animation: Boolean;
  public helper: Boolean;

  constructor() {
    this.nameMesh = "";
    this.color = new THREE.Color();
    ////  h: 350,
    ////  s: 0.9,
    ////  v: 0.3
    // Hue, saturation, value

    this.offsetX = 0;
    this.offsetY = 0,
      this.repeatX = 1,
      this.repeatY = 1,
      this.rotation = 0,
      this.centerX = 0.5,
      this.centerY = 0.5,
      this.RepeatWrapping = true,
      this.animation = true,
      this.helper = true //模型辅助线
  };
}

export class Application {

  private _scene: THREE.Scene;
  //private _canvas: HTMLCanvasElement;
  private _camera: THREE.PerspectiveCamera;
  private _renderer: THREE.WebGLRenderer;
  private _axis: THREE.AxesHelper;
  private _light: THREE.DirectionalLight;
  private _light2: THREE.DirectionalLight;
  private _material: THREE.MeshBasicMaterial;
  private _box: THREE.Mesh;
  private _container: HTMLDivElement;
  private _tooltip: HTMLDivElement;
  private _showHelpers: Boolean;
  private _textureLoader: THREE.TextureLoader;
  private _raycaster: THREE.Raycaster;
  private _currentMesh: THREE.Group;
  private _controller: OrbitControls;
  private _currentSubMesh: THREE.Mesh;
  private _datGui: DAT.GUI;
  private _gui: guiStruct;
  private _srcModel: string;
  private _srcMaterialConfig: string;

  public constructor(opts) {
    if (opts.container) {
      console.log(" existed container", opts.container);
      this._container = opts.container;
    } else {
      console.log(" create container");
      this.createContainer();
    }

    this.createTooltip();

    this._showHelpers = opts.showHelpers ? true : false;
    this._textureLoader = new THREE.TextureLoader();

    if (Detector.webgl) {
      this.bindEventHandlers();
      this.init();
      this.renderApp();
    } else {
      // console.warn("WebGL NOT supported in your browser!");
      const warning = Detector.getWebGLErrorMessage();
      this._container.appendChild(warning);
    }
  }

  /**
   * Create a div element which will contain the Three.js canvas.
   */
  private createContainer() {
    const elements = document.getElementsByClassName("app");
    if (elements.length !== 1) {
      alert("You need to have exactly ONE <div class='app' /> in your HTML");
    }
    const app = elements[0];
    const div = document.createElement("div");
    div.setAttribute("class", "canvas-container");
    app.appendChild(div);
    this._container = div;
  }

  private createTooltip() {
    const elements = document.getElementsByClassName("app");
    if (elements.length !== 1) {
      alert("You need to have exactly ONE <div class='app' /> in your HTML");
    }
    const app = elements[0];
    const div = document.createElement("div");
    div.setAttribute("class", "tooltip");
    app.appendChild(div);
    this._tooltip = div;
  }

  //////////////////////////////////////Event Handler////////////////////////////
  /**
 * Bind event handlers to the Application instance.
 */
  private bindEventHandlers() {
    window.addEventListener("message", event => this.handlePostMessage(event));
    window.addEventListener("resize", event => this.handleResize(event));
    window.addEventListener("click", event => this.handleClick(event));
    window.addEventListener("mouseMove", event => this.handleMouseMove(event));
    window.addEventListener("postMessage", event => this.handlePostMessage(event));
  }

  handleClick(event) {
    const [x, y] = this.getNDCCoordinates(event, true);
    this._raycaster.setFromCamera({
      x,
      y
    }, this._camera);

    const intersects = this.getIntersects();
    if (intersects != null && intersects.length > 0) {
      var res = intersects.filter(function (res) {
        return res && res.object;
      })[0];
      console.log("hancleClick res = ", res);
      if (res && res.object) {
        if (this._currentSubMesh != res.object) {
          this._currentSubMesh = res.object as THREE.Mesh;
          if (this._currentSubMesh != null) {
            this.SetMeshSelection(this._currentSubMesh);
          }
        }
      }
    } else {
      this.SetMeshSelection(null);
    }
  }

  getIntersects() {
    const [x, y] = this.getNDCCoordinates(event, true);
    this._raycaster.setFromCamera({
      x,
      y
    }, this._camera);

    ////return this._raycaster.intersectObjects( this._scene.children);
    if (this._currentMesh != null) {
      return this._raycaster.intersectObject(this._currentMesh, true);
    }
    return null;
  }

  SetMeshSelection(currentSubMesh) {
    if (currentSubMesh) {
      if (this._datGui == null) {
        this.setupGUI();
      }
      this._gui.nameMesh = this._currentSubMesh.name;
    } else {
      if (this._datGui != null) { }
    }
  }

  handleMouseMove(event) {
    const [x, y] = this.getNDCCoordinates(event, false);
  }

  handleResize(event) {
    const {
      clientWidth,
      clientHeight
    } = this._container;
    this._camera.aspect = clientWidth / clientHeight;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(clientWidth, clientHeight);
  }
  handlePostMessage(event) {
    // event.origin --发送者的源
    // event.source --发送者的window对象
    // event.data --数据
    console.log("....zzh: handlePostMessage ", event.data);
    if (event.data.srcModel) {
      //// 如果直接指定了srcModel和materialConfig，那么直接去加载。类似（已经OnLoadCatalogResponse）
      console.log("....zzh: handlePostMessage event.data.srcModel", event.data.srcModel);
      //此处执行事件: OnLoadCatalogResponse
      this.set3DMediaSrc(event.data.srcModel, event.data.srcMaterialConfig);
    }
    else if (event.data.fullId) { /**** shopId.productId.varintId.optionId */
      ////类似PlaceProductOntoStageCommand: fullId
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
    this._tooltip.innerHTML = `<h4>${name} (${type})</h4><br><span>UUID: ${uuid}</span><br><span><em>Click to cast a ray</em></span>`;
    const style = `left: ${xScreen}px; top: ${yScreen}px; visibility: visible; opacity: 0.8`;
    ////this._tooltip.ststyle = style;
  }

  hideTooltip(interactionEvent) {
    ////this._tooltip.style = "visibility: hidden";
  }

  getScreenCoordinates(xNDC, yNDC) {
    const {
      clientHeight,
      clientWidth,
      offsetLeft,
      offsetTop,
    } = this._renderer.domElement;

    const xRelativePx = ((xNDC + 1) / 2) * clientWidth;
    const yRelativePx = -0.5 * (yNDC - 1) * clientHeight;
    const xScreen = xRelativePx + offsetLeft;
    const yScreen = yRelativePx + offsetTop;
    return [xScreen, yScreen];
  }

  ///////////////////////////////////////////////////////////////////UI/////////////////////////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////////////////////////////
  //// 在这里设置MaterialConfig UI
  ////////////////////////////////////////////////////////////////////////////////
  setupGUI() {
    if (this._datGui)
      return;
    //声明一个保存需求修改的相关数据的对象
    this._gui = new guiStruct();

    this._datGui = new DAT.GUI();
    var MaterialConfigScrollView = this._datGui.addFolder("产品配色清单");


    this._datGui.add(this._gui, "nameMesh", "没选中").name("当前选中部件").listen();
    /****
    var cameraFolder = this.datGui
      .addFolder("相机控制");
    cameraFolder
      .add(this._camera.position, "x")
      .name("Camera X")
      .min(0)
      .max(100);
    cameraFolder
      .add(this._camera.position, "y")
      .name("Camera Y")
      .min(0)
      .max(100);
    cameraFolder
      .add(this._camera.position, "z")
      .name("Camera Z")
      .min(0)
      .max(100);
 */
    this.AddFabricFolder();

    this._datGui.close();
  }

  AddFabricFolder() {
    var fabricFolder = this._datGui.addFolder("面料系列");
    fabricFolder.addColor(this._gui, "color").onChange(() => this.updateUV());
    //// https://stackoverflow.com/questions/49546169/represent-a-three-js-gui-button-with-an-icon
    var obj = {
      setTexture: () => {
        if (this._currentSubMesh != null) {
          var loader = new THREE.TextureLoader();
          var texture = loader.load(UV_Grid_Sm);
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          ////texture.matrixAutoUpdate = false; // 设置纹理属性matrixAutoUpdate为false以后，纹理将通过matrix属性设置的矩阵更新纹理显示
          this._currentSubMesh.material = new THREE.MeshBasicMaterial({
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

    var uvFolder = this._datGui.addFolder("配色设置");
    //将设置属性添加到gui当中，gui.add(对象，属性，最小值，最大值）
    uvFolder.add(this._gui, "offsetX", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "offsetY", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "repeatX", 0.25, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "repeatY", 0.25, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "rotation", -2.0, 2.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "centerX", 0.0, 1.0).onChange(() => this.updateUV());
    uvFolder.add(this._gui, "centerY", 0.0, 1.0).onChange(() => this.updateUV());
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

  }

  //更新纹理贴图的方法
  updateUV() {
    // 一种方法，直接全写在一个方法内
    //texture.matrix.setUvTransform( API.offsetX, API.offsetY, API.repeatX, API.repeatY, API.rotation, API.centerX, API.centerY );
    ////console.log("currentSubMesh.material ...", this.currentSubMesh.material);
    var m = this._currentSubMesh.material as THREE.MeshBasicMaterial;
    if (m != null && m.map != null) {
      //// 在ts中，不存在m.map.matrix，所以，我们一个一个手工设置
      m.map.offset = new THREE.Vector2(-this._gui.offsetX.valueOf(), -this._gui.offsetY.valueOf());
      m.map.rotation = this._gui.rotation.valueOf();
      m.map.repeat = new THREE.Vector2(this._gui.repeatX.valueOf(), this._gui.repeatY.valueOf());
      m.map.center = new THREE.Vector2(this._gui.centerX.valueOf(), this._gui.centerY.valueOf());
      ////console.log("currentSubMesh.material.map ...", this.currentSubMesh.material.map);
      // 另一种方法在js中可用，分开写
      /****m.map.matrix
        .identity() //矩阵重置
        .translate(-this._gui.centerX, -this._gui.centerY) //设置中心点
        .rotate(this._gui.rotation) // 旋转
        .scale(this._gui.repeatX, this._gui.repeatY) //缩放
        .translate(this._gui.centerX, this._gui.centerY) //设置中心点
        .translate(this._gui.offsetX, this._gui.offsetY); //偏移
         */
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
    } = this._renderer.domElement;

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

  parseXml(xmStr: string): XMLDocument {
    var xmlDocument = new DOMParser().parseFromString(xmStr, "text/xml");
    return xmlDocument;
  }

  set3DMediaSrc(src, materialConfig) {

    this.loadModel(src);
  }

  loadModel(src) {
    //加载模型
    this._srcModel = src;
    var loader = null;
    if (this._srcModel.indexOf(".fbx") || this._srcModel.indexOf(".FBX")) {
      loader = new THREEFBXLoader();
    } else if (this._srcModel.indexOf(".3ds") || this._srcModel.indexOf(".3DS")) {
      loader = new THREETDSLoader();
    }

    if (loader != null) {
      loader.load(this._srcModel, (mesh) => {
        console.log('mesh加载 = ', mesh);
        this._currentMesh = mesh;

        //设置模型的每个部位都可以投影
        mesh.traverse(function (child) {
          if (child.isMesh) {
            console.log('设置模型的每个部位都可以投影 child = ', child);
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this._scene.add(mesh);
        console.log('mesh加载完成，并放入到场景了。set3DMediaSrc srcModel = ', this._srcModel);
      });
    }
  }

  ////////////////////////////////////////////////////////////// Setup ///////////////////////////////////////////////////////////////////////
  init() {
    this.setupScene();
    this.setupRenderer();
    this.setupCamera();
    const interaction = new Interaction(this._renderer, this._scene, this._camera);
    this.setupLights();
    if (this._showHelpers) {
      this.setupHelpers();
    }
    this.setupRay();
    this.setupControls();
    this.setupGUI();

    ////this.addFloor(1000, 1000);
  }

  renderApp() {
    if (this._controller != null) this._controller.update();
    if (this._renderer != null) this._renderer.render(this._scene, this._camera);
    // when render is invoked via requestAnimationFrame(this.render) there is
    // no 'this', so either we bind it explicitly or use an es6 arrow function.
    // requestAnimationFrame(this.render.bind(this));
    requestAnimationFrame(() => this.renderApp());
  }

  /**
  * Setup a Three.js scene.
  * Setting the scene is the first Three.js-specific code to perform.
  */
  setupScene() {
    this._scene = new THREE.Scene();
    this._scene.autoUpdate = true;
    // Let's say we want to define the background color only once throughout the
    // application. This can be done in CSS. So here we use JS to get a property
    // defined in a CSS.
    const style = window.getComputedStyle(this._container);
    const color = new THREE.Color(style.getPropertyValue("background-color"));
    this._scene.background = new THREE.Color(0xF7F7F7);
    this._scene.fog = null;
    // Any Three.js object in the scene (and the scene itself) can have a name.
    this._scene.name = "My Three.js Scene";
  }

  /**
   * Create a Three.js renderer.
   * We let the renderer create a canvas element where to draw its output, then
   * we set the canvas size, we add the canvas to the DOM and we bind event
   * listeners to it.
   */
  setupRenderer() {
    this._renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    // this.renderer.setClearColor(0xd3d3d3);  // it's a light gray
    this._renderer.setClearColor(0x222222); // it's a dark gray
    this._renderer.setPixelRatio(window.devicePixelRatio || 1);
    const {
      clientWidth,
      clientHeight
    } = this._container;
    this._renderer.setSize(clientWidth, clientHeight);
    this._renderer.shadowMap.enabled = true;
    this._container.appendChild(this._renderer.domElement);
    this._renderer.domElement.addEventListener("click", (event) => this.handleClick(event));
    this._renderer.domElement.addEventListener("mousemove", (event) => this.handleMouseMove(event));
  }

  setupCamera() {
    const fov = 75;
    const {
      clientWidth,
      clientHeight
    } = this._container;
    const aspect = clientWidth / clientHeight;
    const near = 0.1;
    const far = 10000;
    this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this._camera.name = CAMERA_NAME;
    this._camera.position.set(100, 100, 200);
    this._camera.lookAt(this._scene.position);
  }

  setupLights() {
    this._scene.add(new THREE.AmbientLight(0x444444));
    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(0, 20, 20);

    light.castShadow = true;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;

    //告诉平行光需要开启阴影投射
    light.castShadow = true;

    this._scene.add(light);
  }

  setupLights2() {
    const dirLight = new THREE.DirectionalLight(0x4682b4, 1); // steelblue
    dirLight.name = DIRECTIONAL_LIGHT_NAME;
    dirLight.position.set(120, 30, -200);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 10;
    this._scene.add(dirLight);

    const spotLight = new THREE.SpotLight(0xffaa55);
    spotLight.name = SPOT_LIGHT_NAME;
    spotLight.position.set(120, 30, 0);
    spotLight.castShadow = true;
    dirLight.shadow.camera.near = 10;
    this._scene.add(spotLight);

    const ambientLight = new THREE.AmbientLight(0xffaa55);
    this._scene.add(ambientLight);
  }

  setupHelpers() {
    const gridHelper = new THREE.GridHelper(2000, 16);
    gridHelper.name = "Floor GridHelper";
    this._scene.add(gridHelper);

    // XYZ axes helper (XYZ axes are RGB colors, respectively)
    const axesHelper = new THREE.AxesHelper(75);
    axesHelper.name = "XYZ AzesHelper";
    this._scene.add(axesHelper);
    /****
    const dirLight =  this._scene.getObjectByName(DIRECTIONAL_LIGHT_NAME);

    const dirLightHelper = new THREE.DirectionalLightHelper(dirLight, 10);
    dirLightHelper.name = `${DIRECTIONAL_LIGHT_NAME} Helper`;
     this._scene.add(dirLightHelper);

    const dirLightCameraHelper = new THREE.CameraHelper(dirLight.shadow.camera);
    dirLightCameraHelper.name = `${DIRECTIONAL_LIGHT_NAME} Shadow Camera Helper`;
     this._scene.add(dirLightCameraHelper);

    const spotLight =  this._scene.getObjectByName(SPOT_LIGHT_NAME);

    const spotLightHelper = new THREE.SpotLightHelper(spotLight);
    spotLightHelper.name = `${SPOT_LIGHT_NAME} Helper`;
     this._scene.add(spotLightHelper);

    const spotLightCameraHelper = new THREE.CameraHelper(
      spotLight.shadow.camera
    );
    spotLightCameraHelper.name = `${SPOT_LIGHT_NAME} Shadow Camera Helper`;
     this._scene.add(spotLightCameraHelper);
     */
  }

  setupRay() {
    this._raycaster = new THREE.Raycaster();
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
      this._scene.add(floor);

      ////floor.cursor = "pointer";
      floor.addEventListener("mouseover", this.showTooltip);
      floor.addEventListener("mouseout", this.hideTooltip);
    };

    const onProgress = undefined;

    const onError = event => {
      alert(`Impossible to load the texture ${checkerboard}`);
    };
    this._textureLoader.load(checkerboard, onLoad, onProgress, onError);
  }

  setupControls() {
    this._controller = new OrbitControls(this._camera, this._renderer.domElement);
    this._controller.enabled = true;
    this._controller.minDistance = 1; //设置相机距离原点的最远距离
    this._controller.maxDistance = 1500;
    this._controller.autoRotate = true;
    this._controller.autoRotateSpeed = 0.5;
    this._controller.enableDamping = true;

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
}

