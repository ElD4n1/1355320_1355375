'use strict';

var gl = null;
const camera = {
  rotation: {
    x: 0,
    y: 0
  },
  position: {
    x: 1,
    y: -25,
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
var rotateDoor;

var smokeNode;
var particles = [];
var paritcleNodes = [];

var isOpenDoor = 0;
var isCloseDoor = 0;
var doorAnimationStartTime;
var lastrendertime = 0;

//textures
var envcubetexture;
var renderTargetColorTexture;
var renderTargetDepthTexture;

//framebuffer variables
var renderTargetFramebuffer;
var framebufferWidth = 1024;
var framebufferHeight = 1024;

const planetrad = 20;
const numberOfParticels = 1000;
const particleLifeTime =2000;


//load the required resources using a utility function
loadResources({
  vs_shadow: 'shader/shadow.vs.glsl',
  fs_shadow: 'shader/shadow.fs.glsl',
  vs_env: 'shader/envmap.vs.glsl',
  fs_env: 'shader/envmap.fs.glsl',
  vs_texture: 'shader/texture.vs.glsl',
  fs_texture: 'shader/texture.fs.glsl',
  fs_particle: 'shader/particle.fs.glsl',
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
  tardis_side: 'models/Tardis/TARDIS_SIDE.jpg',
  particle_texture: 'models/particleTexture.png',

  wall_texture: 'models/wall_bricks.jpg',
  roof_texture: 'models/roof_bricks.jpg',
  roof_side_texture: 'models/roof_wood.jpg',
  wood_texture: 'models/wood.jpg',
  door_texture: 'models/door.jpg'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext(400, 400);


  initCubeMap(resources);

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

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
                  new RenderSGNode(makeSphere(60)))
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
    lightNode = new LightSGNode();
    lightNode.ambient = [0.1, 0.1, 0.1, 1];
    lightNode.diffuse = [0.8, 0.8, 0.8, 1];
    lightNode.specular = [1, 1, 1, 1];
    lightNode.position = [0, 0, 0];

    orbitSun = new TransformationSGNode(mat4.create());
    translateLight = new TransformationSGNode(glm.translate(-50,-5,20)); //translating the light is the same as setting the light position

    orbitSun.append(translateLight);
    translateLight.append(lightNode);
    translateLight.append(createLightSphere()); //add sphere for debugging: since we use 0,0,0 as our light position the sphere is at the same position as the light source
    root.append(new TransformationSGNode(glm.rotateX(90),orbitSun));
  }

  {
    //Planet
    planetNode =  new MaterialSGNode(
                  new TextureSGNode(resources.planet_texture,
                  new TransformationSGNode(glm.rotateZ(90),                     //Rotate so texture border is not on top
                  new RenderSGNode(makeSphere(planetrad,40,40))
                )));

    planetNode.ambient = [0.05375, 0.05, 0.06625, 1];
    planetNode.diffuse = [ 0.18275, 0.17, 0.22525, 1];
    planetNode.specular = [ 0.332741, 0.328634, 0.346435, 1];
    planetNode.shininess = 0.9;

    root.append(planetNode);
  }

  let dalek = createDalek();
  let translateDalek = new TransformationSGNode(glm.translate(0,-planetrad-0.2,0));
  translateDalek.append(dalek);
  planetNode.append(translateDalek);

  smokeNode = new TextureSGNode(resources.particle_texture) ;


//smokeNode.append(new RenderSGNode(makeRect(1,1)));

  translateDalek.append(new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_particle),smokeNode));

  planetNode.append(new TransformationSGNode(glm.rotateY(10),new TransformationSGNode(glm.translate(0,-(planetrad+2.4),0), new TransformationSGNode(glm.rotateX(90),createLamp()))));
  //planetNode.append(new TransformationSGNode(glm.rotateY(10),new TransformationSGNode(glm.translate(0,-(planetrad),0), new TransformationSGNode(glm.rotateX(90),createHouseLevel0()))));

  //house
  let level0 = new TransformationSGNode(glm.rotateY(10), new TransformationSGNode(glm.rotateX(90),createHouseLevel0()));
  let level1 = new TransformationSGNode(glm.rotateY(10), new TransformationSGNode(glm.rotateX(90),createHouseLevel1(resources)));
  let level2 = new TransformationSGNode(glm.rotateY(10), new TransformationSGNode(glm.rotateX(90),createHouseLevel2(resources)));
  planetNode.append(new LevelOfDetailSGNode([0.0, -planetrad-5, 0.0], level0, level1, level2));

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
  translateTardis =new TransformationSGNode(glm.translate(3,-20,0),rotateTardis);

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

    let translateMoon = new TransformationSGNode(glm.translate(40,-5,-35));
    translateMoon.append(moonNode);
    translateMoon.append(moonLightNode);
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
  let dalek = new TransformationSGNode(mat4.create(),new TransformationSGNode(glm.translate(1,0,0),new TransformationSGNode(glm.rotateY(180),new RenderSGNode(makeTrapeze(1,1,0.2,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0, 0,1.2), new RenderSGNode(makeTrapeze(1,1,0.2,0))));
  dalek.append(new TransformationSGNode(glm.rotateY(270), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0))));
  dalek.append(new TransformationSGNode(glm.translate(1, 0,1.2), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0, 0.2,1.2), new TransformationSGNode(glm.rotateX(270), new RenderSGNode(makeTrapeze(1,1,1.2,0)))));

  dalek.append(new TransformationSGNode(glm.translate(0.8, -0.9,0.2), new TransformationSGNode(glm.rotateY(180),new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.8), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new TransformationSGNode(glm.rotateY(270), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.8, -0.9,0.8), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.6,0)))));

  dalek.append(new TransformationSGNode(glm.translate(0,0,1.2), new TransformationSGNode(glm.rotateY(90),new TransformationSGNode(glm.rotateX(163), new RenderSGNode(makeTrapeze(1.2,0.6,0.7,0.4))))));
  dalek.append(new TransformationSGNode(glm.translate(1,0,0),new TransformationSGNode(glm.rotateY(270),new TransformationSGNode(glm.rotateX(163),new RenderSGNode(makeTrapeze(1.2,0.6,0.7,0.2))))));
  dalek.append(new TransformationSGNode(glm.rotateX(163), new RenderSGNode(makeTrapeze(1,0.6,0.7,0.2)))); //Backside
  dalek.append(new TransformationSGNode(glm.translate(1,0,1.2),new TransformationSGNode(glm.rotateX(211),new TransformationSGNode(glm.rotateY(180),new RenderSGNode(makeTrapeze(1,0.6,0.8,0.2))))));
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

