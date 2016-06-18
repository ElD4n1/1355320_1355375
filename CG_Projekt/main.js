'use strict';

var gl = null;
const camera = {
  rotation: {
    x: 0,
    y: 0
  },
  position: {
    x: 0,
    y: -20.5,
    z:40
  },
  //Vector from direction from cameraposition to lookAt
  direction: {
    x: 0,
    y: 0,
    z: -1
  },
  lookAt: {
    x: 0,
    y: -20.5,
    z: -1
  }
};

//scene graph nodes
var root = null;
var lightNode;
var translateLight;
// Nodes for orbiting sun and moon around the planet
var orbitMoon;
var orbitSun;
var planetNode;
var translatePlanet;
var translateTardis;
var rotateTardis;
var rotateDoor;
var swingLamp;
// Array of all heads of the daleks. Rotate all heads togehter
var rotateDalekHead = [];
var dalekout;
var smokeNode;
//The particle objects to update the positions
var particles = [];
// particle SceneGraph nodes for rendering
var paritcleNodes = [];


// animation variables tardis
var tardispos;
var tardislanded = false;
var tardisstarttime =-1.0;
var startTardis = false;

// animation variables door
var doorPosition = [1.1, -20.16,-0.2];
var isDoorOpening = false;
var isDoorOpen = false;
var isDoorClosing = false;
var isDoorClosed = true;
var doorAnimationStartTime;
var lastrendertime = 0;

//textures
var envcubetexture;

// radius of planet. used for for positioning object
const planetrad = 20;
// constans for particle System
const numberOfParticels = 1000;
const particleLifeTime =2000;
// Factor for scaling the scenegraphnodes like daleks, house and tardis
const scaleObjects = 0.2;

// marks if the cameraFlight is still in progress
var cameraFlight = true;

//load the required resources using a utility function
loadResources({
  vs_env: 'shader/envmap.vs.glsl',
  fs_env: 'shader/envmap.fs.glsl',
  vs_texture: 'shader/texture.vs.glsl',
  fs_texture: 'shader/texture.fs.glsl',
  fs_particle: 'shader/particle.fs.glsl',
  fs_light: 'shader/lightsphere.fs.glsl',
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
  lamp_texture: 'models/lamp.png',
  stop_texture: 'models/stop.png',
  // house textures
  wall_texture: 'models/wall_bricks.jpg',
  roof_texture: 'models/roof_bricks.jpg',
  roof_side_texture: 'models/roof_wood.jpg',
  wood_texture: 'models/wood.jpg',
  door_texture: 'models/door.jpg',
  floor_texture: 'models/floor.jpg',
  ceiling_texture: 'models/ceiling.jpg'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext(400, 400);

  initCubeMap(resources);

  // enables z-buffer and alpha blending for transparenzy
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  //create scenegraph
  root = createSceneGraph(gl, resources);

  initInteraction(gl.canvas);
}

function createLightSphere(rad, resources) {
  return new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_light), [
    //render with light fragment shader to make it bright.
    new RenderSGNode(makeSphere(rad,10,10)) // Parameters: radius, latitudeBands, longitudeBands (how round it is)
  ]);
}

