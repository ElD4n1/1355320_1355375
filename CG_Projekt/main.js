/**
 * Created by Clemens Birklbauer on 22.02.2016.
 */
'use strict';

var gl = null;
const camera = {
  rotation: {
    x: 0,
    y: 0
  },
  position: {
    x:0,
    y:-1,
    z:4
  },
  lookAt: {
    x: 0,
    y: 0,
    z: 0
  }
};

//scene graph nodes
var root = null;
var lightNode;
var translateLight;
var planetNode;
var translatePlanet;

//textures
var envcubetexture;
var renderTargetColorTexture;
var renderTargetDepthTexture;

//framebuffer variables
var renderTargetFramebuffer;
var framebufferWidth = 1024;
var framebufferHeight = 1024;


//load the required resources using a utility function
loadResources({
  vs_phong: 'shader/phong.vs.glsl',
  fs_phong: 'shader/phong.fs.glsl',
  vs_shadow: 'shader/shadow.vs.glsl',
  fs_shadow: 'shader/shadow.fs.glsl',
  vs_env: 'shader/envmap.vs.glsl',
  fs_env: 'shader/envmap.fs.glsl',
// Cubemap:
  env_pos_x: 'models/skybox/Galaxy_RT.jpg',
  env_neg_x: 'models/skybox/Galaxy_LT.jpg',
  env_pos_y: 'models/skybox/Galaxy_DN.jpg',
  env_neg_y: 'models/skybox/Galaxy_UP.jpg',
  env_pos_z: 'models/skybox/Galaxy_FT.jpg',
  env_neg_z: 'models/skybox/Galaxy_BK.jpg'


  //model: 'models/C-3PO.obj'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext(400, 400);


  initCubeMap(resources);

  gl.enable(gl.DEPTH_TEST);

  //create scenegraph
  root = createSceneGraph(gl, resources);

  //create scenegraph without floor and simple shader

  initInteraction(gl.canvas);
}

function createSceneGraph(gl, resources) {
  //create scenegraph
  const root = new ShaderSGNode(createProgram(gl, resources.vs_env, resources.fs_env));

  //add skybox by putting large sphere around us
  var skybox = new EnvironmentSGNode(envcubetexture,4,false,
                  new RenderSGNode(makeSphere(50)));
  root.append(skybox);

  //light debug helper function
  function createLightSphere() {
    return new ShaderSGNode(createProgram(gl, resources.vs_phong, resources.fs_phong), [

      new RenderSGNode(makeSphere(.9,10,10)) // Parameters: radius, latitudeBands, longitudeBands (how round it is)
    ]);
  }

  {
    //initialize light
    lightNode = new LightSGNode(); //use now framework implementation of light node
    lightNode.ambient = [0.2, 0.2, 0.2, 1];
    lightNode.diffuse = [0.8, 0.8, 0.8, 1];
    lightNode.specular = [1, 1, 1, 1];
    lightNode.position = [0, 0, 0];

    translateLight = new TransformationSGNode(glm.translate(0,-9,9)); //translating the light is the same as setting the light position

    translateLight.append(lightNode);
    translateLight.append(createLightSphere()); //add sphere for debugging: since we use 0,0,0 as our light position the sphere is at the same position as the light source
    root.append(translateLight);
  }

  {
    //Planet
    planetNode = new RenderSGNode(makeSphere(0.2,30,30));
    translatePlanet = new TransformationSGNode(glm.translate(0,0,0));
    translatePlanet.append(planetNode);

    root.append(translatePlanet);

  }

  return root;
}

function render(timeInMilliseconds) {
  checkForWindowResize(gl);

  //setup viewport
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Backgroundcolor
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //setup context and camera matrices
  const context = createSGContext(gl);
  context.projectionMatrix = mat4.perspective(mat4.create(), 30, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.01, 100);
  //very primitive camera implementation
  let lookAtMatrix = mat4.lookAt(mat4.create(), [camera.position.x,camera.position.y,camera.position.z], [camera.lookAt.x, camera.lookAt.y, camera.lookAt.z], [0,1,0]);

  context.viewMatrix = lookAtMatrix;

  //get inverse view matrix to allow computing eye-to-light matrix
  context.invViewMatrix = mat4.invert(mat4.create(), context.viewMatrix);

  //render scenegraph
  root.render(context);

  //animate
  requestAnimationFrame(render);
}


function initCubeMap(resources) {
  //create the texture
  envcubetexture = gl.createTexture();
  //define some texture unit we want to work on
  gl.activeTexture(gl.TEXTURE0);
  //bind the texture to the texture unit
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, envcubetexture);
  //set sampling parameters
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  //gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.MIRRORED_REPEAT); //will be available in WebGL 2
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  //set correct image for each side of the cube map
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);//flipping required for our skybox, otherwise images don't fit together
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_pos_x);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_neg_x);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_pos_y);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_neg_y);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_pos_z);
  gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resources.env_neg_z);
  //generate mipmaps (optional)
