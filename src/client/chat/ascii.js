// ASCII 艺术字
const ASCII_FONT = {
  A: [".##.", "#..#", "####", "#..#", "#..#"],
  B: ["###.", "#..#", "###.", "#..#", "###."],
  C: [".##.", "#..#", "#...", "#..#", ".##."],
  D: ["###.", "#..#", "#..#", "#..#", "###."],
  E: ["####", "#...", "###.", "#...", "####"],
  F: ["####", "#...", "###.", "#...", "#..."],
  G: [".##.", "#...", "#.##", "#..#", ".##."],
  H: ["#..#", "#..#", "####", "#..#", "#..#"],
  I: ["#####", "..#..", "..#..", "..#..", "#####"],
  J: ["..##.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#..#", "#.#.", "##..", "#.#.", "#..#"],
  L: ["#...", "#...", "#...", "#...", "####"],
  M: ["#..#", "##.#", "#.##", "#..#", "#..#"],
  N: ["#..#", "##.#", "#.##", "#.##", "#..#"],
  O: [".##.", "#..#", "#..#", "#..#", ".##."],
  P: ["###.", "#..#", "###.", "#...", "#..."],
  Q: [".##.", "#..#", "#..#", "#.##", ".##."],
  R: ["###.", "#..#", "###.", "#.#.", "#..#"],
  S: [".##.", "#...", ".##.", "...#", ".##."],
  T: ["#####", "..#..", "..#..", "..#..", "..#.."],
  U: ["#..#", "#..#", "#..#", "#..#", ".##."],
  V: ["#..#", "#..#", "#..#", ".#.#", "..#.."],
  W: ["#..#", "#..#", "#.##", "##.#", "#..#"],
  X: ["#..#", ".#.#", "..#..", ".#.#", "#..#"],
  Y: ["#..#", ".#.#", "..#..", "..#..", "..#.."],
  Z: ["####", "...#", "..#..", ".#...", "####"],
  "0": [".##.", "#..#", "#..#", "#..#", ".##."],
  "1": ["..#.", ".##.", "..#.", "..#.", "####"],
  "2": [".##.", "#..#", "...#", ".#..", "####"],
  "3": [".##.", "#..#", "..##", "#..#", ".##."],
  "4": ["...#", "..#.", ".#.#", "####", "...#"],
  "5": ["####", "#...", "###.", "...#", "###."],
  "6": [".##.", "#...", "###.", "#..#", ".##."],
  "7": ["####", "...#", "..#.", ".#..", ".#.."],
  "8": [".##.", "#..#", ".##.", "#..#", ".##."],
  "9": [".##.", "#..#", ".###", "...#", ".##."],
  "?": [".##.", "#..#", "..#.", "....", "..#."],
  "!": ["..#.", "..#.", "..#.", "....", "..#."],
  ".": ["....", "....", "....", "....", "..#."],
  " ": [".....", ".....", ".....", ".....", "....."],
};
const ASCII_UNKNOWN_CHAR = ["#####", "#   #", "# # #", "#   #", "#####"];

export function generateAsciiArt(text) {
  let unknown = [];
  let lines = ['', '', '', '', ''];
  for (let ch of text) {
    let upper = ch.toUpperCase();
    let letter = ASCII_FONT[upper];
    if (!letter) letter = ASCII_FONT[ch];
    if (!letter) { letter = ASCII_UNKNOWN_CHAR; unknown.push(ch); }
    for (let i = 0; i < 5; i++) {
      lines[i] += (letter[i] || ASCII_UNKNOWN_CHAR[i]) + '  ';
    }
  }
  let result = lines.map(l => l.replace(/\./g, ' ')).join('\n');
  return { art: result, unknown };
}

export function renderTextToAsciiCanvas(text) {
  const GRID_W = 20, GRID_H = 20, GAP = 2;
  const FONT_SIZE = 200;
  const FONT = `bold ${FONT_SIZE}px "Microsoft YaHei", "PingFang SC", "Noto Sans SC", "SimHei", "Heiti SC", sans-serif`;
  const chars = ' .:-=+*#%@';
  let grids = [];
  for (let ch of text) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = FONT;
    const textW = ctx.measureText(ch).width;
    const minW = FONT_SIZE * 0.7;
    canvas.width = Math.ceil(Math.max(textW, minW));
    canvas.height = Math.ceil(FONT_SIZE * 1.15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(ch, canvas.width / 2, canvas.height / 2);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const totalPixels = canvas.width * canvas.height;
    let charGrid = [];
    for (let row = 0; row < GRID_H; row++) {
      let line = '';
      for (let col = 0; col < GRID_W; col++) {
        const xStart = Math.floor(col * canvas.width / GRID_W);
        const xEnd = Math.floor((col + 1) * canvas.width / GRID_W);
        const yStart = Math.floor(row * canvas.height / GRID_H);
        const yEnd = Math.floor((row + 1) * canvas.height / GRID_H);
        let totalBright = 0;
        let count = 0;
        for (let py = yStart; py < yEnd; py++) {
          for (let px = xStart; px < xEnd; px++) {
            const idx = (py * canvas.width + px) * 4;
            if (idx < 0 || idx + 2 >= totalPixels * 4) continue;
            const b = (pixels[idx] * 0.299 + pixels[idx+1] * 0.587 + pixels[idx+2] * 0.114) / 255;
            totalBright += b;
            count++;
          }
        }
        const avgBright = count > 0 ? totalBright / count : 1;
        const ci = Math.floor((1 - avgBright) * (chars.length - 1));
        line += chars[Math.max(0, Math.min(ci, chars.length - 1))];
      }
      charGrid.push(line);
    }
    grids.push(charGrid);
  }
  let result = grids[0].map((_, row) =>
    grids.map(g => g[row]).join(' '.repeat(GAP))
  ).join('\n');
  return result.replace(/\n[ \n]+$/, '');
}
