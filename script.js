const xRes = 1024;
const yRes = 1024;

let values = new GPUImage(xRes,yRes);
let edges = new GPUImage(xRes,yRes);


setTimeout(draw);

let t = -0.4
function draw()
{
    computeValues(values,t);
    computeAxes(values);
    render(values)
    t+= 0.0006;
    requestAnimationFrame(draw)
}

//ComputeValues
{
    var computeValuesProgram = createShaderProgram(generic_vs_code,
        `#version 300 es
        precision highp float;
        in vec2 v_position;
    
        out vec4 FragColor;

        uniform float C;
        
        float F(float x, float y)
        {
            return 2.0*(x*x+y*y)-C-sin(5.0*3.1415926535*x*y);
        }
        vec2 gradient(float x, float y)
        {
            return vec2(
                6.0 * x - 5.0*3.1415926535 * y * cos(5.0*3.1415926535*x*y),
                6.0 * y - 5.0*3.1415926535 * x * cos(5.0*3.1415926535*x*y)
            );
        }
        
        void main()
        {
            vec2 size = vec2(1024.0,1024.0);

            float x = v_position.x;
            float y = v_position.y;
            
            float pixSize = 2.0/size.x;

            bool hasNeg = false;
            bool hasPos = false;

            vec2 negPos = vec2(0.0,0.0);
            vec2 posPos = vec2(0.0,0.0);

            float negVal = -2.0;
            float posVal = 2.0;

            for(int yDiff = -1; yDiff < 2; yDiff++)
            {
                for(int xDiff = -1; xDiff < 2; xDiff++)
                {
                    vec2 subpixelCoords = vec2( 
                        (float(xDiff)*0.5) * pixSize,
                        (float(yDiff)*0.5) * pixSize
                    );
                    float value = F(x+subpixelCoords.x,y+subpixelCoords.y);

                    if(value <= 0.0 && value > negVal)
                    {
                        negVal = value;
                        negPos = subpixelCoords;
                        hasNeg = true;
                    }
                    if(value >= 0.0 && value < posVal)
                    {
                        posVal = value;
                        posPos = subpixelCoords;
                        hasPos = true;
                    }
                }
            }
            if(hasNeg && hasPos)
            {
                vec2 centerPos = 0.5*(negPos+posPos);
                float centerVal = 0.0;
                for(int i = 0; i < 8; i++)
                {
                    centerVal = F(x + centerPos.x, y + centerPos.y);
                    if(centerVal < 0.0)
                    {
                        negPos = centerPos;
                    }
                    else
                    {
                        posPos = centerPos;
                    }
                    centerPos = 0.5*(negPos+posPos);
                    vec2 grad = normalize(gradient(x + centerPos.x, y + centerPos.y));
                    centerPos = grad * dot(grad,centerPos);
                }
                
                vec2 grad = normalize(gradient(x + centerPos.x, y + centerPos.y));
                // grad *= dot(grad,centerPos);
                FragColor = vec4(grad,1.0*dot(grad,centerPos),1.0);
            }
            else
            {
                FragColor = vec4(0.0,0.0,0.0,0.0);
            }
        }
        `
    );
    let computeValuesCLoc = gl.getUniformLocation(computeValuesProgram,"C");
    /**
     * 
     * @param {GPUImage} output
     */
    function computeValues(output,C)
    {
        gl.useProgram(computeValuesProgram); 
        gl.viewport(0,0,output.width,output.height);

        gl.uniform1f(computeValuesCLoc,C);
       
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,output.frontTex);
        gl.bindFramebuffer(gl.FRAMEBUFFER,output.backFb);
    
        gl.drawArrays(gl.TRIANGLES,0,3);
        output.swapBuffers()
    }
}

//Compute distance axes
{
    var computeAxesProgram = createShaderProgram(generic_vs_code,
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

            float x = v_position.x;
            float y = v_position.y;
            float pixSize = 2.0/float(size.x);

            int samples = 7;

            vec2 gradient = vec2(0.0, 0.0);
            float minDist = 10.0;

            for(int yDiff = -(samples-1)/2; yDiff < (samples+1)/2; yDiff++)
            {
                for(int xDiff = -(samples-1)/2; xDiff < (samples+1)/2; xDiff++)
                {
                    vec4 pix = texelFetch(input_tex0,ivec2(ix+xDiff,iy+yDiff),0);
                    if(pix.a == 1.0)
                    {
                        // float dist = length(vec2(float(xDiff),float(yDiff)));

                        vec2 subPixOffset = pix.xy*pix.z;
                        vec2 gradDir = (pix.xy);

                        vec2 totalOffset = vec2(float(xDiff),float(yDiff)) + 1.0 * subPixOffset/pixSize;

                        float dist = abs(length(totalOffset));

                        if(dist < minDist)
                        {
                            minDist = dist;
                            gradient = gradDir;
                        }
                    }
                }
            }

            float distance = minDist;

            distance = 2.0 - distance;

            float intensity = 0.0;
            
            if(-1.0 <= distance && distance <= 1.0)
            {
                float distSign = sign(distance);
                distance = abs(distance);

                gradient = abs(gradient);
                if(gradient.y < gradient.x)
                {
                    gradient = vec2(gradient.y,gradient.x);
                }

                float area = 0.0;
                if(distance < gradient.y-gradient.x)
                {
                    area = 2.0 - 2.0 * distance / gradient.y;
                }
                else
                {
                    float sqed = (1.0 + gradient.x / gradient .y - distance / gradient.y);
                    area = 0.5 * (gradient.y / gradient .x) * sqed * sqed;
                }
                area *= 0.25;
                area = 1.0-area;
                if(distSign <= 0.0)
                {
                    area = 1.0-area;
                }
                intensity = area;
            }
            if(distance >= 1.0)
            {
                intensity = 1.0;
            }

            FragColor = vec4(intensity, 0.0, 0.0, 1.0);
            // if(distance >0.5)
            // {
            // }
            // else
            // {
            //     FragColor = vec4(0.0,0.0,0.0,1.0);
            // }
        }
        `
    );
    let computeAxesSizeLoc = gl.getUniformLocation(computeAxesProgram,"size");
    /**
     * 
     * @param {GPUImage} image
     */
    function computeAxes(image)
    {
        gl.useProgram(computeAxesProgram); 
        gl.viewport(0,0,image.width,image.height);
       
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,image.frontTex);
        gl.bindFramebuffer(gl.FRAMEBUFFER,image.backFb);
        
        gl.uniform2i(computeAxesSizeLoc,image.width,image.height);
    
        gl.drawArrays(gl.TRIANGLES,0,3);
        image.swapBuffers()
    }
}
