export function clamp(v, max = 1)
{
    return v < 0 ? 0 : v > max ? max : v;
}


export function rndFromArray(a)
{
    return a[0|Math.random() * a.length]
}

