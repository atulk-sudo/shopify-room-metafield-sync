import fetch from "node-fetch";

const SHOP = process.env.SHOP;
const TOKEN = process.env.TOKEN;

const ALLOWED_TAGS = [
  "Bathroom", "Bedroom", "Ceiling", "Dining", "Hallway",
  "Kids", "Kitchen", "Living", "Nursery", "Office"
];

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
              metafield(namespace: "custom", key: "room") {
                id
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
      const matched = node.tags.filter(t => ALLOWED_TAGS.includes(t));

      let existing = [];
      if (node.metafield?.value) {
        existing = JSON.parse(node.metafield.value);
      }

      const merged = [...new Set([...existing, ...matched])];
      if (merged.length === 0) continue;

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
          key: "room",
          type: "list.single_line_text_field",
          value: JSON.stringify(merged)
        }
      });
    }

    hasNextPage = res.data.products.pageInfo.hasNextPage;
    cursor = edges.at(-1)?.cursor;
  }
}

run();
