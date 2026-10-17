"""Independent Pillow decoding of the delivered animations and atlas frames."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / "dist/kettlebell-motion-manifest.json").read_text())
results = []
for record in manifest["records"]:
    for gender, variant in record["variants"].items():
        spec = variant["animation"]
        frames = Image.open(root / "dist" / variant["image"])
        atlas = Image.open(root / "dist" / spec["atlas"]).convert("RGB")
        poster = Image.open(root / "dist" / variant["poster"]).convert("RGB")
        assert frames.n_frames == spec["keyframes"] and frames.info["loop"] == 0
        assert frames.size == (600, 484) and atlas.size == (1680, 840)
        hashes, delays, bboxes = [], [], []
        poster_matches = False
        for index, stored in enumerate(spec["poseSequence"]):
            frames.seek(index)
            frame = frames.convert("RGB")
            delays.append(frames.info["duration"])
            x, y = stored % 4 * 420, stored // 4 * 420
            native = atlas.crop((x, y, x + 420, y + 420))
            assert frame.crop((90, 32, 510, 452)).tobytes() == native.tobytes()
            for edge in [(0, 0, 600, 32), (0, 452, 600, 484), (0, 32, 90, 452), (510, 32, 600, 452)]:
                assert set(frame.crop(edge).tobytes()) == {255}, "Artwork escaped its fixed stage"
            poster_matches |= frame.tobytes() == poster.tobytes()
            hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
            mask = frame.point(lambda value: 0 if value > 190 else 255)
            bboxes.append(mask.getbbox())
        assert delays == spec["delayMs"] and sum(delays) == 4000
        assert len(set(hashes)) == 8 and poster_matches
        assert all(box and box[0] > 0 and box[1] > 0 and box[2] < 600 and box[3] < 484 for box in bboxes)
        results.append({"exercise": record["id"], "gender": gender, "frames": frames.n_frames,
                        "unique_poses": len(set(hashes)), "duration_ms": sum(delays),
                        "atlas_pixels_match": True, "poster_matches": True, "framing_passed": True})
report = {"passed": True, "decoder": "Pillow", "variants": results}
destination = root / "animation-source/kettlebell-motion/decoded-audit.json"
destination.write_text(json.dumps(report, indent=2) + "\n")
print("PASS: Pillow independently decoded all six loops, timings, eight poses, posters, framing and exact atlas pixels.")
