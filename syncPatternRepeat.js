import fetch from "node-fetch";

const SHOP = process.env.SHOP;
const TOKEN = process.env.TOKEN;

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
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              title
              descriptionHtml

              metafield(namespace: "custom", key: "pattern_repeat") {
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

      if (!node.descriptionHtml) {
        continue;
      }

      // Match:
      // <p>Repeat: 28”</p>
      // <p>Repeat: 18.75"</p>

      const match = node.descriptionHtml.match(
        /<p>\s*Repeat:\s*([^<]+)<\/p>/i
      );

      if (!match) {
        continue;
      }

      const repeatValue = match[1].trim();

      const existingValue =
        node.metafield?.value?.trim() || "";

      if (existingValue === repeatValue) {
        continue;
      }

      console.log(
        `Updating ${node.title}: ${repeatValue}`
      );

      const mutation = `
        mutation ($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const result = await shopify(mutation, {
        metafields: [
          {
            ownerId: node.id,
            namespace: "custom",
            key: "pattern_repeat",
            type: "single_line_text_field",
            value: repeatValue
          }
        ]
      });

      const errors =
        result?.data?.metafieldsSet?.userErrors || [];

      if (errors.length) {
        console.log(errors);
      }
    }

    hasNextPage =
      res.data.products.pageInfo.hasNextPage;

    cursor = edges.at(-1)?.cursor;
  }
}

run();
