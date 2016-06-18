/*
*		simple shader to map texture on an object with alpha values of the texture
*		no light is considered because of performance reasons
*/
precision mediump float;

// parameters of texture
varying vec2 v_texCoord;
uniform sampler2D u_tex;

void main() {

	// map the textel to the pixel
	vec4 textureColor = vec4(0,0,0,1);
	textureColor = texture2D(u_tex,v_texCoord);

	gl_FragColor = textureColor;
}
