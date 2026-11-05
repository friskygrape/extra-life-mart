import Phaser from 'phaser';

type Ctx = CanvasRenderingContext2D;

const rect = (c: Ctx, color: string, x: number, y: number, w = 1, h = 1) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
  return tex;
}

function pixelRows(c: Ctx, rows: string[], palette: Record<string, string>) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (palette[ch]) rect(c, palette[ch], x, y);
    });
  });
}

function drawTiles(scene: Phaser.Scene) {
  canvasTexture(scene, 'floor', 16, 16, (c) => {
    rect(c, '#b97a4b', 0, 0, 16, 16);
    rect(c, '#a96b40', 0, 7, 16, 1);
    rect(c, '#a96b40', 0, 15, 16, 1);
    rect(c, '#a96b40', 5, 0, 1, 7);
    rect(c, '#a96b40', 12, 8, 1, 7);
    rect(c, '#c98a58', 8, 3, 3, 1);
    rect(c, '#c98a58', 2, 11, 4, 1);
  });
  canvasTexture(scene, 'floor2', 16, 16, (c) => {
    rect(c, '#6d6a86', 0, 0, 16, 16);
    rect(c, '#62607a', 0, 0, 8, 8);
    rect(c, '#62607a', 8, 8, 8, 8);
  });
  canvasTexture(scene, 'wall', 16, 16, (c) => {
    rect(c, '#3b3556', 0, 0, 16, 16);
    rect(c, '#4c456e', 0, 0, 16, 4);
    rect(c, '#5d5585', 0, 0, 16, 1);
    rect(c, '#332d4b', 0, 14, 16, 2);
    rect(c, '#2c2742', 7, 5, 1, 9);
  });
  canvasTexture(scene, 'door_inner', 16, 16, (c) => {
    rect(c, '#6d6a86', 0, 0, 16, 16);
    rect(c, '#4c456e', 0, 0, 2, 16);
    rect(c, '#4c456e', 14, 0, 2, 16);
    rect(c, '#5d5585', 0, 0, 16, 2);
  });
  canvasTexture(scene, 'door_entrance', 16, 16, (c) => {
    rect(c, '#3b3556', 0, 0, 16, 16);
    rect(c, '#8fd3e8', 2, 2, 12, 14);
    rect(c, '#c6ecf5', 3, 3, 3, 6);
    rect(c, '#e8e2d0', 7, 2, 2, 14);
    rect(c, '#f2b84b', 6, 8, 1, 2);
    rect(c, '#f2b84b', 9, 8, 1, 2);
  });
  canvasTexture(scene, 'shelf_food', 16, 16, (c) => {
    rect(c, '#6f4427', 0, 0, 16, 16);
    rect(c, '#8c5a34', 1, 1, 14, 14);
    rect(c, '#55331d', 1, 6, 14, 1);
    rect(c, '#55331d', 1, 13, 14, 2);
    rect(c, '#a4713f', 0, 0, 16, 1);
  });
  canvasTexture(scene, 'shelf_game', 16, 16, (c) => {
    rect(c, '#2b2a55', 0, 0, 16, 16);
    rect(c, '#403f7d', 1, 1, 14, 14);
    rect(c, '#232246', 1, 6, 14, 1);
    rect(c, '#232246', 1, 13, 14, 2);
    rect(c, '#e05a8a', 0, 0, 16, 1);
  });
  canvasTexture(scene, 'counter', 16, 16, (c) => {
    rect(c, '#7a2a33', 0, 0, 16, 16);
    rect(c, '#e8e2d0', 0, 0, 16, 5);
    rect(c, '#c9c2ac', 0, 4, 16, 1);
    rect(c, '#b0413e', 0, 5, 16, 8);
    rect(c, '#5c1f27', 0, 13, 16, 3);
  });
  canvasTexture(scene, 'register', 16, 16, (c) => {
    rect(c, '#7a2a33', 0, 0, 16, 16);
    rect(c, '#e8e2d0', 0, 0, 16, 5);
    rect(c, '#b0413e', 0, 5, 16, 8);
    rect(c, '#5c1f27', 0, 13, 16, 3);
    rect(c, '#2f3b4c', 2, 1, 12, 8);
    rect(c, '#46596f', 3, 2, 10, 2);
    rect(c, '#8df0a1', 4, 2, 8, 2);
    rect(c, '#c9c2ac', 3, 5, 2, 1);
    rect(c, '#c9c2ac', 7, 5, 2, 1);
    rect(c, '#c9c2ac', 11, 5, 2, 1);
    rect(c, '#c9c2ac', 3, 7, 2, 1);
    rect(c, '#c9c2ac', 7, 7, 2, 1);
    rect(c, '#f2b84b', 11, 7, 2, 1);
  });
  canvasTexture(scene, 'computer', 16, 16, (c) => {
    rect(c, '#6d6a86', 0, 0, 16, 16);
    rect(c, '#8c5a34', 0, 9, 16, 7);
    rect(c, '#6f4427', 0, 13, 16, 3);
    rect(c, '#d6cfb8', 2, 0, 12, 10);
    rect(c, '#223a35', 3, 1, 10, 7);
    rect(c, '#8df0a1', 4, 2, 5, 1);
    rect(c, '#8df0a1', 4, 4, 7, 1);
    rect(c, '#8df0a1', 4, 6, 3, 1);
    rect(c, '#b3ad98', 3, 10, 10, 2);
  });
  canvasTexture(scene, 'crate', 16, 16, (c) => {
    rect(c, '#6d6a86', 0, 0, 16, 16);
    rect(c, '#b98d55', 1, 2, 14, 13);
    rect(c, '#8f6a3b', 1, 2, 14, 1);
    rect(c, '#8f6a3b', 1, 14, 14, 1);
    rect(c, '#8f6a3b', 1, 2, 1, 13);
    rect(c, '#8f6a3b', 14, 2, 1, 13);
    rect(c, '#d9b47c', 6, 2, 4, 13);
  });
  canvasTexture(scene, 'marker', 16, 16, (c) => {
    const w = '#fff7d6';
    [[0, 0], [11, 0], [0, 11], [11, 11]].forEach(([x, y]) => {
      rect(c, w, x + (x ? 0 : 1), y + (y ? 3 : 1), 4, 1);
      rect(c, w, x + (x ? 3 : 1), y + (y ? 0 : 1), 1, 4);
    });
  });
}

