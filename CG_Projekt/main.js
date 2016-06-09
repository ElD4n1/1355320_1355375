'use strict';

var gl = null;
const camera = {
  rotation: {
    x: 0,
    y: 0
  },
  position: {
    x: 1,
    y: -15,
    z:-1
  },
  direction: {
    x: 0,
    y: 0,
    z: 0
  },
  lookAt: {
    x: 0,
    y: -1,
    z: 5
  }
};

//scene graph nodes
var root = null;
var lightNode;
var translateLight;
var orbitSun;
var planetNode;
var translatePlanet;
var orbitMoon;
var translateTardis;
var rotateTardis;

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
  vs_shadow: 'shader/shadow.vs.glsl',
  fs_shadow: 'shader/shadow.fs.glsl',
  vs_env: 'shader/envmap.vs.glsl',
  fs_env: 'shader/envmap.fs.glsl',
  vs_texture: 'shader/texture.vs.glsl',
  fs_texture: 'shader/texture.fs.glsl',
// Cubemap:
  env_pos_x: 'models/skybox/Galaxy_RT.jpg',
  env_neg_x: 'models/skybox/Galaxy_LT.jpg',
  env_pos_y: 'models/skybox/Galaxy_DN.jpg',
  env_neg_y: 'models/skybox/Galaxy_UP.jpg',
  env_pos_z: 'models/skybox/Galaxy_FT.jpg',
  env_neg_z: 'models/skybox/Galaxy_BK.jpg',
  //textures
  moon_texture: 'models/Moon.jpg',
  planet_texture: 'models/planet.jpg',
  tardis_bottom: 'models/Tardis/TARDIS_BOTTOM.jpg',
  tardis_top: 'models/Tardis/TARDIS_TOP.jpg',
  tardis_front: 'models/Tardis/TARDIS_FRONT.jpg',
  tardis_side: 'models/Tardis/TARDIS_SIDE.jpg'

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
  const root = new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_texture));



  //add skybox by putting large sphere around us
  var skybox =  new ShaderSGNode(createProgram(gl, resources.vs_env, resources.fs_env),[
                new EnvironmentSGNode(envcubetexture,4,false,
                  new RenderSGNode(makeSphere(50)))
                ]);
  root.append(skybox);

  //light debug helper function
  function createLightSphere() {
    return new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_texture), [

      new RenderSGNode(makeSphere(1.9,10,10)) // Parameters: radius, latitudeBands, longitudeBands (how round it is)
    ]);
  }

  {
    //initialize light
    lightNode = new LightSGNode(); //use now framework implementation of light node
    lightNode.ambient = [0.0, 0.0, 0.0, 1];
    lightNode.diffuse = [0.8, 0.8, 0.8, 1];
    lightNode.specular = [1, 1, 1, 1];
    lightNode.position = [0, 0, 0];

    orbitSun = new TransformationSGNode(mat4.create());
    translateLight = new TransformationSGNode(glm.translate(-40,-5,20)); //translating the light is the same as setting the light position

    orbitSun.append(translateLight);
    translateLight.append(lightNode);
    translateLight.append(createLightSphere()); //add sphere for debugging: since we use 0,0,0 as our light position the sphere is at the same position as the light source
    root.append(orbitSun);
  }

  {
    //Planet
    planetNode =  new MaterialSGNode(
                  new TextureSGNode(resources.planet_texture,
                  new RenderSGNode(makeSphere(10,30,30))
                ));

    planetNode.ambient = [0.05375, 0.05, 0.06625, 1];
    planetNode.diffuse = [ 0.18275, 0.17, 0.22525, 1];
    planetNode.specular = [ 0.332741, 0.328634, 0.346435, 1];
    planetNode.shininess = 0.9;

    root.append(planetNode);
  }

  let dalek = createDalek();
  let translateDalek = new TransformationSGNode(glm.translate(0,-13,0));
  translateDalek.append(dalek);
  planetNode.append(translateDalek);

  planetNode.append(new TransformationSGNode(glm.translate(5,-13,0),createDalek()));

  planetNode.append(new TransformationSGNode(glm.translate(0,-15,2), new TransformationSGNode(glm.rotateX(90),createLamp())));

