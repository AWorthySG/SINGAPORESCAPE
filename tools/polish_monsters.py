"""Finish existing monster art offline, without moving any animation joints.

Usage: python3 tools/polish_monsters.py SOURCE_CREATURES DESTINATION_CREATURES
The source and destination directories should be separate so the finish can be
re-run from the original artwork. True repaints can be supplied separately.
"""

import argparse
from concurrent.futures import ProcessPoolExecutor
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


FALLBACKS = ('crab.png', 'fowl.png', 'serpent.png', 'spider.png')


def smoothstep(low, high, values):
    t = np.clip((values - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def finish(image, rig):
    rgba = np.array(image, dtype=np.uint8)
    alpha = rgba[..., 3]
    rgb = rgba[..., :3].astype(np.float32)
    solid = alpha >= 128
    # Give the filters a continuation of the artwork across the alpha edge.
    # Transparent RGB would otherwise put dark fringes around small details.
    nearest = ndi.distance_transform_edt(~solid, return_distances=False, return_indices=True)
    colour = rgb[tuple(nearest)]
    luma = colour @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    unit = max(image.size) / 256

    fine = ndi.gaussian_filter(luma, 0.85 * unit)
    coarse = ndi.gaussian_filter(luma, 2.65 * unit)
    accents = fine - coarse
    brushwork = ndi.gaussian_filter(np.abs(accents), 5 * unit)
    flat = 1 - smoothstep(2, 9, brushwork)

    # Dark ink defines the surfaces we light. Fade the treatment on already
    # painted areas and protect dark lines, white marks and glowing highlights.
    ink = luma < 61
    light_mask = ndi.binary_dilation(solid, iterations=max(1, round(4 * unit))) if rig else solid
    surface = light_mask & ~ink
    depth = ndi.distance_transform_edt(surface)
    relief = ndi.gaussian_filter(np.sqrt(depth / unit), 1.65 * unit)
    dy, dx = np.gradient(relief)
    facing_light = np.tanh((0.62 * dx + 0.78 * dy) * (4.6 * unit))
    paint = smoothstep(46, 100, luma) * (1 - 0.75 * smoothstep(212, 250, luma))
    if rig:
        # The open cut ends of rig parts meet other artwork when they move.
        # A restrained local light keeps those seams from getting a new rim.
        strength = 0.65
    else:
        strength = 1.0
    light = strength * paint * flat * facing_light
    highlight = np.maximum(light, 0)[..., None]
    shadow = np.maximum(-light, 0)[..., None]

    # Warm key light and cool bounce give solid colours volume. Enhance
    # brushwork on detailed paintings with a clamped mid-frequency pass.
    rgb += highlight * (255 - rgb) * np.array([0.39, 0.29, 0.22])
    rgb -= shadow * rgb * np.array([0.24, 0.27, 0.20])
    detail = np.clip(accents, -20, 20) * (0.30 + 0.24 * (1 - flat))
    rgb += (detail + (coarse - 118) * 0.035)[..., None]
    rgba[..., :3] = np.rint(np.clip(rgb, 0, 255)).astype(np.uint8)
    return Image.fromarray(rgba)


def polish(job):
    source, destination, relative = job
    original = source / relative
    target = destination / relative
    with Image.open(original) as image:
        result = finish(image.convert('RGBA'), 'rig' in relative.parts)

    target.parent.mkdir(parents=True, exist_ok=True)
    if original.suffix == '.png':
        result.save(target, optimize=True)
    else:
        # Use the original transfer size as a guide. Keep a quality floor so
        # simple source images can gain shading without crushing it back out.
        budget = int(original.stat().st_size * 0.99)
        for quality in (91, 88, 85, 82):
            encoded = BytesIO()
            result.save(encoded, 'WEBP', quality=quality, method=5, alpha_quality=100)
            if encoded.tell() <= budget:
                break
        target.write_bytes(encoded.getvalue())
    return original.stat().st_size, target.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--skip-species', nargs='*', default=[])
    parser.add_argument('--workers', type=int, default=4)
    args = parser.parse_args()
    if args.source.resolve() == args.destination.resolve():
        parser.error('Source and destination must be separate directories.')

    paths = [Path(name) for name in FALLBACKS]
    for group in ('species', 'bosses'):
        paths.extend(
            p.relative_to(args.source)
            for p in sorted((args.source / group).rglob('*.webp'))
            if group != 'species' or p.parent.name == 'rig' or p.stem not in args.skip_species
        )
    with ProcessPoolExecutor(args.workers) as pool:
        sizes = list(pool.map(polish, ((args.source, args.destination, p) for p in paths), chunksize=8))
    before, after = map(sum, zip(*sizes))
    print(f'Finished {len(paths)} sprites. {before:,} to {after:,} bytes.')


if __name__ == '__main__':
    main()