function createSceneGraph(gl, resources) {
  //create scenegraph
  const root = new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_texture));

  //add skybox by putting large sphere around the scene
  var skybox =  new ShaderSGNode(createProgram(gl, resources.vs_env, resources.fs_env),[
                new EnvironmentSGNode(envcubetexture,4,false,
                  new RenderSGNode(makeSphere(60)))
                ]);
  root.append(skybox);

  {
    //initialize light
    lightNode = new LightSGNode();
    lightNode.ambient = [0.1, 0.1, 0.1, 1];
    lightNode.diffuse = [1, 1, 1, 1];
    lightNode.specular = [1, 1, 1, 1];

    // TransomationNode to rotate sun
    orbitSun = new TransformationSGNode(mat4.create());
    translateLight = new TransformationSGNode(glm.translate(-52,-5,20));
    //translating the light is the same as setting the light position

    orbitSun.append(translateLight);
    translateLight.append(lightNode);
    // create a lightsphere to make the sun visible
    translateLight.append(createLightSphere(1.9, resources));
    root.append(new TransformationSGNode(glm.transform({ rotateX:90, rotateY:-135 }),orbitSun));
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
  // Create a dalek with smok for particle system.
  let dalek = createDalek();
  let translateSmokingDalek = new TransformationSGNode(glm.transform({ translate: [1.3,-planetrad+0.01,-0.6], scale: scaleObjects*0.8 }));
  translateSmokingDalek.append(dalek);
  planetNode.append(translateSmokingDalek);
  //create a own node with a semitransparrent texture for particles
  smokeNode = new TextureSGNode(resources.particle_texture) ;
  // shade the particles with a different particle shader to increase the performance (no phong shading)
  translateSmokingDalek.append(new ShaderSGNode(createProgram(gl, resources.vs_texture, resources.fs_particle),smokeNode));

  // street lamps
  //let lampSpotLight1 = new SpotLightSGNode([0,0,0], [(planetrad+0.9)*Math.tan(4), planetrad+0.9, (planetrad+0.9)*Math.tan(-1)], Math.cos(25));
  let lampSpotLight1 = new SpotLightSGNode([0,0,0], [0, planetrad+0.9, 0], Math.cos(25));
  lampSpotLight1.ambient = [0.1, 0.1, 0.1, 1];
  lampSpotLight1.diffuse = [0.5, 0.5, 0.5, 1];
  lampSpotLight1.specular = [0.3, 0.3, 0.3, 1];
  lampSpotLight1.uniform = 'u_light3';

  let lamp1 = createLamp();
  lamp1.append(lampSpotLight1);
  lamp1.append(createLightSphere(0.2, resources));
  lamp1 = new TransformationSGNode(glm.transform({ rotateX :4,rotateZ: -1}),new TransformationSGNode(glm.translate(0,-(planetrad+0.9),0), new TransformationSGNode(glm.rotateX(90),new TransformationSGNode(glm.scale(0.4,0.4,0.4),lamp1))));
  planetNode.append(lamp1);

  //let lampSpotLight2 = new SpotLightSGNode([0,0,0], [(planetrad+0.9)*Math.tan(-2), planetrad+0.9, (planetrad+0.9)*Math.tan(-1)], Math.cos(25));
  let lampSpotLight2 = new SpotLightSGNode([0,0,0], [0, planetrad+0.9, 0], Math.cos(25));
  lampSpotLight2.ambient = [0.1, 0.1, 0.1, 1];
  lampSpotLight2.diffuse = [0.5, 0.5, 0.5, 1];
  lampSpotLight2.specular = [0.3, 0.3, 0.3, 1];
  lampSpotLight2.uniform = 'u_light4';

  let lamp2 = createLamp();
  lamp2.append(lampSpotLight2);
  lamp2.append(createLightSphere(0.2, resources));
  lamp2 = new TransformationSGNode(glm.transform({ rotateX :-2,rotateZ: -1}),new TransformationSGNode(glm.translate(0,-(planetrad+0.9),0), new TransformationSGNode(glm.rotateX(90),new TransformationSGNode(glm.scale(0.4,0.4,0.4),lamp2))));
  planetNode.append(lamp2);

  //Create a swinging lamp with a pointlight in the house
  swingLamp = new TransformationSGNode(mat4.create(), createHouseLamp(resources));
  planetNode.append(new TransformationSGNode(glm.transform({translate: [1.6,-planetrad-0.35,-0.2], rotateX: 270, scale: scaleObjects}), swingLamp));

  //Daleks patroling around planet
  dalekout = new TransformationSGNode(mat4.create(), new TransformationSGNode(glm.transform({translate: [0,-planetrad, 0],scale:scaleObjects*0.8}),createDalek()));
  dalekout.append(new TransformationSGNode(glm.transform({translate: [0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek()));
  dalekout.append(new TransformationSGNode(glm.transform({translate: [-0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek()));

  dalekout.append(new TransformationSGNode(glm.rotateX(30),new TransformationSGNode(glm.transform({translate: [0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek())));
  dalekout.append(new TransformationSGNode(glm.rotateX(30),new TransformationSGNode(glm.transform({translate: [-0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek())));
  dalekout.append(new TransformationSGNode(glm.rotateX(30),new TransformationSGNode(glm.transform({translate: [0,-planetrad, 0],scale:scaleObjects*0.8}),createDalek())));

  dalekout.append(new TransformationSGNode(glm.rotateX(15),new TransformationSGNode(glm.transform({translate: [0,-planetrad, 0],scale:scaleObjects*0.8}),createDalek())));
  dalekout.append(new TransformationSGNode(glm.rotateX(15),new TransformationSGNode(glm.transform({translate: [0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek())));
  dalekout.append(new TransformationSGNode(glm.rotateX(15),new TransformationSGNode(glm.transform({translate: [-0.3,-planetrad, -0.5],scale:scaleObjects*0.8}),createDalek())));

  planetNode.append(dalekout);
  //Daleks inside the house
  planetNode.append(new TransformationSGNode(glm.transform({translate:[1.8, -planetrad, -0.2], rotateY:220, scale: scaleObjects*0.8}), createDalek()));
  planetNode.append(new TransformationSGNode(glm.transform({translate:[1.6, -planetrad, 0.2], rotateY:180, scale: scaleObjects*0.8}), createDalek()));


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
    translateTardis =new TransformationSGNode(glm.translate(-0.25,-19.5,39.5),new TransformationSGNode(glm.scale(scaleObjects,scaleObjects,scaleObjects), rotateTardis));
    // shininess for material wood is 0
    tardis.shininess = 0;

    planetNode.append(translateTardis);
  }

  {
    //stop sign
    let stopsign = new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeZylinder(0.005,0.3,30)));
    stopsign.append(new TransformationSGNode(glm.transform({translate:[0.05,0,0.3], rotateY: 180, rotateX:90}),new TextureSGNode(resources.stop_texture, new RenderSGNode(makeOctagon(0.1,0.1)))));
    planetNode.append(new TransformationSGNode(glm.transform({rotateX:-3, rotateZ: -1}),new TransformationSGNode(glm.translate(0,-planetrad+0.1,0),stopsign)));
  }

  //house
  //must be appended last because of tranparency
  let level0 = createHouseLevel0(resources);      // 3 objects with different levels of detail
  let level1 = createHouseLevel1(resources);
  let level2 = createHouseLevel2(resources);
  let housex = 5.5, housey = -planetrad+0.04, housez = -0;
  let houseNode = new LevelOfDetailSGNode([housex, housey, housez], level0, level1, level2);
  // append house as LevelOfDetailSGNode which decides depending on the distance from the camera to the houseposition which level of detail is rendered
  planetNode.append(new TransformationSGNode(glm.transform({ translate: [housex, housey, housez], rotateZ: 250, rotateX : 90, scale: scaleObjects }),houseNode));


{
    // moon
    let moonNode = new TextureSGNode(resources.moon_texture,
                      new RenderSGNode(makeSphere(3,10,10)));

    // TransformationSGNode for rotating the moon around the planet
    orbitMoon = new TransformationSGNode(mat4.create());

    let translateMoon = new TransformationSGNode(glm.translate(40,-10,-35));
    translateMoon.append(moonNode);
    orbitMoon.append(translateMoon)
    planetNode.append(orbitMoon);
}


  return root;
}
// creates a hanging lamp with a lightbulb in te middle
function createHouseLamp(resources){
  let lamp = new RenderSGNode(makeZylinder(0.01, 0.3,10));
  let lampLight = new LightSGNode();
  lampLight.ambient = [0.1, 0.1, 0.1, 1];
  lampLight.diffuse = [0.7, 0.7, 0.7, 1];
  lampLight.specular = [0.5, 0.5, 0.5, 1];
  lampLight.uniform = 'u_light2';
  let lampbulb = new TransformationSGNode(glm.translate(0,0,0.05),createLightSphere(0.04, resources));
  lampbulb.append(lampLight);
  // gives the lamp a very trendy texture
  lamp.append(new TransformationSGNode(glm.transform({translate: [0,0,0.4], rotateX: 180}),
              new TextureSGNode(resources.lamp_texture,  [new RenderSGNode(makeHalfSphere(0.1)),lampbulb])));
  return lamp;
}
// creates a street lamp without light.
function createLamp(){
  let lamp = new RenderSGNode(makeHalfSphere(0.3, 10, 10));
  lamp.append(new TransformationSGNode(glm.rotateY(-45), new TransformationSGNode(glm.translate(0,0,0.29), new RenderSGNode(makeZylinder(0.05, 0.5,10)))));
  lamp.append( new TransformationSGNode(glm.translate(-0.6,0,0.6), new RenderSGNode(makeSphere(0.08, 10,10))));
  lamp.append(new TransformationSGNode(glm.translate(-0.6,0,-2.44), new RenderSGNode(makeZylinder(0.05,3,10))));

  lamp = new MaterialSGNode(lamp);
  // metalic material
  lamp.ambient = [0.05375, 0.05, 0.06625, 1];
  lamp.diffuse = [ 0.18275, 0.17, 0.22525, 1];
  lamp.specular = [ 0.332741, 0.328634, 0.346435, 1];
  lamp.shininess = 0.9;

  return lamp;
}

// Returns a Dalek node
function createDalek(){
  let dalek = new TransformationSGNode(mat4.create(),new TransformationSGNode(glm.translate(1,0,0),new TransformationSGNode(glm.rotateY(180),new RenderSGNode(makeTrapeze(1,1,0.2,0)))));
  //bottom
  dalek.append(new TransformationSGNode(glm.translate(0, 0,1.2), new RenderSGNode(makeTrapeze(1,1,0.2,0))));
  dalek.append(new TransformationSGNode(glm.rotateY(270), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0))));
  dalek.append(new TransformationSGNode(glm.translate(1, 0,1.2), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(1.2,1.2,0.2,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0, 0.2,1.2), new TransformationSGNode(glm.rotateX(270), new RenderSGNode(makeTrapeze(1,1,1.2,0)))));

  //top
  dalek.append(new TransformationSGNode(glm.translate(0.8, -0.9,0.2), new TransformationSGNode(glm.rotateY(180),new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.8), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new TransformationSGNode(glm.rotateY(270), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.8, -0.9,0.8), new TransformationSGNode(glm.rotateY(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.25,0)))));
  dalek.append(new TransformationSGNode(glm.translate(0.2, -0.9,0.2), new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(0.6,0.6,0.6,0)))));
  //sides
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
  //head and arms
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.8,0.8),new RenderSGNode(makeZylinder(0.02,0.5,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.33,-0.8,0.8),new RenderSGNode(makeSphere(0.04,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,0.8),new RenderSGNode(makeZylinder(0.02,0.4,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,0.8),new RenderSGNode(makeSphere(0.04,10,10))));
  dalek.append(new TransformationSGNode(glm.translate(0.67,-0.8,1.245),new TransformationSGNode(glm.rotateX(180),new RenderSGNode(makeHalfSphere(0.05,10,10)))));
  // create an own node for the head which can be moved
  let dalekHead = new TransformationSGNode(mat4.create(),[new RenderSGNode(makeZylinder(0.025,0.2,10)),
                                        new TransformationSGNode(glm.translate(0,0,0.18), new RenderSGNode(makeSphere(0.04,10,10)))
                                      ]);
  // all dalek heads are grouped in an array to make the daleks move their eye.
  rotateDalekHead.push(dalekHead);

  dalek.append(new TransformationSGNode(glm.translate(0.5,-1,0.75),dalekHead));

  dalek = new MaterialSGNode(dalek);
  // make the daleks golden
  dalek.ambient = [0.24725, 0.1995, 0.0745, 1];
  dalek.diffuse = [0.75164, 0.60648, 0.22648, 1];
  dalek.specular = [0.628281, 0.555802, 0.366065, 1];
  dalek.shininess = 0.4;

  return dalek;
}

function createHouseLevel0() {
  let length = 6;
  let width = 3;
  let height = 3.5;
  let wallheight = height/3.5 * 2;
  let roofheight = height/3.5 * 1.5;
  let roofwidth = Math.sqrt(Math.pow(roofheight,2) + Math.pow(width/2,2));
  let house = new MaterialSGNode(new RenderSGNode(makeTrapeze(length,length,width,0)));
  let roof = new RenderSGNode(makeTrapeze(length, length, roofwidth, 0));
  let roofside = new RenderSGNode(makeRightTriangle(roofwidth, roofwidth));

  // append walls
  house.append(new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(length,length,wallheight,0))));
  house.append(new TransformationSGNode(glm.translate(0,width,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(width,width,wallheight,0))))));
  house.append(new TransformationSGNode(glm.translate(length,0,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(width,width,wallheight,0))))));
  house.append(new TransformationSGNode(glm.translate(length,width,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), new RenderSGNode(makeTrapeze(length,length,wallheight,0))))));
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new RenderSGNode(makeTrapeze(length,length,width,0))));

  // append roof
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new TransformationSGNode(glm.rotateX(45), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width,wallheight), new TransformationSGNode(glm.rotateX(135), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width/2,height), new TransformationSGNode(glm.rotateX(225), new TransformationSGNode(glm.rotateY(270), roofside))));
  house.append(new TransformationSGNode(glm.translate(length,width/2,height), new TransformationSGNode(glm.rotateX(315), new TransformationSGNode(glm.rotateY(90), roofside))));

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
  let basementheight = 1;

  let house = new MaterialSGNode();
  let longwall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(length,length,wallheight,0)));
  let sidewall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(width,width,wallheight,0, calcTextureCoordinates(length, wallheight, 0, width, 0, wallheight))));//[0, 0 /**/, width/length, 0 /**/, width/length, 1 /**/, 0, 1])));
  let frontwall = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(windowlengthpos, windowlengthpos, wallheight,0, calcTextureCoordinates(length, wallheight, 0, windowlengthpos, 0, wallheight))));
  let basementlong = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(length,length,basementheight,0, calcTextureCoordinates(length, wallheight, 0, length, 0, basementheight))));//[0, 0 /**/, 1, 0 /**/, 1, basementheight/wallheight /**/, 0, basementheight/wallheight])));
  let basementside = new TextureSGNode(resources.wall_texture, new RenderSGNode(makeTrapeze(width,width,basementheight,0, calcTextureCoordinates(length, wallheight, 0, width, 0, basementheight))));//[0, 0 /**/, width/length, 0 /**/, width/length, basementheight/wallheight /**/, 0, basementheight/wallheight])));
  let roof = new TextureSGNode(resources.roof_texture, new RenderSGNode(makeTrapeze(length, length, roofwidth, 0)));
  let roofside = new TextureSGNode(resources.roof_side_texture, new RenderSGNode(makeRightTriangle(roofwidth, roofwidth)));
  let window = createWindow(resources, windowwidth, windowheight);
  let floor = new TextureSGNode(resources.floor_texture, new RenderSGNode(makeTrapeze(length,length,width,0)));
  let ceiling = new TextureSGNode(resources.ceiling_texture, new RenderSGNode(makeTrapeze(length,length,width,0)));

  // front wall (divided into pieces because of windows and door)
  frontwall.append(createFrontwallPiece(length, wallheight, windowwidth, windowheightpos, windowlengthpos, 0)); // below left window
  frontwall.append(createFrontwallPiece(length, wallheight, windowwidth, wallheight-windowheightpos-windowheight, windowlengthpos, windowheightpos+windowheight)); // above left window
  frontwall.append(createFrontwallPiece(length, wallheight, doorlengthpos-windowlengthpos-windowwidth, wallheight, windowlengthpos+windowwidth, 0));  // left the door
  frontwall.append(createFrontwallPiece(length, wallheight, doorwidth, wallheight-doorheight, doorlengthpos, doorheight));  // above the door
  frontwall.append(createFrontwallPiece(length, wallheight, doorlengthpos-windowlengthpos-windowwidth, wallheight, doorlengthpos+doorwidth, 0));  // right the door
  frontwall.append(createFrontwallPiece(length, wallheight, windowwidth, wallheight-windowheightpos-windowheight, length-windowlengthpos-windowwidth, windowheightpos+windowheight));  // above right window
  frontwall.append(createFrontwallPiece(length, wallheight, windowwidth, windowheightpos, length-windowlengthpos-windowwidth, 0)); // below right window
  frontwall.append(createFrontwallPiece(length, wallheight, windowlengthpos, wallheight, length-windowlengthpos, 0)); // right the right window

  // walls
  house.append(new TransformationSGNode(glm.rotateX(90), frontwall));
  house.append(new TransformationSGNode(glm.translate(0,width,0),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,0,0),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), sidewall))));
  house.append(new TransformationSGNode(glm.translate(length,width,0),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), longwall))));
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), ceiling));
  house.append(floor);

  // roof
  house.append(new TransformationSGNode(glm.translate(0,0,wallheight), new TransformationSGNode(glm.rotateX(45), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width,wallheight), new TransformationSGNode(glm.rotateX(135), roof)));
  house.append(new TransformationSGNode(glm.translate(0,width/2,height), new TransformationSGNode(glm.rotateX(225), new TransformationSGNode(glm.rotateY(270), roofside))));
  house.append(new TransformationSGNode(glm.translate(length,width/2,height), new TransformationSGNode(glm.rotateX(315), new TransformationSGNode(glm.rotateY(90), roofside))));

  // basement
  house.append(new TransformationSGNode(glm.translate(0,0,-basementheight), new TransformationSGNode(glm.rotateX(90), basementlong)));
  house.append(new TransformationSGNode(glm.translate(0,width,-basementheight),new TransformationSGNode(glm.rotateZ(270),new TransformationSGNode(glm.rotateX(90), basementside))));
  house.append(new TransformationSGNode(glm.translate(length,0,-basementheight),new TransformationSGNode(glm.rotateZ(90),new TransformationSGNode(glm.rotateX(90), basementside))));
  house.append(new TransformationSGNode(glm.translate(length,width,-basementheight),new TransformationSGNode(glm.rotateZ(180),new TransformationSGNode(glm.rotateX(90), basementlong))));

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

