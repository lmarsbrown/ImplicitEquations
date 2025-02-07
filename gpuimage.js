class GPUImage
{
    constructor(width,height)
    {
        this.frontTex = createTexture(width,height,null);
        this.backTex = createTexture(width,height,null);
        
        this.frontFb = gl.createFramebuffer();
        this.backFb = gl.createFramebuffer();

        gl.bindFramebuffer(gl.FRAMEBUFFER,this.frontFb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.frontTex,0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);

        gl.bindFramebuffer(gl.FRAMEBUFFER,this.backFb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.backTex,0);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);



        this.width = width;
        this.height = height;

        this._buffer = new Float32Array(this.width*this.height*4);
        this.r = new Float32Array(this.width*this.height);
        this.g = new Float32Array(this.width*this.height);
        this.b = new Float32Array(this.width*this.height);
    }
    writeImage(data)
    {
        for(let i = 0; i < this._buffer.length; i++)
        {
            this._buffer[i] = data.data[i]/255;
        }
        for(let i = 0; i < this.width*this.height; i++)
        {
            this.r[i] = this._buffer[i*4+0];
            this.g[i] = this._buffer[i*4+1];
            this.b[i] = this._buffer[i*4+2];
        }
        write_to_tex(this.frontTex,this._buffer,this.width,this.height);
    }
    write()
    {
        for(let i = 0; i < this.width*this.height; i++)
        {
            this._buffer[i*4+0] = this.r[i];
            this._buffer[i*4+1] = this.g[i];
            this._buffer[i*4+2] = this.b[i];
            this._buffer[i*4+3] = 1.0;
        }
        write_to_tex(this.frontTex,this._buffer,this.width,this.height);
    }
    read()
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.frontFb)
        gl.readPixels(0,0,this.width,this.height,gl.RGBA,gl.FLOAT,this._buffer);

        for(let i = 0; i < this.width*this.height; i++)
        {
            this.r[i] = this._buffer[i*4+0];
            this.g[i] = this._buffer[i*4+1];
            this.b[i] = this._buffer[i*4+2];
        }
    }
    isSquare()
    {
        return this.width = this.height;
    }
    sameSize(input)
    {
        return this.width == input.width && this.height == input.height;
    }
    swapBuffers()
    {
        let tmpTex = this.frontTex;
        let tmpFb = this.frontFb;
        
        this.frontTex = this.backTex;
        this.frontFb = this.backFb;

        this.backTex = tmpTex;
        this.backFb = tmpFb;
    }
    destroy()
    {
        gl.deleteTexture(this.frontTex);
        gl.deleteTexture(this.backTex);
        gl.deleteFramebuffer(this.frontFb);
        gl.deleteFramebuffer(this.backFb);
    }
}

let can = document.createElement("canvas");
can.width = 1024;
can.height = 1024;
document.body.appendChild(can);


var gl = can.getContext("webgl2");
if (!gl.getExtension('EXT_color_buffer_float'))
    throw new Error('Rendering to floating point textures is not supported on this platform');


var renderProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));
        
        vec4 outcolor = texelFetch(input_tex0,ivec2(ix,iy),0);


        // outcolor.r = log(1.0+sqrt(outcolor.r*outcolor.r+outcolor.g*outcolor.g)*4.0)*1.0;
        // outcolor.r = 0.0;

        // outcolor.b = -outcolor.r;
        // outcolor.g = abs(outcolor.g);
        // outcolor *= 4.0;
        // outcolor.r += 0.5;
        // outcolor.g += 0.5;
        // outcolor.b += 0.5;

        FragColor = outcolor;
    }
    `
);

let renderSizeLoc = gl.getUniformLocation(renderProgram,"size");
create_quad(renderProgram);



var copyProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));
        
        vec4 outcolor = texture(input_tex0,0.5*(v_position+1.0));

        FragColor = outcolor;
    }
    `
);

let copySizeLoc = gl.getUniformLocation(copyProgram,"size");

var greyscaleProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));
        
        vec4 pixColor = texture(input_tex0,0.5*(v_position+1.0));
        float intensity = (pixColor.r + pixColor.g + pixColor.b) / 3.0;

        FragColor = vec4(intensity,intensity,intensity,1.0);
    }
    `
);

let greyscaleSizeLoc = gl.getUniformLocation(greyscaleProgram,"size");



/**
 * 
 * @param {GPUImage} input 
 */
function render(input)
{
    gl.useProgram(renderProgram); 
    gl.viewport(0,0,input.width,input.height)
   

    gl.uniform2i(renderSizeLoc,input.width,input.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.drawArrays(gl.TRIANGLES,0,3);
}

/**
 * 
 * @param {GPUImage} input
 * @param {GPUImage} output 
 */
function copy(input,output)
{
    gl.useProgram(copyProgram); 
    gl.viewport(0,0,output.width,output.height)
   

    gl.uniform2i(copySizeLoc,input.width,input.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.backFb);
    gl.drawArrays(gl.TRIANGLES,0,3);
    output.swapBuffers()
}

/**
 * 
 * @param {GPUImage} input
 */
function greyscale(input)
{
    gl.useProgram(greyscaleProgram); 
    gl.viewport(0,0,input.width,input.height)
   

    gl.uniform2i(greyscaleSizeLoc,input.width,input.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,input.backFb);
    gl.drawArrays(gl.TRIANGLES,0,3);
    input.swapBuffers()
}


var colorCovarianceProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x*2));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y*2));

        int section = ix / size.x + 2*(iy / size.x);
        
        ix %= size.x;
        iy %= size.y;

        vec4 outColor = texelFetch(input_tex0,ivec2(ix,iy),0);

        switch(section)
        {
            case 1:
                outColor *= outColor.r;
                break;
            case 2:
                outColor *= outColor.g;
                break;
            case 3:
                outColor *= outColor.b;
                break;
        }

        outColor.a = 1.0;

        FragColor = outColor;
    }
    `
);
let colorCovarianceSizeLoc = gl.getUniformLocation(colorCovarianceProgram,"size");


var kernelSize = 27;
var gaussianBlurProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform float[${kernelSize}] kernel;

    uniform sampler2D input_tex0;

    uniform int direction;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        ivec2 halfSize = size / 2;

        ivec2 sectionOffset = (ivec2(ix,iy)/halfSize)*halfSize;
        
        ix %= halfSize.x;
        iy %= halfSize.y;

        vec4 outColor = vec4(0.0,0.0,0.0,0.0);

        for(int i = ${-Math.floor(kernelSize/2)}; i < ${Math.ceil(kernelSize/2)}; i++)
        {
            ivec2 sampleLoc = ivec2(ix,iy);
            if(direction == 0)
            {
                sampleLoc.x += i;
            }
            else
            {
                sampleLoc.y += i;
            }
            sampleLoc = min(max(sampleLoc, ivec2(0,0)),halfSize-1);

            outColor += texelFetch(input_tex0,sampleLoc+sectionOffset,0) * kernel[i+${Math.floor(kernelSize/2)}];
        }

        outColor.a = 1.0;

        FragColor = outColor;
    }
    `
);
let gaussianBlurSizeLoc = gl.getUniformLocation(gaussianBlurProgram,"size");
let gaussianBlurKernelLoc = gl.getUniformLocation(gaussianBlurProgram,"kernel");
let gaussianBlurDirectionLoc = gl.getUniformLocation(gaussianBlurProgram,"direction");

var noiseRemovalProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;
    
    uniform sampler2D image;
    uniform sampler2D distribution;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        vec3 pixColor = texelFetch(image,ivec2(ix,iy),0).xyz;
        // mat3 noiseDist = mat3(
        //     0.0025, 0.0, 0.0,
        //     0.0, 0.0012, 0.0,
        //     0.0, 0.0, 0.0025
        // );

        mat3 noiseDist = mat3(
            0.02, 0.0, 0.0,
            0.0, 0.0012, 0.0,
            0.0, 0.0, 0.01
        );


        vec3 mean = texelFetch(distribution,ivec2(ix,iy),0).xyz;
        mat3 covMat = mat3(
            (texelFetch(distribution,ivec2(ix+size.x,iy),0).xyz        - mean.r*mean),
            (texelFetch(distribution,ivec2(ix,iy+size.y),0).xyz        - mean.g*mean),
            (texelFetch(distribution,ivec2(ix+size.x,iy+size.y),0).xyz - mean.b*mean)
        );

        mat3 kalmanGain =  noiseDist*inverse(noiseDist + covMat);

        vec3 noise = kalmanGain*(mean-pixColor);
        // noise.g *= 2.0;
        pixColor += noise;

        FragColor = vec4(pixColor,1.0);
    }
    `
);

let noiseRemovalSizeLoc = gl.getUniformLocation(noiseRemovalProgram,"size");
let noiseRemovalImageLoc = gl.getUniformLocation(noiseRemovalProgram,"image");
let noiseRemovalDistLoc = gl.getUniformLocation(noiseRemovalProgram,"distribution");

gl.useProgram(noiseRemovalProgram);
gl.uniform1i(noiseRemovalImageLoc,0);
gl.uniform1i(noiseRemovalDistLoc,1);
gl.useProgram(null);


