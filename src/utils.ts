export function formatThousands(x: number): string {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function getUrlParam(url: string, param: string): string | null {
    let params = new URLSearchParams(url)
    return params.get(param)
}

function hashCode(str: string): number { // java String#hashCode
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

function intToRGB(i: number, opacity: number): string {
    var c = (i & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();

    return "#00000".substring(0, 7 - c.length) + c + opacity.toString().padStart(2, "0");
}

export function hashStringToRgb(val: string, opacity: number): string {
    return intToRGB(hashCode(val), opacity)
}