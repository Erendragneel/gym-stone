# Female anime exercise character

Artwork is generated using the built-in image generator. The canonical adult athlete has medium tan skin, dark hair in a high ponytail, a red athletic tank, charcoal shorts and red sneakers. `character-prompt.txt` records the exact identity/reference prompt. The existing male examples and stable exercise IDs are preserved.

Each exercise uses the canonical identity and its original male movement sheet as visual references. Exact generation prompts are saved in `prompts`, selected six-pose artwork in `sheets`, and playback corrections in `qa`. Animation assembly extracts the cells, aligns studio framing, reuses the source form caption, and encodes a 5.2-second instructional loop with endpoint pauses. It does not draw replacement character artwork. The app serves animated WebP assets; GIF exports are retained in the separate downloadable library.

The renderer supports an ascent/return sequence, a deliberate alternating cycle, or a selected clean subset when original reference frames contain a repeated motion or camera change. Every exported file is decoded and checked for multiple frames, distinct image content and infinite looping. These are anime pose illustrations with transitions, not recorded exercise demonstrations.

The profile gender determines both the exercise cards and enlarged preview. A missing female asset is never substituted with a male example. Complete female coverage is required before publishing the gender feature.
