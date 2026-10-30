# Camp map roads (developers only)

The camp map's roads are traced from `site-layout-original.png` (the aerial site layout).

1. `python trace.py`: finds the red dirt roads in the picture and traces their centre lines (`auto_roads.json`)
2. `python compose.py`: joins gaps hidden under trees, adds the perimeter road (fence sits just outside it) and the hand fixes in `manual.json`; writes `final_overlay.png` to check against the picture
3. `python export.py ../../assets/js/campmap-data.js`: writes the map data and works out the game drive route (reception, out the north gate onto Kaallaagte Road)

Add or fix a road: add its points (picture pixels) to `manual.json` under `"add"`, then run steps 2 and 3.
Stand positions are not here: they are in `content/stands.md` (left %, top % of the same picture).
