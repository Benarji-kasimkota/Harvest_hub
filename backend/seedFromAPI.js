const mongoose = require('mongoose');
const dotenv = require('dotenv');
const https = require('https');
const Product = require('./models/Product');

dotenv.config();

const fetchProducts = (category, searchTerm) => {
  return new Promise((resolve, reject) => {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${searchTerm}&search_simple=1&action=process&json=1&page_size=6&fields=product_name,image_url,ingredients_text,nutriments`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const products = (json.products || [])
            .filter(p => p.product_name && p.image_url)
            .slice(0, 4)
            .map(p => ({
              name: p.product_name.slice(0, 50),
              description: p.ingredients_text
                ? `Ingredients: ${p.ingredients_text.slice(0, 150)}...`
                : `Fresh ${category} product sourced from local farms.`,
              price: parseFloat((Math.random() * 10 + 1.5).toFixed(2)),
              category,
              image: p.image_url,
              stock: Math.floor(Math.random() * 150) + 20,
              unit: category === 'dairy' ? 'litre' : category === 'meat' ? 'kg' : 'kg',
              farmer: ['Green Valley Farm', 'Sunrise Organics', 'Local Harvest', 'Farm Fresh Co', 'Nature\'s Best'][Math.floor(Math.random() * 5)],
              featured: Math.random() > 0.5,
              rating: parseFloat((4 + Math.random()).toFixed(1))
            }));
          resolve(products);
        } catch (e) { resolve([]); }
      });
      res.on('error', () => resolve([]));
    }).on('error', () => resolve([]));
  });
};

// Fallback hardcoded products in case API fails
const fallbackProducts = [
  { name: 'Fresh Broccoli', description: 'Crisp farm-fresh broccoli packed with vitamins. Perfect for stir-fries and salads.', price: 2.99, category: 'vegetables', image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&q=80', stock: 100, unit: 'kg', farmer: 'Green Valley Farm', featured: true, rating: 4.8 },
  { name: 'Organic Tomatoes', description: 'Sun-ripened organic tomatoes bursting with flavor. No pesticides, no GMOs.', price: 3.49, category: 'vegetables', image: 'https://images.unsplash.com/photo-1546470427-e26264be0b0d?w=500&q=80', stock: 80, unit: 'kg', farmer: 'Sunrise Organics', featured: true, rating: 4.9 },
  { name: 'Sweet Carrots', description: 'Naturally sweet crunchy carrots. Rich in beta-carotene, perfect for snacking.', price: 1.99, category: 'vegetables', image: 'https://images.unsplash.com/photo-1445282768818-728615cc910a?w=500&q=80', stock: 150, unit: 'kg', farmer: 'Root & Soil Farm', featured: true, rating: 4.6 },
  { name: 'Baby Spinach', description: 'Tender baby spinach leaves packed with iron and antioxidants.', price: 2.49, category: 'vegetables', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=500&q=80', stock: 60, unit: 'bunch', farmer: 'Green Valley Farm', featured: true, rating: 4.7 },
  { name: 'Red Apples', description: 'Crisp sweet red apples from mountain orchards. Hand-picked at peak ripeness.', price: 4.99, category: 'fruits', image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=500&q=80', stock: 200, unit: 'kg', farmer: 'Mountain Orchards', featured: true, rating: 4.9 },
  { name: 'Fresh Strawberries', description: 'Plump juicy strawberries picked at peak ripeness. Perfect fresh or in desserts.', price: 5.99, category: 'fruits', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=500&q=80', stock: 50, unit: 'punnet', farmer: 'Berry Best Farm', featured: true, rating: 4.9 },
  { name: 'Ripe Bananas', description: 'Naturally ripened yellow bananas, rich in potassium. Perfect for smoothies.', price: 1.49, category: 'fruits', image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=500&q=80', stock: 120, unit: 'bunch', farmer: 'Tropical Farms', featured: true, rating: 4.5 },
  { name: 'Fresh Mangoes', description: 'Luscious golden mangoes at perfect ripeness. Intensely sweet tropical flavor.', price: 6.99, category: 'fruits', image: 'https://images.unsplash.com/photo-1605027990121-cbae9e0642df?w=500&q=80', stock: 70, unit: 'kg', farmer: 'Tropical Farms', featured: true, rating: 4.8 },
  { name: 'Chicken Breast', description: 'Free-range chicken breast, hormone-free. Lean and tender, perfect for grilling.', price: 8.99, category: 'meat', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=500&q=80', stock: 40, unit: 'kg', farmer: 'Happy Hen Farm', featured: true, rating: 4.8 },
  { name: 'Beef Mince', description: 'Premium grass-fed ground beef, extra lean. Perfect for burgers and bolognese.', price: 12.99, category: 'meat', image: 'https://images.unsplash.com/photo-1588347818481-05b9c9e44370?w=500&q=80', stock: 30, unit: 'kg', farmer: 'Grassland Beef Co', featured: true, rating: 4.7 },
  { name: 'Lamb Chops', description: 'Tender succulent lamb chops from free-range pasture-raised sheep.', price: 15.99, category: 'meat', image: 'https://images.unsplash.com/photo-1529693662653-9d480da3dc47?w=500&q=80', stock: 25, unit: 'kg', farmer: 'Green Pastures', featured: true, rating: 4.9 },
  { name: 'Full Cream Milk', description: 'Fresh full cream milk from grass-fed cows. Rich creamy taste, no additives.', price: 3.99, category: 'dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&q=80', stock: 100, unit: 'litre', farmer: 'Meadow Fresh Dairy', featured: true, rating: 4.7 },
  { name: 'Greek Yogurt', description: 'Thick creamy Greek-style yogurt packed with protein and live probiotic cultures.', price: 4.49, category: 'dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&q=80', stock: 70, unit: 'tub', farmer: 'Meadow Fresh Dairy', featured: true, rating: 4.6 },
  { name: 'Aged Cheddar', description: 'Artisan-aged cheddar with sharp complex flavor. Made from raw whole milk.', price: 6.99, category: 'dairy', image: 'https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=500&q=80', stock: 45, unit: 'block', farmer: 'Artisan Cheese Co', featured: true, rating: 4.8 },
  { name: 'Basmati Rice', description: 'Premium long-grain basmati rice with delicate floral aroma. Aged 2 years.', price: 5.99, category: 'grains', image: 'https://images.unsplash.com/photo-1536304993881-ff86e0c9e14e?w=500&q=80', stock: 200, unit: 'kg', farmer: 'Golden Fields', featured: false, rating: 4.6 },
  { name: 'Whole Wheat Flour', description: 'Stone-ground whole wheat flour, high in fiber. Perfect for breads and baking.', price: 3.49, category: 'grains', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=500&q=80', stock: 150, unit: 'kg', farmer: 'Mill & Stone Farm', featured: false, rating: 4.5 },
];

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('🔄 Fetching products from Open Food Facts API...');
    
    const [vegProducts, fruitProducts] = await Promise.all([
      fetchProducts('vegetables', 'fresh+vegetables'),
      fetchProducts('fruits', 'fresh+fruits'),
    ]);

    const apiProducts = [...vegProducts, ...fruitProducts];
    
    let finalProducts;
    if (apiProducts.length > 4) {
      console.log(`✅ Got ${apiProducts.length} products from API!`);
      // Merge API products with our fallback for meat/dairy/grains
      const meatDairyGrains = fallbackProducts.filter(p => 
        ['meat','dairy','grains'].includes(p.category)
      );
      finalProducts = [...apiProducts, ...meatDairyGrains];
    } else {
      console.log('⚠️  API unavailable, using curated product data...');
      finalProducts = fallbackProducts;
    }

    await Product.deleteMany({});
    await Product.insertMany(finalProducts);
    console.log(`✅ Database seeded with ${finalProducts.length} products!`);
    process.exit();
  })
  .catch(err => { console.error(err); process.exit(1); });