// creates a piece of the front wall with correct position relative to front wall and adjusted texture coordinates
function createFrontwallPiece(fullwalllength, fullwallheight, piecewidth, pieceheight, lengthpos, heightpos) {
  return new TransformationSGNode(glm.translate(lengthpos,heightpos,0), new RenderSGNode(makeTrapeze(piecewidth,piecewidth,pieceheight,0, calcTextureCoordinates(fullwalllength, fullwallheight, lengthpos, lengthpos+piecewidth, heightpos, heightpos+pieceheight))));
}

// calculates the texture coordinates to position a smaller rectangle within a rectangle of measures origlength * origwidth (needed for frontwall, sidewall and basement)
function calcTextureCoordinates(origlength, origwidth, lengthstartpos, lengthendpos, widthstartpos, widthendpos) {
  return [lengthstartpos/origlength, widthstartpos/origwidth /**/, lengthendpos/origlength, widthstartpos/origwidth /**/, lengthendpos/origlength, widthendpos/origwidth /**/, lengthstartpos/origlength, widthendpos/origwidth]
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
// function that creates a trapeze
function makeTrapeze(length, width, height, offset, texture) {
  width = width || 1;
  height = height || 1;
  length = length || 1;
  offset = offset || 0;
  var position = [0, 0, 0, length, 0, 0, width+offset, height, 0, offset, height, 0];
  var normal = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  var texture = texture || [0, 0 /**/, 1, 0 /**/, 1, 1 /**/, 0, 1];
  var index = [0, 1, 2, 2, 3, 0];
  return {
    position: position,
    normal: normal,
    texture: texture,
    index: index
  };
}

// creates an octagon. the texture is "cut out of the immage"
function makeOctagon(height, width) {
  width = width || 1;
  height = height || 1;

  var position = [width/3,0 , 0, width*2/3, 0, 0,
              width, height/3, 0, width, height*2/3, 0,
            width*2/3, height, 0, width/3, height, 0,
          0, height*2/3, 0, 0, height/3, 0];
  var normal = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];
  var texture = [1/3, 0, 2/3, 0, 1, 1/3, 1, 2/3,2/3,1,1/3,1,0,2/3,0,1/3];
  var index = [0,1,2, 0,2,3, 0,3,4, 0,4,5, 0,5,6, 0,6,7];
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
 // based on framework implementation of sphere
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
  // based on framework implementation of sphere
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


// create Particles. the class stores the position which is updated deppening on the starttime and the current time
// if the particle gets too old it is restarted from the beginning
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
      // thes age for restet
      if(this.age>particleLifeTime){
        this.starttime = currenttime;
        this.age = 0.0;
        this.position[0]=this.startposition[0];
        this.position[1] =this.startposition[1];
        this.position[2] = this.startposition[2];
      } else {
        // calculate the position depending on the age, speed and direction
        this.position[0] = this.startposition[0] +(this.speed * this.age) * this.direction[0] ;
        this.position[1] = this.startposition[1] +(this.speed * this.age) * this.direction[1] ;
        this.position[2] = this.startposition[2] +(this.speed * this.age) * this.direction[2] ;
      }
    }
}

