// Ported from the phone app's SearchService — plain substring matching
// across name/category, case-insensitive. Desktop had no product search
// at all until now, which becomes a real problem the moment a shop has
// more than a handful of products.
const norm = (val) => (val || "").toString().toLowerCase();

export const searchService = {
  searchProducts(products, query) {
    if (!query || !query.trim()) return products;
    const q = norm(query);
    return products.filter(
      (p) =>
        norm(p.name).includes(q) ||
        norm(p.category).includes(q) ||
        norm(p.brand).includes(q),
    );
  },
};
