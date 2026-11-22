import {bounds, roadRecords, trianonPolygons} from './geography.js';

const palette = {
  background: '#102428',
  minorRoad: '#365158',
  majorRoad: '#6b8588',
  avenue: '#a6b8b4',
  park: '#254b3d',
  coverage: '#6ec2ab',
  ink: '#e7eeea',
  muted: '#8ba4a7',
  marker: '#b6ded2',
  target: '#f2c478',
};

const cardinals = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const kilometers = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 1});

export function navigationInfo(position, target) {
  if (!position || !target) return null;
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  if (!Number.isFinite(dx) || !Number.isFinite(dz)) return null;
  const distance = Math.hypot(dx, dz);
  const angle = distance ? Math.atan2(dx, -dz) : 0;
  const bearing = (Math.round(angle * 180 / Math.PI) + 360) % 360;
  return {
    distance,
    distanceLabel: distance < 1000 ? `${Math.round(distance)} m` : `${kilometers.format(distance / 1000)} km`,
    angle,
    bearing,
    cardinal: cardinals[Math.round(bearing / 45) % 8],
  };
}

const roadStyles = ['minorRoad', 'majorRoad', 'avenue', 'tunnel'];
const roadsByStyle = new Map(roadStyles.map(style => [style, []]));
for (const road of roadRecords) {
  const style = road.tunnel || road.layer < 0 ? 'tunnel' : road.name === 'Avenida Paulista' ? 'avenue' :
    ['primary', 'secondary', 'tertiary'].includes(road.kind) ? 'majorRoad' : 'minorRoad';
  const box = {minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity};
  for (const [x, z] of road.points) {
    box.minX = Math.min(box.minX, x);
    box.maxX = Math.max(box.maxX, x);
    box.minZ = Math.min(box.minZ, z);
    box.maxZ = Math.max(box.maxZ, z);
  }
  roadsByStyle.get(style).push({points: road.points, box});
}

export function mapIncludes(coverage, {x, z}) {
  return !coverage || (x >= coverage.minX && x <= coverage.maxX && z >= coverage.minZ && z <= coverage.maxZ);
}

function getView(width, height, mode, position, coverage) {
  if (mode === 'mini') return {scale: .40, centerX: position.x, centerZ: position.z};
  const extent = mode === 'local' && coverage ? coverage : bounds;
  const pad = mode === 'local' ? 68 : 200;
  return {
    scale: Math.min(width / (extent.maxX - extent.minX + pad * 2), height / (extent.maxZ - extent.minZ + pad * 2)),
    centerX: (extent.minX + extent.maxX) / 2,
    centerZ: (extent.minZ + extent.maxZ) / 2,
  };
}

function drawArrow(ctx, x, y, angle, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * .64, size * .65);
  ctx.lineTo(0, size * .32);
  ctx.lineTo(-size * .64, size * .65);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = palette.background;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

function drawDiamond(ctx, x, y, size, color, filled) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = palette.background;
  } else {
    ctx.strokeStyle = color;
  }
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawScale(ctx, width, height, scale, isMini, unit) {
  const meters = [1000, 500, 250, 100, 50].find(value => value * scale < (isMini ? 62 : 116) * unit) ?? 25;
  const start = width - meters * scale - 12 * unit;
  const end = width - 12 * unit;
  const y = isMini ? 30 * unit : height - 27 * unit;
  ctx.font = `500 ${10 * unit}px system-ui`;
  ctx.strokeStyle = palette.ink;
  ctx.fillStyle = palette.ink;
  ctx.lineWidth = unit;
  ctx.beginPath();
  ctx.moveTo(start, y - 2 * unit);
  ctx.lineTo(start, y + 2 * unit);
  ctx.lineTo(end, y + 2 * unit);
  ctx.lineTo(end, y - 2 * unit);
  ctx.stroke();
  ctx.fillText(meters === 1000 ? '1 km' : `${meters} m`, start, y - 4 * unit);
}

const overviewLabels = new Set(['masp', 'republica', 'luz', 'ibira', 'se', 'casa']);

