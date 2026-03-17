// This file holds all our product data
// Think of it like a mini database stored right in the code!

// Define what a Product looks like using TypeScript
export interface Product {
  id: number;       // A unique number for each product
  name: string;     // The product name
  price: number;    // The price in dollars
  image: string;    // A URL to the product image
  description: string; // A short description
}

// Our list of t-shirt products
export const products: Product[] = [
  {
    id: 1,
    name: "Classic White Tee",
    price: 24.99,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop",
    description: "A clean, timeless white t-shirt. Perfect for any occasion.",
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
  },
  {
    id: 4,
    name: "Essential Grey Tee",
    price: 22.99,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=400&fit=crop",
    description: "Soft, comfortable, and versatile. A wardrobe staple.",
  },
];