// creates numberOfParticels time a particle as Particle class and a TransformationSGNode for positioning each
function makeSmoke(timeInMilliseconds){
  // creates another particle if the limit is not reached
  if(paritcleNodes.length<numberOfParticels){
    // creates a Particle as sphere with random startposition and random speed
    let part = new Particle(makeSphere(0.05,10,10),[Math.random(),0,Math.random()],[0.0,-1.0,0.0],Math.random()/1000+0.0001, timeInMilliseconds);
    // append particle to the array for updating the position
    particles.push(part);
    // create TransformationSGNode to set the position of the particle
    var n = new TransformationSGNode(mat4.create(),part);
    smokeNode.append(n);
    paritcleNodes.push(n);
  }
  var index;
  var p;
  for(index = 0;index<particles.length;index++){
    // update the positions of all particles with the current time and translate the particles
    p =   particles[index];
    p.update(timeInMilliseconds);
    paritcleNodes[index].matrix = glm.translate(p.position[0], p.position[1], p.position[2]);
  }
}

function openDoor() {
  if (!isDoorOpening && !isDoorOpen) {  // cannot open the door if the door is already open(ed)
    doorAnimationStartTime = lastrendertime;
    isDoorOpening = true;
  }
}

function animateDoorOpen(timeInMilliseconds) {
  let angle = (timeInMilliseconds - doorAnimationStartTime)*0.05 % 136;

  if(angle >= 135 || ((timeInMilliseconds - doorAnimationStartTime)*0.05 / 136) >= 1) {
    isDoorOpening = false;
    isDoorOpen = true;
    isDoorClosed = false;
    angle = 135;
  }

  rotateDoor.matrix = glm.rotateZ(angle);
}

