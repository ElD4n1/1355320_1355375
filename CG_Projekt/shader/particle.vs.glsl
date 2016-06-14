// Phong Vertex Shader

attribute vec3 a_position;
attribute vec2 a_texCoord;
attribute	vec3 a_direction;
attribute	float a_speed;
attribute	float a_starttime;

uniform mat4 u_modelView;
uniform mat3 u_normalMatrix;
uniform mat4 u_projection;
uniform mat4 u_invView;

uniform float u_systime;

uniform vec3 u_lightPos;
uniform vec3 u_light2Pos;

//output of this shader
varying vec3 v_normalVec;
varying vec3 v_eyeVec;
varying vec3 v_lightVec;
varying vec3 v_light2Vec;

//output variable for texture coordinates
varying vec2 v_texCoord;


void main() {

	vec4 eyePosition = u_modelView * vec4(a_position+ (a_speed*(u_systime-a_starttime)) * a_direction,1);



  v_normalVec = -eyePosition.xyz;

  v_eyeVec = -eyePosition.xyz;
	v_lightVec = u_lightPos - eyePosition.xyz;
	v_light2Vec = u_light2Pos - eyePosition.xyz;

	//pass on texture coordinates to fragment shader
	v_texCoord = a_texCoord;

	gl_Position = u_projection * eyePosition;
}
