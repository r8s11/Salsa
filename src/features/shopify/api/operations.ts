const IMAGE_FIELDS = `
  url
  altText
  width
  height
`;

const MONEY_FIELDS = `
  amount
  currencyCode
`;

const VARIANT_FIELDS = `
  id
  title
  availableForSale
  price { ${MONEY_FIELDS} }
  compareAtPrice { ${MONEY_FIELDS} }
  image { ${IMAGE_FIELDS} }
  selectedOptions { name value }
`;

const CART_LINES_FIELDS = `
  nodes {
    id
    quantity
    cost { totalAmount { ${MONEY_FIELDS} } }
    merchandise {
      ... on ProductVariant {
        id
        title
        availableForSale
        image { ${IMAGE_FIELDS} }
        selectedOptions { name value }
        product { title handle }
      }
    }
  }
  pageInfo { hasNextPage endCursor }
`;

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost { subtotalAmount { ${MONEY_FIELDS} } totalAmount { ${MONEY_FIELDS} } }
  lines(first: 250) { ${CART_LINES_FIELDS} }
`;

export const PRODUCTS_QUERY = `
  query Products($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        handle
        title
        featuredImage { ${IMAGE_FIELDS} }
        priceRange { minVariantPrice { ${MONEY_FIELDS} } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!, $first: Int!) {
    product(handle: $handle) {
      id
      handle
      title
      description
      featuredImage { ${IMAGE_FIELDS} }
      images(first: $first) {
        nodes { ${IMAGE_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
      priceRange { minVariantPrice { ${MONEY_FIELDS} } }
      variants(first: $first) {
        nodes { ${VARIANT_FIELDS} }
        pageInfo { hasNextPage endCursor }
      }
  }
  }
`;

export const PRODUCT_VARIANTS_QUERY = `
  query ProductVariants($id: ID!, $first: Int!, $after: String) {
    node(id: $id) {
      ... on Product {
        variants(first: $first, after: $after) {
          nodes { ${VARIANT_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

export const PRODUCT_IMAGES_QUERY = `
  query ProductImages($id: ID!, $first: Int!, $after: String) {
    node(id: $id) {
      ... on Product {
        images(first: $first, after: $after) {
          nodes { ${IMAGE_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

export const CART_QUERY = `
  query Cart($id: ID!) {
    cart(id: $id) { ${CART_FIELDS} }
  }
`;

export const CART_LINES_QUERY = `
  query CartLines($id: ID!, $after: String!) {
    cart(id: $id) {
      lines(first: 250, after: $after) { ${CART_LINES_FIELDS} }
    }
  }
`;

export const CART_CREATE_MUTATION = `
  mutation CartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
      warnings { code message target }
    }
  }
`;

export const CART_LINES_ADD_MUTATION = `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
      warnings { code message target }
    }
  }
`;

export const CART_LINES_UPDATE_MUTATION = `
  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
    cartLinesUpdate(cartId: $cartId, lines: $lines) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
      warnings { code message target }
    }
  }
`;

export const CART_LINES_REMOVE_MUTATION = `
  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
      cart { ${CART_FIELDS} }
      userErrors { field message code }
      warnings { code message target }
    }
  }
`;