function closeDoor() {
  if (!isDoorClosing && !isDoorClosed) {  // cannot close the door if the dorr is already closed
    doorAnimationStartTime = lastrendertime;
    isDoorClosing = true;
  }
}

function animateDoorClose(timeInMilliseconds) {
  let angle = 136 - (timeInMilliseconds - doorAnimationStartTime)*0.05 % 136;

  if(angle <= 0 || ((timeInMilliseconds - doorAnimationStartTime)*0.05 / 136) >= 1) {
    isDoorClosing = false;
    isDoorClosed = true;
    isDoorOpen = false;
    angle = 0;
  }

  rotateDoor.matrix = glm.rotateZ(angle);
}

// when the cameraFlight ended this function checks if the camera is close to
// triggerable object and then triggers their movement
function triggerMovement(timeInMilliseconds){
  var x ;
  var y ;
  var z ;
  var t = timeInMilliseconds/1000;

  if(cameraFlight){
    // don't trigger if the cameraFlight is still going
    return;
  }
  if(closeToTardis()){
    startTardis = true;
  }
  //if the camera is close move the tardis
  if(startTardis){
    // check if tardis was on planet or in space
    if(!tardislanded){
      if(tardisstarttime ==-1.0){
        tardisstarttime = t;
        // if there is no starttime set it to current time
      }
      // calculate the position depending on the starting time
      // going back in time if the tardis should take off of the planet
      let dt=14-(t-tardisstarttime);

    } else {
      if(tardisstarttime ==-1.0){
        tardisstarttime = t;        // store time when animation started
      }
      // calculate the position depending on the starting time
      let dt=(t-tardisstarttime);

    }
    x = -0.3- Math.cos(dt);
    y = -planetrad+0.1;
    z = 18.8 * Math.cos(dt * Math.PI/14) +20.0;

    // if the time reaches the 14 seconds stop the tardis movement
    if((t-tardisstarttime)>=13.9){
      tardislanded = !tardislanded;     //mark tardis as flying in space or standing on planet
      tardisstarttime = -1.0;   //set starttime to unset
      startTardis = false;      //stop movement of tardis
      tardispos = [x,y,z];      // remember the current position for triggering the movement
    }
    // rotate tardis if moving
    rotateTardis.matrix = glm.rotateY(timeInMilliseconds*0.1);
    // update the position
    translateTardis.matrix = glm.translate(x,y,z);
  }
  // if the camera is very close to the door open it to enter.
  if(closeToDoor()){
    //open door to enter
    openDoor();
  } else {
    closeDoor();
  }
}
// calculates the distance between camera and door and compares it to a distance level
function closeToDoor(){
  let distance = getDistance([camera.position.x, camera.position.y, camera.position.z], doorPosition);  // calculate the distance between the camera and the tardis

  return distance < 0.3;
}

