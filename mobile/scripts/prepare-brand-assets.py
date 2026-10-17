"""Convert source brand images into Expo icon, splash, and in-app assets."""
from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
CURSOR_ASSETS = Path(
    r"C:\Users\rajes\.cursor\projects\c-Users-rajes-Documents-projects-New-TP-town-panchayat-management-system-v-15\assets"
)
SRC_LOGO = CURSOR_ASSETS / "c__Users_rajes_AppData_Roaming_Cursor_User_workspaceStorage_b924e25774642a7801248bfb2dfd63e9_images_logo-e64f0433-dd56-4b40-8562-06d7556dd083.png"
SRC_ICON = CURSOR_ASSETS / "c__Users_rajes_AppData_Roaming_Cursor_User_workspaceStorage_b924e25774642a7801248bfb2dfd63e9_images_icon-4eae57e8-3a28-4f47-84a1-656e6477bd9c.png"

# Matches BRAND_NAVY in src/theme/palettes.ts — one fill for launcher + headers.
NAVY = (26, 61, 102, 255)
HERO = (11, 18, 32, 255)


def flood_knockout(im: Image.Image, tol: int = 36) -> Image.Image:
    """Make near-white background transparent by flooding from the corners."""
    arr = np.array(im.convert("RGBA"), dtype=np.int16)
    h, w = arr.shape[:2]
    bg = arr[0, 0, :3]
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        q.append((x, y))
    while q:
        x, y = q.popleft()
        if visited[y, x]:
            continue
        visited[y, x] = True
        pix = arr[y, x, :3]
        if int(np.abs(pix - bg).max()) > tol:
            continue
        dist = float(np.abs(pix - bg).mean())
        arr[y, x, 3] = 0 if dist < tol * 0.55 else int(max(0, 255 * (dist / tol)))
        if x > 0 and not visited[y, x - 1]:
            q.append((x - 1, y))
        if x + 1 < w and not visited[y, x + 1]:
            q.append((x + 1, y))
        if y > 0 and not visited[y - 1, x]:
            q.append((x, y - 1))
        if y + 1 < h and not visited[y + 1, x]:
            q.append((x, y + 1))
    out = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(out)


def strip_navy_fill(im: Image.Image) -> Image.Image:
    """Remove the navy rounded-square fill so in-app tiles can use the theme color."""
    arr = np.array(im.convert("RGBA"))
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    navy = (b >= g) & (b > r + 12) & (r < 95) & (g < 135) & (b < 175)
    arr[navy, 3] = 0
    return Image.fromarray(arr)


def crop_to_artwork(im: Image.Image, pad: int = 8) -> Image.Image:
    """Drop the leftover rounded-rect rim; keep building, hills, and arc."""
    arr = np.array(im.convert("RGBA"))
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    green = (g > r + 15) & (g > b) & (g > 70)
    orange = (r > 180) & (g > 90) & (b < 90)
    keep = (a > 60) & (green | orange)
    ys, xs = np.where(keep)
    if xs.size == 0:
        return im
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width - 1, x1 + pad), min(im.height - 1, y1 + pad)
    cropped = im.crop((x0, y0, x1 + 1, y1 + 1))
    arr2 = np.array(cropped)
    h, w = arr2.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    margin = int(min(h, w) * 0.22)
    edge = (xx < margin) | (xx > w - 1 - margin) | (yy < margin) | (yy > h - 1 - margin)
    r2, g2, b2 = arr2[:, :, 0], arr2[:, :, 1], arr2[:, :, 2]
    light = (r2 > 130) & (g2 > 130) & (b2 > 130)
    arr2[edge & light, 3] = 0
    return Image.fromarray(arr2)


def crop_alpha(im: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > 8)
    if xs.size == 0:
        return im
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(im.width - 1, x1 + pad), min(im.height - 1, y1 + pad)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def fit_square(im: Image.Image, size: int, bg: tuple[int, int, int, int], scale: float = 1.0) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), bg)
    target = int(size * scale)
    fitted = ImageOps.contain(im, (target, target), Image.Resampling.LANCZOS)
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def to_monochrome(im: Image.Image, size: int) -> Image.Image:
    gray = np.array(ImageOps.grayscale(im.convert("RGB")))
    pixels = np.zeros((*gray.shape, 4), dtype=np.uint8)
    pixels[gray < 210] = [255, 255, 255, 255]
    return fit_square(Image.fromarray(pixels), size, (0, 0, 0, 0), scale=0.72)


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    logo = crop_alpha(flood_knockout(Image.open(SRC_LOGO)), pad=6)
    icon_full = crop_alpha(flood_knockout(Image.open(SRC_ICON), tol=42), pad=2)
    icon = crop_to_artwork(strip_navy_fill(icon_full), pad=18)

    logo_w = 1024
    logo_h = int(logo.height * (logo_w / logo.width))
    app_logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    app_logo.save(ASSETS / "app_logo.png", "PNG", optimize=True)

    # Launcher, splash, and header badge all share the same navy fill.
    splash = Image.new("RGBA", (1280, 1280), NAVY)
    splash_mark = ImageOps.contain(icon, (620, 620), Image.Resampling.LANCZOS)
    splash.alpha_composite(splash_mark, ((1280 - splash_mark.width) // 2, (1280 - splash_mark.height) // 2))
    splash.convert("RGB").save(ASSETS / "splash-icon.png", "PNG", optimize=True)

    fit_square(icon, 1024, NAVY, scale=0.78).convert("RGB").save(ASSETS / "icon.png", "PNG", optimize=True)

    app_icon = fit_square(icon, 512, (0, 0, 0, 0), scale=0.92)
    app_icon.save(ASSETS / "app_icon.png", "PNG", optimize=True)

    fit_square(icon, 1024, (0, 0, 0, 0), scale=0.72).save(ASSETS / "android-icon-foreground.png", "PNG", optimize=True)
    Image.new("RGB", (1024, 1024), NAVY[:3]).save(ASSETS / "android-icon-background.png", "PNG", optimize=True)
    to_monochrome(icon, 1024).save(ASSETS / "android-icon-monochrome.png", "PNG", optimize=True)

    fav = ImageOps.contain(icon, (40, 40), Image.Resampling.LANCZOS)
    fav_canvas = Image.new("RGBA", (48, 48), NAVY)
    fav_canvas.alpha_composite(fav, ((48 - fav.width) // 2, (48 - fav.height) // 2))
    fav_canvas.convert("RGB").save(ASSETS / "favicon.png", "PNG", optimize=True)

    print("Wrote transparent brand assets to", ASSETS)


if __name__ == "__main__":
    main()
