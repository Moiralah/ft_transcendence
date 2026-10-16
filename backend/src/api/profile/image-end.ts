// Where the image in `b` really ends, read from the format's own structure:
// PNG chunks up to IEND, JPEG segments up to EOI, GIF blocks up to the
// trailer, the RIFF size for WebP. null if the structure is broken.
// A decoder stops at that point and ignores the rest, which is where a
// payload appended to a real image hides; the upload is refused unless this
// equals the file's length.
export function imageEnd(b: Buffer, type: string): number | null {
	if (type === 'image/png') return pngEnd(b);
	if (type === 'image/jpeg') return jpegEnd(b);
	if (type === 'image/gif') return gifEnd(b);
	if (type === 'image/webp') return b.length >= 12 ? 8 + b.readUInt32LE(4) : null;
	return null;
}

// 8-byte signature, then chunks: 4-byte length, 4-byte type, data, 4-byte CRC.
function pngEnd(b: Buffer): number | null {
	let pos = 8;
	while (pos + 8 <= b.length) {
		const length = b.readUInt32BE(pos);
		const type = b.toString('latin1', pos + 4, pos + 8);
		pos += 12 + length;
		if (type === 'IEND') return pos;
	}
	return null;
}

// SOI, then marker segments (FF xx + 2-byte length). After SOS (FF DA) comes
// entropy-coded data, where FF only appears as FF 00 or a restart marker
// (FF D0-D7), so the next other FF xx is the next marker. EOI is FF D9.
// Progressive JPEGs have several SOS scans; the loop handles each.
function jpegEnd(b: Buffer): number | null {
	let pos = 2;
	while (pos + 1 < b.length) {
		if (b[pos] !== 0xff) return null;
		let marker = b[pos + 1];
		while (marker === 0xff && pos + 2 < b.length) marker = b[++pos + 1]; // fill bytes
		pos += 2;
		if (marker === 0xd9) return pos;
		if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue; // no length
		if (pos + 2 > b.length) return null;
		pos += b.readUInt16BE(pos);
		if (marker === 0xda) {
			while (pos + 1 < b.length && !(b[pos] === 0xff && b[pos + 1] !== 0x00 && !(b[pos + 1] >= 0xd0 && b[pos + 1] <= 0xd7))) pos++;
		}
	}
	return null;
}

// Header and screen descriptor (13 bytes), optional global colour table, then
// blocks: 0x21 extension, 0x2C image, 0x3B trailer. Extension and image data
// are sub-blocks: a length byte and that many bytes, ending with a 0 length.
function gifEnd(b: Buffer): number | null {
	if (b.length < 13) return null;
	let pos = 13;
	if (b[10] & 0x80) pos += 3 * (1 << ((b[10] & 7) + 1));
	const skipSubBlocks = () => {
		while (pos < b.length) {
			const n = b[pos];
			pos += 1 + n;
			if (n === 0) return true;
		}
		return false;
	};
	while (pos < b.length) {
		const block = b[pos];
		if (block === 0x3b) return pos + 1;
		if (block === 0x21) {
			pos += 2; // introducer + label
			if (!skipSubBlocks()) return null;
		} else if (block === 0x2c) {
			if (pos + 10 > b.length) return null;
			const flags = b[pos + 9];
			pos += 10;
			if (flags & 0x80) pos += 3 * (1 << ((flags & 7) + 1));
			pos += 1; // LZW minimum code size
			if (!skipSubBlocks()) return null;
		} else {
			return null;
		}
	}
	return null;
}