// calculates the distance between camera and saved tardis position and compares it to a distance level
function closeToTardis(){
  let distance = getDistance([camera.position.x, camera.position.y, camera.position.z], tardispos);  // calculate the distance between the camera and the tardis

  return distance < 1;

}

// moves tardis during the first 14 seconds (the camera flight)
function moveTardis(timeInMilliseconds){
  var x ;
  var y ;
  var z ;
  var t = timeInMilliseconds/1000;  //Time in seconds


  if(t <= 14 ){
    //First scene. Tardis moves to planet.
    x = - 0.3- Math.cos(t);
    y = -planetrad+0.1;
    z = 18.8 * Math.cos(t * Math.PI/14) +20.0;
    rotateTardis.matrix = glm.rotateY(timeInMilliseconds*0.1);
    tardispos = [x,y,z];
    translateTardis.matrix = glm.translate(x,y,z);
    if(z==1.2){
      tardislanded = true;
    }
  }


}

// let the daleks outside patrol around the planet and all daleks except the smoking one move their eye
function moveDaleks(timeInMilliseconds){
  var t = timeInMilliseconds/1000+13;

  // rotates all daleks outside
  dalekout.matrix = glm.rotateX(30-1.5*t);
  var index;
  //Start index with one so the smoking dalek does not move its eye
  for(index =1;index<rotateDalekHead.length;index++){
    rotateDalekHead[index].matrix = glm.rotateY(30*Math.sin(t));
  }
}

