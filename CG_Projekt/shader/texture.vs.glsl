// Phong Vertex Shader

attribute vec3 a_position;
attribute vec3 a_normal;
attribute vec2 a_texCoord;

uniform mat4 u_modelView;
uniform mat3 u_normalMatrix;
uniform mat4 u_projection;
uniform mat4 u_invView;

uniform vec3 u_lightPos;
uniform vec3 u_light2Pos;
uniform mat4 u_eyeToLightMatrix;

//output of this shader
varying vec3 v_normalVec;
varying vec3 v_eyeVec;
varying vec3 v_lightVec;
varying vec3 v_light2Vec;
varying vec4 v_shadowMapTexCoord;

//output variable for texture coordinates
varying vec2 v_texCoord;

void main() {
	vec4 eyePosition = u_modelView * vec4(a_position,1);

  v_normalVec = u_normalMatrix * a_normal;

  v_eyeVec = -eyePosition.xyz;
	v_lightVec = u_lightPos - eyePosition.xyz;
	v_light2Vec = u_light2Pos - eyePosition.xyz;

	//calculate vertex position in light clip space coordinates using u_eyeToLightMatrix
	v_shadowMapTexCoord = u_eyeToLightMatrix * eyePosition;

	//pass on texture coordinates to fragment shader
	v_texCoord = a_texCoord;

	gl_Position = u_projection * eyePosition;
}