function createHouseLevel0() {
  let length = 6;
  let width = 3;
  let height = 2;
  let house = new MaterialSGNode(new RenderSGNode(makeTrapeze(length,length,width,0)));

  house.append(new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(length,length,height,0))));
  house.append(new TransformationSGNode(glm.translate(0,width,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(width,width,height,0))))));
  house.append(new TransformationSGNode(glm.translate(length,0,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(width,width,height,0))))));
  house.append(new TransformationSGNode(glm.translate(length,width,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(length,length,height,0))))));
  house.append(new TransformationSGNode(glm.translate(0,0,height), new RenderSGNode(makeTrapeze(length,length,width,0))));

  house.ambient = [0.05375, 0.05, 0.06625, 1];
  house.diffuse = [ 139/256, 105/256, 105/256, 1];
  house.specular = [ 139/256, 105/256, 105/256, 1];
  house.shininess = 0.4;

  return house;
}

function createHouseLevel1(resources) {
  let length = 6;
  let width = 3;
  let height = 3.5;
  let wallheight = height/3.5 * 2;
  let roofheight = height/3.5 * 1.5;
  let roofwidth = Math.sqrt(Math.pow(roofheight,2) + Math.pow(width/2,2));
  let house = new MaterialSGNode(new RenderSGNode(makeTrapeze(length,length,width,0))); // create ground plate
  let longwall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(length,length,wallheight,0)));
  let sidewall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(width,width,wallheight,0)));
  let roof = new TextureSGNode(resources.roof_texture, new RenderSGNode(makeTrapeze(length, length, roofwidth, 0)));
  let roofside = new TextureSGNode(resources.roof_side_texture, new RenderSGNode(makeRightTriangle(roofwidth, roofwidth)));

  // append walls
  house.append(new TransformationSGNode(glm.rotateX(90), longwall));
  house.append(new TransformationSGNode(glm.translate(0,width,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,0,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,width,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), longwall))));
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new RenderSGNode(makeTrapeze(length,length,width,0))));

  // append roof
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new TransformationSGNode(glm.rotateX(45), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width,wallheight), new TransformationSGNode(glm.rotateX(135), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width/2,height), new TransformationSGNode(glm.rotateX(225), new TransformationSGNode(glm.rotateY(270), roofside))));
  house.append(new TransformationSGNode(glm.translate(length,width/2,height), new TransformationSGNode(glm.rotateX(315), new TransformationSGNode(glm.rotateY(90), roofside))));

  house.ambient = [0.05375, 0.05, 0.06625, 1];
  house.diffuse = [ 0.18275, 0.17, 0.22525, 1];
  house.specular = [ 0.332741, 0.328634, 0.346435, 1];
  house.shininess = 0.4;

  return house;
}

