```markdown
# Dungeon Toolkit — Multi-page Edition

What I changed:
- Split functionality into three separate pages: map.html (map builder), npcs.html (NPC generator), room.html (room descriptor).
- Map builder now supports doors (place manually or auto-place where corridors meet rooms) and secret passage endpoints that can be toggled/revealed. Exports include doors, secret endpoints and pro[...]
- NPC generator supports tags. You can add custom tags, attach tags to NPCs, filter the generated list by tags, and export NPC JSON.
- Room descriptor supports tag-driven templates (dungeon, tavern, temple, library, etc.). You can toggle tags to bias the description, add props and NPC hints, generate short/medium/long descriptio[...]

Files added/updated:
- index.html — landing page linking to the three tools
- styles.css — shared styles
- map.html + map.js — map builder with doors and secret passages
- npcs.html + npc.js — taggable NPC generator
- room.html + room.js — tag-driven room descriptor
- shared.js — small utility library
- README.md, LICENSE

How to use:
- Open index.html locally or publish this repo to GitHub Pages.
- Click "Map Builder" to generate a map. Use the Edit Mode buttons to place doors or secret endpoints. Toggle "Reveal secrets" to visualize secret endpoints.
- Click "NPC Generator" to make tagged NPCs, add custom tags, and filter by tags.
- Click "Room Descriptor" to generate tag-influenced descriptions (useful for dungeon masters or writers).

Notes:
- Everything is client-side and static (works with GitHub Pages).
- Exports are available as JSON/TXT for reuse.

License: MIT
```