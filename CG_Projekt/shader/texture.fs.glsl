/**
 * a phong shader implementation with texture support
 */
precision mediump float;

/**
 * definition of a material structure containing common properties
 */
struct Material {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
	vec4 emission;
	float shininess;
};

/**
 * definition of the light properties related to material properties
 */
struct Light {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
};

struct SpotLight {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
	vec3 direction;	// the direction of the spotlight
	float cosCutoff;	// the cosine of the angle of the cone of the spotlight
};

//illumination related variables
uniform Material u_material;
uniform Light u_light;
uniform Light u_light2;
uniform SpotLight u_light3;
uniform SpotLight u_light4;
uniform Light u_light5;

varying vec3 v_normalVec;
varying vec3 v_eyeVec;
varying vec3 v_lightVec;
//varying vec3 v_light2Vec;
varying vec3 v_light3Vec;
varying vec3 v_light3DirVec;	// need the vector from the spot light to the current processed vertex to limit the illuminated area
varying vec3 v_light4Vec;
varying vec3 v_light4DirVec;
varying vec3 v_light5Vec;
//varying vec3 v_light5DirVec;

// texturing variables
uniform bool u_enableTexturing;
varying vec2 v_texCoord;
uniform sampler2D u_tex;

vec4 calculateSimplePointLight(Light light, Material material, vec3 lightVec, vec3 normalVec, vec3 eyeVec, vec4 textureColor) {
	lightVec = normalize(lightVec);
	normalVec = normalize(normalVec);
	eyeVec = normalize(eyeVec);

	//compute diffuse term
	float diffuse = max(dot(normalVec,lightVec),0.0);

	//compute specular term
	vec3 reflectVec = reflect(-lightVec,normalVec);
	float spec = pow( max( dot(reflectVec, eyeVec), 0.0) , material.shininess);

  if(u_enableTexturing) {
    material.diffuse = textureColor;
    material.ambient = textureColor;
  }

	vec4 c_amb  = clamp(light.ambient * material.ambient, 0.0, 1.0);
	vec4 c_diff = clamp(diffuse * light.diffuse * material.diffuse, 0.0, 1.0);
	vec4 c_spec = clamp(spec * light.specular * material.specular, 0.0, 1.0);
	vec4 c_em   = material.emission;

  return c_amb + c_diff + c_spec + c_em;
}

vec4 calculateSimpleSpotLight(SpotLight light, Material material, vec3 lightDirVec, vec3 lightVec, vec3 normalVec, vec3 eyeVec, vec4 textureColor) {
	lightVec = normalize(lightVec);
	normalVec = normalize(normalVec);
	eyeVec = normalize(eyeVec);

	vec4 c_amb  = vec4(0,0,0,0);
	vec4 c_diff = vec4(0,0,0,0);
	vec4 c_spec = vec4(0,0,0,0);
	vec4 c_em   = vec4(0,0,0,0);

	// if the angle between the spolight direction and the lightvector is smaller than the cutoff angle (i.e. the cosine is greater)
	if(dot(-lightDirVec, light.direction) > light.cosCutoff) {
		//compute diffuse term
		float diffuse = max(dot(normalVec,lightVec),0.0);

		if(diffuse > 0.0) {
			//compute specular term
			vec3 reflectVec = reflect(-lightVec,normalVec);
			float spec = pow( max( dot(reflectVec, eyeVec), 0.0) , material.shininess);

		  if(u_enableTexturing) {
		    material.diffuse = textureColor;
		    material.ambient = textureColor;
		  }

			c_amb  = clamp(light.ambient * material.ambient, 0.0, 1.0);
			c_diff = clamp(diffuse * light.diffuse * material.diffuse, 0.0, 1.0);
			c_spec = clamp(spec * light.specular * material.specular, 0.0, 1.0);
			c_em   = material.emission;
		}
	}

  return c_amb + c_diff + c_spec + c_em;
}

void main (void) {

  vec4 textureColor = vec4(0,0,0,1);

  if(u_enableTexturing) {
    textureColor = texture2D(u_tex,v_texCoord);
  }

	gl_FragColor = clamp(calculateSimplePointLight(u_light, u_material, v_lightVec, v_normalVec, v_eyeVec, textureColor) +
                //calculateSimplePointLight(u_light2, u_material, v_light2Vec, v_normalVec, v_eyeVec, textureColor) +
								calculateSimpleSpotLight(u_light3, u_material, v_light3DirVec, v_light3Vec, v_normalVec, v_eyeVec, textureColor) +
								calculateSimpleSpotLight(u_light4, u_material, v_light4DirVec, v_light4Vec, v_normalVec, v_eyeVec, textureColor) +
								calculateSimplePointLight(u_light5, u_material, v_light5Vec, v_normalVec, v_eyeVec, textureColor), 0.0, 1.0);
}
