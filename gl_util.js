

var generic_vs_code = 
`#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 v_position;

void  main()
{
    v_position = a_position;
    gl_Position = vec4(a_position,0.0,1.0);
}
`;

function createShaderProgram(vs_code,fs_code)
{
    
    let vert_shader = gl.createShader(gl.VERTEX_SHADER);
    let frag_shader = gl.createShader(gl.FRAGMENT_SHADER);


    gl.shaderSource(vert_shader,vs_code);
    gl.shaderSource(frag_shader,fs_code);

    gl.compileShader(vert_shader)
    console.log(gl.getShaderParameter(vert_shader,gl.COMPILE_STATUS))
    if(!gl.getShaderParameter(vert_shader,gl.COMPILE_STATUS))
    {
        console.log("VERTEX SHADER COMPILE ERROR!");
        console.log(gl.getShaderInfoLog(vert_shader));
    }
        
    gl.compileShader(frag_shader)
    if(!gl.getShaderParameter(frag_shader,gl.COMPILE_STATUS))
    {
        console.log("FRAGMENT SHADER COMPILE ERROR!");
        console.log(gl.getShaderInfoLog(frag_shader));
    }

    let shader_program = gl.createProgram();
    gl.attachShader(shader_program,vert_shader);
    gl.attachShader(shader_program,frag_shader);
    gl.linkProgram(shader_program);
    gl.validateProgram(shader_program);
    if(!gl.getProgramParameter(shader_program,gl.LINK_STATUS))
    {
        console.log("LINKING ERROR")
        console.log(gl.getProgramInfoLog(shader_program))
    }
    gl.useProgram(shader_program);
    return shader_program;

}

function createTexture(tex_width,tex_height,data)
{
    let tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        tex_width,
        tex_height,
        0,
        gl.RGBA,
        gl.FLOAT,
        data
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); 
    return tex;
}
function createWriteableTexture(tex_width,tex_height)
{

    let tex = createTexture(tex_width,tex_height,null);
    let tex_fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,tex_fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    
    return {tex:tex,fb:tex_fb};
}
function write_to_tex(tex,array,x_res,y_res)
    {
        if(array.length != x_res*y_res*4)
        {
            debugger;
        }
        gl.bindTexture(this.gl.TEXTURE_2D,tex);
        gl.texSubImage2D(
            this.gl.TEXTURE_2D,
            0,
            0, 
            0,
            x_res, y_res,
            gl.RGBA,
            gl.FLOAT,
            array
        );
    }

function create_quad(shader_program)
{
    let vertex_array = new Float32Array([
        -2.0,-1.0,
        2.0,-1.0,
        0.0, 3.0
    ]);
    let vertBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,Float32Array.BYTES_PER_ELEMENT*vertex_array.length,gl.STATIC_DRAW);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,vertex_array);
    
    
    gl.useProgram(shader_program)
    let a_position =  gl.getAttribLocation(shader_program,"a_position");
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position,2,gl.FLOAT,false,Float32Array.BYTES_PER_ELEMENT*2,0);
    
    gl.clearColor(1.0,0.0,1.0,1.0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)
}

function loadText(name)
{
    let xhr = new XMLHttpRequest();
    xhr.open("GET",name,false);
    xhr.setRequestHeader("content-type","text/plain")
    xhr.send();
    return xhr.response;
}