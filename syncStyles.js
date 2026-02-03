import fetch from "node-fetch";

const SHOP = process.env.SHOP;
const TOKEN = process.env.TOKEN;

// Tags you want to sync → metafield
const ALLOWED_TAGS = [
  "beach",
  "boho",
  "coquette",
  "linen",
  "nature",
  "retro",
  "tropical",
  "vintage"
];

// Map lowercase → Capitalized (optional but clean)
const TAG_MAP = Object.fromEntries(
  ALLOWED_TAGS.map(t => [t.toLowerCase(), t.charAt(0).toUpperCase() + t.slice(1)])
);

const endpoint = `https://${SHOP}/admin/api/2024-10/graphql.json`;

async function shopify(query, variables = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN
    },
    body: JSON.stringify({ query, variables })
  });
  return res.json();
}

async function run() {
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query ($cursor: String) {
        products(first: 100, after: $cursor) {
          pageInfo { hasNextPage }
          edges {
            cursor
            node {
              id
              tags
              metafield(namespace: "custom", key: "style_new") {
                value
              }
            }
          }
        }
      }
    `;

    const res = await shopify(query, { cursor });
    const edges = res.data.products.edges;

    for (const { node } of edges) {
      // normalize product tags
      const matched = node.tags
        .map(t => t.trim().toLowerCase())
        .filter(t => TAG_MAP[t])
        .map(t => TAG_MAP[t]);

      if (!matched.length) continue;

      let existing = [];
      if (node.metafield?.value) {
        try {
          existing = JSON.parse(node.metafield.value);
        } catch {
          existing = [];
        }
      }

      const merged = [...new Set([...existing, ...matched])];

      // nothing changed → skip
      if (merged.length === existing.length) continue;

      const mutation = `
        mutation ($input: MetafieldsSetInput!) {
          metafieldsSet(metafields: [$input]) {
            userErrors { message }
          }
        }
      `;

      await shopify(mutation, {
        input: {
          ownerId: node.id,
          namespace: "custom",
          key: "style_new",
          type: "list.single_line_text_field",
          value: JSON.stringify(merged)
        }
      });

      console.log(`Updated product ${node.id}:`, merged);
    }

    hasNextPage = res.data.products.pageInfo.hasNextPage;
    cursor = edges.at(-1)?.cursor;
  }

  console.log("✅ Style sync completed");
}

run();
