import fetch from "node-fetch";

const SHOP = process.env.SHOPIFY_STORE_URL;
const TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;
const API_VERSION = "2024-01";

const TAG_TO_STYLE = {
  beach: "Beach",
  boho: "Boho",
  coquette: "Coquette",
  linen: "Linen",
  nature: "Nature",
  retro: "Retro",
  tropical: "Tropical",
  vintage: "Vintage",
};

const headers = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": TOKEN,
};

async function getAllProducts() {
  let products = [];
  let url = `https://${SHOP}/admin/api/${API_VERSION}/products.json?limit=250`;

  while (url) {
    const res = await fetch(url, { headers });
    const data = await res.json();
    products.push(...data.products);

    const link = res.headers.get("link");
    if (link && link.includes('rel="next"')) {
      url = link.match(/<([^>]+)>/)[1];
    } else {
      url = null;
    }
  }
  return products;
}

async function getExistingStyles(productId) {
  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/products/${productId}/metafields.json?namespace=custom&key=style_new`,
    { headers }
  );
  const data = await res.json();

  if (!data.metafields.length) return [];
  return JSON.parse(data.metafields[0].value);
}

async function updateStyles(productId, values) {
  const body = {
    metafield: {
      namespace: "custom",
      key: "style_new",
      type: "list.single_line_text_field",
      value: JSON.stringify(values),
    },
  };

  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/products/${productId}/metafields.json`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error(`❌ Failed product ${productId}`);
  } else {
    console.log(`✅ Product ${productId}: ${values.join(", ")}`);
  }
}

async function run() {
  const products = await getAllProducts();

  for (const product of products) {
    const tags = product.tags
      .split(",")
      .map(t => t.trim().toLowerCase());

    const matched = Object.entries(TAG_TO_STYLE)
      .filter(([tag]) => tags.includes(tag))
      .map(([, value]) => value);

    if (!matched.length) continue;

    const existing = await getExistingStyles(product.id);
    const finalValues = [...new Set([...existing, ...matched])];

    await updateStyles(product.id, finalValues);
  }
}

run().catch(console.error);