const FOOD_ICONS: Record<string, { rows: string[]; palette: Record<string, string> }> = {
  chips: {
    rows: ['.rrrrrr.', '.yyyyyy.', '.rryyrr.', '.ryyyyr.', '.ryyyyr.', '.rryyrr.', '.yyyyyy.', '.rrrrrr.'],
    palette: { r: '#d9423c', y: '#f7cf4d' },
  },
  soda: {
    rows: ['..ssss..', '.bbbbbb.', '.bwwbbb.', '.bwbbbb.', '.bwwbbb.', '.bbbwbb.', '.bwwwbb.', '..ssss..'],
    palette: { s: '#c9d1d9', b: '#2f77c9', w: '#f0f4f8' },
  },
  choco: {
    rows: ['........', 'rrrrrrrr', 'ryyyyyyr', 'rrrrbdbd', 'rrrrdbdb', 'ryyyyyyr', 'rrrrrrrr', '........'],
    palette: { r: '#a72f5e', y: '#f2d27a', b: '#5e3620', d: '#7a4a2b' },
  },
  noodle: {
    rows: ['.yyyyyy.', 'wwwwwwww', '.rrrrrr.', '.wwwwww.', '.wrwwrw.', '.wwwwww.', '..rrrr..', '..wwww..'],
    palette: { y: '#f2d27a', w: '#f4efe2', r: '#d9423c' },
  },
  jerky: {
    rows: ['......dd', '.....dbd', '....dbd.', '...dbd..', '..dbd...', '.dbd....', 'dbd.....', 'dd......'],
    palette: { d: '#5a2d1a', b: '#a0562d' },
  },
  pie: {
    rows: ['........', '..cccc..', '.ctttct.', 'cttcttcc', 'cctttccc', 'bbbbbbbb', '.dddddd.', '........'],
    palette: { c: '#d9a55c', t: '#f0c988', b: '#a8743a', d: '#7a5228' },
  },
};

const GAME_COLOURS: Record<string, [string, string]> = {
  golf: ['#3ba55c', '#f7cf4d'],
  mops: ['#3f6fd1', '#c6ecf5'],
  chef: ['#3a3a4a', '#e8505b'],
  disco: ['#b24fd1', '#f7cf4d'],
  toad: ['#e0882f', '#8df0a1'],
  cave: ['#7a5c44', '#f4efe2'],
};

function drawIcons(scene: Phaser.Scene) {
  for (const [id, icon] of Object.entries(FOOD_ICONS)) {
    canvasTexture(scene, `item_${id}`, 8, 8, (c) => pixelRows(c, icon.rows, icon.palette));
  }
  for (const [id, [body, label]] of Object.entries(GAME_COLOURS)) {
    canvasTexture(scene, `item_${id}`, 8, 8, (c) => {
      rect(c, '#8a8fa3', 1, 0, 6, 8);
      rect(c, '#b6bbcc', 1, 0, 6, 1);
      rect(c, body, 2, 1, 4, 5);
      rect(c, label, 3, 2, 2, 2);
      rect(c, '#5a5e70', 2, 7, 4, 1);
    });
  }
}

