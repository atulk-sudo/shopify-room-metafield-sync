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

    const linkHeader = res.headers.get("link");
    if (linkHeader && linkHeader.includes('rel="next"')) {
      url = linkHeader
        .split(",")
        .find(l => l.includes('rel="next"'))
        .match(/<([^>]+)>/)[1];
    } else {
      url = null;
    }
  }

  return products;
}

async function updateMetafield(productId, values) {
  const body = {
    metafield: {
      namespace: "custom",
      key: "style_new",
      type: "single_line_text_field",
      value: values.join(","),
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
    console.error(`❌ Failed updating product ${productId}`);
  } else {
    console.log(`✅ Updated product ${productId}: ${values.join(", ")}`);
  }
}

async function run() {
  const products = await getAllProducts();

  for (const product of products) {
    const tags = product.tags
      .split(",")
      .map(t => t.trim().toLowerCase());

    const matchedStyles = Object.entries(TAG_TO_STYLE)
      .filter(([tag]) => tags.includes(tag))
      .map(([, value]) => value);

    if (matchedStyles.length === 0) continue;

    // Get existing metafield values
    const mfRes = await fetch(
      `https://${SHOP}/admin/api/${API_VERSION}/products/${product.id}/metafields.json?namespace=custom&key=style_new`,
      { headers }
    );
    const mfData = await mfRes.json();

    let existingValues = [];
    if (mfData.metafields.length > 0) {
      existingValues = mfData.metafields[0].value
        .split(",")
        .map(v => v.trim());
    }

    const finalValues = [
      ...new Set([...existingValues, ...matchedStyles]),
    ];

    await updateMetafield(product.id, finalValues);
  }
}

run().catch(console.error);