var laplacianProgram = createShaderProgram(generic_vs_code,
    `#version 300 es
    precision highp float;
    in vec2 v_position;

    uniform ivec2 size;

    uniform sampler2D input_tex0;

    out vec4 FragColor;
    
    void main()
    {
        int ix = int(0.5*(v_position.x+1.0)*float(size.x));
        int iy = int(0.5*(v_position.y+1.0)*float(size.y));

        vec4 average = vec4(0.0, 0.0, 0.0, 0.0);
        vec4 center = texelFetch(input_tex0,ivec2(ix,iy),0);
        ivec2 offset = ivec2(1,0);

        for(int i = 0; i < 4; i++)
        {
            ivec2 offsetPos = ivec2(ix,iy)+offset;
            offsetPos = min(max(offsetPos,0),size-1);
            average += texelFetch(input_tex0,offsetPos,0)*0.25;
            offset = ivec2(-offset.y,offset.x);
        }

        average -= center;
        average *= 4.0;
        average.a = 1.0;

        // average += (center - average) * 0.5;


        FragColor = average;
    }
    `
);
let laplacianSizeLoc = gl.getUniformLocation(laplacianProgram,"size");


/**
 * @param {GPUImage} input 
 * @param {GPUImage} output
 */
function initCovariance(input,output)
{
    if(input.height*2 != output.height || input.width*2 != output.width)
    {
        throw "Size mismatch";
    }
    gl.useProgram(colorCovarianceProgram); 
    gl.viewport(0,0,output.width,output.height)
   

    gl.uniform2i(colorCovarianceSizeLoc,input.width,input.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,output.backFb);
    gl.drawArrays(gl.TRIANGLES,0,3);
    output.swapBuffers();
}

/**
 * @param {GPUImage} cov 
 */
function gaussianBlur(cov,stdev=0.17)
{
    gl.useProgram(gaussianBlurProgram); 
    gl.viewport(0,0,cov.width,cov.height)

    let kernel = new Float32Array(kernelSize);

    let kernelMin = -Math.floor(kernelSize/2);
    let kernelMax = Math.ceil(kernelSize/2);

    let total = 0.0;
    for(let i = kernelMin; i < kernelMax; i++)
    {
        kernel[i-kernelMin] = Math.exp(-0.5*(i/(stdev*10))**2);
        total += kernel[i-kernelMin];
    }
    for(let i = 0; i < kernel.length; i++)
    {
        kernel[i] /= total;
    }
    // kernel[Math.floor(kernelSize/2)] -= 1.0;

   

    gl.uniform2i(gaussianBlurSizeLoc,cov.width,cov.height);
    gl.uniform1fv(gaussianBlurKernelLoc,kernel);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,cov.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,cov.backFb);


    gl.uniform1i(gaussianBlurDirectionLoc,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    cov.swapBuffers();

    gl.bindTexture(gl.TEXTURE_2D,cov.frontTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER,cov.backFb);
    gl.uniform1i(gaussianBlurDirectionLoc,1);
    gl.drawArrays(gl.TRIANGLES,0,3);
    cov.swapBuffers();
}

/**
 * @param {GPUImage} image 
 * @param {GPUImage} distribution
 */
function removeNoise(image)
{
    let distribution = new GPUImage(image.width*2, image.height*2);

    initCovariance(image,distribution);
    gaussianBlur(distribution)

    gl.useProgram(noiseRemovalProgram); 
    gl.viewport(0,0,image.width,image.height)
   
    gl.uniform2i(noiseRemovalSizeLoc,image.width,image.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,image.frontTex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,distribution.frontTex);

    gl.bindFramebuffer(gl.FRAMEBUFFER,image.backFb);
    gl.drawArrays(gl.TRIANGLES,0,3);
    image.swapBuffers();

    distribution.destroy();
}

/**
 * @param {GPUImage} input 
 */
function laplacian(input)
{
    gl.useProgram(laplacianProgram); 
    gl.viewport(0,0,input.width,input.height)
   
    gl.uniform2i(laplacianSizeLoc,input.width,input.height);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D,input.frontTex);

    gl.bindFramebuffer(gl.FRAMEBUFFER,input.backFb);
    gl.drawArrays(gl.TRIANGLES,0,3);
    input.swapBuffers();
}

function load_img(name,callback)
{
    let img_ele = document.createElement("img");
    img_ele.src = name;

    img_ele.onload = ()=>{
        let extractionCan = document.createElement("canvas");
        extractionCan.width = img_ele.width;
        extractionCan.height = img_ele.height;
        let extCtx = extractionCan.getContext("2d");
        extCtx.drawImage(img_ele,0,0);
        let channeled_data = extCtx.getImageData(0,0,img_ele.width,img_ele.height);

        callback(channeled_data);
    };
}