{
  //tardis
  let tardis = new MaterialSGNode(
            new TextureSGNode(resources.tardis_bottom,
            new RenderSGNode(makeRect(0.5,0.5))
  ));
  tardis.append(new TransformationSGNode(glm.translate(-0.5,-0.5,0),new TransformationSGNode(glm.rotateX(90), new TextureSGNode(resources.tardis_front, new RenderSGNode(makeTrapeze(1,1,2,0))))));
  tardis.append(new TransformationSGNode(glm.translate(-0.5,0.5,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), new TextureSGNode(resources.tardis_side, new RenderSGNode(makeTrapeze(1,1,2,0)))))));
  tardis.append(new TransformationSGNode(glm.translate(0.5,-0.5,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), new TextureSGNode(resources.tardis_side, new RenderSGNode(makeTrapeze(1,1,2,0)))))));
  tardis.append(new TransformationSGNode(glm.translate(0.5,0.5,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), new TextureSGNode(resources.tardis_side, new RenderSGNode(makeTrapeze(1,1,2,0)))))));
  tardis.append(new TransformationSGNode(glm.translate(0,0,2), new TextureSGNode(resources.tardis_top, new RenderSGNode(makeRect(0.5,0.5)))));
  rotateTardis = new TransformationSGNode(mat4.create(), new TransformationSGNode(glm.rotateX(90),tardis));
  translateTardis =new TransformationSGNode(glm.translate(3,-13,5),rotateTardis);

tardis.shininess = 0;

  planetNode.append(translateTardis);
}

    let moonNode = new TextureSGNode(resources.moon_texture,
                      new RenderSGNode(makeSphere(3,10,10)));


    orbitMoon = new TransformationSGNode(mat4.create());

    let moonLightNode = new LightSGNode(); //use now framework implementation of light node
    moonLightNode.ambient = [0.0, 0.0, 0.0, 1];
    moonLightNode.diffuse = [0.4, 0.4, 0.4, 1];
    moonLightNode.specular = [0.2, 0.2, 0.2, 1];
    moonLightNode.position = [0, 0, 0];
    moonLightNode.uniform = 'u_light2';

    let translateMoon = new TransformationSGNode(glm.translate(15,-5,-15));
    translateMoon.append(moonNode);
//    translateMoon.append(moonLightNode);
    orbitMoon.append(translateMoon)
    planetNode.append(orbitMoon);



  return root;
}

function createLamp(){
  let lamp = new RenderSGNode(makeHalfSphere(0.3, 10, 10));
  lamp.append(new TransformationSGNode(glm.rotateY(-45), new TransformationSGNode(glm.translate(0,0,0.29), new RenderSGNode(makeZylinder(0.05, 0.5,10)))));
  lamp.append( new TransformationSGNode(glm.translate(-0.6,0,0.6), new RenderSGNode(makeSphere(0.08, 10,10))));
  lamp.append(new TransformationSGNode(glm.translate(-0.6,0,-2.44), new RenderSGNode(makeZylinder(0.05,3,10))));

  lamp = new MaterialSGNode(lamp);

  lamp.ambient = [0.05375, 0.05, 0.06625, 1];
  lamp.diffuse = [ 0.18275, 0.17, 0.22525, 1];
  lamp.specular = [ 0.332741, 0.328634, 0.346435, 1];
  lamp.shininess = 0.9;

  return lamp;
}

// Returns a Dalek node
function createDalek(){
  let dalek = new RenderSGNode(makeTrapeze(1,1,0.2,0));
  dalek.append(new TransformationSGNode(glm.translate(0, 0,1.2), new RenderSGNode(makeTrapeze(1,1,0.2,0))));
  dalek.append(new TransformationSGNode(glm.rotateY(270), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0))));
  dalek.append(new TransformationSGNode(glm.translate(1, 0,1.2), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0, 0.2,0), new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(1,1,1.2,0)))));

  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.8), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.8), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.8, -0.9,0.8), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.6,0)))));

  dalek.append(new TransformationSGNode(glm.translate(0,0,1.2), new TransformationSGNode(glm.rotateY(90),new TransformationSGNode(glm.rotateX(163), new RenderSGNode(makeTrapeze(1.2,0.6,0.7,0.4))))));
  dalek.append(new TransformationSGNode(glm.translate(1,0,0),new TransformationSGNode(glm.rotateY(270),new TransformationSGNode(glm.rotateX(163),new RenderSGNode(makeTrapeze(1.2,0.6,0.7,0.2))))));
  dalek.append(new TransformationSGNode(glm.rotateX(163),new RenderSGNode(makeTrapeze(1,0.6,0.7,0.2))));
  dalek.append(new TransformationSGNode(glm.translate(0,0,1.2),new TransformationSGNode(glm.rotateX(211),new RenderSGNode(makeTrapeze(1,0.6,0.8,0.2)))));
  dalek.append(new TransformationSGNode(glm.translate(0.5,-0.9,0.5),new RenderSGNode(makeSphere(0.3,15,15))));
