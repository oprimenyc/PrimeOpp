// This file holds all our product data
// Think of it like a mini database stored right in the code!

// A color variant — one color option for a product with its own price
export interface ColorVariant {
  name: string;  // e.g. "Red", "Black", "Navy Blue"
  hex: string;   // The actual color code, e.g. "#FF0000" — used to draw the swatch circle
  price: number; // This color costs this much (can be different from the base price)
}

// Define what a Product looks like using TypeScript
export interface Product {
  id: number;
  name: string;
  price: number;       // The base/default price (used when no color is selected)
  image: string;
  description: string;
  colors?: ColorVariant[]; // Optional! If you add colors, customers can pick one
}

// Our default list of t-shirt products
export const products: Product[] = [
  {
    id: 1,
    name: "Classic White Tee",
    price: 24.99,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    description: "A clean, timeless white t-shirt. Perfect for any occasion.",
    colors: [
      { name: "White", hex: "#FFFFFF", price: 24.99 },
      { name: "Black", hex: "#111111", price: 24.99 },
      { name: "Red",   hex: "#CC0000", price: 26.99 },
    ],
  },
  {
    id: 2,
    name: "Midnight Black Tee",
    price: 24.99,
    image: "https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=400&h=400&fit=crop",
    description: "Sleek and bold. The black tee that goes with everything.",
  },
  {
    id: 3,
    name: "PrimeOpp Logo Tee",
    price: 29.99,
    image: "https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=400&fit=crop",
    description: "Rep the brand. Premium quality with our signature logo.",
    colors: [
      { name: "Black",  hex: "#111111", price: 29.99 },
      { name: "White",  hex: "#FFFFFF", price: 29.99 },
      { name: "Navy",   hex: "#1a2744", price: 31.99 },
      { name: "Forest", hex: "#1a3a2a", price: 31.99 },
    ],
  },
  {
    id: 4,
    name: "Essential Grey Tee",
    price: 22.99,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop",
    description: "Soft, comfortable, and versatile. A wardrobe staple.",
  },
];
