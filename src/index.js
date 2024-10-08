import domready from "domready"
import "./style.css"
import { voronoi } from "d3-voronoi"
import { sutherlandHodgeman } from "@thi.ng/geom-clip"
import { polygonCentroid, polygonArea } from "d3-polygon"
import spectral from "spectral.js"
import { createNoise2D } from "simplex-noise"
import { canvasRGBA } from "stackblur-canvas"
import { allPalettesWithBlack } from "./randomPalette"
import { rndFromArray } from "./util"
import { easeOutQuad } from "./easing"

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const overdraw = 1.5

const config = {
    width: 0,
    height: 0
};

/**
 * @type CanvasRenderingContext2D
 */
let ctx;
let canvas;
let noise;

function relax(v, pts, count = 5)
{
    for (let i = 0; i < count; i++)
    {
        pts = v(pts).polygons().map(poly => {
            const c = polygonCentroid(poly)
            c[0] |= 0
            c[1] |= 0
            return c
        })
    }
    return pts
}

function createTemp(width = config.width, height = config.height)
{
    const canvas = document.createElement("canvas")
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")

    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, width, height)

    return ctx
}

function drawPolygon(ctx, polygon)
{
    const last = polygon.length - 1
    const [x, y] = polygon[last]

    ctx.beginPath()
    ctx.moveTo(
        Math.round(x),
        Math.round(y)
    )

    for (let i = 0; i < polygon.length; i++)
    {
        const [x, y] = polygon[i]
        ctx.lineTo(
            Math.round(x),
            Math.round(y)
        )
    }
    ctx.fill()
    ctx.stroke()
}


function getPair(palette)
{
    const colorA = rndFromArray(palette)
    let colorB
    do
    {
        colorB = rndFromArray(palette)
    } while( colorA === colorB)

    return [colorA, colorB]
}


function randomMix(palette)
{
    const [colorA, colorB] = getPair(palette)
    return spectral.mix(colorA, colorB, Math.random(), spectral.HEX)
}


function createRandomColors(palette, count = 10)
{
    const { width, height } = config

    const points = []
    const colors = []

    const borderX = -(overdraw * width - width)/2
    const borderY = -(overdraw * height - height)/2

    for (let i = 0; i < count; i++)
    {

        points.push([
            borderX + Math.random() * width * overdraw,
            borderY + Math.random() * height * overdraw,
        ])
        colors.push(rndFromArray(palette))
    }

    return [points, colors]
}


function touchesScreen(polygon)
{
    const { width, height } = config

    for (let i = 0; i < polygon.length; i++)
    {
        const [x, y] = polygon[i]
        if (x >= 0 && x < width && y >= 0 && y < height)
        {
            return true
        }
    }
    return false
}

function findIndex(pts, pt)
{
    for (let i = 0; i < pts.length; i++)
    {
        const p = pts[i]
        if (p === pt)
        {
            return i
        }
    }
    throw new Error("Could not find " + JSON.stringify(pt))
}


const ns = 0.15

function randomColorPos(pt, flip)
{
    const [x,y] = pt

    let v = 0.15 + (0.5 + 0.5 * noise(x * ns, y * ns))  * 0.7

    if (flip)
    {
        v = 1 - v
    }
    return v
}

function getOrder(x0,y0,x1,y1)
{
    return Math.atan2(y1-y0,x0-y1) < 0
}

/**
 * Recursive interpolation of color positions
 *
 * @param {Array<Array<number>>} pts    Array of all positions (each is a 2 element array)
 * @param {Array<string>} colors        Array of all colors (each is a color)
 * @param {Array<Array<number>>} tri    Array of the current triangle coordinates
 * @param {Array<string>} triColors     Array of colors for the current triangle
 * @param {number} level                current dept, approaches and stops at 0
 */