export function drawNavigationMap(canvas, {position, yaw, waypoint, destinations = [], coverage, coverages, mode = 'mini', space = 'world'}) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !position) return;
  const {width, height} = canvas;
  const isMini = mode === 'mini';
  const regions = mode === 'atlas' ? coverages ?? (coverage ? [coverage] : []) : coverage ? [coverage] : [];
  const clientScale = Math.min((canvas.clientWidth || width) / width, (canvas.clientHeight || height) / height);
  const unit = Math.min(2.9, Math.max(1, 1 / clientScale));
  const {scale, centerX, centerZ} = getView(width, height, mode, position, coverage);
  const project = (x, z) => [width / 2 + (x - centerX) * scale, height / 2 + (z - centerZ) * scale];
  const visibleBounds = {
    minX: centerX - width / (2 * scale), maxX: centerX + width / (2 * scale),
    minZ: centerZ - height / (2 * scale), maxZ: centerZ + height / (2 * scale),
  };
  const intersects = (box) => box.maxX >= visibleBounds.minX && box.minX <= visibleBounds.maxX &&
    box.maxZ >= visibleBounds.minZ && box.minZ <= visibleBounds.maxZ;

  ctx.save();
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (!isMini) {
    ctx.fillStyle = '#1d393b';
    for (const region of regions) {
      const [x, y] = project(region.minX, region.minZ);
      ctx.fillRect(x, y, (region.maxX - region.minX) * scale, (region.maxZ - region.minZ) * scale);
    }
  }

  ctx.fillStyle = palette.park;
  for (const polygon of trianonPolygons) {
    ctx.beginPath();
    polygon.forEach(([x, z], index) => ctx[index ? 'lineTo' : 'moveTo'](...project(x, z)));
    ctx.closePath();
    ctx.fill();
  }

  for (const style of roadStyles) {
    if (style === 'tunnel' && space !== 'tunnel') continue;
    ctx.beginPath();
    for (const road of roadsByStyle.get(style)) {
      if (!intersects(road.box)) continue;
      road.points.forEach(([x, z], index) => ctx[index ? 'lineTo' : 'moveTo'](...project(x, z)));
    }
    ctx.lineWidth = style === 'minorRoad' ? .85 : style === 'majorRoad' ? 1.55 : 2.35;
    if (mode === 'atlas') ctx.lineWidth *= .75;
    ctx.strokeStyle = style === 'tunnel' ? palette.coverage : palette[style];
    if (style === 'tunnel') ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const region of regions) {
    const [x, y] = project(region.minX, region.minZ);
    ctx.strokeStyle = palette.coverage;
    ctx.lineWidth = isMini ? 1.15 : 1.5 * unit;
    ctx.setLineDash([5 * unit, 4 * unit]);
    ctx.strokeRect(x, y, (region.maxX - region.minX) * scale, (region.maxZ - region.minZ) * scale);
    ctx.setLineDash([]);
  }

  const [playerX, playerY] = project(position.x, position.z);
  const guidance = navigationInfo(position, waypoint);
  const waypointOnMap = guidance ? project(waypoint.x, waypoint.z) : null;
  if (waypointOnMap) {
    ctx.beginPath();
    ctx.moveTo(playerX, playerY);
    ctx.lineTo(...waypointOnMap);
    ctx.lineWidth = 1.5 * unit;
    ctx.setLineDash([4 * unit, 4 * unit]);
    ctx.strokeStyle = palette.target;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const labelBoxes = [];
  const label = (name, x, y, color) => {
    const fontSize = (isMini ? 9 : 13) * unit;
    const widthLimit = (isMini ? 125 : 230) * unit;
    ctx.font = `600 ${fontSize}px system-ui`;
    const labelWidth = Math.min(ctx.measureText(name).width, widthLimit);
    const left = x + labelWidth + 14 * unit > width ? x - labelWidth - 9 * unit : x + 9 * unit;
    const top = y - fontSize - 6 * unit;
    const box = {left, right: left + labelWidth, top, bottom: top + fontSize + 3 * unit};
    const reservedBottom = height - (isMini ? 48 : 32) * unit;
    const reservedTop = (mode === 'atlas' ? 68 : 46) * unit;
    if (left < 7 || top < reservedTop || box.bottom > reservedBottom ||
      labelBoxes.some(other => box.left < other.right + 6 && box.right > other.left - 6 && box.top < other.bottom + 4 && box.bottom > other.top - 4)) return;
    labelBoxes.push(box);
    ctx.lineWidth = 3.5 * unit;
    ctx.strokeStyle = palette.background;
    ctx.strokeText(name, left, y - 6 * unit, widthLimit);
    ctx.fillStyle = color;
    ctx.fillText(name, left, y - 6 * unit, widthLimit);
  };

  if (waypointOnMap && !isMini && mapIncludes(visibleBounds, waypoint)) {
    label(waypoint.mapName || waypoint.name || 'Destino', ...waypointOnMap, palette.target);
  }

  for (const destination of destinations) {
    if (!mapIncludes(visibleBounds, destination)) continue;
    const [x, y] = project(destination.x, destination.z);
    const playable = destination.playable ?? mapIncludes(coverage, destination);
    const color = playable ? palette.marker : palette.muted;
    drawDiamond(ctx, x, y, (isMini ? 3 : 4) * unit, color, playable);
    if (mode === 'local' || (mode === 'atlas' && overviewLabels.has(destination.id))) label(destination.mapName || destination.name, x, y, color);
  }

  if (waypointOnMap) {
    const [x, y] = waypointOnMap;
    const inside = x >= 14 * unit && x <= width - 14 * unit && y >= 14 * unit && y <= height - 14 * unit;
    if (inside) {
      drawDiamond(ctx, x, y, 6.5 * unit, palette.target, true);
    } else if (isMini) {
      const dx = x - playerX;
      const dy = y - playerY;
      const factor = Math.min((width / 2 - 16 * unit) / (Math.abs(dx) || Infinity), (height / 2 - 38 * unit) / (Math.abs(dy) || Infinity));
      if (Number.isFinite(factor) && factor > 0) drawArrow(ctx, playerX + dx * factor, playerY + dy * factor, guidance.angle, 8 * unit, palette.target);
    }
  }

  if (mapIncludes(visibleBounds, position)) {
    ctx.beginPath();
    ctx.arc(playerX, playerY, 9 * unit, 0, Math.PI * 2);
    ctx.fillStyle = '#e7eeea26';
    ctx.fill();
    drawArrow(ctx, playerX, playerY, Number.isFinite(yaw) ? -yaw : 0, 7.5 * unit, palette.ink);
  }

  ctx.fillStyle = palette.ink;
  ctx.font = `700 ${11 * unit}px system-ui`;
  ctx.fillText('N', 13 * unit, 21 * unit);
  drawArrow(ctx, 27 * unit, 17 * unit, 0, 5.5 * unit, palette.ink);
  drawScale(ctx, width, height, scale, isMini, unit);

  if (!isMini && regions.length) {
    ctx.font = `600 ${12 * unit}px system-ui`;
    ctx.lineWidth = 5 * unit;
    ctx.strokeStyle = palette.background;
    ctx.fillStyle = palette.coverage;
    ctx.strokeText('—  Área jogável', 14 * unit, 42 * unit);
    ctx.fillText('—  Área jogável', 14 * unit, 42 * unit);
    if (mode === 'atlas') {
      ctx.fillStyle = palette.muted;
      ctx.strokeText('◇  Ponto de referência', 14 * unit, 60 * unit);
      ctx.fillText('◇  Ponto de referência', 14 * unit, 60 * unit);
    }
  }

  if (isMini && guidance) {
    const text = `${guidance.distanceLabel} · ${guidance.cardinal}`;
    ctx.font = `700 ${11 * unit}px system-ui`;
    const textWidth = ctx.measureText(text).width;
    const x = width - 10 * unit - textWidth;
    const y = height - 11 * unit;
    ctx.fillStyle = '#102428df';
    ctx.fillRect(x - 5 * unit, y - 12 * unit, textWidth + 9 * unit, 16 * unit);
    ctx.fillStyle = palette.target;
    ctx.fillText(text, x, y);
  }

  if (!isMini) {
    ctx.fillStyle = palette.ink;
    ctx.font = `500 ${10 * unit}px system-ui`;
    ctx.fillText('© OpenStreetMap', 14 * unit, height - 12 * unit);
  }
  ctx.restore();
}
