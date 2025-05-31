export function formatThousands(x: number): string {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function getUrlParam(url: string, param: string): string | null {
    let params = new URLSearchParams(url)
    return params.get(param)
}

export function hashStringToRgb(val: string, opacity: number): string {
    return stringToRGBMD5(val, opacity)
}


function md5Like(str: string) {
    // MD5 constants
    const K = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
    ];

    const S = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];

    // Helper functions
    function leftRotate(value: any, amount: any) {
        return (value << amount) | (value >>> (32 - amount));
    }

    function addUnsigned(x: number, y: number): number {
        return ((x & 0x7FFFFFFF) + (y & 0x7FFFFFFF)) ^ (x & 0x80000000) ^ (y & 0x80000000);
    }

    // Convert string to array of 32-bit words
    function stringToWords(str: string): number[] {
        const words = [];
        const len = str.length;

        // Pad string
        str += '\x80';
        while ((str.length % 64) !== 56) {
            str += '\x00';
        }

        // Append length
        const bitLen = len * 8;
        str += String.fromCharCode(bitLen & 0xFF);
        str += String.fromCharCode((bitLen >>> 8) & 0xFF);
        str += String.fromCharCode((bitLen >>> 16) & 0xFF);
        str += String.fromCharCode((bitLen >>> 24) & 0xFF);
        str += '\x00\x00\x00\x00';

        // Convert to 32-bit words
        for (let i = 0; i < str.length; i += 4) {
            words.push(
                (str.charCodeAt(i) & 0xFF) |
                ((str.charCodeAt(i + 1) & 0xFF) << 8) |
                ((str.charCodeAt(i + 2) & 0xFF) << 16) |
                ((str.charCodeAt(i + 3) & 0xFF) << 24)
            );
        }

        return words;
    }

    // Initialize hash values
    let h0 = 0x67452301;
    let h1 = 0xEFCDAB89;
    let h2 = 0x98BADCFE;
    let h3 = 0x10325476;

    const words = stringToWords(str);

    // Process message in 512-bit blocks
    for (let offset = 0; offset < words.length; offset += 16) {
        let a = h0, b = h1, c = h2, d = h3;

        for (let i = 0; i < 64; i++) {
            let f, g;

            if (i < 16) {
                f = (b & c) | (~b & d);
                g = i;
            } else if (i < 32) {
                f = (d & b) | (~d & c);
                g = (5 * i + 1) % 16;
            } else if (i < 48) {
                f = b ^ c ^ d;
                g = (3 * i + 5) % 16;
            } else {
                f = c ^ (b | ~d);
                g = (7 * i) % 16;
            }

            const temp = d;
            d = c;
            c = b;
            const x = addUnsigned(addUnsigned(a, f), addUnsigned(K[i], words[offset + g]));
            b = addUnsigned(b, leftRotate(x, S[i]));
            a = temp;
        }

        h0 = addUnsigned(h0, a);
        h1 = addUnsigned(h1, b);
        h2 = addUnsigned(h2, c);
        h3 = addUnsigned(h3, d);
    }

    return [h0, h1, h2, h3];
}

// Convert MD5-like hash to RGB
function stringToRGBMD5(str: string, opacity: number): string {
    const hash = md5Like(str);

    // Use first 3 bytes of hash for RGB
    const r = (hash[0] >>> 0) & 0xFF;
    const g = (hash[0] >>> 8) & 0xFF;
    const b = (hash[0] >>> 16) & 0xFF;

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}` + opacity.toString().padStart(2, "0")
}