//moves the camera though the 3 scenes
function moveCamera(timeInMilliseconds){
  if(!cameraFlight){
    return;
  }
  // calculate time in seconds (easier readable)
  var t = timeInMilliseconds/1000;

  if( t<14 ){
    //First scene. Tardis moves to planet.
    camera.position.x = 0;
    camera.position.y = -20.5;
    // accelerate and stop a little smother
    camera.position.z = 19 * Math.cos(t * Math.PI/14) +21.0;
    return;
  }
  if(t<21){
    if(t>20) {
      // if close to door open it
      openDoor();
    }

    camera.position.x = ((t-14) * (t-14))/49;   //Turn in 7 seconds; divide by 7 *7 for normalization
    camera.position.y = -20.5 + (t-14)/21;      // lower camera a little bit
    camera.position.z = 2-(t-14)/3.3;                   //Go forward


    // change direction of camera to look at the house
    camera.direction.x = Math.sin((t-14) * Math.PI/14);  //Rotate 90 degrees in 7 seconds
    camera.direction.z = - Math.cos((t-14) * Math.PI/19);

    // update lookat vector depending on the direction
    camera.lookAt.x = camera.position.x + camera.direction.x;
    camera.lookAt.y = camera.position.y + camera.direction.y;
    camera.lookAt.z = camera.position.z + camera.direction.z;
    return;
  }
  if(t<30){
    if(t>29) {
      // close the Door at the end of the flight
      closeDoor();
    }
    // calculate a curve the camera should make with two polinoms second order
    var x = t-21;
    camera.position.x = 1-x*x*29/1800+x*341/1800;
    camera.position.y = -20.16;
    camera.position.z = -3/25 +x*x*17/1800-149/1800*x;

    camera.direction.x = Math.sin((0.25+t/10)*Math.PI);  //Rotate 90 degrees in 7 seconds
    camera.direction.z = - Math.cos((0.25+t/10)*Math.PI);


    camera.lookAt.x = camera.position.x + camera.direction.x;
    camera.lookAt.y = camera.position.y + camera.direction.y;
    camera.lookAt.z = camera.position.z + camera.direction.z;
    return;
  }
  cameraFlight = false; // cameraFlight ends after 30 seconds
}

