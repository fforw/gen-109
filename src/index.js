import domready from "domready"
import "./style.css"
import { voronoi } from "d3-voronoi"
import { polygonCentroid } from "d3-polygon"
import { allPalettesWithBlack } from "./randomPalette"
import { rndFromArray } from "./util"
import spectral from "spectral.js"

const PHI = (1 + Math.sqrt(5)) / 2;
const TAU = Math.PI * 2;
const DEG2RAD_FACTOR = TAU / 360;

const config = {
    width: 0,
    height: 0
};

/**
 * @type CanvasRenderingContext2D
 */
let ctx;
let canvas;

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

const overdraw = 1.5


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


function touchesScreen(tri)
{
    const { width, height } = config

    const [[x0,y0],[x1,y1],[x2,y2]] = tri

    return (
        (x0 >= 0 && x0 < width && y0 >= 0 && y0 < height) ||
        (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) ||
        (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height)
    )
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


function randomColorPos()
{
    return 0.25 + Math.random() * 0.5
}


function interpolate(pts,colors, tri, triColors, level)
{
    const [pt0,pt1,pt2] = tri

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
    const color3 = spectral.mix(color0, color1, randomColorPos(), spectral.HEX)
    const color4 = spectral.mix(color1, color2, randomColorPos(), spectral.HEX)
    const color5 = spectral.mix(color2, color0, randomColorPos(), spectral.HEX)

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

            ctx.fillStyle = "#000";
            ctx.fillRect(0,0, width, height);

            const borderX = (overdraw - 1) * width / 2
            const borderY = (overdraw - 1) * height / 2
            const v = voronoi().extent([[-borderX,-borderY], [width + borderX, height + borderY]])

            const palette = rndFromArray(allPalettesWithBlack)

            const count = Math.floor(width * overdraw * overdraw * height/150000)

            let [pts, colors] = createRandomColors(palette, count)

            let diagram = v(pts)

            let triangles = diagram.triangles()
            let drawn = 0, culled = 0
            triangles.forEach(tri => {

                if (touchesScreen(tri))
                {
                    const numSplits = 4 + Math.floor(Math.pow(Math.random(),0.5) * 2)

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
            console.log("TRI", triangles.length, "drawn = ", drawn, ", culled = ", culled)

            // for (let i = 0; i < pts.length; i++)
            // {
            //     const [x, y] = pts[i]
            //
            //     ctx.fillStyle = colors[i]
            //     ctx.fillRect(x-1,y-1,2,2)
            //
            // }

            diagram = v(pts)
            diagram.polygons().forEach(
                (p, idx) => {
                    ctx.fillStyle = colors[idx]
                    ctx.strokeStyle = colors[idx]
                    ctx.lineWidth = 2
                    drawPolygon(ctx, p)
                })
        }

        paint()

        canvas.addEventListener("click", paint, true)
    }
);