function createHouseLevel2(resources) {
  let length = 6;
  let width = 3;
  let height = 3.5;
  let wallheight = height/3.5 * 2;
  let roofheight = height/3.5 * 1.5;
  let roofwidth = Math.sqrt(Math.pow(roofheight,2) + Math.pow(width/2,2));
  let windowwidth = 1;
  let windowheight = 1;
  let windowheightpos = wallheight/3;
  let windowlengthpos = length/6;
  let doorwidth = 0.75;
  let doorheight = 1.5;
  let doorlengthpos = length/2 - doorwidth/2;

  let house = new MaterialSGNode(new RenderSGNode(makeTrapeze(length,length,width,0))); // create ground plate
  let longwall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(length,length,wallheight,0)));
  let sidewall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(width,width,wallheight,0)));
  let frontwall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(windowlengthpos, windowlengthpos, wallheight)));
  let roof = new TextureSGNode(resources.roof_texture, new RenderSGNode(makeTrapeze(length, length, roofwidth, 0)));
  let roofside = new TextureSGNode(resources.roof_side_texture, new RenderSGNode(makeRightTriangle(roofwidth, roofwidth)));
  let window = createWindow(resources, windowwidth, windowheight);

  // front wall (divided into pieces because of windows and door)
  frontwall.append(new TransformationSGNode(glm.translate(windowlengthpos,0,0), new RenderSGNode(makeTrapeze(windowwidth,windowwidth,windowheightpos))));
  frontwall.append(new TransformationSGNode(glm.translate(windowlengthpos,windowheightpos+windowheight,0), new RenderSGNode(makeTrapeze(windowwidth,windowwidth,wallheight-windowheightpos-windowheight))));
  frontwall.append(new TransformationSGNode(glm.translate(windowlengthpos+windowwidth,0,0), new RenderSGNode(makeTrapeze(doorlengthpos - windowlengthpos - windowwidth,doorlengthpos - windowlengthpos - windowwidth,wallheight))));
  frontwall.append(new TransformationSGNode(glm.translate(windowlengthpos+windowwidth,0,0), new RenderSGNode(makeTrapeze(doorlengthpos - windowlengthpos - windowwidth,doorlengthpos - windowlengthpos - windowwidth,wallheight))));
  frontwall.append(new TransformationSGNode(glm.translate(doorlengthpos,doorheight,0), new RenderSGNode(makeTrapeze(doorwidth,doorwidth,wallheight - doorheight))));
  frontwall.append(new TransformationSGNode(glm.translate(doorlengthpos + doorwidth,0,0), new RenderSGNode(makeTrapeze(doorlengthpos - windowlengthpos - windowwidth,doorlengthpos - windowlengthpos - windowwidth,wallheight))));
  frontwall.append(new TransformationSGNode(glm.translate(length - windowlengthpos - windowwidth,windowheightpos+windowheight,0), new RenderSGNode(makeTrapeze(windowwidth,windowwidth,wallheight-windowheightpos-windowheight))));
  frontwall.append(new TransformationSGNode(glm.translate(length - windowlengthpos - windowwidth,0,0), new RenderSGNode(makeTrapeze(windowwidth,windowwidth,windowheightpos))));
  frontwall.append(new TransformationSGNode(glm.translate(length - windowlengthpos,0,0), new RenderSGNode(makeTrapeze(windowlengthpos,windowlengthpos,wallheight))));

  // walls
  house.append(new TransformationSGNode(glm.rotateX(90), frontwall));
  house.append(new TransformationSGNode(glm.translate(0,width,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,0,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,width,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), longwall))));
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new RenderSGNode(makeTrapeze(length,length,width,0))));

  // roof
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new TransformationSGNode(glm.rotateX(45), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width,wallheight), new TransformationSGNode(glm.rotateX(135), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width/2,height), new TransformationSGNode(glm.rotateX(225), new TransformationSGNode(glm.rotateY(270), roofside))));
  house.append(new TransformationSGNode(glm.translate(length,width/2,height), new TransformationSGNode(glm.rotateX(315), new TransformationSGNode(glm.rotateY(90), roofside))));

  // windows
  house.append(new TransformationSGNode(glm.translate(windowlengthpos,0,windowheightpos), new TransformationSGNode(glm.rotateX(90), window)));
  house.append(new TransformationSGNode(glm.translate(length - windowwidth - windowlengthpos,0,windowheightpos), new TransformationSGNode(glm.rotateX(90), window)));

  // door
  rotateDoor = new TransformationSGNode(mat4.create(), new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(doorwidth,doorwidth,doorheight,0))));
  house.append(new TextureSGNode(resources.door_texture, new TransformationSGNode(glm.translate(doorlengthpos,0,0), rotateDoor)));

  house.ambient = [0.05375, 0.05, 0.06625, 1];
  house.diffuse = [ 0.18275, 0.17, 0.22525, 1];
  house.specular = [ 0.332741, 0.328634, 0.346435, 1];
  house.shininess = 0.4;

  return house;
}