function interpolate(pts,colors, tri, triColors, level)
{
    const [pt0,pt1,pt2] = tri

    // see /tri-interpolate.png 

    const [x0,y0] = pt0
    const [x1,y1] = pt1
    const [x2,y2] = pt2

    const x3 = (x0 + x1) >> 1
    const y3 = (y0 + y1) >> 1
    const x4 = (x1 + x2) >> 1
    const y4 = (y1 + y2) >> 1
    const x5 = (x2 + x0) >> 1
    const y5 = (y2 + y0) >> 1

    const pt3 = [x3,y3]
    const pt4 = [x4,y4]
    const pt5 = [x5,y5]

    const color0 = triColors[0]
    const color1 = triColors[1]
    const color2 = triColors[2]

    const order3 = getOrder(x0,y0,x1,y1)
    const order4 = getOrder(x1,y1,x2,y2)
    const order5 = getOrder(x2,y2,x0,y0)


    const color3 = spectral.mix(color0, color1, randomColorPos(pt3, order3), spectral.HEX)
    const color4 = spectral.mix(color1, color2, randomColorPos(pt4, order4), spectral.HEX)
    const color5 = spectral.mix(color2, color0, randomColorPos(pt5, order5), spectral.HEX)

    pts.push(
        [x3,y3],
        [x4,y4],
        [x5,y5],
    )
    colors.push(color3)
    colors.push(color4)
    colors.push(color5)

    const nextLevel = level -1
    if (nextLevel > 0)
    {
        interpolate(
            pts,
            colors,
            [
                pt0,
                pt3,
                pt5
            ],
            [
                color0,
                color3,
                color5
            ],
            nextLevel
        )
        interpolate(
            pts,
            colors,
            [
                pt3,
                pt1,
                pt4
            ],
            [
                color3,
                color1,
                color4
            ],
            nextLevel
        )
        interpolate(
            pts,
            colors,
            [
                pt5,
                pt4,
                pt2
            ],
            [
                color5,
                color4,
                color2
            ],
            nextLevel
        )
        interpolate(
            pts,
            colors,
            [
                pt3,
                pt4,
                pt5
            ],
            [
                color3,
                color4,
                color5
            ],
            nextLevel
        )
    }
}


function transferAlpha(ctx, maskCtx)
{
    const { width, height } = config

    const imageData = ctx.getImageData(0,0,width,height)
    const maskData = maskCtx.getImageData(0,0,width,height)

    const { data } = imageData
    const { data : mask } = maskData

    let off = 0
    for (let y = 0; y < height; y++)
    {
        for (let x = 0; x < width; x++)
        {
            data[off + 3] = mask[off + 1]
            off += 4
        }
    }
    ctx.putImageData(imageData, 0, 0)
}


function getMinMax(array)
{
    let min = Infinity, max = -Infinity
    for (let i = 0; i < array.length; i++)
    {
        const value = array[i]

        if (value < min)
        {
            min = value
        }
        if (value > max)
        {
            max = value
        }
    }
    return [min,max]

}

function clipPolygons(polygons, colors)
{
    const polygonsOut = []
    const colorsOut = []
    const areasOut = []

    const screen = getScreenPolygon()

    for (let i = 0; i < polygons.length; i++)
    {
        const polygon = polygons[i]

        const result = polygon ? sutherlandHodgeman(polygon, screen) : []
        
        if (result.length)
        {
            const area = polygonArea(result)
            if (area > 1)
            {
                polygonsOut.push(result)
                colorsOut.push(colors[i])
                areasOut.push(area)
            }
        }
    }

    return [polygonsOut, colorsOut,areasOut]

}


function getScreenPolygon()
{
    const { width, height } = config

    return [
        [0,0],
        [width,0],
        [width,height],
        [0,height]
    ]
}


function getArea(tri)
{
    const [[x1,y1],[x2,y2],[x3,y3]] = tri

    return 0.5 * Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 *(y1 - y2))
}

function getMinHeight(tri)
{
    const area = getArea(tri)

    let min = Infinity
    // h = a / (0.5 * base)

    const length = tri.length
    let [x0,y0] = tri[length - 1]
    for (let i = 0; i < length; i++)
    {
        const [x1, y1] = tri[i]
        const h = area / (0.5 * distance(x0,y0,x1,y1))

        if (h < min)
        {
            min = h
        }

        x0 = x1
        y0 = y1
    }
    return min;
}