//  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  //unbind the texture again
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
}

//a scene graph node for setting environment mapping parameters
class EnvironmentSGNode extends SGNode {

  constructor(envtexture, textureunit, doReflect , children ) {
      super(children);
      this.envtexture = envtexture;
      this.textureunit = textureunit;
      this.doReflect = doReflect;
  }

  render(context)
  {
    //set additional shader parameters
    let invView3x3 = mat3.fromMat4(mat3.create(), context.invViewMatrix); //reduce to 3x3 matrix since we only process direction vectors (ignore translation)
    gl.uniformMatrix3fv(gl.getUniformLocation(context.shader, 'u_invView'), false, invView3x3);
    gl.uniform1i(gl.getUniformLocation(context.shader, 'u_texCube'), this.textureunit);
    gl.uniform1i(gl.getUniformLocation(context.shader, 'u_useReflection'), this.doReflect)

    //activate and bind texture
    gl.activeTexture(gl.TEXTURE0 + this.textureunit);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.envtexture);

    //render children
    super.render(context);

    //clean up
    gl.activeTexture(gl.TEXTURE0 + this.textureunit);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }
}

//camera control
function initInteraction(canvas) {
  const mouse = {
    pos: { x : 0, y : 0},
    leftButtonDown: false
  };
  function toPos(event) {
    //convert to local coordinates
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  canvas.addEventListener('mousedown', function(event) {
    mouse.pos = toPos(event);
    mouse.leftButtonDown = event.button === 0;
  });
  canvas.addEventListener('mousemove', function(event) {
    const pos = toPos(event);
    const delta = { x : mouse.pos.x - pos.x, y: mouse.pos.y - pos.y };
    if (mouse.leftButtonDown) {
      //add the relative movement of the mouse to the rotation variables
      let speed = 0.01;
  		camera.rotation.x += delta.x * speed;
  		camera.rotation.y += delta.y * speed;

      let direction = {
        x: Math.cos(camera.rotation.y) * Math.sin(camera.rotation.x),
        y: Math.sin(camera.rotation.y),
        z: Math.cos(camera.rotation.x) * Math.cos(camera.rotation.y)
      };

      camera.lookAt.x = camera.position.x + direction.x;
      camera.lookAt.y = camera.position.y + direction.y;
      camera.lookAt.z = camera.position.z + direction.z;
    }
    mouse.pos = pos;
  });
  canvas.addEventListener('mouseup', function(event) {
    mouse.pos = toPos(event);
    mouse.leftButtonDown = false;
  });
  //register globally
  document.addEventListener('keypress', function(event) {
    //https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
    if (event.code === 'KeyR') {
      camera.rotation.x = 0;
  		camera.rotation.y = 0;
    } else if (event.code === 'KeyW') {
      let direction = {
        x: Math.cos(camera.rotation.y) * Math.sin(camera.rotation.x),
        y: Math.sin(camera.rotation.y),
        z: Math.cos(camera.rotation.x) * Math.cos(camera.rotation.y)
      };
      let speed = 0.1;

      camera.position.x += direction.x * speed;
      camera.position.y += direction.y * speed;
      camera.position.z += direction.z * speed;
      camera.lookAt.x = camera.position.x + direction.x;
      camera.lookAt.y = camera.position.y + direction.y;
      camera.lookAt.z = camera.position.z + direction.z;
   } else if (event.code === 'KeyS') {
     let direction = {
       x: Math.cos(camera.rotation.y) * Math.sin(camera.rotation.x),
       y: Math.sin(camera.rotation.y),
       z: Math.cos(camera.rotation.x) * Math.cos(camera.rotation.y)
     };
     let speed = 0.1;

     camera.position.x -= direction.x * speed;
     camera.position.y -= direction.y * speed;
     camera.position.z -= direction.z * speed;
     camera.lookAt.x = camera.position.x + direction.x;
     camera.lookAt.y = camera.position.y + direction.y;
     camera.lookAt.z = camera.position.z + direction.z;
    }
  });
}
