"""Extract native sprite cells without discarding or clamping pose pixels."""
from PIL import Image
import numpy as np

def cells(path):
    sheet = Image.open(path).convert('RGB')
    w, h = sheet.size
    assert w % 3 == 0 and h % 2 == 0, (path, sheet.size)
    frames = []
    for index in range(6):
        x, y = index % 3 * w // 3, index // 3 * h // 2
        cell = sheet.crop((x, y, x + w // 3, y + h // 2))
        # Use one fixed scale for the whole sheet. Keep the complete source cell;
        # shifting/clamping rows to align feet can truncate heads and equipment.
        art = cell.resize((432, 432), Image.Resampling.LANCZOS)
        pixels = np.asarray(cell)
        corners = np.concatenate([pixels[3:15,3:15].reshape(-1,3),pixels[3:15,-15:-3].reshape(-1,3),pixels[-15:-3,3:15].reshape(-1,3),pixels[-15:-3,-15:-3].reshape(-1,3)])
        background = tuple(np.median(corners, axis=0).astype(int))
        frame = Image.new('RGB', (512, 512), background)
        frame.paste(art, (40, 40))
        frames.append(frame)
    return frames