//Spheres on body
  dalek.append(new TransformationSGNode(glm.translate(0.2,-0.5,0.3),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.2,-0.5,0.6),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.1,-0.2,0.3),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.1,-0.2,0.6),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.1,-0.2,0.9),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.8,-0.5,0.3),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.8,-0.5,0.6),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.9,-0.2,0.3),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.9,-0.2,0.6),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.9,-0.2,0.9),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.5,0.2),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.5,0.2),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.2,0.1),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.2,0.1),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.5,0.85),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.5,0.85),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.2,1.05),new RenderSGNode(makeSphere(0.1,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.2,1.05),new RenderSGNode(makeSphere(0.1,10,10))));

  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.8,0.8),new RenderSGNode(makeZylinder(0.02,0.5,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.8,0.8),new RenderSGNode(makeSphere(0.04,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,0.8),new RenderSGNode(makeZylinder(0.02,0.4,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,0.8),new RenderSGNode(makeSphere(0.04,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,1.245),new TransformationSGNode(glm.rotateX(180),new RenderSGNode(makeHalfSphere(0.05,10,10)))));
  dalek.append(new TransformationSGNode(glm.translate(0.5,-1,0.75),new RenderSGNode(makeZylinder(0.025,0.2,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.5,-1,0.93),new RenderSGNode(makeSphere(0.04,10,10))));

  dalek = new MaterialSGNode(dalek);

  dalek.ambient = [0.24725, 0.1995, 0.0745, 1];
  dalek.diffuse = [0.75164, 0.60648, 0.22648, 1];
  dalek.specular = [0.628281, 0.555802, 0.366065, 1];
  dalek.shininess = 0.4;

  return dalek;
}

function makeTrapeze(length, width, height, offset) {
  width = width || 1;
  height = height || 1;
  length = length || 1;
  offset = offset || 0;
  var position = [0, 0, 0, length, 0, 0, width+offset, height, 0, offset, height, 0];
  var normal = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  var texture = [0, 0 /**/, 1, 0 /**/, 1, 1 /**/, 0, 1];
  var index = [0, 1, 2, 2, 3, 0];
  return {
    position: position,
    normal: normal,
    texture: texture,
    index: index
  };
}


function makeZylinder(radius, length, latitudeBands) {
 radius = radius || 2;
 latitudeBands = latitudeBands || 30;
 length = length || 5;
 //based on view-source:http://learningwebgl.com/lessons/lesson11/index.html
 var vertexPositionData = [];
 var normalData = [];
 var textureCoordData = [];
 for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
   var theta = latNumber * 2* Math.PI / latitudeBands;
   var sinTheta = Math.sin(theta);
   var cosTheta = Math.cos(theta);

   var x = sinTheta;
   var y = cosTheta;

   var v = 1 - (latNumber / latitudeBands);
   normalData.push(x);
   normalData.push(y);
   normalData.push(0);
   textureCoordData.push(0);
   textureCoordData.push(v);
   vertexPositionData.push(radius * x);
   vertexPositionData.push(radius * y);
   vertexPositionData.push(0);

   normalData.push(x);
   normalData.push(y);
   normalData.push(length);
   textureCoordData.push(length);
   textureCoordData.push(v);
   vertexPositionData.push(radius * x);
   vertexPositionData.push(radius * y);
   vertexPositionData.push(length);

 }

 var indexData = [];
 for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {

     var first = (latNumber * 2);
     indexData.push(first);
     indexData.push(first+1);
     indexData.push(first+2);
     indexData.push(first+1);
     indexData.push(first+3);
     indexData.push(first+2);

 }
 return {
   position: vertexPositionData,
   normal: normalData,
   texture: textureCoordData,
   index: indexData //1
 };
}


function makeHalfSphere(radius, latitudeBands, longitudeBands) {
  radius = radius || 2;
  latitudeBands = latitudeBands || 30;
  longitudeBands = longitudeBands || 30;

  //based on view-source:http://learningwebgl.com/lessons/lesson11/index.html
  var vertexPositionData = [];
  var normalData = [];
  var textureCoordData = [];
  for (var latNumber = 0; latNumber <= latitudeBands; latNumber++) {
    var theta = latNumber * Math.PI / latitudeBands;
    var sinTheta = Math.sin(theta);
    var cosTheta = Math.cos(theta);
    for (var longNumber = 0; longNumber <= longitudeBands; longNumber++) {
      var phi = longNumber * Math.PI / longitudeBands;
      var sinPhi = Math.sin(phi);
      var cosPhi = Math.cos(phi);
      var x = cosPhi * sinTheta;
      var y = cosTheta;
      var z = sinPhi * sinTheta;
      var u = 1 - (longNumber / longitudeBands);
      var v = 1 - (latNumber / latitudeBands);
      normalData.push(x);
      normalData.push(y);
      normalData.push(z);
      textureCoordData.push(u);
      textureCoordData.push(v);
      vertexPositionData.push(radius * x);
      vertexPositionData.push(radius * y);
      vertexPositionData.push(radius * z);
    }
  }
  var indexData = [];
  for (var latNumber = 0; latNumber < latitudeBands; latNumber++) {
    for (var longNumber = 0; longNumber < longitudeBands; longNumber++) {
      var first = (latNumber * (longitudeBands + 1)) + longNumber;
      var second = first + longitudeBands + 1;
      indexData.push(first);
      indexData.push(second);
      indexData.push(first + 1);
      indexData.push(second);
      indexData.push(second + 1);
      indexData.push(first + 1);
    }
  }
  return {
    position: vertexPositionData,
    normal: normalData,
    texture: textureCoordData,
    index: indexData //1
  };
}

function makeQuad(width, height, length){
  width = width || 2;
  length = length || 3;
  height = height || 1;

  var position = [0,0,0,  width,0,0, width,0,height,  0,0,height,
                  0,length,0,  width,length,0, width,length,height,  0,length,height];

  var normal = [0,-1,0,0,-1,0,0,-1,0,0,-1,0,0,1,0,0,1,0,0,1,0,0,1,0];
  var texture = [0.5, 0.33, 0.5, 0.67,  0.75, 0.67,   0.75, 0.33];
  var index = [0, 1, 2, 2, 3, 0,4,0,3,3,7,4,4,5,1,1,0,4,1,5,6,6,2,1,5,4,7,7,6,5,3,2,6,6,7,3];


  return {
    position: position,
    normal: normal,
    texture: texture,
    index: index
  };
}

function render(timeInMilliseconds) {
  checkForWindowResize(gl);

  //Rotates sun and moon around the planet
  orbitSun.matrix = glm.rotateY(timeInMilliseconds*0.005);
  orbitMoon.matrix = glm.rotateY(timeInMilliseconds*-0.001);
  rotateTardis.matrix = glm.rotateY(timeInMilliseconds*0.1);
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

// extend the library TextureSGNode to enable texturing in shader before rendering and disable it afterwards
class TextureSGNode extends AdvancedTextureSGNode {
    constructor(image, children) {
      super(image, children);
    }
    render(context) {
        gl.uniform1i(gl.getUniformLocation(context.shader, 'u_enableTexturing'), 1);

        super.render(context);

        gl.uniform1i(gl.getUniformLocation(context.shader, 'u_enableTexturing'), 0);
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

      // change direction (needed for movement)
      camera.direction.x = Math.cos(camera.rotation.y) * Math.sin(camera.rotation.x);
      camera.direction.y = Math.sin(camera.rotation.y);
      camera.direction.z = Math.cos(camera.rotation.y) * Math.cos(camera.rotation.x);

      // change lookAt-vector: camera position + camera direction
      camera.lookAt.x = camera.position.x + camera.direction.x;
      camera.lookAt.y = camera.position.y + camera.direction.y;
      camera.lookAt.z = camera.position.z + camera.direction.z;
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

      camera.position.x = 0;
      camera.position.y = -1;
      camera.position.z = 4;

      camera.lookAt.x = 0;
      camera.lookAt.y = -1;
      camera.lookAt.z = 5;
    } else if (event.code === 'KeyW') {
      let speed = 0.1;

      camera.position.x += camera.direction.x * speed;
      camera.position.y += camera.direction.y * speed;
      camera.position.z += camera.direction.z * speed;

      camera.lookAt.x = camera.position.x + camera.direction.x;
      camera.lookAt.y = camera.position.y + camera.direction.y;
      camera.lookAt.z = camera.position.z + camera.direction.z;
   } else if (event.code === 'KeyS') {
     let speed = 0.1;

     camera.position.x -= camera.direction.x * speed;
     camera.position.y -= camera.direction.y * speed;
     camera.position.z -= camera.direction.z * speed;

     camera.lookAt.x = camera.position.x + camera.direction.x;
     camera.lookAt.y = camera.position.y + camera.direction.y;
     camera.lookAt.z = camera.position.z + camera.direction.z;
    }
  });
}
