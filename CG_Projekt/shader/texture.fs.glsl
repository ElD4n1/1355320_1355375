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

//illumination related variables
uniform Material u_material;
uniform Light u_light;
uniform Light u_light2;
varying vec3 v_normalVec;
varying vec3 v_eyeVec;
varying vec3 v_lightVec;
varying vec3 v_light2Vec;

// texturing variables
uniform bool u_enableTexturing;
varying vec2 v_texCoord;
uniform sampler2D u_tex;


//shadow related variables
varying vec4 v_shadowMapTexCoord;
uniform sampler2D u_depthMap;

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

	//TASK 2.3: apply perspective division to v_shadowMapTexCoord and save to shadowMapTexCoord3D
  vec3 shadowMapTexCoord3D = v_shadowMapTexCoord.xyz/v_shadowMapTexCoord.w;

	//do texture space transformation (-1 to 1 -> 0 to 1)
	shadowMapTexCoord3D = vec3(0.5,0.5,0.5) + shadowMapTexCoord3D*0.5;
	//substract small amount from z to get rid of self shadowing (TRY: disable to see difference)
	shadowMapTexCoord3D.z -= 0.003;


  float shadowCoeff = 0.0; //set to 1 if no shadow!
	//TASK 2.4: look up depth in u_depthMap and set shadow coefficient (shadowCoeff) to 0 based on depth comparison
	if(shadowMapTexCoord3D.z < texture2D(u_depthMap, shadowMapTexCoord3D.xy).r){
		shadowCoeff = 1.0;
	}

  //EXTRA TASK: Improve shadow quality by sampling multiple shadow coefficients (a.k.a. PCF)
	/*const float offset = 0.002;
	const float factor = 1.0;
	for(float x=-factor*offset; x <=factor*offset; x+=offset){
		for(float y = -factor*offset;y<=factor*offset; y+=offset){

			vec2 cord = vec2(shadowMapTexCoord3D.x, shadowMapTexCoord3D.y);

			if(shadowMapTexCoord3D.z < texture2D(u_depthMap, cord).r){
				shadowCoeff += 1.0;
			}
		}
	}
	shadowCoeff /= (2.0*factor+1.0)*(2.0*factor+1.0);*/


  return c_amb + shadowCoeff*c_diff + shadowCoeff*c_spec + c_em;


}

void main (void) {

  vec4 textureColor = vec4(0,0,0,1);

  if(u_enableTexturing) {
    textureColor = texture2D(u_tex,v_texCoord);
  }

	gl_FragColor = calculateSimplePointLight(u_light, u_material, v_lightVec, v_normalVec, v_eyeVec, textureColor); +
                calculateSimplePointLight(u_light2, u_material, v_light2Vec, v_normalVec, v_eyeVec, textureColor);

}
