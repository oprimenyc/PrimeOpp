# Restock and Scarcity

`restock-engine` detects 11 restock kinds: first-restock,
repeated-restock, limited-release, seasonal-return,
discontinued-reappearance, regional-inventory, online-inventory,
store-inventory, back-in-stock, preorder-opening, waitlist-opening.

`rarity-engine` computes rarity from 9 dimensions: observation frequency,
stock duration, retailer count, regional concentration, demand proxy,
resale premium, release cadence, product lifecycle, community interest.

Scarcity is NEVER fabricated. `detectScarcityManipulation` flags
suspicious high rarity + low observation count + no resale premium.
