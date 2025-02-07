const xRes = 1024;
const yRes = 1024;

let values = new GPUImage(1024,1024);
let edges = new GPUImage(xRes,yRes);

setTimeout(draw);

let t = -0.4
function draw()
{
    computeValues(values,t);
    // findEdges(values,edges)
    // computeAxes(edges);
    // combineAxes(edges);
    render(values)
    t+= 0.00025;
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
        
        void main()
        {
            float x = v_position.x;
            float y = v_position.y;

            // float intensity = 2.0*(x*x+y*y)-C+sin(5.0*3.1415926535*x*y);

            // vec2 gradient = vec2(
            //     6.0 * x + 5.0*3.1415926535 * y * cos(5.0*3.1415926535*x*y),
            //     6.0 * y + 5.0*3.1415926535 * x * cos(5.0*3.1415926535*x*y)
            // );
            
            float distance = C+2.0*x+0.5*y / sqrt(2.0*2.0+0.5*0.5);
            distance = abs(distance)*256.0;

            vec2 gradient = normalize(vec2(
                2.0,
                0.5
            ));

            distance = 2.0-distance;

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
            else if(distance >= 1.0)
            {
                intensity = 1.0;
            }


            // distance /= 1024.0;
            
            FragColor = vec4(intensity,0.0,0.0,1.0);
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

//FindEdges
{
    var findEdgesProgram = createShaderProgram(generic_vs_code,
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

            vec4 self = texelFetch(input_tex0,ivec2(ix,iy),0);
            float selfSign = sign(self.r);

            ivec2 offset = ivec2(1,0);

            vec2 edgeDist = vec2(2.0,2.0);

            float isEdge = 0.0;
            for(int i = 0; i < 4; i++)
            {
                ivec2 offsetPos = ivec2(ix,iy) + offset;
                offsetPos.x = max(min(offsetPos.x,size.x),0);
                offsetPos.y = max(min(offsetPos.y,size.y),0);

                vec4 neighbor = texelFetch(input_tex0,offsetPos,0);
                if(sign(neighbor.r) != selfSign)
                {
                    isEdge = 1.0;
                }
                offset = ivec2(-offset.y,offset.x);
            }


            edgeDist = 1.0-edgeDist;
            if(edgeDist.x == -1.0)
            {
                edgeDist.x = 0.0;
            }
            if(edgeDist.y == -1.0)
            {
                edgeDist.y = 0.0;
            }

            vec2 trueDist = vec2(0.0,0.0);
            if(isEdge == 1.0)
            {
                trueDist = min(max(float(size)*vec2(self.x,self.x)/(self.yz),-1.0),1.0);
            }
            else
            {
                trueDist = vec2(-2.0,-2.0);
            }

            vec2 grad = normalize(self.yz) * self.x / length(self.yz);
            FragColor = vec4(isEdge,grad,1.0);
        }
        `
    );
    let findEdgesSizeLoc = gl.getUniformLocation(findEdgesProgram,"size");
    /**
     * 
     * @param {GPUImage} output
     */
    function findEdges(values,output)
    {
        gl.useProgram(findEdgesProgram); 
        gl.viewport(0,0,output.width,output.height);
       
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,values.frontTex);
        gl.bindFramebuffer(gl.FRAMEBUFFER,output.backFb);
        
        gl.uniform2i(findEdgesSizeLoc,values.width,values.height);
    
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

            int samples = 7;

            vec2 edgeDist = vec2(10.0,10.0);

            for(int i = -(samples-1)/2; i < (samples+1)/2; i++)
            {
                float isEdge = texelFetch(input_tex0,ivec2(ix+i,iy),0).x;

                if(isEdge == 1.0&& float(abs(i)) < abs(edgeDist.x))
                {
                    edgeDist.x = float(i);
                }
                // if(distY.y != -2.0)
                // {
                //     edgeDist.y = min(edgeDist.y,abs(float(i)));
                // }
            }

            // if(edgeDist.x == 0.0)
            // {
            //     edgeDist.x = 1.0;
            // }
            // if(edgeDist.x == 10.0)
            // {
            //     edgeDist.x = 0.0;
            // }

            // if(edgeDist.y == 0.0)
            // {
            //     edgeDist.y = 1.0;
            // }
            // if(edgeDist.y == 10.0)
            // {
            //     edgeDist.y = 0.0;
            // }

            
            vec4 self = texelFetch(input_tex0,ivec2(ix,iy),0);
            FragColor = vec4(edgeDist.x,self.yz,1.0);
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

//Combine distance axes
{
    var combineAxesProgram = createShaderProgram(generic_vs_code,
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

            int samples = 7;

            float minDist = 0.0;


            vec2 gradPos = vec2(0.0,0.0);
            vec2 gradDir = vec2(0.0,0.0);

            float weight = 0.0;

            for(int i = -(samples-1)/2; i < (samples+1)/2; i++)
            {
                vec3 distPix = texelFetch(input_tex0,ivec2(ix,iy+i),0).xyz;

                float trueDist = float(i*i)+distPix.x*distPix.x;

                vec2 tempGradPos = vec2(distPix.x,float(i));
                vec2 tempGradDir = normalize(distPix.yz);

                float dist = (abs(tempGradDir.x*tempGradPos.x+tempGradDir.y*tempGradPos.y));

                if(trueDist < 3.0)
                {
                    minDist += dist/(1.0+dist*dist);
                    gradPos = tempGradPos;
                    gradDir = tempGradDir;

                    weight += 1.0/(1.0+dist*dist);
                }
            }
            minDist /= weight;


            float finalDist = minDist;

            
            

            float finalValue = 0.0;//1.0-max(finalDist,0.0);

            if(finalDist < 2.0&& minDist != 100.0)
            {
                finalValue = 1.0-finalDist;
            }

            FragColor = vec4(finalValue, finalValue,finalValue , 1.0);
        }
        `
    );
    let combineAxesSizeLoc = gl.getUniformLocation(combineAxesProgram,"size");
    /**
     * 
     * @param {GPUImage} image
     */
    function combineAxes(image)
    {
        gl.useProgram(combineAxesProgram); 
        gl.viewport(0,0,image.width,image.height);
       
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D,image.frontTex);
        gl.bindFramebuffer(gl.FRAMEBUFFER,image.backFb);
        
        gl.uniform2i(combineAxesSizeLoc,image.width,image.height);
    
        gl.drawArrays(gl.TRIANGLES,0,3);
        image.swapBuffers()
    }
}