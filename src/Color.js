export const LUM_THRESHOLD = 0.03928;

export const PERCEPTIVE_FACTOR_RED = 0.2126;
export const PERCEPTIVE_FACTOR_GREEN = 0.7152;
export const PERCEPTIVE_FACTOR_BLUE = 0.0722;


// settings this to 2 will enable quicker, less accurate interpolation, 1 will switch to linear
const TO_LINEAR_POWER = 2.4
const TO_RGB_POWER = 1/TO_LINEAR_POWER

function gun_luminance(v)
{

    if (v <= LUM_THRESHOLD)
    {
        return v / 12.92
    }
    else
    {
        return Math.pow(((v + 0.055) / 1.055), 2.4);
    }
}



const colorRegExp = /^(#)?([0-9a-f]+)$/i;

function hex(n)
{
    const s = n.toString(16);

    return s.length === 1 ? "0" + s : s;
}

function hue2rgb(p, q, t){
    if(t < 0) t += 1;
    if(t > 1) t -= 1;
    if(t < 1/6) return p + (q - p) * 6 * t;
    if(t < 1/2) return q;
    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}

export function getLuminance(color)
{
    //const c = Color.validate(color);
    return PERCEPTIVE_FACTOR_RED * gun_luminance(color.r) + PERCEPTIVE_FACTOR_GREEN * gun_luminance(color.g) + PERCEPTIVE_FACTOR_BLUE * gun_luminance(color.b);
}


export default class Color
{
    r;
    g;
    b;

    constructor(r,g,b)
    {
        this.r = r;
        this.g = g;
        this.b = b;
    }

    mix(other, ratio, out)
    {
        if (!out)
        {
            out = new Color();
        }

        if (TO_LINEAR_POWER === 2)
        {
            // quick and dirty
            const r0 = this.r * this.r
            const g0 = this.g * this.g
            const b0 = this.b * this.b

            const r1 = other.r * other.r
            const g1 = other.g * other.g
            const b1 = other.b * other.b

            out.r = Math.sqrt(r0 + (r1 - r0) * ratio)|0;
            out.g = Math.sqrt(g0 + (g1 - g0) * ratio)|0;
            out.b = Math.sqrt(b0 + (b1 - b0) * ratio)|0;
        }
        else if (TO_LINEAR_POWER === 1)
        {
            // linear is bad, but still might be interesting artistically
            out.r = (this.r + (other.r - this.r) * ratio)|0;
            out.g = (this.g + (other.g - this.g) * ratio)|0;
            out.b = (this.b + (other.b - this.b) * ratio)|0;
        }
        else
        {
            const r0 = Math.pow(this.r, TO_LINEAR_POWER)
            const g0 = Math.pow(this.g, TO_LINEAR_POWER)
            const b0 = Math.pow(this.b, TO_LINEAR_POWER)

            const r1 = Math.pow(other.r, TO_LINEAR_POWER)
            const g1 = Math.pow(other.g, TO_LINEAR_POWER)
            const b1 = Math.pow(other.b, TO_LINEAR_POWER)


            out.r = Math.pow(r0 + (r1 - r0) * ratio, TO_RGB_POWER)|0;
            out.g = Math.pow(g0 + (g1 - g0) * ratio, TO_RGB_POWER)|0;
            out.b = Math.pow(b0 + (b1 - b0) * ratio, TO_RGB_POWER)|0;
        }
        return out;
    }

    multiply(n, out)
    {
        if (!out)
        {
            out = new Color();
        }

        out.r = this.r * n;
        out.g = this.g * n;
        out.b = this.b * n;
        return out;
    }

    scale(r, g, b, out)
    {
        if (!out)
        {
            out = new Color();
        }

        out.r = this.r * r;
        out.g = this.g * g;
        out.b = this.b * b;

        return out
    }

    set(r, g, b)
    {
        if (r instanceof Color)
        {
            this.r = r.r;
            this.g = r.g;
            this.b = r.b;

        }
        else
        {
            this.r = r;
            this.g = g;
            this.b = b;
        }
        return this;
    }

    toRGBHex()
    {
        return "#" + hex(this.r) + hex(this.g) + hex(this.b );
    }

    toRGBA(alpha)
    {
        return "rgba(" + (this.r) + "," + (this.g) + "," + (this.b ) + "," + alpha + ")";
    }

    toHex()
    {
        return (this.r << 16) + (this.g << 8) + this.b;
    }

    static validate(color)
    {

        let m;
        if (typeof color !== "string" || !(m = colorRegExp.exec(color)))
        {
            return null;
        }
        const col = m[2];

        if (col.length === 3)
        {
            return new Color(
                parseInt(col[0], 16) * 17,
                parseInt(col[1], 16) * 17,
                parseInt(col[2], 16) * 17
            )
        }
        else if (col.length === 6)
        {
            return new Color(
                parseInt(col.substring(0, 2), 16),
                parseInt(col.substring(2, 4), 16),
                parseInt(col.substring(4, 6), 16)
            )
        }
        else
        {
            return null;
        }
    }

    static from(color, factor = 1.0)
    {
        if (Array.isArray(color))
        {
            const length = color.length;
            const array = new Float32Array(length * 3);

            const f = factor/255;

            let off = 0;
            for (let i = 0; i < length; i++)
            {
                const col = Color.from(color[i]);
                array[off++] = col.r * f;
                array[off++] = col.g * f;
                array[off++] = col.b * f;
            }

            return array;
        }

        const col = Color.validate(color);

        if (!col)
        {
            throw new Error("Invalid color " + color);
        }

        col.r *= factor;
        col.g *= factor;
        col.b *= factor;

        return col;
    }

    static fromHSL(h,s,l)
    {
        let r, g, b;

        if(s <= 0){
            r = g = b = l; // achromatic
        }else{

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return new Color(
            Math.round(r * 255),
            Math.round(g * 255),
            Math.round(b * 255)
        );
    }
}