function swingLampFunc(timeInMilliseconds){
  var t = timeInMilliseconds /1000;

  swingLamp.matrix = glm.rotateX(20*Math.cos(t));
}

function render(timeInMilliseconds) {
  checkForWindowResize(gl);


  makeSmoke(timeInMilliseconds);

  moveTardis(timeInMilliseconds);
  moveDaleks(timeInMilliseconds);
  moveCamera(timeInMilliseconds);


  triggerMovement(timeInMilliseconds);

  //Rotates sun and moon around the planet
  orbitSun.matrix = glm.rotateY(timeInMilliseconds*0.005);
  orbitMoon.matrix = glm.rotateY(timeInMilliseconds*-0.001);
  swingLampFunc(timeInMilliseconds);

  lastrendertime = timeInMilliseconds;
  if (isDoorOpening) {
    animateDoorOpen(timeInMilliseconds);
  } else if (isDoorClosing) {
    animateDoorClose(timeInMilliseconds);
  }

  //setup viewport
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(0.0, 0.0, 0.0, 1.0); // Backgroundcolor
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //setup context and camera matrices
  const context = createSGContext(gl);
  context.projectionMatrix = mat4.perspective(mat4.create(), 30, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.01, 100);

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

      if (distance > 20) {
        this.level0.render(context);
      } else if (distance > 10) {
        this.level1.render(context);
      } else {
        this.level2.render(context);
      }

      // render children
      super.render(context);
    }
}

class SpotLightSGNode extends LightSGNode {
  constructor(position, direction, cosCutoff, children) {
    super(position, children);
    this.direction = direction;
    this.cosCutoff = cosCutoff;
  }

  render(context) {
    // set additional uniforms
    gl.uniform3fv(gl.getUniformLocation(context.shader, this.uniform+'.direction'), this.direction);
    gl.uniform1f(gl.getUniformLocation(context.shader, this.uniform+'.cosCutoff'), this.cosCutoff);

    super.render(context);
  }
}

// calculates the euclidian distance between two points in 3D space
function getDistance(pos1, pos2) {
    let vector = [pos2[0] - pos1[0], pos2[1] - pos1[1], pos2[2] - pos1[2]];
    let distance = Math.sqrt(Math.pow(vector[0],2) + Math.pow(vector[1],2) + Math.pow(vector[2],2));
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
      //stop cameraFlight
      cameraFlight = false;

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
  document.addEventListener('keydown', function(event) {
    //https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
    if (event.code === 'KeyR') {
      //stop cameraFlight
      cameraFlight = false;

      camera.rotation.x = 0;
  		camera.rotation.y = 0;

      camera.position.x = 0;
      camera.position.y = -20.5;
      camera.position.z = 40;

      camera.direction.x=0;
      camera.direction.y=0;
      camera.direction.z=-1;

      camera.lookAt.x = 0;
      camera.lookAt.y = -20.5;
      camera.lookAt.z = -1;
    } else if (event.code === 'KeyW' || event.keyCode == 38) {
      let speed = 0.1;

      //stop cameraFlight
      cameraFlight = false;

      camera.position.x += camera.direction.x * speed;
      camera.position.y += camera.direction.y * speed;
      camera.position.z += camera.direction.z * speed;

      camera.lookAt.x = camera.position.x + camera.direction.x;
      camera.lookAt.y = camera.position.y + camera.direction.y;
      camera.lookAt.z = camera.position.z + camera.direction.z;
   } else if (event.code === 'KeyS' || event.keyCode == 40) {
     let speed = 0.1;

     //stop cameraFlight
     cameraFlight = false;

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