function createWindow(resources, width, height) {
  let framewidth = height/8;
  let frame = new TextureSGNode(resources.wood_texture, new RenderSGNode(makeTrapeze(width,width,framewidth,0)));
  let glass = new MaterialSGNode(new TransformationSGNode(glm.translate(framewidth,framewidth,0), new RenderSGNode(makeTrapeze(width-2*framewidth, width-2*framewidth, height-2*framewidth, 0))));

  frame.append(new TransformationSGNode(glm.translate(0,height-framewidth,0), new RenderSGNode(makeTrapeze(length,length,framewidth,0))));
  frame.append(new TransformationSGNode(glm.translate(0,framewidth,0), new RenderSGNode(makeTrapeze(framewidth,framewidth,height-2*framewidth,0))));
  frame.append(new TransformationSGNode(glm.translate(width-framewidth,framewidth,0), new RenderSGNode(makeTrapeze(framewidth,framewidth,height-2*framewidth,0))));

  frame = new MaterialSGNode(frame);

  frame.ambient = [0.05375, 0.05, 0.06625, 1];
  frame.diffuse = [ 0.18275, 0.17, 0.22525, 1];
  frame.specular = [ 0.332741, 0.328634, 0.346435, 1];
  frame.shininess = 0.3;

  glass.append(frame);

  glass.ambient = [0.2, 0.2, 0.2, 0.1];
  glass.diffuse = [0.8, 0.8, 0.8, 0.1];
  glass.specular = [0.1, 0.1, 0.1, 0.1];
  glass.emission = [0, 0, 0, 0];
  glass.shininess = 0.3;

  return glass;
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

function makeRightTriangle(a, b) {
  a = a || 1;
  b = b || 1;
  var position = [0, 0, 0,  a, 0, 0,  0, b, 0];
  var normal = [0, 0, 1, 0, 0, 1, 0, 0, 1];
  var texture = [0.5, 1 /**/, 0, 0 /**/, 1, 0];
  var index = [0, 1, 2];
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


// create Particles
class Particle extends RenderSGNode {
    constructor(renderer,pos, dir, speed, starttime, children){
      super(renderer,children);
      this.position = [0,0,0];
      this.startposition = pos;
      this.direction = dir;
      this.speed = speed;
      this.age = 0.0;
      this.starttime = starttime;
    }

    update(currenttime){
      this.age = currenttime-this.starttime;



      if(this.age>particleLifeTime){
        this.starttime = currenttime;
        this.age = 0.0;
        this.position[0]=this.startposition[0];
        this.position[1] =this.startposition[1];
        this.position[2] = this.startposition[2];
      } else {
        this.position[0] = this.startposition[0] +(this.speed * this.age) * this.direction[0] ;
        this.position[1] = this.startposition[1] +(this.speed * this.age) * this.direction[1] ;
        this.position[2] = this.startposition[2] +(this.speed * this.age) * this.direction[2] ;
      }
    }
}

function makeSmoke(timeInMilliseconds){
  if(paritcleNodes.length<numberOfParticels){
    let part = new Particle(makeSphere(0.05,10,10),[Math.random(),0,Math.random()],[0.0,-1.0,0.0],Math.random()/1000+0.0001, timeInMilliseconds);
    particles.push(part);

    var n = new TransformationSGNode(mat4.create(),part);
    smokeNode.append(n);
    paritcleNodes.push(n);
  }
  var index;
  var p;
  for(index = 0;index<particles.length;index++){
    p =   particles[index];
    p.update(timeInMilliseconds);
    paritcleNodes[index].matrix = glm.translate(p.position[0], p.position[1], p.position[2]);
  }
}

function openDoor() {
  if (isCloseDoor == 1) {
    isCloseDoor = 0;
  }

  doorAnimationStartTime = lastrendertime;
  isOpenDoor = 1;
}

function animateDoorOpen(timeInMilliseconds) {
  let angle = (timeInMilliseconds - doorAnimationStartTime)*0.05 % 136;

  if(angle >= 135 || ((timeInMilliseconds - doorAnimationStartTime)*0.05 / 136) >= 1) {
    isOpenDoor = 0;
    return;
  }

  rotateDoor.matrix = glm.rotateZ(angle);
}

function closeDoor() {
  if (isOpenDoor == 1) {
    isOpenDoor = 0;
  }

  doorAnimationStartTime = lastrendertime;
  isCloseDoor = 1;
}

function animateDoorClose(timeInMilliseconds) {
  let angle = 136 - (timeInMilliseconds - doorAnimationStartTime)*0.05 % 136;

  if(angle <= 0 || ((timeInMilliseconds - doorAnimationStartTime)*0.05 / 136) >= 1) {
    isCloseDoor = 0;
    return;
  }

  rotateDoor.matrix = glm.rotateZ(angle);
}

function render(timeInMilliseconds) {
  checkForWindowResize(gl);


makeSmoke(timeInMilliseconds);


  //Rotates sun and moon around the planet
  orbitSun.matrix = glm.rotateY(timeInMilliseconds*0.005);
  orbitMoon.matrix = glm.rotateY(timeInMilliseconds*-0.001);
  rotateTardis.matrix = glm.rotateY(timeInMilliseconds*0.1);

  lastrendertime = timeInMilliseconds;
  if (isOpenDoor == 1) {
    animateDoorOpen(timeInMilliseconds);
  } else if (isCloseDoor == 1) {
    animateDoorClose(timeInMilliseconds);
  }

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
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
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

class LevelOfDetailSGNode extends SGNode {
    constructor(position, level0, level1, level2, children) {
      super(children);
      this.position = position;
      this.level0 = new TransformationSGNode(glm.translate(position[0], position[1], position[2]), level0);
      this.level1 = new TransformationSGNode(glm.translate(position[0], position[1], position[2]), level1);
      this.level2 = new TransformationSGNode(glm.translate(position[0], position[1], position[2]), level2);
    }

    render(context) {
      let distance = getDistance([camera.position.x, camera.position.y, camera.position.z], this.position);  // calculate the distance between the camera and this object

      if (distance > 10) {
        this.level0.render(context);
      } else if (distance > 5) {
        this.level1.render(context);
      } else {
        this.level2.render(context);
      }

      // render children
      super.render(context);
    }
}

// calculates the euclidian distance between two points
function getDistance(pos1, pos2) {
    let vector = [pos2[0] - pos1[0], pos2[1] - pos1[1], pos2[2] - pos1[2]];
    let distance = Math.sqrt(Math.pow(vector[0],2), Math.pow(vector[1],2), Math.pow(vector[2],2));
    return distance;
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
   } else if (event.code === 'KeyO') {
     openDoor();
   } else if (event.code === 'KeyC') {
     closeDoor();
   }
  });
}
