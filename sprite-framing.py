"""Extract native sprite cells without discarding or clamping pose pixels."""
from PIL import Image
import numpy as np

def cells(path):
    sheet = Image.open(path).convert('RGB')
    w, h = sheet.size
    assert abs(w / h - 1.5) < 0.02, (path, sheet.size)
    frames = []
    for index in range(6):
        column, row = index % 3, index // 3
        # A generated sheet may differ by one pixel from the requested size.
        # Rounded shared boundaries retain every pixel without losing an edge.
        cell = sheet.crop((round(column*w/3), round(row*h/2),
                           round((column+1)*w/3), round((row+1)*h/2)))
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
