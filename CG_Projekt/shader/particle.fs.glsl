
precision mediump float;


varying vec2 v_texCoord;
uniform sampler2D u_tex;

void main() {


	vec4 textureColor = vec4(0,0,0,1);
	textureColor = texture2D(u_tex,v_texCoord);



	gl_FragColor = textureColor;
}