function distance(x0, y0, x1, y1)
{
    const dx = x1 - x0
    const dy = y1 - y0
    return Math.sqrt(dx * dx + dy * dy)
}


domready(
    () => {

        canvas = document.getElementById("screen");
        ctx = canvas.getContext("2d");

        const width = (window.innerWidth) | 0;
        const height = (window.innerHeight) | 0;

        config.width = width;
        config.height = height;

        canvas.width = width;
        canvas.height = height;

        const paint = () => {

            noise = createNoise2D()

            ctx.fillStyle = "#000";
            ctx.fillRect(0,0, width, height);

            const borderX = (overdraw - 1) * width / 2
            const borderY = (overdraw - 1) * height / 2
            const v = voronoi().extent([[-borderX,-borderY], [width + borderX, height + borderY]])

            const palette = rndFromArray(allPalettesWithBlack)

            const variance = 0.2 + Math.pow(Math.random(),2) * 1.4
            const count = Math.floor(width * overdraw * overdraw * height/(150000*variance))

            let [pts, colors] = createRandomColors(palette, count)

            pts = relax(v, pts, 1)

            const power = 0.1 + Math.random() * 2

            let diagram = v(pts)

            let triangles = diagram.triangles()
            let drawn = 0, culled = 0
            let minSplits = Infinity, maxSplits = -Infinity
            triangles.forEach(tri => {

                if (touchesScreen(tri))
                {
                    const h = getMinHeight(tri)

                    const numSplits = 2 + Math.floor(Math.pow(Math.random(),power) * Math.log2(h) - 2)

                    if (numSplits < minSplits)
                    {
                        minSplits = numSplits
                    }
                    if (numSplits > maxSplits)
                    {
                        maxSplits = numSplits
                    }

                    if (numSplits > 0)
                    {
                        interpolate(pts,colors,tri, tri.map(p => colors[findIndex(pts, p)]), numSplits)
                    }
                    drawn++
                }
                else
                {
                    culled++
                }
            })


            console.log("TRI", triangles.length, "drawn = ", drawn, ", culled = ", culled, ", minSplits = ", minSplits, ", maxSplits = ", maxSplits)


            // for (let i = 0; i < pts.length; i++)
            // {
            //     const [x, y] = pts[i]
            //
            //     ctx.fillStyle = colors[i]
            //     ctx.fillRect(x-1,y-1,2,2)
            //
            // }


            diagram = v(pts)
            let polys = diagram.polygons()

            const [polygons, cols, polygonAreas] = clipPolygons(polys, colors)

            const [minArea, maxArea] = getMinMax(polygonAreas)

            console.log({minArea,maxArea})

            const maskCtx = createTemp()
            polygons.forEach(
                (p, idx) => {

                    let value = (polygonAreas[idx] - minArea) / (maxArea - minArea)

                    value = Math.floor(easeOutQuad(value) * 255)
                    const color = `rgb(${value},${value},${value})`

                    maskCtx.fillStyle = color
                    maskCtx.strokeStyle = color
                    maskCtx.lineWidth = 2
                    drawPolygon(maskCtx, p)
                })
            canvasRGBA(maskCtx.canvas, 0,0,width,height, 100)
            //dither(maskCtx, 200)

            polygons.forEach(
                (p, idx) => {
                    ctx.fillStyle = cols[idx]
                    ctx.strokeStyle = cols[idx]
                    ctx.lineWidth = 2
                    drawPolygon(ctx, p)
                })

            const blurCtx = createTemp()
            blurCtx.drawImage(ctx.canvas, 0, 0, width, height)
            canvasRGBA(blurCtx.canvas, 0,0,width,height, 100)
            //dither(blurCtx, 100)

            transferAlpha(blurCtx, maskCtx)
            //ctx.drawImage(maskCtx.canvas, 0, 0, width, height)
            ctx.drawImage(blurCtx.canvas, 0, 0)

        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
