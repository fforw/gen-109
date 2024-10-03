export function clamp(v)
{
    return v < 0 ? 0 : v > 1 ? 1 : v;
}


export function rndFromArray(a)
{
    return a[0|Math.random() * a.length]
}