interface CharacterPalette {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  apron?: string;
}

export const CUSTOMER_LOOKS = 6;

const CHARACTERS: Record<string, CharacterPalette> = {
  player: { skin: '#f0c6a0', hair: '#3a2a4d', shirt: '#2f9e9e', pants: '#2f3b4c', apron: '#f2b84b' },
  c0: { skin: '#d9a273', hair: '#22202c', shirt: '#d9423c', pants: '#34405c' },
  c1: { skin: '#8a5a3c', hair: '#1a1420', shirt: '#f2d27a', pants: '#4a3a5c' },
  c2: { skin: '#f0c6a0', hair: '#c9772f', shirt: '#6aa84f', pants: '#3c3c4c' },
  c3: { skin: '#c68a5e', hair: '#d9d6e0', shirt: '#7a5cc9', pants: '#5c4632' },
  c4: { skin: '#5e3a28', hair: '#8c2f5e', shirt: '#e8e2d0', pants: '#2f5c6e' },
  c5: { skin: '#f4d3b5', hair: '#e8c34f', shirt: '#e0628f', pants: '#2f3b4c' },
};

const DIRS = ['down', 'up', 'side'] as const;
export type CharDir = (typeof DIRS)[number];

function drawCharacter(c: Ctx, ox: number, p: CharacterPalette, dir: CharDir, step: number) {
  const r = (color: string, x: number, y: number, w = 1, h = 1) => rect(c, color, ox + x, y, w, h);
  const shoe = '#1e1a28';
  if (dir === 'side') {
    const front = step === 1 ? 1 : 0;
    const back = step === 2 ? 1 : 0;
    r(p.pants, 6, 13, 2, 2 - back);
    r(shoe, 6 - back, 15 - back, 3, 1);
    r(p.pants, 8, 13, 2, 2 - front);
    r(shoe, 8 + front, 15 - front, 3 - front, 1);
    r(p.shirt, 5, 8, 6, 5);
    if (p.apron) r(p.apron, 8, 9, 3, 4);
    r(p.shirt, 7, 9, 2, 3);
    r(p.skin, 7, 12, 2, 1);
    r(p.skin, 4, 2, 8, 6);
    r(p.hair, 4, 1, 8, 2);
    r(p.hair, 4, 3, 3, 3);
    r('#1e1a28', 10, 5);
    return;
  }
  const leftUp = step === 1 ? 1 : 0;
  const rightUp = step === 2 ? 1 : 0;
  r(p.pants, 5, 13, 2, 2 - leftUp);
  r(shoe, 5, 15 - leftUp, 2, 1);
  r(p.pants, 9, 13, 2, 2 - rightUp);
  r(shoe, 9, 15 - rightUp, 2, 1);
  r(p.shirt, 4, 8, 8, 5);
  r(p.shirt, 3, 8, 1, 4);
  r(p.shirt, 12, 8, 1, 4);
  r(p.skin, 3, 12);
  r(p.skin, 12, 12);
  r(p.skin, 4, 2, 8, 6);
  if (dir === 'down') {
    if (p.apron) r(p.apron, 5, 9, 6, 4);
    r(p.hair, 4, 1, 8, 2);
    r(p.hair, 4, 3, 1, 2);
    r(p.hair, 11, 3, 1, 2);
    r('#1e1a28', 6, 5);
    r('#1e1a28', 9, 5);
  } else {
    if (p.apron) r(p.apron, 7, 8, 2, 1);
    r(p.hair, 4, 1, 8, 6);
  }
}

function drawCharacters(scene: Phaser.Scene) {
  for (const [name, palette] of Object.entries(CHARACTERS)) {
    const tex = canvasTexture(scene, `char_${name}`, 16 * 9, 16, (c) => {
      DIRS.forEach((dir, d) => {
        for (let step = 0; step < 3; step++) drawCharacter(c, (d * 3 + step) * 16, palette, dir, step);
      });
    });
    DIRS.forEach((dir, d) => {
      for (let step = 0; step < 3; step++) tex.add(`${dir}${step}`, 0, (d * 3 + step) * 16, 0, 16, 16);
    });
  }
}

export function createTextures(scene: Phaser.Scene): void {
  drawTiles(scene);
  drawIcons(scene);
  drawCharacters(scene);
}
